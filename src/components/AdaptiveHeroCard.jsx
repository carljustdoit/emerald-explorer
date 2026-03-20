import React, { useState } from 'react';
import { MapPin, Clock, Plus, Check, X } from 'lucide-react';

const AdaptiveHeroCard = ({
  event,
  isParentingWeek,
  score,
  isAdded,
  isCommitted,
  onAdd,
  onRemove,
  onCommit,
  onClick
}) => {
  const [pickingSession, setPickingSession] = useState(false);

  const getDynamicDateLabel = () => {
    if (!event.startDate) return event.dateLabel || '';
    
    const startDate = new Date(event.startDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const eventDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    
    if (eventDay.getTime() === today.getTime()) return "Today";
    if (eventDay.getTime() === tomorrow.getTime()) return "Tomorrow";
    
    return startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const displayDateLabel = getDynamicDateLabel();
  return (
    <div className={`hero-card glass`} onClick={onClick}>
      <div className="card-image">
        <img
          src={event.image || '/placeholder.png'}
          alt={event.title}
          onError={(e) => { e.target.src = '/placeholder.png'; }}
        />
        <div className="vibe-tag">{event.vibe}</div>
        {event.source && <div className="source-tag">{event.source}</div>}
      </div>

      <div className="card-content">
        <div className="top-row">
          <h3>{event.title}</h3>
        </div>

        <p className="description">{event.description.substring(0, 100)}...</p>

        <div className="meta-info">
          <div className="meta-item">
            <MapPin size={12} strokeWidth={1.5} />
            <span>{event.location}</span>
          </div>
          <div className="meta-item">
            <Clock size={12} strokeWidth={1.5} />
            <span>
              {displayDateLabel} · {event.time}
              {event.sessions && event.sessions.length > 1 && ` (+${event.sessions.length - 1} more)`}
            </span>
          </div>
        </div>

        {onAdd && (
          <div className="card-actions" onClick={e => e.stopPropagation()}>
            {isAdded ? (
              <div className="action-row">
                <button className="action-btn added-btn" onClick={onRemove}>
                  <Check size={13} /> Added
                </button>
                <button
                  className={`action-btn commit-btn ${isCommitted ? 'committed' : ''}`}
                  onClick={onCommit}
                >
                  {isCommitted ? 'Committed' : 'Mark committed'}
                </button>
              </div>
            ) : pickingSession ? (
              <div className="session-picker">
                <div className="session-picker-header">
                  <span>Choose a session</span>
                  <button className="session-picker-cancel" onClick={() => setPickingSession(false)}>
                    <X size={12} />
                  </button>
                </div>
                {event.sessions.map((session, i) => (
                  <button
                    key={i}
                    className="session-option"
                    onClick={() => { onAdd(session); setPickingSession(false); }}
                  >
                    <span className="session-date">{session.date}</span>
                    <span className="session-time">{session.start_time}</span>
                    <span className="session-price">{session.price}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button
                className="action-btn add-btn"
                onClick={() => {
                  if (event.sessions && event.sessions.length > 1) {
                    setPickingSession(true);
                  } else {
                    onAdd();
                  }
                }}
              >
                <Plus size={13} /> Add to agenda
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        .hero-card {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: var(--transition-smooth);
          cursor: pointer;
        }
        .hero-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg);
        }
        .solo-mode .hero-card:hover {
          box-shadow: 0 12px 32px rgba(0,0,0,0.35);
        }

        .card-image {
          position: relative;
          height: 180px;
        }
        .card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .vibe-tag {
          position: absolute;
          top: 14px;
          left: 14px;
          background: rgba(26, 26, 26, 0.7);
          color: rgba(255,255,255,0.9);
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          backdrop-filter: blur(8px);
        }
        .source-tag {
          position: absolute;
          top: 14px;
          right: 14px;
          background: var(--glass-bg);
          color: var(--text-strong);
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.02em;
          backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border);
        }

        .card-content {
          padding: 18px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .hero-card h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-strong);
          line-height: 1.25;
          letter-spacing: -0.02em;
        }
        .solo-mode .hero-card h3 { color: var(--solo-text-strong); }

        .description {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.55;
        }
        .solo-mode .description { color: var(--solo-text-muted); }

        .meta-info {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .solo-mode .meta-info { color: var(--solo-text-muted); }
        .meta-item { display: flex; align-items: center; gap: 5px; }

        .card-actions {
          margin-top: 6px;
          padding-top: 14px;
          border-top: 1px solid var(--glass-border);
        }
        .solo-mode .card-actions { border-top-color: var(--solo-glass-border); }

        .action-row { display: flex; gap: 8px; }

        .action-btn {
          padding: 9px 14px;
          border-radius: var(--radius-md);
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          transition: var(--transition-fast);
          cursor: pointer;
        }

        .add-btn {
          width: 100%;
          border: 1px solid var(--glass-border);
          background: transparent;
          color: var(--text-strong);
        }
        .solo-mode .add-btn { color: var(--solo-text-strong); border-color: var(--solo-glass-border); }
        .add-btn:hover {
          background: var(--accent-soft);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }
        .solo-mode .add-btn:hover {
          background: var(--solo-accent-soft);
          border-color: var(--solo-accent);
          color: var(--solo-accent);
        }

        .added-btn {
          flex: 1;
          border: 1px solid var(--accent-primary);
          background: var(--accent-soft);
          color: var(--accent-primary);
        }
        .solo-mode .added-btn {
          border-color: var(--solo-accent);
          background: var(--solo-accent-soft);
          color: var(--solo-accent);
        }

        .commit-btn {
          flex: 1.5;
          border: 1px solid var(--glass-border);
          background: transparent;
          color: var(--text-muted);
        }
        .solo-mode .commit-btn { color: var(--solo-text-muted); border-color: var(--solo-glass-border); }
        .commit-btn.committed {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);
        }
        .solo-mode .commit-btn.committed {
          background: var(--solo-accent);
          color: #0c0f1a;
          border-color: var(--solo-accent);
        }

        .session-picker { display: flex; flex-direction: column; gap: 6px; }
        .session-picker-header { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .session-option { padding: 8px 12px; border-radius: 10px; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text-strong); font-size: 12px; font-weight: 500; cursor: pointer; text-align: left; transition: var(--transition-fast); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .session-option:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
        .session-date { font-weight: 600; }
        .session-time { color: var(--text-muted); }
        .session-price { font-size: 11px; color: var(--accent-primary); font-weight: 600; }
        .session-picker-cancel { background: none; border: none; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; padding: 2px; border-radius: 4px; transition: var(--transition-fast); }
        .session-picker-cancel:hover { color: var(--text-strong); }
      `}</style>
    </div>
  );
};

export default AdaptiveHeroCard;
