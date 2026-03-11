import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { mockEvents } from '../data';
import AdaptiveHeroCard from '../components/AdaptiveHeroCard';
import EventDetailModal from '../components/EventDetailModal';
import { TrendingUp, Users } from 'lucide-react';

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
                    const isCommitted = agendaItem?.status === 'committed';

                    return (
                        <AdaptiveHeroCard
                            key={event.id}
                            event={event}
                            isParentingWeek={rotation.isParentingWeek}
                            score={score}
                            isAdded={isAdded}
                            isCommitted={isCommitted}
                            onAdd={() => addToAgenda(event)}
                            onRemove={() => removeFromAgenda(event.id)}
                            onCommit={() => addToAgenda(event, isCommitted ? 'added' : 'committed')}
                            onClick={() => setViewingEvent(event)}
                        />
                    );
                })}
            </div>

            {/* Event Detail Modal */}
            {viewingEvent && (
                <EventDetailModal
                    event={viewingEvent}
                    onClose={() => setViewingEvent(null)}
                />
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
        .event-feed { display: flex; flex-direction: column; gap: 28px; }
      `}</style>
        </div>
    );
};

export default Discovery;
