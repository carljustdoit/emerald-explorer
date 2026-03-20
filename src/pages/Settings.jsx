import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Calendar, Clock, Coffee, ChevronLeft, ChevronRight, FileDown, Sun, LogOut } from 'lucide-react';

const Settings = () => {
    const {
        rotation,
        preferences,
        updatePreferences,
        agenda,
        theme,
        setTheme
    } = useApp();
    const { logout } = useAuth();
    const navigate = useNavigate();

    const [currentDate, setCurrentDate] = useState(new Date());

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    const getIsParentingForDay = (day) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        return rotation.calculateStateOnDate(date, rotation.rotationStartDate, rotation.pattern, rotation.overrides);
    };

    const toggleDay = (day) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dateStr = date.toISOString().split('T')[0];
        const currentState = getIsParentingForDay(day);
        rotation.setManualOverride(dateStr, !currentState);
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const exportToICS = () => {
        const formatICSDate = (date) => {
            const d = new Date(date);
            return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };
        const escape = (str) => (str || '').replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');

        const events = (agenda || []).filter(e => e?.startDate).map((event, i) => {
            const start = new Date(event.startDate);
            const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 2 * 3600000);
            const uid = `emerald-${event.id || i}-${Date.now()}@emerald-explorer`;
            return [
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${formatICSDate(new Date())}`,
                `DTSTART:${formatICSDate(start)}`,
                `DTEND:${formatICSDate(end)}`,
                `SUMMARY:${escape(event.title)}`,
                event.description ? `DESCRIPTION:${escape(event.description)}` : '',
                event.location ? `LOCATION:${escape(event.location)}` : '',
                event.link ? `URL:${event.link}` : '',
                'END:VEVENT',
            ].filter(Boolean).join('\r\n');
        });

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Emerald Explorer//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            ...events,
            'END:VCALENDAR',
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'emerald-explorer-agenda.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="settings-page">
            <h1 className="page-title">Settings</h1>

            <section className="settings-card glass">
                <div className="section-header">
                    <Calendar size={16} strokeWidth={1.5} />
                    <h3>Parenting Schedule</h3>
                </div>

                <div className="rotation-control">
                    <label>Pattern</label>
                    <select
                        value={rotation.pattern}
                        onChange={(e) => rotation.setPattern(e.target.value)}
                    >
                        <option value="WEEKLY">Alternating Weekly</option>
                        <option value="TWO_TWO_FIVE_FIVE">2-2-5-5 Rotation</option>
                        <option value="NONE">No Fixed Rotation</option>
                    </select>
                </div>

                <div className="calendar-grid-container">
                    <div className="calendar-nav">
                        <button onClick={prevMonth}><ChevronLeft size={18} /></button>
                        <span className="month-label">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                        <button onClick={nextMonth}><ChevronRight size={18} /></button>
                    </div>
                    <div className="calendar-grid">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="day-header">{d}</div>)}
                        {Array(firstDayOfMonth).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
                        {Array(daysInMonth).fill(null).map((_, i) => {
                            const day = i + 1;
                            const isParenting = getIsParentingForDay(day);

                            return (
                                <button
                                    key={day}
                                    className={`day-btn ${isParenting ? 'parenting' : 'solo'}`}
                                    onClick={() => toggleDay(day)}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <p className="hint">Tap a date to override</p>
                </div>
                <p className="section-note">Events on your parenting days are automatically filtered from Discover unless they're kid-friendly. Green = your parenting day, white = solo day.</p>
            </section>

            <section className="settings-card glass">
                <div className="section-header">
                    <Clock size={16} strokeWidth={1.5} />
                    <h3>Scheduling Constraints</h3>
                </div>
                <p className="section-note">These time windows hide events that start outside your available hours in Discover. The buffer (rest day) setting also reduces back-to-back event suggestions.</p>

                <div className="input-row">
                    <div className="input-group">
                        <label>No events before</label>
                        <input
                            type="time"
                            value={preferences.noEventsBefore || ""}
                            onChange={(e) => updatePreferences({ noEventsBefore: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label>No events after</label>
                        <input
                            type="time"
                            value={preferences.noEventsAfter || ""}
                            onChange={(e) => updatePreferences({ noEventsAfter: e.target.value })}
                        />
                    </div>
                </div>

                <div className="toggle-row">
                    <div className="toggle-label">
                        <Coffee size={16} strokeWidth={1.5} />
                        <div>
                            <span className="toggle-title">Rest days</span>
                            <p className="toggle-desc">Buffer every other day</p>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={preferences.breakEveryOtherDay}
                        onChange={(e) => updatePreferences({ breakEveryOtherDay: e.target.checked })}
                    />
                </div>
            </section>

            <section className="settings-card glass">
                <div className="section-header">
                    <Sun size={16} strokeWidth={1.5} />
                    <h3>Appearance</h3>
                </div>
                <div className="theme-toggle-group">
                    {['auto', 'light', 'dark'].map(t => (
                        <button
                            key={t}
                            className={`theme-btn ${theme === t ? 'active' : ''}`}
                            onClick={() => setTheme(t)}
                        >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>
            </section>

            <section className="settings-card glass">
                <button className="export-btn" onClick={exportToICS}>
                    <FileDown size={16} strokeWidth={1.5} />
                    Export schedule
                </button>

                <button className="logout-btn" onClick={() => { logout(); navigate('/login'); }}>
                    <LogOut size={16} strokeWidth={1.5} />
                    Sign Out
                </button>
            </section>

            <style>{`
        .settings-page { display: flex; flex-direction: column; gap: 20px; padding-bottom: 120px; }
        .page-title { font-size: 24px; margin-bottom: 4px; font-weight: 700; }
        
        .settings-card { padding: 22px; }
        .section-header { display: flex; align-items: center; gap: 8px; color: var(--accent-primary); margin-bottom: 20px; }
        .solo-mode .section-header { color: var(--solo-accent); }
        .section-header h3 { font-size: 14px; letter-spacing: -0.01em; font-weight: 600; font-family: var(--font-body); }
        
        .rotation-control { margin-bottom: 24px; }
        .rotation-control label { font-size: 12px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em; }
        select { 
          width: 100%; padding: 12px 14px; border-radius: var(--radius-md); background: var(--bg-surface); border: 1px solid var(--glass-border);
          color: var(--text-strong); font-weight: 500; font-family: var(--font-body); font-size: 14px; cursor: pointer;
          -webkit-appearance: none; appearance: none;
        }
        .solo-mode select { background: rgba(255,255,255,0.04); color: var(--solo-text-strong); border-color: var(--solo-glass-border); }

        .calendar-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .calendar-nav button { color: var(--text-muted); padding: 4px; transition: var(--transition-fast); }
        .calendar-nav button:hover { color: var(--accent-primary); }
        .solo-mode .calendar-nav button { color: var(--solo-text-muted); }
        .solo-mode .calendar-nav button:hover { color: var(--solo-accent); }
        .month-label { font-weight: 600; font-size: 14px; }
        
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
        .day-header { text-align: center; font-size: 10px; font-weight: 600; color: var(--text-muted); padding: 6px 0; text-transform: uppercase; letter-spacing: 0.04em; }
        .solo-mode .day-header { color: var(--solo-text-muted); }
        
        .day-btn { 
          aspect-ratio: 1; border-radius: var(--radius-md); border: 1px solid transparent; display: flex; align-items: center; justify-content: center;
          font-weight: 500; font-size: 13px; transition: var(--transition-fast);
        }
        .day-btn.parenting { background: var(--accent-primary); color: white; }
        .day-btn.solo { background: var(--bg-surface); color: var(--text-muted); }
        .solo-mode .day-btn.parenting { background: var(--solo-accent); color: #0c0f1a; }
        .solo-mode .day-btn.solo { background: rgba(255,255,255,0.03); color: var(--solo-text-muted); }
        .day-btn:hover { opacity: 0.85; transform: scale(0.96); }
        
        .hint { font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 14px; font-weight: 500; }
        .solo-mode .hint { color: var(--solo-text-muted); }
        .section-note { font-size: 12px; color: var(--text-muted); line-height: 1.55; margin-top: 6px; padding: 10px 14px; border-radius: 10px; background: rgba(0,0,0,0.03); border: 1px solid var(--glass-border); }
        .solo-mode .section-note { color: var(--solo-text-muted); background: rgba(255,255,255,0.03); }

        .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
        .input-group label { font-size: 12px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px; }
        .solo-mode .input-group label { color: var(--solo-text-muted); }
        input[type="time"] {
          width: 100%; padding: 11px 12px; border-radius: var(--radius-md); border: 1px solid var(--glass-border); background: var(--bg-surface);
          color: var(--text-strong); font-family: var(--font-body); font-weight: 500; font-size: 14px;
        }
        .solo-mode input[type="time"] { background: rgba(255,255,255,0.04); color: var(--solo-text-strong); border-color: var(--solo-glass-border); }

        .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
        .toggle-label { display: flex; align-items: center; gap: 12px; color: var(--text-strong); }
        .solo-mode .toggle-label { color: var(--solo-text-strong); }
        .toggle-title { display: block; font-weight: 600; font-size: 14px; }
        .toggle-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; font-weight: 400; }
        .solo-mode .toggle-desc { color: var(--solo-text-muted); }
        
        input[type="checkbox"] { width: 20px; height: 20px; accent-color: var(--accent-primary); cursor: pointer; }
        .solo-mode input[type="checkbox"] { accent-color: var(--solo-accent); }

        .export-btn {
          width: 100%; padding: 13px; border-radius: var(--radius-md); background: var(--bg-surface); color: var(--text-strong);
          font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: var(--transition-fast); margin-top: 16px; border: 1px solid var(--glass-border);
        }
        .solo-mode .export-btn { background: rgba(255,255,255,0.04); color: var(--solo-text-strong); border-color: var(--solo-glass-border); }
        .export-btn:hover { background: var(--accent-soft); border-color: var(--accent-primary); color: var(--accent-primary); }
        .solo-mode .export-btn:hover { background: var(--solo-accent-soft); border-color: var(--solo-accent); color: var(--solo-accent); }

        .logout-btn {
          width: 100%; padding: 13px; border-radius: var(--radius-md); background: rgba(220, 38, 38, 0.06); color: #dc2626;
          font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: var(--transition-fast); margin-top: 10px; border: 1px solid rgba(220, 38, 38, 0.1);
        }
        .logout-btn:hover { background: rgba(220, 38, 38, 0.12); }

        .theme-toggle-group {
          display: flex;
          background: var(--bg-surface);
          padding: 3px;
          border-radius: var(--radius-md);
          gap: 3px;
          border: 1px solid var(--glass-border);
        }
        .solo-mode .theme-toggle-group { background: rgba(255,255,255,0.03); border-color: var(--solo-glass-border); }
        
        .theme-btn {
          flex: 1;
          padding: 9px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 7px;
          color: var(--text-muted);
          transition: var(--transition-fast);
        }
        .solo-mode .theme-btn { color: var(--solo-text-muted); }
        
        .theme-btn.active {
          background: white;
          color: var(--accent-primary);
          box-shadow: var(--shadow-sm);
        }
        .solo-mode .theme-btn.active {
          background: rgba(255, 255, 255, 0.08);
          color: var(--solo-accent);
          box-shadow: var(--solo-shadow-sm);
        }
      `}</style>
        </div>
    );
};

export default Settings;
