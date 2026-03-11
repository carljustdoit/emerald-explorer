import React from 'react';
import { useApp } from '../context/AppContext';
import WeatherInsight from '../components/WeatherInsight';
import AdaptiveHeroCard from '../components/AdaptiveHeroCard';
import BrandBanner from '../components/BrandBanner';
import { MapPin } from 'lucide-react';

const Home = () => {
  const { agenda, rotation, viability, preferences, mockResources } = useApp();

  const todayAgenda = agenda.filter(event => {
    const eventDate = new Date(event.startDate).toDateString();
    const today = new Date().toDateString();
    return eventDate === today;
  });

  const weekAgenda = agenda.filter(event => {
    const eventDate = new Date(event.startDate).getTime();
    const now = new Date().getTime();
    return eventDate > now && eventDate < now + (7 * 24 * 60 * 60 * 1000);
  });

  return (
    <div className="home-page">
      <header className="home-header">
        <BrandBanner isParentingWeek={rotation.isParentingWeek} />
      </header>

      <WeatherInsight
        forecast={viability.forecast}
        envData={viability.envData}
        isParentingWeek={rotation.isParentingWeek}
      />

      {todayAgenda.length > 1 && (
        <section className="route-section glass">
          <div className="section-header">
            <MapPin size={18} />
            <h3>Your Route Today</h3>
          </div>
          <div className="map-placeholder">
            <div className="route-visual">
              {todayAgenda.map((event, i) => (
                <React.Fragment key={event.id}>
                  <div className="map-dot" title={event.title} />
                  {i < todayAgenda.length - 1 && <div className="route-line" />}
                </React.Fragment>
              ))}
            </div>
            <p className="map-status">Optimized itinerary for {todayAgenda.length} stops</p>
          </div>
        </section>
      )}

      <section className="agenda-section">
        <h2>Upcoming</h2>
        {!agenda.length && (
          <div className="empty-state glass">
            <p>Your agenda is empty. Head to Discovery to add events.</p>
          </div>
        )}

        {todayAgenda.length > 0 && (
          <div className="day-group">
            <h3>Today</h3>
            <div className="event-list">
              {todayAgenda.map(event => (
                <AdaptiveHeroCard
                  key={event.id}
                  event={event}
                  isParentingWeek={rotation.isParentingWeek}
                  score={viability.calculateScore(event, mockResources, rotation.isParentingWeek, preferences, agenda)}
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
                  score={viability.calculateScore(event, mockResources, rotation.isParentingWeek, preferences, agenda)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <style jsx>{`
        .home-page {
          display: flex;
          flex-direction: column;
          gap: 32px;
          padding-bottom: 100px;
        }
        .home-header {
            margin-bottom: -8px;
        }
        .route-section {
          padding: 24px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--accent-primary);
        }
        .solo-mode .section-header { color: var(--solo-accent); }
        .section-header h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; font-family: var(--font-body); }

        .map-placeholder {
          height: 140px;
          background: rgba(0,0,0,0.03);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: 1.5px dashed var(--glass-border);
        }
        .solo-mode .map-placeholder { background: rgba(255,255,255,0.03); }
        
        .route-visual {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .map-dot {
          width: 10px;
          height: 10px;
          background: var(--accent-primary);
          border-radius: 50%;
          box-shadow: 0 0 15px var(--accent-soft);
        }
        .solo-mode .map-dot { background: var(--solo-accent); box-shadow: 0 0 15px var(--solo-accent-soft); }
        
        .route-line {
          width: 32px;
          height: 2px;
          background: var(--glass-border);
        }
        .map-status { font-size: 12px; color: var(--text-muted); font-weight: 500; }
        .solo-mode .map-status { color: var(--solo-text-muted); }

        .agenda-section h2 {
          font-family: var(--font-header);
          font-size: 28px;
          margin-bottom: 24px;
        }
        .day-group {
          margin-bottom: 32px;
        }
        .day-group h3 {
          font-size: 11px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 16px;
          letter-spacing: 2px;
          font-weight: 800;
          font-family: var(--font-body);
        }
        .solo-mode .day-group h3 { color: var(--solo-text-muted); }
        
        .event-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .empty-state {
          padding: 60px 40px;
          text-align: center;
          border-radius: var(--radius-lg);
          color: var(--text-muted);
          font-weight: 500;
        }
        .solo-mode .empty-state { color: var(--solo-text-muted); }
      `}</style>
    </div>
  );
};

export default Home;
