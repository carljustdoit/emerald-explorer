import React, { useEffect } from 'react';
import { X, ExternalLink, MapPin, Clock, Plus, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

const EventDetailModal = ({ event, onClose }) => {
    const { addToAgenda, removeFromAgenda, agenda } = useApp();

    // Prevent background scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    if (!event) return null;

    const agendaItem = agenda.find(item => item.id === event.id);
    const isAdded = !!agendaItem;
    const isCommitted = agendaItem?.status === 'committed';

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
        <div className="modal-overlay" onClick={onClose}>
            <div className="detail-modal" onClick={e => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose} aria-label="Close modal">
                    <X size={20} />
                </button>

                <div className="modal-scroll">
                    <div className="modal-image">
                        <img
                            src={event.image || '/placeholder.png'}
                            alt={event.title}
                            onError={(e) => { e.target.src = '/placeholder.png'; }}
                        />
                        <div className="modal-tags">
                            <span className="modal-cat">{event.category}</span>
                            {event.source && <span className="modal-source" style={{ marginLeft: '8px' }}>{event.source}</span>}
                        </div>
                    </div>

                    <div className="modal-body">
                        <div className="modal-header-section">
                            <h2>{event.title}</h2>
                            <div className="modal-actions-inline">
                                {isAdded ? (
                                    <div className="modal-action-row">
                                        <button className="modal-action-btn added" onClick={() => removeFromAgenda(event.id)}>
                                            <Check size={14} /> Added
                                        </button>
                                        <button
                                            className={`modal-action-btn commit ${isCommitted ? 'committed' : ''}`}
                                            onClick={() => addToAgenda(event, isCommitted ? 'added' : 'committed')}
                                        >
                                            {isCommitted ? 'Committed' : 'Mark committed'}
                                        </button>
                                    </div>
                                ) : (
                                    <button className="modal-action-btn add" onClick={() => addToAgenda(event)}>
                                        <Plus size={14} /> Add to agenda
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="modal-meta-row">
                            <div className="meta-item"><MapPin size={14} /> {event.location}</div>
                            {(!event.sessions || event.sessions.length <= 1) ? (
                                <div className="meta-item"><Clock size={14} /> {displayDateLabel} • {event.time}</div>
                            ) : (
                                <div className="meta-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Clock size={14} /> Multiple Sessions Available
                                    </div>
                                    <div className="sessions-list">
                                        {event.sessions.map((session, idx) => (
                                            <div key={idx} className="session-pill">
                                                {session.date} {session.start_time && `• ${session.start_time}`} {session.price && `• Price: ${session.price}`}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {event.price && <p className="modal-price">{event.price}</p>}

                        <div className="modal-map-container">
                            <iframe 
                                title="Event Location"
                                width="100%" 
                                height="200" 
                                frameBorder="0" 
                                scrolling="no" 
                                marginHeight="0" 
                                marginWidth="0" 
                                src={`https://www.openstreetmap.org/export/embed.html?bbox=${event.coord.y - 0.01},${event.coord.x - 0.01},${event.coord.y + 0.01},${event.coord.x + 0.01}&layer=mapnik&marker=${event.coord.x},${event.coord.y}`}
                            />
                        </div>

                        <p className="modal-description">{event.description}</p>

                        <a href={event.link} target="_blank" rel="noopener noreferrer" className="ext-link">
                            Visit website <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            </div>

            <style>{`
        .modal-map-container {
            margin-bottom: 24px;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid var(--glass-border);
        }
        .modal-map-container iframe {
            display: block;
            filter: grayscale(0.5) contrast(1.1);
        }
        .solo-mode .modal-map-container iframe {
            filter: invert(1) hue-rotate(180deg) grayscale(0.5);
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.9);
          z-index: 2000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          backdrop-filter: blur(8px);
        }
        .detail-modal {
          width: 100%;
          max-width: 600px;
          height: 92vh;
          border-radius: 32px 32px 0 0;
          position: relative;
          background: var(--bg-primary);
          color: var(--text-strong);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

        .modal-scroll {
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          flex: 1;
        }
        
        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 100;
          background: rgba(15, 23, 42, 0.5);
          border: none;
          color: white;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
          transition: var(--transition-smooth);
        }
        .close-btn:hover { background: #ef4444; }
        
        .modal-image { position: relative; height: 340px; flex-shrink: 0; }
        .modal-image img { width: 100%; height: 100%; object-fit: cover; }
        .modal-tags { position: absolute; bottom: 24px; left: 24px; }
        .modal-cat {
          padding: 8px 16px; border-radius: 10px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 1.2px;
          background: var(--accent-primary); color: white;
        }
        .modal-source {
          padding: 8px 16px; border-radius: 10px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 1.2px;
          background: rgba(255,255,255,0.9); color: black;
        }

        .modal-body { padding: 32px 28px 80px; }
        
        .modal-header-section {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin-bottom: 24px;
        }

        .modal-body h2 { font-size: 32px; line-height: 1.1; font-family: var(--font-header); letter-spacing: -0.02em; }
        
        .modal-actions-inline {
            display: flex;
            gap: 12px;
        }

        .modal-action-row {
            display: flex;
            gap: 12px;
            width: 100%;
        }

        .modal-action-btn {
            flex: 1;
            padding: 14px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
            transition: var(--transition-smooth);
            border: none;
        }

        .modal-action-btn.add {
            background: var(--accent-primary);
            color: white;
            box-shadow: 0 4px 12px var(--accent-soft);
        }
        .modal-action-btn.added {
            background: var(--accent-soft);
            color: var(--accent-primary);
        }
        .modal-action-btn.commit {
            background: transparent;
            border: 1.5px solid var(--accent-primary);
            color: var(--accent-primary);
        }
        .modal-action-btn.commit.committed {
            background: var(--accent-primary);
            color: white;
        }

        .modal-meta-row { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
        .meta-item { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-muted); font-weight: 500; }
        .sessions-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 4px;
            padding-left: 22px;
        }
        .session-pill {
            background: rgba(0,0,0,0.04);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 13px;
            color: var(--text-strong);
        }
        .solo-mode .session-pill {
            background: rgba(255,255,255,0.06);
        }
        .modal-price { font-weight: 600; font-size: 15px; color: var(--accent-primary); margin-bottom: 12px; }
        
        .modal-description { line-height: 1.8; color: var(--text-muted); font-size: 16px; margin-bottom: 40px; }
        
        .ext-link {
          display: inline-flex; align-items: center; gap: 8px; color: var(--accent-primary); text-decoration: none; font-weight: 600; font-size: 15px;
          padding: 14px 0; border-bottom: 1px solid var(--accent-primary); transition: var(--transition-smooth);
        }
        .ext-link:hover { opacity: 0.7; }
      `}</style>
        </div>
    );
};

export default EventDetailModal;
