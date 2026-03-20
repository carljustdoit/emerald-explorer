import React, { useState } from 'react';
import {
  Sun, Cloud, Snowflake, Waves, Wind,
  Mountain, Zap, Thermometer, Droplets,
  ChevronRight, Calendar, CloudSun, ChevronDown
} from 'lucide-react';

// Compass direction → degrees the arrow points (arrow shows where wind blows TO = opposite of FROM)
const compassToDeg = (dir) => {
  const map = { N:0, NNE:22.5, NE:45, ENE:67.5, E:90, ESE:112.5, SE:135, SSE:157.5,
                S:180, SSW:202.5, SW:225, WSW:247.5, W:270, WNW:292.5, NW:315, NNW:337.5 };
  return map[dir?.toUpperCase()] ?? 225; // default SW
};

const WindArrow = ({ dir, mph, isForecast }) => {
  const deg = compassToDeg(dir);
  // Arrow points in direction wind is going (FROM dir + 180°)
  const arrowDeg = (deg + 180) % 360;
  return (
    <div className="wind-arrow-wrap" title={`${mph}mph from ${dir || '?'}`}>
      <svg
        width="22" height="22" viewBox="0 0 22 22"
        className="wind-arrow-svg"
        style={{ transform: `rotate(${arrowDeg}deg)` }}
      >
        {/* Arrow pointing up = north; rotated to direction */}
        <line x1="11" y1="18" x2="11" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="6,9 11,4 16,9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="wind-text-col">
        <span className="wind-speed">{mph}<span className="wind-unit">mph</span></span>
        <span className={`wind-dir-label ${isForecast ? 'forecast-wind' : ''}`}>
          {dir || '?'}{isForecast ? ' fcst' : ''}
        </span>
      </div>
    </div>
  );
};

const UnifiedInsightCard = ({ forecast, envData, sportsData, isParentingWeek, loading }) => {
  const [activeTab, setActiveTab] = useState('today');
  const [expanded, setExpanded] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > 680 : true
  );

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
    <div className={`unified-card glass ${isParentingWeek ? 'parenting' : 'solo'} ${expanded ? 'expanded' : 'collapsed'}`}>
      {/* Compact collapsed strip — always visible, acts as toggle */}
      <div className="card-compact-strip" onClick={() => setExpanded(v => !v)}>
        <div className="compact-left">
          <span className="compact-icon">
            {getWeatherIcon(forecast[activeTab]?.condition || 'Fair')}
          </span>
          <span className="compact-temp">
            {activeTab === 'week' ? Math.round(weeklyForecast[0]?.temp || 56) : forecast[activeTab]?.temp}°
          </span>
          {forecast[activeTab]?.high != null && forecast[activeTab]?.low != null && activeTab !== 'week' && (
            <span className="compact-range">
              <span className="temp-high">H:{Math.round(forecast[activeTab].high)}°</span>
              <span className="temp-low">L:{Math.round(forecast[activeTab].low)}°</span>
            </span>
          )}
          <span className="compact-condition">
            {activeTab === 'week' ? 'Weekly Outlook' : (forecast[activeTab]?.condition || 'Fair')}
          </span>
        </div>
        <div className="compact-right">
          <div className="vibe-pill-mini" style={{ '--vibe-color': getVibeColor(activeTab === 'week' ? 'Steady Vibe' : forecast[activeTab]?.vibe) }}>
            <Zap size={11} />
            <span>{activeTab === 'week' ? 'Steady Vibe' : (forecast[activeTab]?.vibe || 'Ready')}</span>
          </div>
          <ChevronDown
            size={16}
            className="expand-chevron"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', color: 'var(--text-muted)' }}
          />
        </div>
      </div>

      {/* Full card content — only visible when expanded */}
      {expanded && (
      <div className="card-expanded-content">
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
                {activeTab !== 'week' && forecast[activeTab]?.high != null && forecast[activeTab]?.low != null && (
                  <span className="temp-range">
                    <span className="temp-high">H:{Math.round(forecast[activeTab].high)}°</span>
                    <span className="temp-low">L:{Math.round(forecast[activeTab].low)}°</span>
                  </span>
                )}
              </div>
              <div className="city-condition">
                {activeTab === 'week' ? 'Weekly Outlook' : (forecast[activeTab]?.condition || 'Fair')}
              </div>
            </div>
          </div>
          <div className="vibe-and-collapse">
            <div className="vibe-pill" style={{ '--vibe-color': getVibeColor(activeTab === 'week' ? 'Steady Vibe' : forecast[activeTab]?.vibe) }}>
              <Zap size={14} />
              <span>{activeTab === 'week' ? 'Steady Vibe' : (forecast[activeTab]?.vibe || 'Ready')}</span>
            </div>
            <button className="collapse-btn" onClick={() => setExpanded(false)} aria-label="Collapse weather card">
              <ChevronDown size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
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
                  (() => {
                    const sd = sportsData[activeTab] || {};
                    const newSnow = sd.snow_forecast_inches ?? 0;
                    const isForecasted = activeTab !== 'today';
                    const periodLabel = activeTab === 'today' ? 'Real-time' : activeTab === 'tomorrow' ? 'Tomorrow' : 'Weekend';
                    const resorts = [
                      { name: 'Snoqualmie', base: sd.snoqualmie_base_depth_inches || 0, mid: sd.snoqualmie_mid_depth_inches || 0, peak: sd.snoqualmie_peak_depth_inches || 0, cond: sd.snoqualmie_snow_condition || 'Unknown' },
                      { name: 'Stevens',    base: sd.stevens_pass_base_depth_inches || 0, mid: sd.stevens_pass_base_depth_inches || 0, peak: sd.stevens_pass_base_depth_inches || 0, cond: sd.stevens_pass_snow_condition || 'Unknown' },
                      { name: 'Crystal',   base: sd.crystal_mountain_base_depth_inches || 0, mid: sd.crystal_mountain_mid_depth_inches || 0, peak: sd.crystal_mountain_peak_depth_inches || 0, cond: sd.crystal_mountain_snow_condition || 'Unknown' },
                    ];
                    return (
                      <>
                        <div className="period-label-row">
                          <span className={`period-badge ${isForecasted ? 'forecast' : 'realtime'}`}>{periodLabel}</span>
                          {isForecasted && (
                            <span className="new-snow-chip">
                              <Snowflake size={11} />
                              {newSnow > 0 ? `+${newSnow}" new snow` : 'No new snow expected'}
                            </span>
                          )}
                          {sd.conditions && <span className="conditions-chip">{sd.conditions}</span>}
                        </div>
                        {resorts.map(resort => (
                          <div key={resort.name} className="resort-stat">
                            <span className="resort-name">{resort.name}</span>
                            <div className="elevation-depths">
                              <div className="depth">
                                <span className="label">Base</span>
                                <span className="val">{resort.base}"</span>
                              </div>
                              <div className="depth">
                                <span className="label">Mid</span>
                                <span className="val">{resort.mid || resort.base}"</span>
                              </div>
                              <div className="depth">
                                <span className="label">Peak</span>
                                <span className="val">{resort.peak || resort.base}"</span>
                              </div>
                            </div>
                            <span className="snow-condition">{resort.cond}</span>
                            {(() => {
                              const key = resort.name.toLowerCase();
                              const h = sportsData?.resort_hours?.[key];
                              // Fallback defaults while backend data loads
                              const isWeekend = [0, 6].includes(new Date().getDay());
                              const defaultOpen = isWeekend ? '8:30 AM' : '9:00 AM';
                              const defaultClose = '4:00 PM';
                              if (h) {
                                if (!h.isOpenToday || h.seasonStatus === 'closed') {
                                  return <span className="resort-hours closed-hours">Closed{h.seasonStatus === 'closed' ? ' for season' : ' today'}</span>;
                                }
                                return (
                                  <div className="resort-hours-row">
                                    <span className="resort-hours open-hours">{h.openTime} – {h.closeTime}</span>
                                    {h.note && <span className="resort-hours-note">{h.note}</span>}
                                  </div>
                                );
                              }
                              // No live data yet — show default hours
                              return (
                                <div className="resort-hours-row">
                                  <span className="resort-hours open-hours">{defaultOpen} – {defaultClose}</span>
                                  <span className="resort-hours-note">Typical hours</span>
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </>
                    );
                  })()
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
                {activeTab !== 'today' && (
                  <div className="water-note">
                    <span>Temp real-time · Wind forecasted</span>
                  </div>
                )}
                <div className="water-grid">
                  {[
                    { label: 'Lake Union', temp: sportsData[activeTab]?.lake_union_temp_f, wind: null, dir: null, sub: 'Freshwater · no wind data' },
                    { label: 'Lake Washington', temp: sportsData[activeTab]?.lake_washington_temp_f, wind: sportsData[activeTab]?.lake_washington_wind_mph, dir: sportsData[activeTab]?.lake_washington_wind_dir, sub: null, highlight: true },
                    { label: 'Puget Sound', temp: sportsData[activeTab]?.puget_sound_temp_f, wind: sportsData[activeTab]?.puget_sound_wind_mph, dir: sportsData[activeTab]?.puget_sound_wind_dir, sub: null },
                  ].map(loc => (
                    <div key={loc.label} className={`water-stat ${loc.highlight ? 'highlight' : ''}`}>
                      <div className="water-left">
                        <span className="location">{loc.label}</span>
                        <span className="water-temp-label">Water Temp</span>
                      </div>
                      <div className="water-right">
                        <span className="water-temp-val">{loc.temp != null ? `${loc.temp}°F` : '--'}</span>
                        {loc.wind != null ? (
                          <div className="wind-row">
                            <WindArrow dir={loc.dir} mph={loc.wind} isForecast={activeTab !== 'today'} />
                          </div>
                        ) : (
                          <span className="sub">{loc.sub}</span>
                        )}
                      </div>
                    </div>
                  ))}
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
      </div>
      )}

      <style>{`
        .unified-card {
          padding: 0;
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          gap: 0;
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

        .card-expanded-content { padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 20px; }
        .card-compact-strip { border-radius: var(--radius-xl); }
        .unified-card.expanded .card-compact-strip { display: none; }
        .vibe-and-collapse { display: flex; align-items: center; gap: 8px; }
        .collapse-btn {
          background: none; border: 1px solid var(--glass-border); border-radius: 50%;
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-muted); transition: var(--transition-fast); flex-shrink: 0;
        }
        .collapse-btn:hover { background: var(--glass-bg); color: var(--text-strong); }
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
        .temp-range {
          display: inline-flex; gap: 6px; align-items: baseline;
          font-size: 13px; font-weight: 500; letter-spacing: 0; margin-left: 8px;
          vertical-align: middle;
        }
        .temp-high { color: #e8845c; }
        .temp-low { color: #6ab3e8; }

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

        /* Period label row above resort list */
        .period-label-row {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;
        }
        .period-badge {
          font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
          padding: 3px 8px; border-radius: 6px;
        }
        .period-badge.realtime { background: rgba(16,185,129,0.12); color: #059669; }
        .period-badge.forecast { background: rgba(59,130,246,0.12); color: #2563eb; }
        .solo .period-badge.realtime { background: rgba(16,185,129,0.15); color: #34d399; }
        .solo .period-badge.forecast { background: rgba(96,165,250,0.15); color: #60a5fa; }

        .new-snow-chip {
          display: flex; align-items: center; gap: 4px;
          font-size: 10px; font-weight: 600; color: var(--blue-500);
          background: rgba(59,130,246,0.08); padding: 3px 8px; border-radius: 6px;
        }
        .solo .new-snow-chip { color: var(--blue-400); background: rgba(96,165,250,0.1); }

        .conditions-chip {
          font-size: 10px; font-weight: 500; color: var(--text-muted);
          background: var(--glass-bg); border: 1px solid var(--glass-border);
          padding: 3px 8px; border-radius: 6px;
        }
        .solo .conditions-chip { color: var(--text-muted); }

        /* Water note */
        .water-note {
          font-size: 10px; color: var(--text-muted); font-style: italic;
          padding: 0 2px; margin-bottom: 2px;
        }
        .forecast-wind { color: var(--blue-500) !important; }
        .solo .forecast-wind { color: var(--blue-400) !important; }

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
          gap: 8px;
        }
        .solo .water-stat {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--solo-glass-border);
        }
        .water-stat.highlight { border-left: 3px solid var(--emerald-500); }

        .water-left { display: flex; flex-direction: column; gap: 2px; }
        .water-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

        .water-stat .location {
          font-size: 13px; font-weight: 600; color: var(--text-strong);
        }
        .water-temp-label {
          font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--text-muted); font-weight: 600;
        }
        .water-temp-val {
          font-size: 15px; font-weight: 700; color: var(--emerald-500);
        }
        .solo .water-temp-val { color: var(--emerald-400); }

        .water-stat .sub {
          font-size: 10px; font-weight: 500; color: var(--text-muted);
        }

        /* Wind arrow */
        .wind-row { display: flex; align-items: center; }
        .wind-arrow-wrap {
          display: flex; align-items: center; gap: 6px; cursor: default;
        }
        .wind-arrow-svg {
          color: var(--blue-500);
          transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
        }
        .solo .wind-arrow-svg { color: var(--blue-400); }
        .wind-text-col { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
        .wind-speed {
          font-size: 14px; font-weight: 700; color: var(--text-strong); line-height: 1;
        }
        .wind-unit { font-size: 9px; font-weight: 500; margin-left: 1px; color: var(--text-muted); }
        .wind-dir-label {
          font-size: 10px; font-weight: 600; color: var(--text-muted); letter-spacing: 0.03em;
        }
        .wind-dir-label.forecast-wind { color: var(--blue-500); }
        .solo .wind-dir-label.forecast-wind { color: var(--blue-400); }

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

        /* Compact strip */
        .card-compact-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          cursor: pointer;
          gap: 12px;
          min-height: 52px;
        }
        .compact-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        .compact-icon svg, .compact-icon img {
          width: 20px !important;
          height: 20px !important;
          flex-shrink: 0;
        }
        .compact-temp {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text-strong);
          flex-shrink: 0;
        }
        .solo .compact-temp { color: var(--solo-text-strong); }
        .compact-range {
          display: flex;
          gap: 5px;
          font-size: 11px;
          font-weight: 500;
          flex-shrink: 0;
        }
        .compact-condition {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .solo .compact-condition { color: var(--solo-text-muted); }
        .compact-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .vibe-pill-mini {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 9px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          background: color-mix(in srgb, var(--vibe-color) 12%, transparent);
          color: var(--vibe-color);
          border: 1px solid color-mix(in srgb, var(--vibe-color) 25%, transparent);
          white-space: nowrap;
        }
        .expand-chevron { flex-shrink: 0; }

        /* When collapsed, don't show the expanded content */
        .unified-card.collapsed .card-expanded-content { display: none; }
        /* When expanded, add a top border between strip and content */
        .unified-card.expanded .card-expanded-content { border-top: 1px solid var(--glass-border); }
        .solo.unified-card.expanded .card-expanded-content { border-top-color: rgba(255,255,255,0.06); }

        /* On mobile, ensure the strip is always visible */
        @media (max-width: 680px) {
          .card-compact-strip { padding: 12px 16px; }
        }

        .resort-hours-row { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
        .resort-hours {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          display: inline-block;
          width: fit-content;
        }
        .resort-hours.open-hours {
          background: rgba(45, 106, 79, 0.12);
          color: var(--accent-primary);
        }
        .solo .resort-hours.open-hours {
          background: rgba(200, 230, 110, 0.1);
          color: var(--solo-accent);
        }
        .resort-hours.closed-hours {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        .resort-hours-note {
          font-size: 10px;
          color: var(--text-muted);
          font-weight: 500;
          padding-left: 2px;
        }
      `}</style>
    </div>
  );
};

export default UnifiedInsightCard;

