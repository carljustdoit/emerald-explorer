import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext';
import { useSportsData } from '../hooks/useApi';
import UnifiedInsightCard from '../components/UnifiedInsightCard';
import AdaptiveHeroCard from '../components/AdaptiveHeroCard';
import EventDetailModal from '../components/EventDetailModal';
import BrandBanner from '../components/BrandBanner';
import { Navigation } from 'lucide-react';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Finds overlapping events by id
function findOverlaps(events) {
  const ids = new Set();
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const aStart = new Date(events[i].startDate).getTime();
      const aEnd = events[i].endDate ? new Date(events[i].endDate).getTime() : aStart + 2 * 3600000;
      const bStart = new Date(events[j].startDate).getTime();
      const bEnd = events[j].endDate ? new Date(events[j].endDate).getTime() : bStart + 2 * 3600000;
      if (aStart < bEnd && bStart < aEnd) {
        ids.add(events[i].id);
        ids.add(events[j].id);
      }
    }
  }
  return ids;
}

// Auto-fits the map to the given lat/lon positions
const MapController = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) {
      map.setView([47.6062, -122.3321], 12);
    } else if (positions.length === 1) {
      map.setView(positions[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
};

const Home = () => {
  const { 
    agenda = [], 
    rotation = { isParentingWeek: false }, 
    viability = {}, 
    mockResources = [], 
    addToAgenda, 
    removeFromAgenda, 
    preferences = {},
    effectiveIsParenting // Destructure effectiveIsParenting here
  } = useApp();
  
  const { data: sportsData, loading: sportsLoading } = useSportsData();
  const [viewingEvent, setViewingEvent] = useState(null);

  const now = new Date();
  const todayStr = now.toDateString();

  const todayAgenda = useMemo(() => {
    return (agenda || [])
      .filter(e => e?.startDate && new Date(e.startDate).toDateString() === todayStr)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  }, [agenda, todayStr]);

  const routePositions = useMemo(() => {
    return todayAgenda
      .filter(e => e.coord && typeof e.coord.x === 'number' && typeof e.coord.y === 'number')
      .map(e => [e.coord.x, e.coord.y]);
  }, [todayAgenda]);

  const [drivingRoute, setDrivingRoute] = useState([]);

  useEffect(() => {
    if (routePositions.length < 2) {
      setDrivingRoute([]);
      return;
    }
    // OSRM expects lon,lat order
    const waypoints = routePositions.map(([lat, lon]) => `${lon},${lat}`).join(';');
    fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        const coords = data.routes?.[0]?.geometry?.coordinates;
        if (coords) {
          // GeoJSON is [lon, lat] — flip to Leaflet [lat, lon]
          setDrivingRoute(coords.map(([lon, lat]) => [lat, lon]));
        } else {
          setDrivingRoute(routePositions);
        }
      })
      .catch(() => setDrivingRoute(routePositions));
  }, [JSON.stringify(routePositions)]);

  const chainedTodayEvents = useMemo(() => {
    if (todayAgenda.length === 0) return [];
    const chains = [];
    let current = [todayAgenda[0]];
    for (let i = 1; i < todayAgenda.length; i++) {
      const prev = current[current.length - 1];
      const prevEnd = prev.endDate
        ? new Date(prev.endDate).getTime()
        : new Date(prev.startDate).getTime() + 2 * 3600000; // 2hr fallback
      const nextStart = new Date(todayAgenda[i].startDate).getTime();
      const gapHours = (nextStart - prevEnd) / 3600000;
      if (gapHours <= 4) {
        current.push(todayAgenda[i]);
      } else {
        chains.push(current);
        current = [todayAgenda[i]];
      }
    }
    chains.push(current);
    return chains;
  }, [todayAgenda]);

  const groupedAgenda = useMemo(() => {
    const future = (agenda || []).filter(e => {
      if (!e?.startDate) return false;
      const d = new Date(e.startDate);
      return !isNaN(d.getTime());
    });
    future.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    const map = new Map();
    future.forEach(event => {
      const d = new Date(event.startDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), events: [] });
      map.get(key).events.push(event);
    });
    return Array.from(map.values());
  }, [agenda]);

  const formatDayLabel = (date) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <BrandBanner isParentingWeek={effectiveIsParenting} />
      </header>

      <UnifiedInsightCard 
        forecast={viability?.forecast}
        envData={viability?.envData}
        sportsData={sportsData}
        isParentingWeek={effectiveIsParenting}
        loading={sportsLoading}
      />

      <section className="map-section glass">
        <div className="section-header">
          <Navigation size={18} />
          <h3>Interactive Route</h3>
        </div>
        <div className="home-map-container">
          <MapContainer
            center={[47.6062, -122.3321]}
            zoom={12}
            style={{ height: '300px', width: '100%', borderRadius: '16px', zIndex: 1 }}
            scrollWheelZoom={false}
          >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />
            <MapController positions={routePositions} />
            {todayAgenda.map((event) => event.coord && typeof event.coord.x === 'number' && (
                <Marker key={event.id} position={[event.coord.x, event.coord.y]}>
                    <Popup>
                        <div className="map-popup">
                            <strong>{event.title}</strong>
                            <span>{new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </Popup>
                </Marker>
            ))}
            {drivingRoute.length > 1 && (
                <Polyline
                    positions={drivingRoute}
                    color="#2d6a4f"
                    weight={4}
                    opacity={0.85}
                />
            )}
          </MapContainer>
          {todayAgenda.length === 0 ? (
            <p className="map-caption">Add events from Discovery to see your daily route</p>
          ) : (
            <div className="route-timeline">
              {chainedTodayEvents.map((chain, ci) => (
                <div key={ci} className="route-chain">
                  {chain.map((event, ei) => (
                    <React.Fragment key={event.id}>
                      <div className="route-stop">
                        <div className="stop-dot" />
                        <div className="stop-info">
                          <span className="stop-time">
                            {new Date(event.startDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                          <span className="stop-title">{event.title}</span>
                        </div>
                      </div>
                      {ei < chain.length - 1 && <div className="stop-connector" />}
                    </React.Fragment>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="agenda-section">
        <h2>Upcoming</h2>
        {groupedAgenda.length === 0 ? (
          <div className="empty-state glass">
            <p>Your agenda is empty. Head to Discovery to add events.</p>
          </div>
        ) : (
          groupedAgenda.map(({ date, events }) => {
            const overlappingIds = findOverlaps(events);
            const hasConflicts = overlappingIds.size > 0;
            return (
              <div key={date.getTime()} className="day-group">
                <div className="day-group-header">
                  <h3>{formatDayLabel(date)}</h3>
                  {hasConflicts && (
                    <span className="overlap-warning">⚠ Schedule conflict</span>
                  )}
                </div>
                <div className="event-list">
                  {events.map(event => (
                    <div key={event.id} className={overlappingIds.has(event.id) ? 'event-overlap-highlight' : ''}>
                      <AdaptiveHeroCard
                        event={event}
                        isParentingWeek={rotation.isParentingWeek}
                        score={viability.calculateScore ? viability.calculateScore(event, mockResources, rotation.isParentingWeek, preferences, agenda) : 50}
                        isAdded={true}
                        isCommitted={event.status === 'committed'}
                        onAdd={() => addToAgenda(event)}
                        onRemove={() => removeFromAgenda(event.id)}
                        onCommit={() => addToAgenda(event, event.status === 'committed' ? 'added' : 'committed')}
                        onClick={() => setViewingEvent(event)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      {viewingEvent && (
        <EventDetailModal
          event={viewingEvent}
          onClose={() => setViewingEvent(null)}
        />
      )}

      <style>{`
        .home-page { display: flex; flex-direction: column; gap: 20px; padding-bottom: 100px; }
        .home-header { margin-bottom: -4px; }
        .map-section { padding: 20px; border-radius: var(--radius-xl); display: flex; flex-direction: column; gap: 14px; }
        .section-header { display: flex; align-items: center; gap: 8px; color: var(--accent-primary); }
        .solo-mode .section-header { color: var(--solo-accent); }
        .section-header h3 { font-size: 14px; letter-spacing: -0.01em; font-weight: 600; }
        .home-map-container { display: flex; flex-direction: column; gap: 10px; }
        .map-popup { display: flex; flex-direction: column; gap: 2px; }
        .map-popup strong { font-size: 13px; }
        .map-popup span { font-size: 11px; color: var(--text-muted); }
        .map-caption { font-size: 12px; color: var(--text-muted); text-align: center; font-weight: 500; }
        .agenda-section h2 { font-size: 24px; margin-bottom: 14px; font-weight: 700; }
        .day-group { margin-bottom: 28px; }
        .event-list { display: flex; flex-direction: column; gap: 20px; }
        .empty-state { padding: 48px 32px; text-align: center; border-radius: var(--radius-xl); color: var(--text-muted); font-size: 14px; }

        /* Day group header */
        .day-group-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .day-group-header > h3 { font-size: 12px; color: var(--text-muted); letter-spacing: 0.04em; font-weight: 600; text-transform: uppercase; margin: 0; }
        .solo-mode .day-group-header > h3 { color: var(--solo-text-muted); }

        /* Overlap warning */
        .overlap-warning { font-size: 11px; font-weight: 600; color: #f59e0b; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 8px; border-radius: 8px; }

        /* Overlap highlight on event card wrapper */
        .event-overlap-highlight { border-radius: var(--radius-xl); outline: 2px solid rgba(245, 158, 11, 0.4); outline-offset: 2px; }

        /* Route timeline */
        .route-timeline { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
        .route-chain { display: flex; flex-direction: column; background: rgba(0,0,0,0.02); border-radius: 12px; border: 1px solid var(--glass-border); padding: 10px 14px; gap: 0; }
        .solo-mode .route-chain { background: rgba(255,255,255,0.02); }
        .route-stop { display: flex; align-items: center; gap: 10px; }
        .stop-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-primary); flex-shrink: 0; }
        .solo-mode .stop-dot { background: var(--solo-accent); }
        .stop-info { display: flex; align-items: baseline; gap: 6px; flex: 1; min-width: 0; }
        .stop-time { font-size: 12px; font-weight: 600; color: var(--accent-primary); flex-shrink: 0; }
        .solo-mode .stop-time { color: var(--solo-accent); }
        .stop-title { font-size: 13px; font-weight: 500; color: var(--text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .solo-mode .stop-title { color: var(--solo-text-strong); }
        .stop-connector { width: 2px; height: 14px; background: var(--glass-border); margin-left: 3px; margin-top: 2px; margin-bottom: 2px; }
      `}</style>
    </div>
  );
};

export default Home;
