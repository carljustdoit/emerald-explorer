import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useEvents } from '../hooks/useApi';
import AdaptiveHeroCard from '../components/AdaptiveHeroCard';
import EventDetailModal from '../components/EventDetailModal';
import { TrendingUp, Users, MapPin, Filter, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORIES = ["All", "Concert", "Sports", "Dance", "Nature", "Meetup", "Others"];

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

    const { events: realEvents, loading, error } = useEvents({ limit: 500 });
    
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedTimeframe, setSelectedTimeframe] = useState("All");
    const [locationSearch, setLocationSearch] = useState("");
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const [viewingEvent, setViewingEvent] = useState(null);

    if (loading) {
        return (
            <div className="discovery-page">
                <h1 className="page-title">Discover</h1>
                <p>Loading events...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="discovery-page">
                <h1 className="page-title">Discover</h1>
                <p>Error loading events: {error}</p>
            </div>
        );
    }
    
    const eventCategoryMap = {
        'outdoor': 'Nature',
        'nature': 'Nature',
        'parks': 'Nature',
        'sports': 'Sports', 
        'fitness': 'Sports',
        'music': 'Concert',
        'concert': 'Concert',
        'art': 'Concert',
        'performance': 'Concert',
        'dance': 'Dance',
        'tech': 'Meetup',
        'education': 'Meetup',
        'wellness': 'Nature',
        'community': 'Meetup',
        'social': 'Meetup',
        'career': 'Meetup',
        'meeting': 'Meetup',
        'food': 'Others',
        'family': 'Others',
        'market': 'Others'
    };

    const apiEvents = realEvents.map(event => {
        const startDate = event.start_time ? new Date(event.start_time) : new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const eventDay = new Date(startDate);
        eventDay.setHours(0, 0, 0, 0);
        
        let dateLabel = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (eventDay.getTime() === today.getTime()) dateLabel = "Today";
        else if (eventDay.getTime() === tomorrow.getTime()) dateLabel = "Tomorrow";

        return {
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location?.name || 'Seattle',
            time: event.start_time ? new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
            dateLabel,
            price: event.price || (event.ticket_url ? 'See tickets' : ''),
            link: event.url || '',
            startDate,
            isKidFriendly: event.is_kid_friendly,
            category: event.vibe_tags?.[0] ? (eventCategoryMap[event.vibe_tags[0].toLowerCase()] || 'Others') : 'Others',
            vibe: event.vibe_tags?.join(', ') || 'General',
            image: event.image || '',
            coord: event.location ? { x: event.location.lat, y: event.location.lon } : { x: 47.6062, y: -122.3321 },
            sessions: event.sessions,
            source: event.source
        };
    });

    const TIMEFRAMES = ["All", "Today", "Tomorrow", "This Weekend", "This Week"];

    const filteredEvents = apiEvents.filter(event => {
        // Category Filter
        if (selectedCategory !== "All" && event.category !== selectedCategory) return false;

        // Location Filter
        if (locationSearch && !event.location.toLowerCase().includes(locationSearch.toLowerCase())) return false;

        // Past events filter (only show future or ongoing today)
        const now = new Date();
        const eventDate = new Date(event.startDate);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (eventDate < today) return false;

        // Timeframe Filter
        
        if (selectedTimeframe === "Today") {
            if (eventDate.toDateString() !== now.toDateString()) return false;
        } else if (selectedTimeframe === "Tomorrow") {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            if (eventDate.toDateString() !== tomorrow.toDateString()) return false;
        } else if (selectedTimeframe === "This Weekend") {
            const day = now.getDay();
            const friday = new Date(now);
            friday.setDate(now.getDate() + (5 - day));
            const sunday = new Date(now);
            sunday.setDate(now.getDate() + (7 - day));
            if (eventDate < friday || eventDate > sunday) return false;
        } else if (selectedTimeframe === "This Week") {
            const nextWeek = new Date(now);
            nextWeek.setDate(now.getDate() + 7);
            if (eventDate < now || eventDate > nextWeek) return false;
        }

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

            <div className={`filter-container glass ${isFilterExpanded ? 'expanded' : ''}`}>
                <button 
                    className="filter-toggle" 
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                >
                    <div className="toggle-left">
                        <Filter size={16} />
                        <span>Filters {selectedCategory !== "All" || selectedTimeframe !== "All" || locationSearch ? "(Active)" : ""}</span>
                    </div>
                    {isFilterExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                <div className="filter-content">
                    <div className="filter-group">
                        <label>Categories</label>
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
                    </div>

                    <div className="filter-group">
                        <label>Timeframe</label>
                        <div className="timeframe-bar">
                            {TIMEFRAMES.map(tf => (
                                <button
                                    key={tf}
                                    className={`tf-btn ${selectedTimeframe === tf ? 'active' : ''}`}
                                    onClick={() => setSelectedTimeframe(tf)}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="filter-group">
                        <label>Location</label>
                        <div className="location-filter">
                            <MapPin size={16} />
                            <input 
                                type="text" 
                                placeholder="Filter by location (e.g. Seattle, Tacoma)" 
                                value={locationSearch}
                                onChange={(e) => setLocationSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
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

            <style>{`
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

        /* Filters */
        .filter-container { border-radius: 20px; overflow: hidden; transition: all 0.3s ease; }
        .filter-toggle {
          width: 100%; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between;
          background: transparent; border: none; color: var(--text-strong); cursor: pointer;
        }
        .solo-mode .filter-toggle { color: var(--solo-text-strong); }
        .toggle-left { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 15px; }
        
        .filter-content { 
          max-height: 0; overflow: hidden; padding: 0 24px; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-top: 1px solid transparent;
        }
        .filter-container.expanded .filter-content { max-height: 500px; padding-bottom: 24px; border-top-color: var(--glass-border); }
        
        .filter-group { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
        .filter-group label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: var(--text-muted); }
        .solo-mode .filter-group label { color: var(--solo-text-muted); }

        .category-bar, .timeframe-bar { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0; scrollbar-width: none; }
        .category-bar::-webkit-scrollbar, .timeframe-bar::-webkit-scrollbar { display: none; }
        
        .cat-btn, .tf-btn {
          padding: 8px 16px; border-radius: 12px; border: 1px solid var(--glass-border);
          background: rgba(0,0,0,0.03); color: var(--text-muted); font-size: 13px;
          font-weight: 500; transition: var(--transition-smooth); white-space: nowrap;
        }
        .solo-mode .cat-btn, .solo-mode .tf-btn { background: rgba(255,255,255,0.03); color: var(--solo-text-muted); }
        .cat-btn.active, .tf-btn.active {
          background: var(--accent-primary); color: white; border-color: var(--accent-primary);
        }
        .solo-mode .cat-btn.active, .solo-mode .tf-btn.active {
          background: var(--solo-accent); color: black; border-color: var(--solo-accent);
        }
        
        .location-filter {
          display: flex; align-items: center; gap: 10px; padding: 12px 16px;
          border-radius: 14px; background: rgba(0,0,0,0.03); border: 1px solid var(--glass-border);
        }
        .solo-mode .location-filter { background: rgba(255,255,255,0.03); }
        .location-filter input {
          background: transparent; border: none; color: var(--text-strong);
          font-size: 14px; font-weight: 500; width: 100%; outline: none;
        }
        .solo-mode .location-filter input { color: var(--solo-text-strong); }
        .location-filter input::placeholder { color: var(--text-muted); }
        .solo-mode .location-filter input::placeholder { color: var(--solo-text-muted); }

        /* Event Feed */
        .event-feed { display: flex; flex-direction: column; gap: 28px; }
      `}</style>
        </div>
    );
};

export default Discovery;
