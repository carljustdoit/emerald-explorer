import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useEvents, useSportsData } from '../hooks/useApi';
import { fetchTrending } from '../services/api';
import AdaptiveHeroCard from '../components/AdaptiveHeroCard';
import EventDetailModal from '../components/EventDetailModal';
import { TrendingUp, Users, MapPin, Filter, X, Calendar } from 'lucide-react';

const CATEGORIES = ["All", "EDM", "Concert", "Sports", "Nature", "Wellness", "Arts", "Meetup", "Food", "Others"];
const TIMEFRAMES = ["All", "Today", "Tomorrow", "This Weekend", "This Week", "Custom"];

// Category icons (text-based)
const CATEGORY_ICONS = {
    "All": "·",
    "EDM": "◈",
    "Concert": "♪",
    "Sports": "▲",
    "Nature": "◉",
    "Wellness": "◇",
    "Arts": "□",
    "Meetup": "◈",
    "Food": "◎",
    "Others": "…"
};

/**
 * Multi-signal category classifier.
 * Checks all vibe_tags (not just first) + title + description keywords.
 * Priority order: Concert > Sports > Nature > Wellness > Arts > Meetup > Food > Others
 */
function classifyEvent(event) {
    const tags = (event.vibe_tags || []).map(t => t.toLowerCase());
    const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();

    // --- EDM: 19hz is exclusively electronic dance music events ---
    if (event.source === '19hz') return 'EDM';
    if (tags.some(t => ['edm', 'bass', 'house', 'techno', 'trance', 'electronic', 'drum and bass', 'dnb', 'dubstep', 'hardstyle'].includes(t))) return 'EDM';
    if (/\b(edm|electronic dance|house music|techno|trance|drum and bass|dnb|dubstep|hardstyle|rave|club night|dj set|underground dance)\b/.test(text)) return 'EDM';

    // --- Concert: music, live performance, nightlife, dance shows ---
    if (tags.some(t => ['music', 'concert', 'nightlife'].includes(t))) return 'Concert';
    if (/\b(concert|live music|live band|live performance|orchestra|symphony|philharmonic|jazz|blues|rock|hip.?hop|folk|indie|dj set|dj night|opera|ballet|comedy show|stand.?up|improv|comedy club|theatre|film screening|movie night|drag show|burlesque|open mic)\b/.test(text)) return 'Concert';

    // --- Sports: games, races, competitive/spectator sports ---
    if (tags.some(t => t === 'sports')) return 'Sports';
    if (/\b(seahawks|mariners|sounders|kraken|storm|thunder|game day|watch party|match|tournament|championship|playoff|triathlon|marathon|5k|10k|half marathon|road race|tennis|golf|soccer|football|baseball|basketball|hockey|volleyball|softball|wrestling|mma|ufc|boxing|esports)\b/.test(text)) return 'Sports';

    // --- Nature: outdoor exploration, trails, water ---
    if (tags.some(t => t === 'outdoor')) return 'Nature';
    if (/\b(hike|hiking|trail|nature walk|bird walk|birding|kayak|paddle|canoe|paddleboard|camping|rock climbing|biking|cycling|beach walk|forest bath|waterfall|botanical|garden tour|tide pool|stargazing|park ranger)\b/.test(text)) return 'Nature';

    // --- Wellness: healing, mindfulness, body-mind practices ---
    if (tags.some(t => t === 'wellness')) return 'Wellness';
    if (/\b(meditation|sound bath|sound healing|reiki|breathwork|holistic|mindfulness|wellness retreat|spa day|qigong|tai chi|yin yoga|restorative|healing circle|crystal|chakra|energy healing|acupuncture|ayurveda)\b/.test(text)) return 'Wellness';
    // Fitness that is wellness-oriented (yoga, pilates without gym context)
    if (tags.some(t => t === 'fitness') && /\b(yoga|pilates|stretch|flow|restore)\b/.test(text)) return 'Wellness';

    // --- Sports (fitness continuation): gyms, workouts ---
    if (tags.some(t => t === 'fitness')) return 'Sports';
    if (/\b(workout|crossfit|spin class|boot camp|strength training|weightlifting|bouldering|obstacle course|spartan|tough mudder|aerial fitness)\b/.test(text)) return 'Sports';

    // --- Arts: visual arts, galleries, film, theater ---
    if (tags.some(t => t === 'art')) return 'Arts';
    if (/\b(art walk|gallery|exhibit|exhibition|museum|art show|sculpture|photography|painting|film festival|short film|documentary|art opening|art fair|art market|craft fair|ceramics|printmaking|illustration|comic|anime)\b/.test(text)) return 'Arts';

    // --- Meetup: learning, tech, community, networking ---
    if (tags.some(t => ['tech', 'education', 'community'].includes(t))) return 'Meetup';
    if (/\b(meetup|workshop|seminar|conference|networking|panel|hackathon|webinar|class|training|lunch.?and.?learn|book club|trivia|quiz night|game night|volunteer|civic|town hall|support group|language exchange)\b/.test(text)) return 'Meetup';

    // --- Food: dining, markets, tastings, drinks ---
    if (tags.some(t => ['food', 'drinks', 'market'].includes(t))) return 'Food';
    if (/\b(food festival|food market|farmers market|night market|restaurant week|tasting menu|wine tasting|beer tasting|cocktail|brewery|distillery|pop.?up dinner|chef|brunch|food truck|ramen|sushi|bbq|pizza|dim sum)\b/.test(text)) return 'Food';

    return 'Others';
}

const Discovery = () => {
    const {
        rotation,
        viability,
        agenda,
        addToAgenda,
        removeFromAgenda,
        preferences,
        effectiveIsParenting,
        mockResources
    } = useApp();

    const { events: realEvents, loading, error } = useEvents({ limit: 500 });
    const { data: sportsData } = useSportsData();
    const [trending, setTrending] = useState([]);
    useEffect(() => {
        fetchTrending().then(data => setTrending(data || [])).catch(() => {});
    }, []);

    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedTimeframe, setSelectedTimeframe] = useState("All");
    const [customDate, setCustomDate] = useState("");
    const [locationSearch, setLocationSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [viewingEvent, setViewingEvent] = useState(null);

    const filterRef = useRef(null);

    // Close filter sheet when clicking outside
    useEffect(() => {
        if (!filterOpen) return;
        const handleClick = (e) => {
            if (filterRef.current && !filterRef.current.contains(e.target)) {
                setFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [filterOpen]);

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
            category: classifyEvent(event),
            vibe: event.vibe_tags?.join(', ') || 'General',
            image: event.image || '',
            coord: event.location ? { x: event.location.lat, y: event.location.lon } : { x: 47.6062, y: -122.3321 },
            sessions: event.sessions,
            source: event.source,
            // Keep raw fields for classifier access
            vibe_tags: event.vibe_tags
        };
    });

    // Count active non-category filters (for badge)
    const activeFilterCount = [
        selectedTimeframe !== "All",
        !!locationSearch
    ].filter(Boolean).length;

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

        // Timeframe Filter — all comparisons use date-only (normalized to midnight)
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

        if (selectedTimeframe === "Today") {
            if (eventDay.getTime() !== today.getTime()) return false;
        } else if (selectedTimeframe === "Tomorrow") {
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            if (eventDay.getTime() !== tomorrow.getTime()) return false;
        } else if (selectedTimeframe === "This Weekend") {
            const day = now.getDay();
            // Sun=0: this weekend's Friday was 2 days ago; Mon-Sat: offset to upcoming/current Friday
            const fridayOffset = day === 0 ? -2 : 5 - day;
            const friday = new Date(today);
            friday.setDate(today.getDate() + fridayOffset);
            const sunday = new Date(friday);
            sunday.setDate(friday.getDate() + 2);
            if (eventDay < friday || eventDay > sunday) return false;
        } else if (selectedTimeframe === "This Week") {
            const nextWeek = new Date(today);
            nextWeek.setDate(today.getDate() + 7);
            if (eventDay < today || eventDay > nextWeek) return false;
        } else if (selectedTimeframe === "Custom" && customDate) {
            const picked = new Date(customDate + 'T00:00:00');
            if (eventDay.getTime() !== picked.getTime()) return false;
        }

        // Per-day parenting filter: check the actual event date, not just current week
        const isParentingOnEventDay = rotation.calculateStateOnDate(
            eventDay, rotation.rotationStartDate, rotation.pattern, rotation.overrides
        );
        if (isParentingOnEventDay && !event.isKidFriendly) return false;

        // Time window hard filter: hide events outside user's available hours
        if (preferences.noEventsBefore || preferences.noEventsAfter) {
            const h = eventDate.getHours();
            const m = eventDate.getMinutes();
            const t = h + m / 60;
            if (preferences.noEventsBefore) {
                const [bh, bm] = preferences.noEventsBefore.split(':').map(Number);
                if (t < bh + bm / 60) return false;
            }
            if (preferences.noEventsAfter) {
                const [ah, am] = preferences.noEventsAfter.split(':').map(Number);
                if (t > ah + am / 60) return false;
            }
        }

        return true;
    });

    // Prioritize events with real external images
    filteredEvents.sort((a, b) => {
        const aImg = a.image && a.image.startsWith('http');
        const bImg = b.image && b.image.startsWith('http');
        if (aImg && !bImg) return -1;
        if (!aImg && bImg) return 1;
        return 0;
    });

    return (
        <div className="discovery-page">
            <h1 className="page-title">Discover</h1>

            {/* Trending Section — only shown when there is real data */}
            {trending.length > 0 && (
                <section className="trending-section glass">
                    <div className="trending-header">
                        <TrendingUp size={16} />
                        <span>Trending in Seattle</span>
                    </div>
                    <div className="trending-items">
                        {trending.map((item, i) => (
                            <div key={item.id} className="trending-pill">
                                <span className="trending-rank">{i + 1}</span>
                                <div className="trending-info">
                                    <span className="trending-name">{item.title}</span>
                                    <span className="trending-meta">
                                        <Users size={12} /> {item.count} {item.count === 1 ? 'person' : 'people'} added this
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="activities-section glass">
                <div className="section-header">
                    <MapPin size={16} />
                    <span>Outdoor Activities (Pin to Home)</span>
                </div>
                <div className="activity-grid">
                    {[
                        { id: 'act-ski-snoqualmie', title: 'Skiing / Boarding', location: 'Snoqualmie Pass', coord: { x: 47.4241, y: -121.4137 }, category: 'Sports', vibe: 'Winter Sports', image: '/assets/snoqualmie_pass.png', hoursKey: 'snoqualmie' },
                        { id: 'act-ski-stevens', title: 'Skiing / Boarding', location: 'Stevens Pass', coord: { x: 47.7463, y: -121.0858 }, category: 'Sports', vibe: 'Winter Sports', image: '/assets/stevens_pass.png', hoursKey: 'stevens' },
                        { id: 'act-ski-crystal', title: 'Skiing / Boarding', location: 'Crystal Mountain', coord: { x: 46.9282, y: -121.5045 }, category: 'Sports', vibe: 'Winter Sports', image: '/assets/crystal_mountain.png', hoursKey: 'crystal' },
                        { id: 'act-paddle-union', title: 'Paddling / Kayaking', location: 'Lake Union', coord: { x: 47.6360, y: -122.3340 }, category: 'Nature', vibe: 'Water Sports', image: '/assets/lake_union.png' },
                        { id: 'act-paddle-sound', title: 'Paddling / Kayaking', location: 'Puget Sound (Alki)', coord: { x: 47.5815, y: -122.4047 }, category: 'Nature', vibe: 'Water Sports', image: '/assets/puget_sound.png' }
                    ].map(activity => {
                        const isPinned = agenda.some(item => item.id === activity.id);
                        return (
                            <div key={activity.id} className="activity-card">
                                <img src={activity.image} alt={activity.title} />
                                <div className="activity-info">
                                    <h4>{activity.title}</h4>
                                    <p>{activity.location}</p>
                                    {activity.hoursKey && (() => {
                                        const h = sportsData?.resort_hours?.[activity.hoursKey];
                                        if (!h) return null;
                                        if (!h.isOpenToday || h.seasonStatus === 'closed') {
                                            return <span className="activity-hours closed">{h.seasonStatus === 'closed' ? 'Closed for season' : 'Closed today'}</span>;
                                        }
                                        return (
                                            <div className="activity-hours-wrap">
                                                <span className="activity-hours open">{h.openTime} – {h.closeTime}</span>
                                                {h.note && <span className="activity-hours-note">{h.note}</span>}
                                            </div>
                                        );
                                    })()}
                                    <button
                                        className={`pin-btn ${isPinned ? 'pinned' : ''}`}
                                        onClick={() => {
                                            if (isPinned) {
                                                removeFromAgenda(activity.id);
                                            } else {
                                                addToAgenda({
                                                    ...activity,
                                                    startDate: new Date().toLocaleString('sv').replace(' ', 'T'),
                                                    description: `Outdoor activity at ${activity.location}. Check weather before heading out!`,
                                                    time: 'Anytime'
                                                });
                                            }
                                        }}
                                    >
                                        {isPinned ? 'Pinned to Home' : 'Pin to Home'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Category Row + Filter Button Row */}
            <div className="browse-controls">
                {/* Swipeable category pills */}
                <div className="category-scroll">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            <span className="cat-icon">{CATEGORY_ICONS[cat]}</span>
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Filter icon button */}
                <div className="filter-wrap" ref={filterRef}>
                    <button
                        className={`filter-icon-btn ${activeFilterCount > 0 ? 'has-filters' : ''}`}
                        onClick={() => setFilterOpen(v => !v)}
                        aria-label="Open filters"
                    >
                        <Filter size={15} />
                        {activeFilterCount > 0 && (
                            <span className="filter-badge">{activeFilterCount}</span>
                        )}
                    </button>

                    {/* Filter dropdown sheet */}
                    {filterOpen && (
                        <div className="filter-sheet glass">
                            <div className="filter-sheet-header">
                                <span>Filter</span>
                                <button className="close-filter" onClick={() => setFilterOpen(false)}>
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Timeframe */}
                            <div className="filter-group">
                                <label>When</label>
                                <div className="timeframe-row">
                                    {TIMEFRAMES.map(tf => (
                                        <button
                                            key={tf}
                                            className={`tf-pill ${selectedTimeframe === tf ? 'active' : ''}`}
                                            onClick={() => setSelectedTimeframe(tf)}
                                        >
                                            {tf}
                                        </button>
                                    ))}
                                </div>
                                {selectedTimeframe === "Custom" && (
                                    <div className="custom-date-row">
                                        <Calendar size={15} />
                                        <input
                                            type="date"
                                            value={customDate}
                                            onChange={e => setCustomDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                        />
                                        {customDate && (
                                            <button className="clear-date" onClick={() => setCustomDate("")}>
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Location */}
                            <div className="filter-group">
                                <label>Location</label>
                                <div className="location-filter">
                                    <MapPin size={14} />
                                    <input
                                        type="text"
                                        placeholder="e.g. Seattle, Tacoma"
                                        value={locationSearch}
                                        onChange={(e) => setLocationSearch(e.target.value)}
                                    />
                                    {locationSearch && (
                                        <button className="clear-date" onClick={() => setLocationSearch("")}>
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Reset */}
                            {activeFilterCount > 0 && (
                                <button className="reset-filters" onClick={() => {
                                    setSelectedTimeframe("All");
                                    setCustomDate("");
                                    setLocationSearch("");
                                }}>
                                    Clear filters
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Results count */}
            <div className="results-meta">
                <span>{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}</span>
                {(selectedCategory !== "All" || activeFilterCount > 0) && (
                    <span className="filter-summary">
                        {selectedCategory !== "All" ? selectedCategory : ''}
                        {selectedCategory !== "All" && selectedTimeframe !== "All" ? ' · ' : ''}
                        {selectedTimeframe !== "All" ? (selectedTimeframe === "Custom" && customDate ? new Date(customDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }) : selectedTimeframe) : ''}
                    </span>
                )}
            </div>

            <div className="event-feed">
                {filteredEvents.length === 0 ? (
                    <div className="empty-state glass">
                        <p>No events match your filters.</p>
                        <button onClick={() => { setSelectedCategory("All"); setSelectedTimeframe("All"); setCustomDate(""); setLocationSearch(""); }}>
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    filteredEvents.map(event => {
                        const score = viability.calculateScore(event, mockResources, rotation.isParentingWeek, preferences, agenda);
                        const agendaItem = agenda.find(item => item.id === event.id);
                        const isAdded = !!agendaItem;
                        const isCommitted = agendaItem?.status === 'committed';

                        return (
                            <AdaptiveHeroCard
                                key={event.id}
                                event={event}
                                isParentingWeek={effectiveIsParenting}
                                score={score}
                                isAdded={isAdded}
                                isCommitted={isCommitted}
                                onAdd={(session) => {
                                    if (session) {
                                        const sessionDate = new Date(session.date + 'T' + (session.start_time || '00:00'));
                                        addToAgenda({ ...event, startDate: sessionDate, time: session.start_time || '' });
                                    } else {
                                        addToAgenda(event);
                                    }
                                }}
                                onRemove={() => removeFromAgenda(event.id)}
                                onCommit={() => addToAgenda(event, isCommitted ? 'added' : 'committed')}
                                onClick={() => setViewingEvent(event)}
                            />
                        );
                    })
                )}
            </div>

            {viewingEvent && (
                <EventDetailModal
                    event={viewingEvent}
                    onClose={() => setViewingEvent(null)}
                />
            )}

            <style>{`
        .discovery-page { display: flex; flex-direction: column; gap: 20px; padding-bottom: 100px; }
        .page-title { font-size: 28px; margin-bottom: 4px; }

        /* Trending */
        .trending-section { padding: 20px 24px; border-radius: var(--radius-xl); }
        .trending-header { display: flex; align-items: center; gap: 8px; color: var(--accent-primary); font-size: 15px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 16px; }
        .solo-mode .trending-header { color: var(--solo-accent); }
        .trending-items { display: flex; flex-direction: column; gap: 12px; }
        .trending-pill { display: flex; align-items: center; gap: 14px; }
        .trending-rank { font-size: 14px; font-weight: 600; color: var(--accent-primary); width: 20px; text-align: center; }
        .solo-mode .trending-rank { color: var(--solo-accent); }
        .trending-info { display: flex; flex-direction: column; gap: 2px; }
        .trending-name { font-size: 15px; font-weight: 500; }
        .trending-meta { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
        .solo-mode .trending-meta { color: var(--solo-text-muted); }

        /* Browse Controls: category row + filter button */
        .browse-controls {
          display: flex; align-items: center; gap: 10px;
        }

        /* Category Scroll */
        .category-scroll {
          display: flex; gap: 8px; overflow-x: auto; flex: 1;
          padding: 2px 0; scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .category-scroll::-webkit-scrollbar { display: none; }

        .cat-pill {
          display: flex; align-items: center; gap: 5px;
          padding: 8px 14px; border-radius: 20px; border: 1px solid var(--glass-border);
          background: rgba(0,0,0,0.03); color: var(--text-muted); font-size: 13px;
          font-weight: 500; white-space: nowrap; transition: var(--transition-smooth);
          cursor: pointer; flex-shrink: 0;
        }
        .solo-mode .cat-pill { background: rgba(255,255,255,0.03); color: var(--solo-text-muted); }
        .cat-pill.active {
          background: var(--accent-primary); color: white; border-color: var(--accent-primary);
          font-weight: 600;
        }
        .solo-mode .cat-pill.active { background: var(--solo-accent); color: black; border-color: var(--solo-accent); }
        .cat-icon { font-size: 11px; opacity: 0.7; }
        .cat-pill.active .cat-icon { opacity: 1; }

        /* Filter Icon Button */
        .filter-wrap { position: relative; flex-shrink: 0; }
        .filter-icon-btn {
          display: flex; align-items: center; justify-content: center; gap: 5px;
          width: 40px; height: 40px; border-radius: 20px;
          border: 1px solid var(--glass-border); background: rgba(0,0,0,0.03);
          color: var(--text-muted); cursor: pointer; transition: var(--transition-smooth);
          position: relative;
        }
        .solo-mode .filter-icon-btn { background: rgba(255,255,255,0.03); color: var(--solo-text-muted); }
        .filter-icon-btn.has-filters {
          background: var(--accent-primary); color: white; border-color: var(--accent-primary);
        }
        .solo-mode .filter-icon-btn.has-filters { background: var(--solo-accent); color: black; border-color: var(--solo-accent); }
        .filter-badge {
          position: absolute; top: -4px; right: -4px;
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--accent-primary); color: white;
          font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--bg-primary, white);
        }
        .solo-mode .filter-badge { background: var(--solo-accent); color: black; }

        /* Filter Sheet (dropdown) */
        .filter-sheet {
          position: absolute; top: calc(100% + 8px); right: 0;
          width: 280px; border-radius: 16px; padding: 16px;
          z-index: 100; display: flex; flex-direction: column; gap: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        }
        .filter-sheet-header {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 14px; font-weight: 700; color: var(--text-strong);
        }
        .solo-mode .filter-sheet-header { color: var(--solo-text-strong); }
        .close-filter {
          background: none; border: none; cursor: pointer; color: var(--text-muted);
          display: flex; align-items: center; padding: 2px;
        }
        .solo-mode .close-filter { color: var(--solo-text-muted); }

        .filter-group { display: flex; flex-direction: column; gap: 8px; }
        .filter-group label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
        .solo-mode .filter-group label { color: var(--solo-text-muted); }

        .timeframe-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .tf-pill {
          padding: 6px 12px; border-radius: 12px; border: 1px solid var(--glass-border);
          background: rgba(0,0,0,0.03); color: var(--text-muted); font-size: 12px;
          font-weight: 500; cursor: pointer; transition: var(--transition-smooth); white-space: nowrap;
        }
        .solo-mode .tf-pill { background: rgba(255,255,255,0.03); color: var(--solo-text-muted); }
        .tf-pill.active {
          background: var(--accent-primary); color: white; border-color: var(--accent-primary);
          font-weight: 600;
        }
        .solo-mode .tf-pill.active { background: var(--solo-accent); color: black; border-color: var(--solo-accent); }

        /* Custom Date */
        .custom-date-row {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px;
          border-radius: 10px; background: rgba(0,0,0,0.03); border: 1px solid var(--glass-border);
          margin-top: 4px;
        }
        .solo-mode .custom-date-row { background: rgba(255,255,255,0.03); }
        .custom-date-row input[type="date"] {
          flex: 1; background: transparent; border: none; color: var(--text-strong);
          font-size: 13px; font-weight: 500; outline: none;
        }
        .solo-mode .custom-date-row input[type="date"] { color: var(--solo-text-strong); color-scheme: dark; }
        .clear-date {
          background: none; border: none; cursor: pointer; color: var(--text-muted);
          display: flex; align-items: center; padding: 2px; opacity: 0.7;
        }

        /* Location Filter */
        .location-filter {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px;
          border-radius: 10px; background: rgba(0,0,0,0.03); border: 1px solid var(--glass-border);
        }
        .solo-mode .location-filter { background: rgba(255,255,255,0.03); }
        .location-filter input {
          background: transparent; border: none; color: var(--text-strong);
          font-size: 13px; font-weight: 500; width: 100%; outline: none;
        }
        .solo-mode .location-filter input { color: var(--solo-text-strong); }
        .location-filter input::placeholder { color: var(--text-muted); }
        .solo-mode .location-filter input::placeholder { color: var(--solo-text-muted); }

        /* Reset */
        .reset-filters {
          padding: 8px; border-radius: 10px; border: 1px solid var(--glass-border);
          background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 600;
          cursor: pointer; text-align: center; transition: var(--transition-smooth);
          width: 100%;
        }
        .reset-filters:hover { background: rgba(0,0,0,0.05); }
        .solo-mode .reset-filters { color: var(--solo-text-muted); }

        /* Results Meta */
        .results-meta {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 13px; color: var(--text-muted); padding: 0 2px;
        }
        .solo-mode .results-meta { color: var(--solo-text-muted); }
        .filter-summary {
          font-weight: 600; color: var(--accent-primary);
        }
        .solo-mode .filter-summary { color: var(--solo-accent); }

        /* Event Feed */
        .event-feed { display: flex; flex-direction: column; gap: 28px; }

        /* Empty State */
        .empty-state {
          padding: 40px 24px; border-radius: var(--radius-xl);
          text-align: center; display: flex; flex-direction: column; gap: 16px; align-items: center;
        }
        .empty-state p { font-size: 15px; color: var(--text-muted); }
        .empty-state button {
          padding: 10px 20px; border-radius: 12px; border: 1px solid var(--glass-border);
          background: transparent; color: var(--text-strong); font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .solo-mode .empty-state p { color: var(--solo-text-muted); }
        .solo-mode .empty-state button { color: var(--solo-text-strong); }

        /* Activities Section */
        .activities-section { padding: 20px 24px; border-radius: var(--radius-xl); }
        .activities-section .section-header { display: flex; align-items: center; gap: 8px; color: var(--accent-primary); font-size: 15px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 16px; }
        .solo-mode .activities-section .section-header { color: var(--solo-accent); }
        .activity-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        @media (max-width: 600px) { .activity-grid { grid-template-columns: 1fr; } }
        .activity-card { display: flex; gap: 12px; background: rgba(0,0,0,0.02); border-radius: 12px; overflow: hidden; border: 1px solid var(--glass-border); }
        .solo-mode .activity-card { background: rgba(255,255,255,0.02); }
        .activity-card img { width: 80px; height: 100%; object-fit: cover; }
        .activity-info { padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .activity-info h4 { font-size: 14px; font-weight: 600; }
        .activity-info p { font-size: 11px; color: var(--text-muted); }
        .activity-hours-wrap { display: flex; flex-direction: column; gap: 1px; margin-top: 3px; }
        .activity-hours {
          display: inline-block; font-size: 10px; font-weight: 600;
          padding: 2px 7px; border-radius: 5px; margin-top: 3px; width: fit-content;
        }
        .activity-hours.open { background: rgba(45,106,79,0.12); color: var(--accent-primary); }
        .solo-mode .activity-hours.open { background: rgba(200,230,110,0.1); color: var(--solo-accent); }
        .activity-hours.closed { background: rgba(239,68,68,0.1); color: #ef4444; }
        .activity-hours-note { font-size: 9px; color: var(--text-muted); font-weight: 500; }
        .solo-mode .activity-hours-note { color: var(--solo-text-muted); }
        .pin-btn { margin-top: 8px; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid var(--accent-primary); background: transparent; color: var(--accent-primary); transition: all 0.2s; }
        .pin-btn.pinned { background: var(--accent-primary); color: white; }
        .solo-mode .pin-btn { border-color: var(--solo-accent); color: var(--solo-accent); }
        .solo-mode .pin-btn.pinned { background: var(--solo-accent); color: black; }
      `}</style>
        </div>
    );
};

export default Discovery;
