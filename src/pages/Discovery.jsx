import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { mockEvents } from '../data';
import AdaptiveHeroCard from '../components/AdaptiveHeroCard';
import { X, ExternalLink, Plus, Check, MapPin, Clock, TrendingUp, Users } from 'lucide-react';

const CATEGORIES = ["All", "Nature", "Sports", "Music", "Career", "Education", "Healing"];

const Discovery = () => {
    const {
        rotation,
        viability,
        mockResources,
        addToAgenda,
        removeFromAgenda,
        agenda,
        preferences
    } = useApp();

    const [selectedCategory, setSelectedCategory] = useState("All");
    const [viewingEvent, setViewingEvent] = useState(null);

    const filteredEvents = mockEvents.filter(event => {
        if (selectedCategory !== "All" && event.category !== selectedCategory) return false;
        const score = viability.calculateScore(event, mockResources, rotation.isParentingWeek, preferences, agenda);
        if (rotation.isParentingWeek && score === 0) return false;
        return true;
    });

    return (
        <div className="discovery-page">
            <h1 className="page-title">Discover</h1>

            {/* Trending Section */}
            <section className="trending-section glass">
                <div className="trending-header">
                    <TrendingUp size={16} />
                    <span>Trending in Seattle</span>
                </div>
                <div className="trending-items">
                    <div className="trending-pill">
                        <span className="trending-rank">1</span>
                        <div className="trending-info">
                            <span className="trending-name">Cherry Blossom Walk</span>
                            <span className="trending-meta"><Users size={12} /> 2.4k interested</span>
                        </div>
                    </div>
                    <div className="trending-pill">
                        <span className="trending-rank">2</span>
                        <div className="trending-info">
                            <span className="trending-name">First Thursday Art Walk</span>
                            <span className="trending-meta"><Users size={12} /> 1.8k interested</span>
                        </div>
                    </div>
                    <div className="trending-pill">
                        <span className="trending-rank">3</span>
                        <div className="trending-info">
                            <span className="trending-name">Pike Place Night Market</span>
                            <span className="trending-meta"><Users size={12} /> 1.2k interested</span>
                        </div>
                    </div>
                </div>
            </section>

            <div className="category-bar">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`cat-btn ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="event-feed">
                {filteredEvents.map(event => {
                    const score = viability.calculateScore(event, mockResources, rotation.isParentingWeek, preferences, agenda);
                    const agendaItem = agenda.find(item => item.id === event.id);
                    const isAdded = !!agendaItem;

                    return (
                        <div key={event.id} className="card-wrapper" onClick={() => setViewingEvent(event)}>
                            <AdaptiveHeroCard
                                event={event}
                                isParentingWeek={rotation.isParentingWeek}
                                score={score}
                            />
                            <div className="card-actions" onClick={e => e.stopPropagation()}>
                                {isAdded ? (
                                    <div className="added-state">
                                        <button className="status-badge" onClick={() => removeFromAgenda(event.id)}>
                                            <Check size={14} /> Added
                                        </button>
                                        <button
                                            className={`commit-btn ${agendaItem.status === 'committed' ? 'committed' : ''}`}
                                            onClick={() => addToAgenda(event, agendaItem.status === 'committed' ? 'added' : 'committed')}
                                        >
                                            {agendaItem.status === 'committed' ? 'Committed' : 'Mark committed'}
                                        </button>
                                    </div>
                                ) : (
                                    <button className="add-btn" onClick={() => addToAgenda(event)}>
                                        <Plus size={16} /> Add to agenda
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Event Detail Modal */}
            {viewingEvent && (
                <div className="modal-overlay" onClick={() => setViewingEvent(null)}>
                    <div className="detail-modal" onClick={e => e.stopPropagation()}>
                        <button className="close-btn" onClick={() => setViewingEvent(null)}><X size={20} /></button>
                        <div className="modal-image">
                            <img src={viewingEvent.image} alt={viewingEvent.title} />
                            <div className="modal-tags">
                                <span className="modal-cat">{viewingEvent.category}</span>
                            </div>
                        </div>

                        <div className="modal-body">
                            <h2>{viewingEvent.title}</h2>
                            <div className="modal-meta-row">
                                <div className="meta-item"><MapPin size={14} /> {viewingEvent.location}</div>
                                <div className="meta-item"><Clock size={14} /> {viewingEvent.time}</div>
                            </div>
                            <p className="modal-price">{viewingEvent.price}</p>

                            <p className="modal-description">{viewingEvent.description}</p>

                            <a href={viewingEvent.link} target="_blank" rel="noopener noreferrer" className="ext-link">
                                Visit website <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .discovery-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 100px; }
        .page-title { font-size: 28px; margin-bottom: 4px; }

        /* Trending */
        .trending-section { padding: 20px 24px; border-radius: var(--radius-xl); }
        .trending-header { display: flex; align-items: center; gap: 8px; color: var(--accent-primary); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
        .solo-mode .trending-header { color: var(--solo-accent); }
        .trending-items { display: flex; flex-direction: column; gap: 12px; }
        .trending-pill { display: flex; align-items: center; gap: 14px; }
        .trending-rank { font-size: 14px; font-weight: 600; color: var(--accent-primary); width: 20px; text-align: center; }
        .solo-mode .trending-rank { color: var(--solo-accent); }
        .trending-info { display: flex; flex-direction: column; gap: 2px; }
        .trending-name { font-size: 15px; font-weight: 500; }
        .trending-meta { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
        .solo-mode .trending-meta { color: var(--solo-text-muted); }

        /* Categories */
        .category-bar { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0; scrollbar-width: none; }
        .category-bar::-webkit-scrollbar { display: none; }
        
        .cat-btn {
          padding: 8px 20px; border-radius: 12px; border: 1px solid var(--glass-border);
          background: transparent; color: var(--text-muted); font-size: 13px;
          font-weight: 500; transition: var(--transition-smooth); white-space: nowrap;
        }
        .solo-mode .cat-btn { color: var(--solo-text-muted); }
        .cat-btn.active {
          background: var(--accent-primary); color: white; border-color: var(--accent-primary);
        }
        .solo-mode .cat-btn.active {
          background: var(--solo-accent); color: black; border-color: var(--solo-accent);
        }

        /* Event Feed */
        .event-feed { display: flex; flex-direction: column; gap: 32px; }
        .card-wrapper { display: flex; flex-direction: column; gap: 16px; }
        .card-actions { padding: 0 4px; }
        
        .add-btn {
          width: 100%; padding: 14px; border-radius: 14px; border: 1.5px solid var(--glass-border);
          background: transparent; color: var(--text-strong);
          display: flex; align-items: center; justify-content: center; gap: 8px;
          font-weight: 500; font-size: 14px;
          transition: var(--transition-smooth);
        }
        .solo-mode .add-btn { color: var(--solo-text-strong); }
        .add-btn:hover { background: var(--accent-soft); border-color: var(--accent-primary); color: var(--accent-primary); }
        .solo-mode .add-btn:hover { background: var(--solo-accent-soft); border-color: var(--solo-accent); color: var(--solo-accent); }
        
        .added-state { display: flex; gap: 12px; }
        .status-badge {
          flex: 1; padding: 14px; border-radius: 14px; border: 1.5px solid var(--accent-primary);
          background: var(--accent-soft); color: var(--accent-primary); font-weight: 500; font-size: 13px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .solo-mode .status-badge { border-color: var(--solo-accent); color: var(--solo-accent); background: var(--solo-accent-soft); }
        
        .commit-btn {
          flex: 1.5; padding: 14px; border-radius: 14px; border: 1.5px solid var(--glass-border);
          background: transparent; color: var(--text-strong); font-weight: 500; font-size: 13px;
          transition: var(--transition-smooth);
        }
        .solo-mode .commit-btn { color: var(--solo-text-strong); }
        .commit-btn.committed {
          background: var(--accent-primary); color: white; border-color: var(--accent-primary);
        }
        .solo-mode .commit-btn.committed {
          background: var(--solo-accent); color: black; border-color: var(--solo-accent);
        }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); z-index: 2000;
          display: flex; align-items: flex-end; justify-content: center; backdrop-filter: blur(8px);
        }
        .detail-modal {
          width: 100%; max-width: 600px; height: 90vh; border-radius: 28px 28px 0 0;
          overflow-y: auto; position: relative; animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          background: var(--bg-primary); color: var(--text-strong);
        }
        .solo-mode .detail-modal { background: var(--solo-bg); color: var(--solo-text-strong); }
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        
        .close-btn {
          position: absolute; top: 20px; right: 20px; z-index: 10;
          background: rgba(15, 23, 42, 0.6); border: none; color: white; border-radius: 50%; width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center; transition: var(--transition-smooth);
        }
        .close-btn:hover { background: #ef4444; }
        
        .modal-image { position: relative; height: 320px; }
        .modal-image img { width: 100%; height: 100%; object-fit: cover; }
        .modal-tags { position: absolute; bottom: 24px; left: 24px; }
        .modal-cat {
          padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 1px;
          background: var(--accent-primary); color: white;
        }
        .solo-mode .modal-cat { background: var(--solo-accent); color: black; }

        .modal-body { padding: 32px 28px; }
        .modal-body h2 { font-size: 28px; line-height: 1.2; margin-bottom: 16px; }
        .modal-meta-row { display: flex; gap: 20px; margin-bottom: 8px; }
        .meta-item { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--text-muted); font-weight: 500; }
        .solo-mode .meta-item { color: var(--solo-text-muted); }
        .modal-price { font-weight: 600; font-size: 14px; color: var(--accent-primary); margin-bottom: 28px; }
        .solo-mode .modal-price { color: var(--solo-accent); }
        
        .modal-description { line-height: 1.7; color: var(--text-muted); font-size: 16px; margin-bottom: 32px; }
        .solo-mode .modal-description { color: var(--solo-text-muted); }
        
        .ext-link {
          display: inline-flex; align-items: center; gap: 8px; color: var(--accent-primary); text-decoration: none; font-weight: 500; font-size: 15px;
          padding: 12px 20px; border: 1.5px solid var(--accent-primary); border-radius: 12px; transition: var(--transition-smooth);
        }
        .solo-mode .ext-link { color: var(--solo-accent); border-color: var(--solo-accent); }
        .ext-link:hover { background: var(--accent-soft); }
        .solo-mode .ext-link:hover { background: var(--solo-accent-soft); }
      `}</style>
        </div>
    );
};

export default Discovery;
