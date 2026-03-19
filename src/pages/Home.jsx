import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
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

const Home = () => {
  const { 
    agenda = [], 
    rotation = { isParentingWeek: false }, 
    viability = {}, 
    mockResources = [], 
    addToAgenda, 
    removeFromAgenda, 
    preferences = {} 
  } = useApp();
  
  const { data: sportsData, loading: sportsLoading } = useSportsData();
  const [viewingEvent, setViewingEvent] = useState(null);

  const now = new Date();
  const todayStr = now.toDateString();

  const todayAgenda = useMemo(() => {
    return (agenda || [])
      .filter(event => {
        if (!event || !event.startDate) return false;
        try {
          return new Date(event.startDate).toDateString() === todayStr;
        } catch (e) {
          return false;
        }
      })
      .sort((a, b) => {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        return dateA - dateB;
      });
  }, [agenda, todayStr]);

  const routePositions = useMemo(() => {
    return todayAgenda
      .filter(e => e.coord && typeof e.coord.x === 'number' && typeof e.coord.y === 'number')
      .map(e => [e.coord.x, e.coord.y]);
  }, [todayAgenda]);

  const weekAgenda = (agenda || []).filter(event => {
    if (!event || !event.startDate) return false;
    const eventDate = new Date(event.startDate);
    const eventTime = eventDate.getTime();
    const nextWeek = now.getTime() + (7 * 24 * 60 * 60 * 1000);
    return eventDate.toDateString() !== todayStr && eventTime > now.getTime() && eventTime < nextWeek;
  });

  const laterAgenda = (agenda || []).filter(event => {
    if (!event || !event.startDate) return false;
    const eventDate = new Date(event.startDate);
    const nextWeek = now.getTime() + (7 * 24 * 60 * 60 * 1000);
    return eventDate.getTime() >= nextWeek;
  });

  return (
    <div className="home-page">
      <header className="home-header">
        <BrandBanner isParentingWeek={rotation.isParentingWeek} />
      </header>

      <UnifiedInsightCard 
        forecast={viability?.forecast}
        envData={viability?.envData}
        sportsData={sportsData}
        isParentingWeek={rotation.isParentingWeek}
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
            zoom={11} 
            style={{ height: '300px', width: '100%', borderRadius: '16px', zIndex: 1 }}
            scrollWheelZoom={false}
          >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />
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
            {routePositions.length > 1 && (
                <Polyline 
                    positions={routePositions} 
                    color="var(--accent-primary)" 
                    weight={3} 
                    dashArray="5, 10"
                />
            )}
          </MapContainer>
          <p className="map-caption">
            {todayAgenda.length > 0 
                ? `Route for ${todayAgenda.length} events today`
                : "Add events from Discovery to see your daily route"}
          </p>
        </div>
      </section>

      <section className="agenda-section">
        <h2>Upcoming</h2>
        {agenda.length === 0 ? (
          <div className="empty-state glass">
            <p>Your agenda is empty. Head to Discovery to add events.</p>
          </div>
        ) : (
          <>
            {todayAgenda.length > 0 && (
              <div className="day-group">
                <h3>Today</h3>
                <div className="event-list">
                  {todayAgenda.map(event => (
                    <AdaptiveHeroCard
                      key={event.id}
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
                  ))}
                </div>
              </div>
            )}

            {weekAgenda.length > 0 && (
              <div className="day-group">
                <h3>This Week</h3>
                <div className="event-list">
                  {weekAgenda.map(event => (
                    <AdaptiveHeroCard
                      key={event.id}
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
                  ))}
                </div>
              </div>
            )}

            {laterAgenda.length > 0 && (
              <div className="day-group">
                <h3>Later</h3>
                <div className="event-list">
                  {laterAgenda.map(event => (
                    <AdaptiveHeroCard
                      key={event.id}
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
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {viewingEvent && (
        <EventDetailModal
          event={viewingEvent}
          onClose={() => setViewingEvent(null)}
        />
      )}

      <style>{`
        .home-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 100px; }
        .home-header { margin-bottom: -8px; }
        .map-section { padding: 24px; border-radius: var(--radius-xl); display: flex; flex-direction: column; gap: 16px; }
        .section-header { display: flex; align-items: center; gap: 8px; color: var(--accent-primary); }
        .section-header h3 { font-size: 15px; letter-spacing: -0.01em; font-weight: 700; }
        .home-map-container { display: flex; flex-direction: column; gap: 12px; }
        .map-popup { display: flex; flex-direction: column; gap: 2px; }
        .map-popup strong { font-size: 13px; }
        .map-popup span { font-size: 11px; color: var(--text-muted); }
        .map-caption { font-size: 12px; color: var(--text-muted); text-align: center; }
        .agenda-section h2 { font-size: 28px; margin-bottom: 16px; }
        .day-group { margin-bottom: 32px; }
        .day-group > h3 { font-size: 13px; color: var(--text-muted); margin-bottom: 12px; letter-spacing: 0.02em; font-weight: 700; }
        .event-list { display: flex; flex-direction: column; gap: 28px; }
        .empty-state { padding: 60px 40px; text-align: center; border-radius: var(--radius-lg); color: var(--text-muted); }
      `}</style>
    </div>
  );
};

export default Home;
