import React, { useState } from 'react';
import { 
  Sun, Cloud, Snowflake, Waves, Wind, 
  Mountain, Zap, Thermometer, Droplets, 
  ChevronRight, Calendar, CloudSun
} from 'lucide-react';

const UnifiedInsightCard = ({ forecast, envData, sportsData, isParentingWeek, loading }) => {
  const [activeTab, setActiveTab] = useState('today');

  if (loading || !forecast || !sportsData) {
    return (
      <div className="unified-card glass loading">
        <div className="skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton-grid">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      </div>
    );
  }

  const currentForecast = forecast[activeTab] || forecast.today;

  const getWeatherIcon = (condition, iconUrl) => {
    const iconSize = 28;
    const lower = condition?.toLowerCase() || '';
    
    if (lower.includes('sunny') || lower.includes('clear')) return <Sun size={iconSize} className="icon-amber" />;
    if (lower.includes('partly cloudy') || lower.includes('mostly cloudy') || lower.includes('overcast') || lower.includes('cloudy')) 
      return <Cloud size={iconSize} className="icon-slate" />;
    if (lower.includes('snow')) return <Snowflake size={iconSize} className="icon-blue" />;
    if (lower.includes('rain') || lower.includes('showers') || lower.includes('drizzle')) return <Droplets size={iconSize} className="icon-blue-light" />;
    if (lower.includes('crisp')) return <Snowflake size={iconSize} className="icon-blue" />;
    if (lower.includes('warming')) return <Sun size={iconSize} className="icon-orange" />;
    
    if (iconUrl) return <img src={iconUrl} alt={condition} style={{ width: 28, height: 28, filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))' }} />;
    return <Sun size={iconSize} className="icon-amber" />;
  };

  const getVibeColor = (vibe) => {
    if (!vibe) return 'var(--accent-primary)';
    if (vibe.includes('Paddle') || vibe.includes('Water') || vibe.includes('Lake')) return 'var(--emerald-500)';
    if (vibe.includes('Tracks') || vibe.includes('Mountain') || vibe.includes('Ski') || vibe.includes('Snow')) return 'var(--blue-500)';
    return 'var(--accent-primary)';
  };

  const tabs = ['today', 'tomorrow', 'weekend', 'week'].filter(t => {
    if (t === 'today' || t === 'week') return true;
    return !!forecast[t];
  });

  // Chart Logic
  const weeklyForecast = sportsData?.weekly_forecast || [];
  const highs = weeklyForecast.map(f => f.high || f.temp || 50);
  const lows = weeklyForecast.map(f => f.low || (f.temp ? f.temp - 12 : 38));
  
  const allTemps = [...highs, ...lows];
  const minTemp = Math.min(...(allTemps.length ? allTemps : [32])) - 8;
  const maxTemp = Math.max(...(allTemps.length ? allTemps : [75])) + 8;
  const range = maxTemp - minTemp;
  const padding = 35;
  const chartWidth = 380;
  const chartHeight = 160;
  
  const getPoints = (data) => data.map((val, i) => ({
    x: padding + i * ((chartWidth - 2 * padding) / (data.length - 1 || 1)),
    y: chartHeight - padding - ((val - minTemp) / range) * (chartHeight - 2 * padding),
    val: val
  }));

  const highPoints = getPoints(highs);
  const lowPoints = getPoints(lows);

  const getPath = (pts) => pts.reduce((acc, p, i, a) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = a[i - 1];
    const cp1x = prev.x + (p.x - prev.x) / 2;
    return `${acc} C ${cp1x},${prev.y} ${cp1x},${p.y} ${p.x},${p.y}`;
  }, "");

  const getReversePath = (pts) => {
    const reversed = [...pts].reverse();
    return reversed.reduce((acc, p, i, a) => {
      if (i === 0) return `L ${p.x},${p.y}`;
      const prev = a[i-1];
      const cp1x = prev.x + (p.x - prev.x) / 2;
      return `${acc} C ${cp1x},${prev.y} ${cp1x},${p.y} ${p.x},${p.y}`;
    }, "");
  };

  const highPath = getPath(highPoints);
  const lowPath = getPath(lowPoints);
  const ribbonPath = highPoints.length ? `${highPath} ${getReversePath(lowPoints)} Z` : "";

  return (
    <div className={`unified-card glass ${isParentingWeek ? 'parenting' : 'solo'}`}>
      <div className="card-header">
        <div className="forecast-header">
          <div className="condition-hero">
            {activeTab === 'week' ? (
              <CloudSun className="hero-icon icon-slate" size={48} />
            ) : (
                getWeatherIcon(forecast[activeTab]?.condition || 'Fair')
            )}
            <div className="hero-text">
              <div className="city-temp">
                {activeTab === 'week' ? Math.round(weeklyForecast[0]?.temp || 56) : forecast[activeTab]?.temp}°
              </div>
              <div className="city-condition">
                {activeTab === 'week' ? 'Weekly Outlook' : (forecast[activeTab]?.condition || 'Fair')}
              </div>
            </div>
          </div>
          <div className="vibe-pill" style={{ '--vibe-color': getVibeColor(activeTab === 'week' ? 'Steady Vibe' : forecast[activeTab]?.vibe) }}>
            <Zap size={14} />
            <span>{activeTab === 'week' ? 'Steady Vibe' : (forecast[activeTab]?.vibe || 'Ready')}</span>
          </div>
        </div>

        <div className="tab-navigation">
          {tabs.map(t => (
            <button
              key={t}
              className={`tab-btn ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t === 'week' ? 'Full Week' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="insight-summary">
            {activeTab === 'week' ? 'Your 7-day temperature trend and outlook for Seattle.' : forecast[activeTab]?.insight}
        </div>
      </div>

      <div className="metrics-grid">
        {activeTab !== 'week' ? (
          <>
            <div className="metric-group mountain">
              <div className="group-title">
                <Mountain size={16} />
                <span>Mountain</span>
              </div>
              <div className="resort-grid">
              {(activeTab === 'today' || activeTab === 'tomorrow' || activeTab === 'weekend') ? (
                  [
                    { 
                      name: 'Snoqualmie', 
                      data: { 
                        base: sportsData[activeTab]?.snoqualmie_base_depth_inches || 0, 
                        mid: sportsData[activeTab]?.snoqualmie_mid_depth_inches || 0, 
                        peak: sportsData[activeTab]?.snoqualmie_peak_depth_inches || 0, 
                        cond: sportsData[activeTab]?.snoqualmie_snow_condition || 'Unknown'
                      } 
                    },
                    { 
                      name: 'Stevens', 
                      data: { 
                        base: sportsData[activeTab]?.stevens_pass_base_depth_inches || 0, 
                        mid: sportsData[activeTab]?.stevens_pass_base_depth_inches || 0, 
                        peak: sportsData[activeTab]?.stevens_pass_base_depth_inches || 0, 
                        cond: sportsData[activeTab]?.stevens_pass_snow_condition || 'Unknown'
                      } 
                    },
                    { 
                      name: 'Crystal', 
                      data: { 
                        base: sportsData[activeTab]?.crystal_mountain_base_depth_inches || 0, 
                        mid: sportsData[activeTab]?.crystal_mountain_mid_depth_inches || 0, 
                        peak: sportsData[activeTab]?.crystal_mountain_peak_depth_inches || 0, 
                        cond: sportsData[activeTab]?.crystal_mountain_snow_condition || 'Unknown'
                      } 
                    }
                  ].map(resort => (
                    <div key={resort.name} className="resort-stat">
                      <span className="resort-name">{resort.name}</span>
                      <div className="elevation-depths">
                        <div className="depth">
                          <span className="label">Base</span>
                          <span className="val">{resort.data.base}"</span>
                        </div>
                        <div className="depth">
                          <span className="label">Mid</span>
                          <span className="val">{resort.data.mid || resort.data.base}"</span>
                        </div>
                        <div className="depth">
                          <span className="label">Peak</span>
                          <span className="val">{resort.data.peak || resort.data.base}"</span>
                        </div>
                      </div>
                      <span className="snow-condition">{resort.data.cond}</span>
                    </div>
                  ))
                ) : (
                  <div className="forecasted-snow-hero">
                    <Snowflake size={32} className="icon-blue" />
                    <div className="snow-val-group">
                      <span className="forecast-label">Forecasted Snow</span>
                      <span className="snow-val">{currentForecast.snow_forecast_inches || 0}"</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(activeTab === 'today' || activeTab === 'tomorrow' || activeTab === 'weekend') && (
              <div className="metric-group water">
                <div className="group-title">
                  <Waves size={16} />
                  <span>Water & Wind</span>
                </div>
                <div className="water-grid">
                  <div className="water-stat">
                    <span className="location">Lake Union</span>
                    <div className="vals">
                    <span>{sportsData[activeTab]?.lake_union_temp_f || '--'}°</span>
                    <span className="sub">Freshwater</span>
                  </div>
                </div>
                <div className="water-stat highlight">
                  <span className="location">Lake Washington</span>
                  <div className="vals">
                    <span>{sportsData[activeTab]?.lake_washington_temp_f || '--'}°</span>
                    <span className="sub">{sportsData[activeTab]?.lake_washington_wind_mph || 0}mph Wind</span>
                  </div>
                </div>
                <div className="water-stat">
                  <span className="location">Puget Sound</span>
                  <div className="vals">
                    <span>{sportsData[activeTab]?.puget_sound_temp_f || '--'}°</span>
                    <span className="sub">{sportsData[activeTab]?.puget_sound_wind_mph || 0}mph Wind</span>
                  </div>
                </div>
                </div>
                <div className="wave-footer">
                  <Wind size={12} />
                  <span>{sportsData[activeTab]?.wave_summary || 'Calm'}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="full-week-forecast">
            <div className="trend-header">
              <Thermometer size={16} />
              <span>Weekly Temperature Trend</span>
            </div>
            <div className="trend-container">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="temp-trend-svg">
                <defs>
                  <linearGradient id="ribbonGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.3" />
                  </linearGradient> 
                </defs>
                <path d={ribbonPath} fill="url(#ribbonGradient)" className="ribbon-path" />
                <path d={highPath} fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0" className="trend-line high" />
                <path d={lowPath} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 2" className="trend-line low" />
                
                {highPoints.map((p, i) => (
                  <g key={`high-${i}`}>
                    <circle cx={p.x} cy={p.y} r="3" fill="#f87171" className="trend-point high" />
                    <text x={p.x} y={p.y - 12} textAnchor="middle" className="chart-temp-label high">{p.val}°</text>
                  </g>
                ))}
                {lowPoints.map((p, i) => (
                  <g key={`low-${i}`}>
                    <circle cx={p.x} cy={p.y} r="3" fill="#60a5fa" className="trend-point low" />
                    <text x={p.x} y={p.y + 18} textAnchor="middle" className="chart-temp-label low">{p.val}°</text>
                  </g>
                ))}
              </svg>
              <div className="weekly-forecast-grid">
                {weeklyForecast.map((day, i) => (
                  <div key={i} className="day-forecast-mini">
                    <span className="day-name">{day.day}</span>
                    <div className="day-icon-mini">
                       {getWeatherIcon(day.condition)}
                    </div>
                    <div className="day-temp-mini-group">
                        <span className="day-temp-mini high">{Math.round(day.high || day.temp)}°</span>
                        <span className="day-temp-mini low">{Math.round(day.low || day.temp - 12)}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .unified-card {
          padding: 24px;
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
          overflow: hidden;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-md);
          color: var(--text-body);
          transition: var(--transition-smooth);
        }
        .unified-card.solo {
          background: var(--solo-glass-bg);
          border-color: var(--solo-glass-border);
          box-shadow: var(--solo-shadow-md);
          color: var(--solo-text-strong);
        }

        .card-header { display: flex; flex-direction: column; gap: 20px; }
        .forecast-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .condition-hero { display: flex; align-items: center; gap: 14px; }
        .hero-text { display: flex; flex-direction: column; }

        .city-temp {
          font-size: 38px;
          font-weight: 700;
          line-height: 1;
          color: var(--text-strong);
          font-family: var(--font-header);
          letter-spacing: -0.03em;
        }
        .solo .city-temp { color: var(--solo-text-strong); }

        .city-condition {
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 500;
          margin-top: 4px;
        }
        .solo .city-condition { color: var(--solo-text-muted); }

        .vibe-pill {
          background: var(--accent-soft);
          border: none;
          padding: 7px 14px;
          border-radius: 99px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: var(--accent-primary);
          letter-spacing: 0.01em;
        }
        .solo .vibe-pill {
          background: var(--solo-accent-soft);
          color: var(--solo-accent);
        }

        .tab-navigation {
          display: flex;
          background: rgba(0, 0, 0, 0.03);
          padding: 3px;
          border-radius: var(--radius-md);
          gap: 3px;
        }
        .solo .tab-navigation { background: rgba(255, 255, 255, 0.04); }

        .tab-btn {
          flex: 1;
          padding: 9px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          color: var(--text-muted);
          transition: var(--transition-fast);
          letter-spacing: 0.01em;
        }
        .solo .tab-btn { color: var(--solo-text-muted); }

        .tab-btn.active {
          background: white;
          color: var(--accent-primary);
          box-shadow: var(--shadow-sm);
        }
        .solo .tab-btn.active {
          background: rgba(255, 255, 255, 0.08);
          color: var(--solo-accent);
          box-shadow: var(--solo-shadow-sm);
        }

        .insight-summary {
          background: var(--accent-soft);
          padding: 14px 16px;
          border-radius: var(--radius-md);
          border-left: 3px solid var(--accent-primary);
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-body);
          font-weight: 400;
        }
        .solo .insight-summary {
          background: rgba(200, 230, 110, 0.05);
          border-left-color: var(--solo-accent);
          color: var(--solo-text-muted);
        }

        .metrics-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; }
        .metric-group { display: flex; flex-direction: column; gap: 10px; }

        .group-title {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .solo .group-title { color: var(--solo-text-muted); }

        .resort-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }

        .resort-stat {
          background: var(--bg-surface);
          padding: 16px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 10px;
          border: 1px solid var(--glass-border);
          transition: var(--transition-fast);
        }
        .solo .resort-stat {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--solo-glass-border);
        }
        .resort-stat:hover { 
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        .resort-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-strong);
          letter-spacing: -0.01em;
        }
        .solo .resort-name { color: var(--solo-text-strong); }

        .elevation-depths { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .depth { display: flex; flex-direction: column; gap: 2px; }

        .depth .label {
          font-size: 9px;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 600;
          letter-spacing: 0.06em;
        }
        .solo .depth .label { color: var(--solo-text-muted); }

        .depth .val {
          font-size: 15px;
          font-weight: 700;
          color: var(--blue-500);
        }
        .solo .depth .val { color: var(--blue-400); }

        .snow-condition {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .solo .snow-condition { color: var(--solo-text-muted); }

        .water-grid { display: flex; flex-direction: column; gap: 6px; }

        .water-stat {
          background: var(--bg-surface);
          padding: 12px 16px;
          border-radius: var(--radius-lg);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid var(--glass-border);
        }
        .solo .water-stat {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--solo-glass-border);
        }

        .water-stat.highlight {
          border-left: 3px solid var(--emerald-500);
        }

        .water-stat .location {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-strong);
        }
        .solo .water-stat .location { color: var(--solo-text-strong); }

        .water-stat .vals {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-strong);
        }
        .solo .water-stat .vals { color: var(--solo-text-strong); }

        .water-stat .sub {
          font-size: 10px;
          font-weight: 500;
          color: var(--text-muted);
          margin-top: 1px;
        }
        .solo .water-stat .sub { color: var(--solo-text-muted); }

        .wave-footer {
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--emerald-500);
          font-weight: 500;
          padding: 0 4px;
        }
        .solo .wave-footer { color: var(--emerald-400); }

        .full-week-forecast {
          grid-column: span 2;
          background: var(--bg-surface);
          padding: 20px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--glass-border);
        }
        .solo .full-week-forecast {
          background: rgba(255, 255, 255, 0.02);
          border-color: var(--solo-glass-border);
        }

        .trend-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .solo .trend-header { color: var(--solo-text-muted); }

        .temp-trend-svg {
          width: 100%;
          height: auto;
          aspect-ratio: 380 / 160;
          margin-bottom: 24px;
          overflow: visible;
        }

        .weekly-forecast-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--glass-border);
        }
        .solo .weekly-forecast-grid { border-top-color: var(--solo-glass-border); }

        .day-forecast-mini {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        }

        .day-name {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.02em;
        }
        .solo .day-name { color: var(--solo-text-muted); }

        .day-temp-mini {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-strong);
        }
        .solo .day-temp-mini { color: var(--solo-text-strong); }

        .forecasted-snow-hero {
          display: flex;
          align-items: center;
          gap: 20px;
          background: #eff6ff;
          padding: 20px;
          border-radius: var(--radius-lg);
          border: 1px solid #dbeafe;
          justify-content: center;
          height: 100%;
          min-height: 100px;
        }
        .solo .forecasted-snow-hero {
          background: rgba(59, 130, 246, 0.05);
          border-color: rgba(59, 130, 246, 0.1);
        }

        .snow-val-group { display: flex; flex-direction: column; }

        .forecast-label {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .solo .forecast-label { color: var(--solo-text-muted); }

        .snow-val {
          font-size: 32px;
          font-weight: 700;
          color: var(--blue-500);
          line-height: 1;
        }
        .solo .snow-val { color: var(--blue-400); }

        .chart-temp-label {
          font-size: 10px;
          font-weight: 600;
          font-family: var(--font-body);
        }
        .chart-temp-label.high { fill: #dc2626; }
        .chart-temp-label.low { fill: #2563eb; }
        .solo .chart-temp-label.high { fill: #fca5a5; }
        .solo .chart-temp-label.low { fill: #93c5fd; }

        .trend-line { filter: none; }
        .day-temp-mini-group { display: flex; flex-direction: column; gap: 1px; }

        .day-temp-mini.high { color: var(--text-strong); font-weight: 600; }
        .day-temp-mini.low { color: var(--text-muted); font-size: 10px; font-weight: 500; }
        .solo .day-temp-mini.high { color: var(--solo-text-strong); }
        .solo .day-temp-mini.low { color: var(--solo-text-muted); }

        .trend-point { filter: none; }
        .trend-line-path { filter: none; }

        .day-icon-mini {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .day-icon-mini img { width: 100%; height: 100%; }

        .icon-amber { color: #d97706; }
        .icon-slate { color: var(--text-muted); }
        .icon-blue { color: #2563eb; }
        .icon-blue-light { color: #60a5fa; }
        .icon-orange { color: #ea580c; }

        @media (max-width: 640px) {
          .metrics-grid { grid-template-columns: 1fr; }
          .forecasted-snow-hero { min-height: 80px; }
        }

        .loading .skeleton-line {
          height: 16px;
          background: rgba(0,0,0,0.04);
          border-radius: 6px;
          margin-bottom: 10px;
        }
        .solo .loading .skeleton-line { background: rgba(255,255,255,0.04); }
      `}</style>
    </div>
  );
};

export default UnifiedInsightCard;

