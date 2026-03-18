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
        viability,
        toggleSummerMode
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
        const icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Emerald Explorer//EN\n" +
            "BEGIN:VEVENT\nSUMMARY:Sample Event\nDTSTART:20260310T100000Z\nEND:20260310T110000Z\nEND:VEVENT\n" +
            "END:VCALENDAR";
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'emerald-explorer-agenda.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="settings-page">
            <h1 className="page-title">Settings</h1>

            <section className="settings-card glass">
                <div className="section-header">
                    <Calendar size={16} />
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
            </section>

            <section className="settings-card glass">
                <div className="section-header">
                    <Clock size={16} />
                    <h3>Scheduling Constraints</h3>
                </div>

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
                        <Coffee size={16} />
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
                    <Sun size={16} />
                    <h3>Environment</h3>
                </div>
                <div className="toggle-row">
                    <div className="toggle-label">
                        <div>
                            <span className="toggle-title">Simulate summer</span>
                            <p className="toggle-desc">Force Golden Hour conditions</p>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={viability.forceSummerMode}
                        onChange={toggleSummerMode}
                    />
                </div>

                <button className="export-btn" onClick={exportToICS}>
                    <FileDown size={16} />
                    Export schedule
                </button>

                <button className="logout-btn" onClick={() => { logout(); navigate('/login'); }}>
                    <LogOut size={16} />
                    Sign Out
                </button>
            </section>

            <style>{`
        .settings-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 120px; }
        .page-title { font-size: 28px; margin-bottom: 8px; }
        
        .settings-card { padding: 24px; border-radius: var(--radius-xl); }
        .section-header { display: flex; align-items: center; gap: 10px; color: var(--accent-primary); margin-bottom: 24px; }
        .solo-mode .section-header { color: var(--solo-accent); }
        .section-header h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; font-family: var(--font-body); }
        
        .rotation-control { margin-bottom: 28px; }
        .rotation-control label { font-size: 13px; font-weight: 500; color: var(--text-muted); display: block; margin-bottom: 8px; }
        select { 
          width: 100%; padding: 14px 16px; border-radius: 12px; background: rgba(0,0,0,0.03); border: 1px solid var(--glass-border);
          color: var(--text-strong); font-weight: 500; font-family: var(--font-body); font-size: 14px; cursor: pointer;
          -webkit-appearance: none; appearance: none;
        }
        .solo-mode select { background: rgba(255,255,255,0.05); color: var(--solo-text-strong); }

        .calendar-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .calendar-nav button { color: var(--text-muted); padding: 4px; }
        .solo-mode .calendar-nav button { color: var(--solo-text-muted); }
        .month-label { font-weight: 500; font-size: 15px; }
        
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
        .day-header { text-align: center; font-size: 11px; font-weight: 600; color: var(--text-muted); padding: 6px 0; }
        .solo-mode .day-header { color: var(--solo-text-muted); }
        
        .day-btn { 
          aspect-ratio: 1; border-radius: 10px; border: 1px solid transparent; display: flex; align-items: center; justify-content: center;
          font-weight: 500; font-size: 13px; transition: var(--transition-smooth);
        }
        .day-btn.parenting { background: var(--accent-primary); color: white; }
        .day-btn.solo { background: rgba(0,0,0,0.03); color: var(--text-muted); }
        .solo-mode .day-btn.parenting { background: var(--solo-accent); color: #020617; }
        .solo-mode .day-btn.solo { background: rgba(255,255,255,0.04); color: var(--solo-text-muted); }
        .day-btn:hover { opacity: 0.8; transform: scale(0.95); }
        
        .hint { font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 16px; }
        .solo-mode .hint { color: var(--solo-text-muted); }

        .input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .input-group label { font-size: 13px; font-weight: 500; color: var(--text-muted); display: block; margin-bottom: 8px; }
        .solo-mode .input-group label { color: var(--solo-text-muted); }
        input[type="time"] {
          width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.03);
          color: var(--text-strong); font-family: var(--font-body); font-weight: 500; font-size: 14px;
        }
        .solo-mode input[type="time"] { background: rgba(255,255,255,0.05); color: var(--solo-text-strong); }

        .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
        .toggle-label { display: flex; align-items: center; gap: 14px; color: var(--text-strong); }
        .solo-mode .toggle-label { color: var(--solo-text-strong); }
        .toggle-title { display: block; font-weight: 500; font-size: 15px; }
        .toggle-desc { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
        .solo-mode .toggle-desc { color: var(--solo-text-muted); }
        
        input[type="checkbox"] { width: 22px; height: 22px; accent-color: var(--accent-primary); cursor: pointer; }
        .solo-mode input[type="checkbox"] { accent-color: var(--solo-accent); }

        .export-btn {
          width: 100%; padding: 14px; border-radius: 14px; background: rgba(0,0,0,0.04); color: var(--text-strong);
          font-weight: 500; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: var(--transition-smooth); margin-top: 20px;
        }
        .solo-mode .export-btn { background: rgba(255,255,255,0.05); color: var(--solo-text-strong); }
        .export-btn:hover { background: rgba(0,0,0,0.08); }
        .solo-mode .export-btn:hover { background: rgba(255,255,255,0.08); }

        .logout-btn {
          width: 100%; padding: 14px; border-radius: 14px; background: rgba(244, 67, 54, 0.1); color: #f44336;
          font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: var(--transition-smooth); margin-top: 12px; border: none; cursor: pointer;
        }
        .logout-btn:hover { background: rgba(244, 67, 54, 0.2); }
      `}</style>
        </div>
    );
};

export default Settings;
