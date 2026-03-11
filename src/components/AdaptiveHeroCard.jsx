import React from 'react';
import { MapPin, Clock } from 'lucide-react';

const AdaptiveHeroCard = ({ event, isParentingWeek, score }) => {
  return (
    <div className={`hero-card glass ${isParentingWeek ? 'parenting' : 'solo'}`}>
      <div className="card-image">
        <img src={event.image} alt={event.title} />
        <div className="vibe-tag">{event.vibe}</div>
      </div>

      <div className="card-content">
        <div className="top-row">
          <h3>{event.title}</h3>
          <div className="viability-badge" title="Viability Score">
            <div className="score-ring">
              <svg viewBox="0 0 36 36">
                <path className="bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="meter" style={{ strokeDasharray: `${score}, 100` }} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <span>{score}</span>
            </div>
          </div>
        </div>

        <p className="description">{event.description.substring(0, 100)}...</p>

        <div className="meta-info">
          <div className="meta-item">
            <MapPin size={13} />
            <span>{event.location}</span>
          </div>
          <div className="meta-item">
            <Clock size={13} />
            <span>{event.time}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero-card {
          display: flex;
          flex-direction: column;
          border-radius: var(--radius-xl);
          overflow: hidden;
          transition: var(--transition-smooth);
          cursor: pointer;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          box-shadow: 0 2px 12px rgba(0,0,0,0.03);
        }
        .hero-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.06);
        }
        .solo-mode .hero-card:hover {
          box-shadow: 0 12px 32px rgba(0,0,0,0.3);
        }

        .card-image {
          position: relative;
          height: 200px;
        }
        .card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .vibe-tag {
          position: absolute;
          top: 16px;
          left: 16px;
          background: rgba(15, 23, 42, 0.85);
          color: rgba(255,255,255,0.95);
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.5px;
          backdrop-filter: blur(8px);
        }

        .card-content {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        h3 {
          font-size: 20px;
          color: var(--text-strong);
          line-height: 1.25;
        }
        .solo-mode h3 { color: var(--solo-text-strong); }

        .description {
          font-size: 14px;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .solo-mode .description { color: var(--solo-text-muted); }

        .meta-info {
          display: flex;
          gap: 20px;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .solo-mode .meta-info { color: var(--solo-text-muted); }
        .meta-item { display: flex; align-items: center; gap: 6px; }

        /* Score Gauge */
        .viability-badge { flex-shrink: 0; }
        .score-ring {
          position: relative;
          width: 44px;
          height: 44px;
        }
        .score-ring svg { transform: rotate(-90deg); }
        .score-ring .bg { fill: none; stroke: rgba(0,0,0,0.04); stroke-width: 3; }
        .solo-mode .score-ring .bg { stroke: rgba(255,255,255,0.06); }
        .score-ring .meter { 
          fill: none; stroke: var(--accent-primary); stroke-width: 3; stroke-linecap: round;
          transition: stroke-dasharray 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .solo-mode .score-ring .meter { stroke: var(--solo-accent); }
        .score-ring span {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 600; color: var(--text-strong);
        }
        .solo-mode .score-ring span { color: var(--solo-text-strong); }
      `}</style>
    </div>
  );
};

export default AdaptiveHeroCard;
