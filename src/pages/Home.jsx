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
        .day-group > h3 { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; letter-spacing: 0.04em; font-weight: 600; text-transform: uppercase; }
        .solo-mode .day-group > h3 { color: var(--solo-text-muted); }
        .event-list { display: flex; flex-direction: column; gap: 20px; }
        .empty-state { padding: 48px 32px; text-align: center; border-radius: var(--radius-xl); color: var(--text-muted); font-size: 14px; }
      `}</style>
    </div>
  );
};

export default Home;
