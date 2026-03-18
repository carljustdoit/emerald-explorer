import React, { useState } from 'react';
import { Sun, Cloud, Snowflake, Waves, Coffee, Bike, Map, Droplets, Wind, Zap } from 'lucide-react';

const WeatherInsight = ({ forecast, envData, isParentingWeek }) => {
  const [activeTab, setActiveTab] = useState('today');

  const getIcon = (condition) => {
    switch (condition?.toLowerCase()) {
      case 'sunny': return <Sun size={22} color="#f59e0b" />;
      case 'partly cloudy': return <Cloud size={22} color="#64748b" />;
      case 'crisp': return <Snowflake size={22} color="#3b82f6" />;
      case 'warming trend': return <Sun size={22} color="#ea580c" />;
      default: return <Sun size={22} />;
    }
  };

  const getVibeIcon = (vibe) => {
    if (vibe.includes('Paddle') || vibe.includes('Water')) return <Waves size={14} />;
    if (vibe.includes('Tracks') || vibe.includes('Mountain') || vibe.includes('Ski')) return <Snowflake size={14} />;
    if (vibe.includes('Bike') || vibe.includes('Active')) return <Bike size={14} />;
    if (vibe.includes('Urban') || vibe.includes('Dinner')) return <Coffee size={14} />;
    return <Map size={14} />;
  };

  const currentData = forecast[activeTab];

  return (
    <div className={`section-card glass weather-insight ${isParentingWeek ? 'parenting' : 'solo'}`}>
      <div className="section-header">
        <div className="icon-box">
          <Cloud size={20} />
        </div>
        <h3>Daily Outlook</h3>
      </div>

      <div className="forecast-tabs">
        {['today', 'weekend', 'week'].map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'week' ? 'This week' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="insight-content">
        <div className="summary-row">
          <div className="condition">
            {getIcon(currentData.condition || currentData.summary)}
            <span className="temp">{currentData.temp ? `${currentData.temp}°` : currentData.summary}</span>
          </div>
          <div className="vibe-badge">
            {getVibeIcon(currentData.vibe)}
            <span>{currentData.vibe}</span>
          </div>
        </div>

        <div className="section-insight">
          <Zap size={14} />
          <p>{currentData.insight}</p>
        </div>

        <div className="raw-metrics">
          <div className="metric">
            <span className="label">Tide Height</span>
            <span className="value">{envData.tideHeight.toFixed(1)} ft</span>
          </div>
          <div className="metric">
            <span className="label">Fresh Snow</span>
            <span className="value">{envData.snowDepth.toFixed(0)}"</span>
          </div>
          <div className="metric">
            <span className="label">Conditions</span>
            <span className="value">{currentData.condition || 'Clear'}</span>
          </div>
        </div>
      </div>

      <style>{`
        .weather-insight {
          gap: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.04);
        }
        .forecast-tabs {
          display: flex;
          gap: 20px;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          padding-bottom: 8px;
        }
        .solo-mode .forecast-tabs { border-bottom-color: rgba(255,255,255,0.06); }
        
        .forecast-tabs button {
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 600;
          padding: 4px 0;
          transition: all 0.3s;
          position: relative;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .solo-mode .forecast-tabs button { color: var(--solo-text-muted); }
        .forecast-tabs button.active { color: var(--text-strong); }
        .forecast-tabs button.active::after {
          content: '';
          position: absolute;
          bottom: -9px;
          left: 0; right: 0;
          height: 2px;
          background: var(--accent-primary);
          border-radius: 2px;
        }
        .solo-mode .forecast-tabs button.active { color: var(--solo-text-strong); }
        .solo-mode .forecast-tabs button.active::after { background: var(--solo-accent); }

        .insight-content { display: flex; flex-direction: column; gap: 20px; }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .condition { display: flex; align-items: center; gap: 12px; }
        .temp {
          font-size: 32px;
          font-family: var(--font-header);
          font-weight: 500;
          color: var(--text-strong);
        }
        .solo-mode .temp { color: var(--solo-text-strong); }

        .vibe-badge {
          background: var(--accent-soft);
          color: var(--accent-primary);
          padding: 10px 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.02);
        }
        .solo-mode .vibe-badge {
          background: var(--solo-accent-soft);
          color: var(--solo-accent);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
        }

        .raw-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.04);
        }
        .solo-mode .raw-metrics { border-top-color: rgba(255,255,255,0.06); }

        .metric { display: flex; flex-direction: column; gap: 4px; }
        .metric .label { font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .solo-mode .metric .label { color: var(--solo-text-muted); }
        .metric .value {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-strong);
          font-family: var(--font-header);
        }
        .solo-mode .metric .value { color: var(--solo-text-strong); }
      `}</style>
    </div>
  );
};

export default WeatherInsight;
