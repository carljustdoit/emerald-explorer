import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, List, Map as MapIcon, Edit2, Trash2, Eye, X, ChevronUp, ChevronDown, Calendar, Tag, Link as LinkIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [sources, setSources] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showFutureOnly, setShowFutureOnly] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showJson, setShowJson] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [scrapeProgress, setScrapeProgress] = useState({ progress: 0, source: '', message: '', logs: [] });
  const [showScrapeLog, setShowScrapeLog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [sortField, setSortField] = useState('start_time');
  const [sortDir, setSortDir] = useState('asc');
  const [displayCount, setDisplayCount] = useState(50);
  
  // Scraper configuration states
  const [isScraperConfigOpen, setIsScraperConfigOpen] = useState(false);
  const [selectedSources, setSelectedSources] = useState({});
  const [scrapeMode, setScrapeMode] = useState('overwrite'); // 'overwrite' or 'append'

  async function getAuthHeaders() {
    if (!user) return {};
    const token = await user.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async function loadData() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [eventsRes, sourcesRes, tagsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/events`, { headers }),
        fetch(`${API_BASE}/admin/sources`, { headers }),
        fetch(`${API_BASE}/tags`),
      ]);
      
      const eventsData = await eventsRes.json();
      const sourcesData = await sourcesRes.json();
      const tagsData = await tagsRes.json();
      
      setEvents(eventsData.events);
      setSources(sourcesData.sources);
      setTags(tagsData.tags);

      // Initialize selected sources based on enabled status
      const initialSelected = {};
      sourcesData.sources.forEach(s => {
        initialSelected[s.name] = true; // Default all to true
      });
      setSelectedSources(initialSelected);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    let liveEventsSource;
    async function initSSE() {
      const token = await user.getIdToken();
      liveEventsSource = new EventSource(`${API_BASE}/admin/live-events?token=${token}`);
      
      liveEventsSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        
        if (data.type === 'init') {
          if (data.events && data.events.length > 0) {
            setEvents(data.events);
          }
        } else if (data.type === 'event') {
          setEvents(prev => {
            if (prev.find(e => e.id === data.event.id)) return prev;
            return [...prev, data.event];
          });
        }
      };
      
      liveEventsSource.onerror = (err) => console.error('Live events SSE error:', err);
    }
    
    initSSE();
    return () => liveEventsSource?.close();
  }, [user]);

  // Persistent Scrape Stream Connection
  useEffect(() => {
    if (!user) return;

    let eventSource;
    async function initSSE() {
      const token = await user.getIdToken();
      eventSource = new EventSource(`${API_BASE}/admin/scrape/stream?token=${token}`);
      
      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        setScrapeProgress(data);
        
        if (data.progress === 100 || data.message.includes('completed')) {
          setScrapeStatus('success');
          setTimeout(() => setScrapeStatus(null), 2000);
        } else if (data.message.includes('failed') || data.message.includes('Failed')) {
          setScrapeStatus('error');
        } else if (data.message !== 'Idle' && data.progress >= 0 && data.progress < 100) {
          setScrapeStatus(prev => {
            if (prev !== 'running') {
              setShowScrapeLog(true);
              return 'running';
            }
            return prev;
          });
        }
      };
      
      eventSource.onerror = (err) => console.error('Scrape SSE error:', err);
    }

    initSSE();
    return () => eventSource?.close();
  }, [user]);

  async function handleScrape() {
    setScrapeStatus('running');
    setScrapeProgress({ progress: 0, source: 'Starting...', message: 'Connecting to scrape server...', logs: [] });
    setShowScrapeLog(true);
    setEvents([]);
    
    const sourcesToRun = Object.entries(selectedSources)
      .filter(([_, isSelected]) => isSelected)
      .map(([name]) => name);

    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE}/admin/scrape`, { 
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          sources: sourcesToRun.length > 0 ? sourcesToRun : undefined,
          mode: scrapeMode 
        })
      });
    } catch {
      setScrapeStatus('error');
    }
  }

  async function handleDeleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE}/admin/events/${id}`, { 
        method: 'DELETE',
        headers
      });
      loadData();
      setSelectedEvent(null);
    } catch {
      alert('Failed to delete event');
    }
  }

  async function handleSaveEvent() {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE}/admin/events/${editingEvent.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(editingEvent),
      });
      setEditingEvent(null);
      loadData();
      setSelectedEvent(null);
    } catch {
      alert('Failed to save event');
    }
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const filteredEvents = useMemo(() => {
    let result = events.filter(e => {
      if (showFutureOnly) {
        const eventDate = new Date(e.start_time);
        const now = new Date();
        if (eventDate < now) return false;
      }
      if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && 
          !e.description?.toLowerCase().includes(search.toLowerCase())) return false;
      if (sourceFilter && e.source !== sourceFilter) return false;
      if (tagFilter && !e.vibe_tags?.includes(tagFilter)) return false;
      return true;
    });

    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'start_time') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [events, search, sourceFilter, tagFilter, showFutureOnly, sortField, sortDir]);

  const displayEvents = filteredEvents.slice(0, displayCount);

  const totalEvents = events.length;
  const totalSources = sources.length;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="header-top">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Manage scraped events and data sources</p>
          </div>
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List size={18} />
            </button>
            <button 
              className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
              onClick={() => setViewMode('map')}
              title="Map view"
            >
              <MapIcon size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card glass">
          <div className="stat-label">Total Events</div>
          <div className="stat-value">{totalEvents}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-label">Sources</div>
          <div className="stat-value">{totalSources}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-label">Tags</div>
          <div className="stat-value">{tags.length}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-label">Scrape Status</div>
          <div className="stat-value" style={{ color: scrapeStatus === 'running' ? '#ffa500' : scrapeStatus === 'success' ? '#4caf50' : scrapeStatus === 'error' ? '#f44336' : 'inherit' }}>
            {scrapeStatus === 'running' ? `${scrapeProgress.progress}%` : (scrapeStatus || 'Idle')}
          </div>
        </div>
      </div>

      {scrapeStatus === 'running' && (
        <div className="scrape-progress glass">
          <div className="progress-header">
            <span className="progress-source">{scrapeProgress.source}</span>
            <span className="progress-message">{scrapeProgress.message}</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${scrapeProgress.progress}%` }}></div>
          </div>
          <button className="log-toggle" onClick={() => setShowScrapeLog(!showScrapeLog)}>
            {showScrapeLog ? '▼ Hide Logs' : '▶ Show Logs'}
          </button>
          {showScrapeLog && (
            <div className="scrape-log">
              {scrapeProgress.logs.map((log, i) => (
                <div key={i} className="log-line">{log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="scraper-config glass">
        <div 
          className="config-header" 
          onClick={() => setIsScraperConfigOpen(!isScraperConfigOpen)}
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h3 className="config-title" style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>Scraper Configuration</h3>
          <span className="collapse-icon" style={{ 
            transform: isScraperConfigOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease'
          }}>▼</span>
        </div>
        
        {isScraperConfigOpen && (
          <div className="config-content" style={{ marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '24px' }}>
            <div className="config-section">
              <h4>Data Connectors</h4>
              <div className="source-toggles">
                {sources.length > 0 ? sources.map(source => (
                   <label key={source.name} className="source-toggle">
                     <input 
                       type="checkbox" 
                       checked={selectedSources[source.name] || false}
                       onChange={(e) => setSelectedSources(prev => ({
                         ...prev,
                         [source.name]: e.target.checked
                       }))}
                     />
                     <span>{source.name}</span>
                   </label>
                )) : <span className="text-muted">Loading connectors...</span>}
                <div className="toggle-actions">
                   <button type="button" onClick={() => {
                     const allTrue = {};
                     sources.forEach(s => allTrue[s.name] = true);
                     setSelectedSources(allTrue);
                   }}>Select All</button>
                   <button type="button" onClick={() => setSelectedSources({})}>Deselect All</button>
                </div>
              </div>
            </div>

            <div className="config-section">
              <h4>Merge Mode</h4>
              <div className="mode-options">
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="scrapeMode" 
                    value="overwrite"
                    checked={scrapeMode === 'overwrite'}
                    onChange={(e) => setScrapeMode(e.target.value)}
                  />
                  <span><strong>Overwrite:</strong> Clears the current master feed and replaces it entirely with newly scraped data. Best for daily resets.</span>
                </label>
                <label className="radio-label">
                  <input 
                    type="radio" 
                    name="scrapeMode" 
                    value="append"
                    checked={scrapeMode === 'append'}
                    onChange={(e) => setScrapeMode(e.target.value)}
                  />
                  <span><strong>Append:</strong> Merges new events with the existing master feed. Existing manual edits might get overwritten if the same event matches a deduplication key.</span>
                </label>
              </div>
            </div>

            <div className="actions-bar no-margin">
              <button 
                onClick={handleScrape}
                disabled={scrapeStatus === 'running' || Object.values(selectedSources).every(v => !v)}
                className={`scrape-btn ${scrapeStatus === 'running' ? 'running' : ''}`}
              >
                {scrapeStatus === 'running' ? 'Scraping...' : 'Run Scrape'}
              </button>
              <button onClick={loadData} className="refresh-btn">
                Refresh Data
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Events ({filteredEvents.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          Sources
        </button>
      </div>

      {activeTab === 'events' && (
        <div className="events-section">
          <div className="filters-bar glass">
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            <select 
              value={sourceFilter} 
              onChange={(e) => setSourceFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Sources</option>
              {sources.map(s => (
                <option key={s.name} value={s.name}>{s.name} ({s.count})</option>
              ))}
            </select>
            <select 
              value={tagFilter} 
              onChange={(e) => setTagFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Tags</option>
              {tags.map(t => (
                <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
              ))}
            </select>
            <label className="future-toggle">
              <input 
                type="checkbox" 
                checked={showFutureOnly}
                onChange={(e) => setShowFutureOnly(e.target.checked)}
              />
              <span>Upcoming only</span>
            </label>
          </div>

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : viewMode === 'list' ? (
            <div className="events-table-container glass">
              <table className="events-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('title')} className="sortable">
                      Event {sortField === 'title' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </th>
                    <th onClick={() => handleSort('source')} className="sortable">
                      Source {sortField === 'source' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </th>
                    <th onClick={() => handleSort('start_time')} className="sortable">
                      Date {sortField === 'start_time' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </th>
                    <th>Location</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayEvents.map(event => (
                    <tr key={event.id}>
                      <td className="event-cell">
                        <div className="event-title" title={event.title}>{event.title}</div>
                        {event.image && (
                          <img 
                            src={event.image} 
                            alt="" 
                            className="event-thumb"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                      </td>
                      <td>
                        <span className="source-badge" title={event.source}>{event.source}</span>
                      </td>
                      <td className="date-cell">
                        {new Date(event.start_time).toLocaleDateString()}
                      </td>
                      <td className="location-cell" title={event.location?.name}>
                        {event.location?.name || 'N/A'}
                      </td>
                      <td>
                        <button onClick={() => setSelectedEvent(event)} className="icon-btn" title="View">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayCount < filteredEvents.length && (
                <div className="load-more">
                  <button onClick={() => setDisplayCount(displayCount + 50)}>
                    Load More ({filteredEvents.length - displayCount} more)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="map-view glass">
              {(() => {
                const eventsWithCoords = displayEvents.filter(e => e.location?.lat && (e.location?.lng || e.location?.lon));
                const eventsWithoutCoords = displayEvents.filter(e => !e.location?.lat || (!e.location?.lng && !e.location?.lon));
                
                return (
                  <>
                    <div className="map-container-wrapper">
                      <MapContainer 
                        center={[47.6062, -122.3321]} 
                        zoom={11} 
                        style={{ height: '600px', width: '100%', borderRadius: '12px' }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {eventsWithCoords.map(event => (
                          <Marker 
                            key={event.id} 
                            position={[event.location.lat, event.location.lng || event.location.lon]}
                            eventHandlers={{
                              click: () => setSelectedEvent(event),
                            }}
                          >
                            <Popup>
                              <div style={{ minWidth: '150px' }}>
                                <strong>{event.title}</strong><br/>
                                {event.location?.name}<br/>
                                {new Date(event.start_time).toLocaleDateString()}
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                    {eventsWithoutCoords.length > 0 && (
                      <div className="map-events-no-coords">
                        <p className="map-hint">{eventsWithoutCoords.length} events without location data:</p>
                        <div className="map-events">
                          {eventsWithoutCoords.slice(0, 20).map(event => (
                            <div 
                              key={event.id} 
                              className="map-event-card glass"
                              onClick={() => setSelectedEvent(event)}
                            >
                              <div className="map-event-title">{event.title}</div>
                              <div className="map-event-meta">
                                <Calendar size={12} /> {new Date(event.start_time).toLocaleDateString()}
                              </div>
                              <div className="map-event-meta">
                                <MapPin size={12} /> {event.location?.name || 'Seattle'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="sources-grid">
          {sources.map(source => (
            <div key={source.name} className="source-card glass">
              <div className="source-name">{source.name}</div>
              <div className="source-count">{source.count} events</div>
              <div className="source-status">Active</div>
            </div>
          ))}
        </div>
      )}

      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent.title}</h2>
              <div className="modal-actions-header">
                <button onClick={() => setSelectedEvent(selectedEvent)} className="icon-btn" title="Edit">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => handleDeleteEvent(selectedEvent.id)} className="icon-btn danger" title="Delete">
                  <Trash2 size={18} />
                </button>
                <button onClick={() => setSelectedEvent(null)} className="icon-btn">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            {selectedEvent.image && (
              <img 
                src={selectedEvent.image} 
                alt={selectedEvent.title}
                className="modal-image"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}

            <div className="detail-tabs">
              <button 
                className={`detail-tab ${!showJson ? 'active' : ''}`}
                onClick={() => setShowJson(false)}
              >
                Details
              </button>
              <button 
                className={`detail-tab ${showJson ? 'active' : ''}`}
                onClick={() => setShowJson(true)}
              >
                Raw JSON
              </button>
            </div>

            {!showJson ? (
              <div className="detail-content">
                <div className="detail-grid">
                  <DetailRow label="Source" value={selectedEvent.source} />
                  <DetailRow label="Date" value={new Date(selectedEvent.start_time).toLocaleString()} />
                  <DetailRow label="Location" value={selectedEvent.location?.name || 'N/A'} />
                  <DetailRow label="Description" value={selectedEvent.description || 'N/A'} />
                  <DetailRow label="Tags" value={selectedEvent.vibe_tags?.join(', ') || 'None'} />
                  <DetailRow label="Kid Friendly" value={selectedEvent.is_kid_friendly ? 'Yes' : 'No'} />
                  {selectedEvent.url && <DetailRow label="URL" value={selectedEvent.url} isLink icon={<LinkIcon size={12} />} />}
                  {selectedEvent.ticket_url && <DetailRow label="Ticket URL" value={selectedEvent.ticket_url} isLink icon={<LinkIcon size={12} />} />}
                  {selectedEvent.image && <DetailRow label="Image URL" value={selectedEvent.image} isLink icon={<LinkIcon size={12} />} />}
                </div>
              </div>
            ) : (
              <pre className="json-content">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {editingEvent && (
        <div className="modal-overlay" onClick={() => setEditingEvent(null)}>
          <div className="modal-content glass edit-modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Event</h2>
            
            <div className="edit-form">
              <div className="form-group">
                <label>Title</label>
                <input 
                  type="text" 
                  value={editingEvent.title || ''} 
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={editingEvent.description || ''} 
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Date (ISO)</label>
                <input 
                  type="text" 
                  value={editingEvent.start_time || ''} 
                  onChange={(e) => setEditingEvent({ ...editingEvent, start_time: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Location Name</label>
                <input 
                  type="text" 
                  value={editingEvent.location?.name || ''} 
                  onChange={(e) => setEditingEvent({ ...editingEvent, location: { ...editingEvent.location, name: e.target.value } })}
                />
              </div>

              <div className="form-group">
                <label>Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={editingEvent.vibe_tags?.join(', ') || ''} 
                  onChange={(e) => setEditingEvent({ ...editingEvent, vibe_tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                />
              </div>

              <div className="form-group">
                <label>URL</label>
                <input 
                  type="text" 
                  value={editingEvent.url || ''} 
                  onChange={(e) => setEditingEvent({ ...editingEvent, url: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input 
                  type="text" 
                  value={editingEvent.image || ''} 
                  onChange={(e) => setEditingEvent({ ...editingEvent, image: e.target.value })}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={handleSaveEvent} className="save-btn">Save Changes</button>
              <button onClick={() => setEditingEvent(null)} className="close-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-page {
          padding: 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .view-toggle {
          display: flex;
          gap: 4px;
          background: rgba(0,0,0,0.05);
          padding: 4px;
          border-radius: var(--radius-lg);
        }

        .solo-mode .view-toggle {
          background: rgba(255,255,255,0.1);
        }

        .view-btn {
          padding: 8px 12px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          color: var(--text-muted);
          transition: var(--transition-smooth);
        }

        .view-btn.active {
          background: var(--accent-primary);
          color: white;
        }

        .solo-mode .view-btn.active {
          background: var(--solo-accent);
          color: #000;
        }

        .admin-header {
          margin-bottom: 24px;
        }

        .admin-header h1 {
          font-family: var(--font-header);
          font-size: 32px;
          font-weight: 500;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }

        .admin-header p {
          color: var(--text-muted);
          font-size: 15px;
        }

        .solo-mode .admin-header p {
          color: var(--solo-text-muted);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-card {
          padding: 20px;
          border-radius: var(--radius-lg);
        }

        .stat-label {
          color: var(--text-muted);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .solo-mode .stat-label {
          color: var(--solo-text-muted);
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          font-family: var(--font-header);
        }

        .scraper-config {
          padding: 24px;
          border-radius: var(--radius-xl);
          margin-bottom: 24px;
        }

        .config-title {
          font-family: var(--font-header);
          font-size: 20px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--glass-border);
        }

        .config-section {
          margin-bottom: 24px;
        }

        .config-section h4 {
          margin-bottom: 12px;
          color: var(--text-muted);
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .solo-mode .config-section h4 {
          color: var(--solo-text-muted);
        }

        .source-toggles {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }

        .source-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0,0,0,0.03);
          padding: 8px 16px;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .solo-mode .source-toggle {
          background: rgba(255,255,255,0.05);
        }

        .source-toggle:hover {
          background: rgba(0,0,0,0.05);
        }
        
        .solo-mode .source-toggle:hover {
          background: rgba(255,255,255,0.08);
        }

        .source-toggle input[type="checkbox"] {
          accent-color: var(--accent-primary);
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        
        .solo-mode .source-toggle input[type="checkbox"] {
          accent-color: var(--solo-accent);
        }

        .toggle-actions {
          display: flex;
          gap: 8px;
          margin-left: 12px;
        }

        .toggle-actions button {
          background: none;
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 6px 12px;
          font-size: 12px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .toggle-actions button:hover {
          background: var(--accent-soft);
          color: var(--accent-primary);
          border-color: transparent;
        }

        .mode-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .radio-label {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          padding: 12px;
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          transition: var(--transition-smooth);
        }

        .radio-label:hover {
          background: rgba(0,0,0,0.01);
        }

        .solo-mode .radio-label:hover {
          background: rgba(255,255,255,0.02);
        }

        .radio-label input[type="radio"] {
          margin-top: 4px;
          accent-color: var(--accent-primary);
          width: 18px;
          height: 18px;
        }
        
        .solo-mode .radio-label input[type="radio"] {
          accent-color: var(--solo-accent);
        }

        .radio-label span {
          color: var(--text-muted);
          font-size: 14px;
          line-height: 1.5;
        }
        
        .solo-mode .radio-label span {
          color: var(--solo-text-muted);
        }

        .radio-label strong {
          color: var(--text-strong);
        }

        .solo-mode .radio-label strong {
          color: var(--solo-text-strong);
        }

        .actions-bar {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-radius: var(--radius-lg);
          margin-bottom: 24px;
        }
        
        .actions-bar.no-margin {
          margin-bottom: 0;
          padding-left: 0;
          padding-right: 0;
          padding-bottom: 0;
        }

        .scrape-btn, .refresh-btn {
          padding: 12px 24px;
          border-radius: var(--radius-lg);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: var(--transition-smooth);
        }

        .scrape-btn {
          background: var(--accent-primary);
          color: white;
        }

        .scrape-btn.running {
          background: #ffa500;
          cursor: not-allowed;
        }

        .scrape-btn:hover:not(.running) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .refresh-btn {
          background: rgba(0,0,0,0.05);
          color: var(--text-strong);
        }

        .solo-mode .refresh-btn {
          background: rgba(255,255,255,0.1);
          color: var(--solo-text-strong);
        }

        .scrape-progress {
          margin-bottom: 24px;
          padding: 16px;
          border-radius: var(--radius-lg);
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .progress-source {
          font-weight: 600;
          color: var(--accent-primary);
        }

        .progress-message {
          color: var(--text-muted);
          font-size: 13px;
        }

        .progress-bar-container {
          height: 8px;
          background: rgba(0,0,0,0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-primary), #00d4aa);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .log-toggle {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 13px;
          padding: 0;
        }

        .log-toggle:hover {
          color: var(--text-strong);
        }

        .scrape-log {
          margin-top: 12px;
          padding: 12px;
          background: rgba(0,0,0,0.05);
          border-radius: var(--radius-md);
          max-height: 200px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 12px;
        }

        .log-line {
          padding: 2px 0;
          color: var(--text-muted);
        }

        .solo-mode .progress-bar-container {
          background: rgba(255,255,255,0.1);
        }

        .solo-mode .scrape-log {
          background: rgba(0,0,0,0.2);
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 0;
        }

        .tab-btn {
          padding: 14px 20px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          transition: var(--transition-smooth);
          margin-bottom: -1px;
        }

        .tab-btn:hover {
          color: var(--text-strong);
        }

        .tab-btn.active {
          color: var(--accent-primary);
          border-bottom-color: var(--accent-primary);
        }

        .solo-mode .tab-btn {
          color: var(--solo-text-muted);
        }

        .solo-mode .tab-btn:hover {
          color: var(--solo-text-strong);
        }

        .solo-mode .tab-btn.active {
          color: var(--solo-accent);
          border-bottom-color: var(--solo-accent);
        }

        .filters-bar {
          display: flex;
          gap: 12px;
          padding: 16px;
          border-radius: var(--radius-lg);
          margin-bottom: 20px;
          flex-wrap: wrap;
          align-items: center;
        }

        .search-input {
          flex: 1;
          min-width: 200px;
          padding: 12px 16px;
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          background: rgba(0,0,0,0.03);
          color: var(--text-strong);
          font-size: 15px;
          transition: var(--transition-smooth);
        }

        .search-input:focus {
          outline: none;
          border-color: var(--accent-primary);
          background: rgba(0,0,0,0.05);
        }

        .solo-mode .search-input {
          background: rgba(255,255,255,0.05);
          color: var(--solo-text-strong);
          border-color: var(--solo-glass-border);
        }

        .solo-mode .search-input:focus {
          border-color: var(--solo-accent);
        }

        .filter-select {
          padding: 12px 16px;
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          background: rgba(0,0,0,0.03);
          color: var(--text-strong);
          font-size: 14px;
          min-width: 150px;
        }

        .solo-mode .filter-select {
          background: rgba(255,255,255,0.05);
          color: var(--solo-text-strong);
        }

        .future-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text-muted);
          cursor: pointer;
          white-space: nowrap;
        }

        .solo-mode .future-toggle {
          color: var(--solo-text-muted);
        }

        .future-toggle input {
          width: 18px;
          height: 18px;
          accent-color: var(--accent-primary);
        }

        .loading-state {
          padding: 40px;
          text-align: center;
          color: var(--text-muted);
        }

        .events-table-container {
          border-radius: var(--radius-xl);
          overflow: hidden;
        }

        .events-table {
          width: 100%;
          border-collapse: collapse;
        }

        .events-table th {
          text-align: left;
          padding: 14px 16px;
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: rgba(0,0,0,0.02);
          border-bottom: 1px solid var(--glass-border);
        }

        .solo-mode .events-table th {
          background: rgba(255,255,255,0.02);
        }

        .events-table th.sortable {
          cursor: pointer;
          user-select: none;
        }

        .events-table th.sortable:hover {
          background: rgba(0,0,0,0.05);
        }

        .solo-mode .events-table th.sortable:hover {
          background: rgba(255,255,255,0.05);
        }

        .events-table td {
          padding: 14px 16px;
          border-top: 1px solid var(--glass-border);
        }

        .event-cell {
          max-width: 300px;
        }

        .event-title {
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-thumb {
          width: 60px;
          height: 40px;
          object-fit: cover;
          border-radius: 6px;
          margin-top: 6px;
        }

        .source-badge {
          background: var(--accent-soft);
          color: var(--accent-primary);
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline-block;
          max-width: 150px;
        }

        .solo-mode .source-badge {
          background: var(--solo-accent-soft);
          color: var(--solo-accent);
        }

        .date-cell, .location-cell {
          color: var(--text-muted);
          font-size: 13px;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .icon-btn {
          padding: 8px;
          border-radius: 6px;
          background: rgba(0,0,0,0.05);
          color: var(--text-muted);
          border: none;
          cursor: pointer;
          transition: var(--transition-smooth);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .icon-btn:hover {
          background: var(--accent-soft);
          color: var(--accent-primary);
        }

        .icon-btn.danger:hover {
          background: rgba(244, 67, 54, 0.1);
          color: #f44336;
        }

        .solo-mode .icon-btn {
          background: rgba(255,255,255,0.1);
          color: var(--solo-text-muted);
        }

        .load-more {
          padding: 16px;
          text-align: center;
          border-top: 1px solid var(--glass-border);
        }

        .load-more button {
          padding: 12px 24px;
          background: var(--accent-soft);
          color: var(--accent-primary);
          border: none;
          border-radius: var(--radius-lg);
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }

        .solo-mode .load-more button {
          background: var(--solo-accent-soft);
          color: var(--solo-accent);
        }

        .map-view {
          border-radius: var(--radius-xl);
          padding: 24px;
          min-height: 700px;
        }

        .map-container-wrapper {
          height: 650px;
          width: 100%;
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }

        .map-events-no-coords {
          margin-top: 24px;
        }

        .map-placeholder {
          text-align: center;
          color: var(--text-muted);
          padding: 40px;
        }

        .map-placeholder svg {
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .map-hint {
          font-size: 13px;
          margin-top: 8px;
        }

        .map-events {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
          margin-top: 24px;
          max-height: 500px;
          overflow-y: auto;
        }

        .map-event-card {
          padding: 16px;
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .map-event-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .map-event-title {
          font-weight: 600;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .map-event-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .sources-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
        }

        .source-card {
          padding: 24px;
          border-radius: var(--radius-lg);
        }

        .source-name {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .source-count {
          color: var(--text-muted);
          font-size: 14px;
          margin-bottom: 12px;
        }

        .source-status {
          display: inline-block;
          background: #4caf50;
          color: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: var(--bg-primary);
          border-radius: var(--radius-xl);
          padding: 28px;
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          overflow: auto;
        }

        .solo-mode .modal-content {
          background: var(--solo-bg);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .modal-header h2 {
          margin: 0;
          flex: 1;
        }

        .modal-actions-header {
          display: flex;
          gap: 8px;
        }

        .modal-image {
          width: 100%;
          max-height: 300px;
          object-fit: cover;
          border-radius: var(--radius-lg);
          margin-bottom: 20px;
        }

        .detail-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
          background: rgba(0,0,0,0.03);
          padding: 4px;
          border-radius: var(--radius-lg);
        }

        .solo-mode .detail-tabs {
          background: rgba(255,255,255,0.05);
        }

        .detail-tab {
          flex: 1;
          padding: 10px 16px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-muted);
          transition: var(--transition-smooth);
        }

        .detail-tab.active {
          background: var(--accent-primary);
          color: white;
        }

        .solo-mode .detail-tab.active {
          background: var(--solo-accent);
          color: #000;
        }

        .detail-content {
          margin-bottom: 20px;
        }

        .detail-grid {
          display: grid;
          gap: 12px;
        }

        .detail-row {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 8px;
        }

        .detail-label {
          min-width: 100px;
          color: var(--text-muted);
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .detail-value {
          flex: 1;
          font-size: 14px;
          word-break: break-word;
        }

        .detail-value a {
          color: var(--accent-primary);
          word-break: break-all;
        }

        .solo-mode .detail-value a {
          color: var(--solo-accent);
        }

        .json-content {
          background: rgba(0,0,0,0.03);
          padding: 16px;
          border-radius: var(--radius-lg);
          font-family: var(--font-mono);
          font-size: 12px;
          overflow: auto;
          max-height: 400px;
        }

        .solo-mode .json-content {
          background: rgba(255,255,255,0.05);
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .save-btn, .close-btn {
          padding: 12px 24px;
          border-radius: var(--radius-lg);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }

        .save-btn {
          background: #4caf50;
          color: white;
        }

        .close-btn {
          background: rgba(0,0,0,0.05);
          color: var(--text-strong);
        }

        .solo-mode .close-btn {
          background: rgba(255,255,255,0.1);
          color: var(--solo-text-strong);
        }

        .edit-modal {
          max-width: 550px;
        }

        .edit-form {
          display: grid;
          gap: 16px;
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .form-group input, .form-group textarea {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          font-size: 14px;
          background: rgba(0,0,0,0.03);
          color: var(--text-strong);
        }

        .solo-mode .form-group input, .solo-mode .form-group textarea {
          background: rgba(255,255,255,0.05);
          color: var(--solo-text-strong);
          border-color: var(--solo-glass-border);
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .header-top {
            flex-direction: column;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
}

function DetailRow({ label, value, isLink, icon }) {
  return (
    <div className="detail-row">
      <div className="detail-label">
        {icon}
        {label}:
      </div>
      <div className="detail-value">
        {isLink && value ? (
          <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
        ) : value || 'N/A'}
      </div>
    </div>
  );
}
