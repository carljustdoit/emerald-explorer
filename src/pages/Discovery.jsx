import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useEvents, useTags } from '../hooks/useApi';
import AdaptiveHeroCard from '../components/AdaptiveHeroCard';
import { X, ExternalLink, MapPin, Clock, TrendingUp, Users, Loader2 } from 'lucide-react';

const CATEGORIES = ["All", "Nature", "Sports", "Music", "Career", "Education", "Healing"];

function mapApiEventToLegacy(apiEvent, viabilityScore = 50) {
    return {
        id: apiEvent.id,
        title: apiEvent.title,
        description: apiEvent.description,
        location: apiEvent.location.name,
        time: new Date(apiEvent.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + 
              ' - ' + new Date(apiEvent.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        price: '',
        link: apiEvent.url,
        startDate: new Date(apiEvent.start_time),
        isKidFriendly: apiEvent.is_kid_friendly,
        category: apiEvent.vibe_tags[0]?.charAt(0).toUpperCase() + apiEvent.vibe_tags[0]?.slice(1) || 'Event',
        vibe: apiEvent.vibe_tags.join(', '),
        image: apiEvent.image || `https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800`,
        coord: { x: apiEvent.location.lat, y: apiEvent.location.lon },
        vibe_tags: apiEvent.vibe_tags,
        apiEvent: apiEvent,
    };
}

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

    const filters = useMemo(() => ({
        kidFriendly: !rotation.isParentingWeek ? undefined : false,
        limit: 50,
    }), [rotation.isParentingWeek]);

    const { events: apiEvents, loading, error, loadMore, pagination } = useEvents(filters);
    const { tags } = useTags();

    const events = useMemo(() => {
        return apiEvents.map(event => {
            const legacyEvent = mapApiEventToLegacy(event);
            const score = viability.calculateScore(legacyEvent, mockResources, rotation.isParentingWeek, preferences, agenda);
            return { ...legacyEvent, _score: score };
        });
    }, [apiEvents, viability, mockResources, rotation.isParentingWeek, preferences, agenda]);

    const filteredEvents = events.filter(event => {
        if (selectedCategory !== "All") {
            const categoryMap = {
                'Nature': ['outdoor', 'fitness'],
                'Sports': ['sports'],
                'Music': ['music', 'nightlife'],
                'Career': ['tech', 'education'],
                'Education': ['education', 'community'],
                'Healing': ['wellness', 'art']
            };
            const allowed = categoryMap[selectedCategory] || [];
            if (!event.vibe_tags.some(t => allowed.includes(t))) return false;
        }
        if (rotation.isParentingWeek && event._score === 0) return false;
        return true;
    });

    if (error) {
        return (
            <div className="discovery-page">
                <h1 className="page-title">Discover</h1>
                <p style={{ padding: '20px', color: 'red' }}>Error loading events: {error}</p>
            </div>
        );
    }

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
                {loading && events.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <Loader2 className="spin" size={32} />
                    </div>
                ) : filteredEvents.map(event => {
                    const agendaItem = agenda.find(item => item.id === event.id);
                    const isAdded = !!agendaItem;
                    const isCommitted = agendaItem?.status === 'committed';

                    return (
                        <AdaptiveHeroCard
                            key={event.id}
                            event={event}
                            isParentingWeek={rotation.isParentingWeek}
                            score={event._score}
                            isAdded={isAdded}
                            isCommitted={isCommitted}
                            onAdd={() => addToAgenda(event)}
                            onRemove={() => removeFromAgenda(event.id)}
                            onCommit={() => addToAgenda(event, isCommitted ? 'added' : 'committed')}
                            onClick={() => setViewingEvent(event)}
                        />
                    );
                })}
                
                {pagination?.hasMore && (
                    <button className="load-more-btn" onClick={loadMore} disabled={loading}>
                        {loading ? <Loader2 className="spin" size={20} /> : 'Load More'}
                    </button>
                )}
            </div>

            {/* Event Detail Modal */}
            {viewingEvent && (
                <div className="modal-overlay" onClick={() => setViewingEvent(null)}>
                    <div className="detail-modal" onClick={e => e.stopPropagation()}>
                        <button className="close-btn" onClick={() => setViewingEvent(null)}><X size={20} /></button>

                        <div className="modal-scroll">
                            <div className="modal-image">
                                <img src={viewingEvent.image} alt={viewingEvent.title} />
                                <div className="modal-tags">
                                    {viewingEvent.vibe_tags?.map(tag => (
                                        <span key={tag} className="modal-cat">{tag}</span>
                                    ))}
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
        .event-feed { display: flex; flex-direction: column; gap: 28px; }

        .load-more-btn {
            padding: 14px 24px; border-radius: 14px; border: 1px solid var(--glass-border);
            background: transparent; color: var(--text-muted); font-size: 14px; font-weight: 500;
            cursor: pointer; transition: var(--transition-smooth); display: flex; align-items: center;
            justify-content: center; gap: 8px; margin-top: 20px;
        }
        .load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .load-more-btn:hover:not(:disabled) { background: var(--accent-soft); color: var(--accent-primary); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Modal */
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
          animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          background: var(--bg-primary);
          color: var(--text-strong);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .solo-mode .detail-modal { background: var(--solo-bg); color: var(--solo-text-strong); }
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
        .modal-tags { position: absolute; bottom: 24px; left: 24px; display: flex; gap: 8px; flex-wrap: wrap; }
        .modal-cat {
          padding: 8px 16px; border-radius: 10px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 1.2px;
          background: var(--accent-primary); color: white;
        }
        .solo-mode .modal-cat { background: var(--solo-accent); color: black; }

        .modal-body { padding: 32px 28px 60px; }
        .modal-body h2 { font-size: 32px; line-height: 1.1; margin-bottom: 20px; }
        .modal-meta-row { display: flex; gap: 20px; margin-bottom: 12px; flex-wrap: wrap; }
        .meta-item { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-muted); font-weight: 500; }
        .solo-mode .meta-item { color: var(--solo-text-muted); }
        .modal-price { font-weight: 600; font-size: 15px; color: var(--accent-primary); margin-bottom: 32px; }
        .solo-mode .modal-price { color: var(--solo-accent); }
        
        .modal-description { line-height: 1.8; color: var(--text-muted); font-size: 16px; margin-bottom: 32px; }
        .solo-mode .modal-description { color: var(--solo-text-muted); }
        
        .ext-link {
          display: inline-flex; align-items: center; gap: 8px; color: var(--accent-primary); text-decoration: none; font-weight: 500; font-size: 15px;
          padding: 14px 24px; border: 1.5px solid var(--accent-primary); border-radius: 14px; transition: var(--transition-smooth);
        }
        .solo-mode .ext-link { color: var(--solo-accent); border-color: var(--solo-accent); }
        .ext-link:hover { background: var(--accent-soft); }
        .solo-mode .ext-link:hover { background: var(--solo-accent-soft); }
      `}</style>
        </div>
    );
};

export default Discovery;
