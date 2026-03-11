import React, { useState } from 'react';
import { Sun, Cloud, Snowflake, Waves, Coffee, Bike, Map, Droplets, Wind } from 'lucide-react';

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
    <div className={`weather-insight glass ${isParentingWeek ? 'parenting' : 'solo'}`}>
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

        <p className="insight-text">{currentData.insight}</p>

        <div className="raw-metrics">
          <div className="metric">
            <div className="metric-label-row">
              <Droplets size={11} />
              <span className="label">Tide</span>
            </div>
            <span className="value">{envData.tideHeight.toFixed(1)} ft</span>
          </div>
          <div className="metric">
            <div className="metric-label-row">
              <Wind size={11} />
              <span className="label">Snow</span>
            </div>
            <span className="value">{envData.snowDepth.toFixed(0)}" fresh</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .weather-insight {
          padding: 24px;
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.03);
        }
        .forecast-tabs {
          display: flex;
          gap: 16px;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          padding-bottom: 12px;
        }
        .solo-mode .forecast-tabs { border-bottom-color: rgba(255,255,255,0.04); }
        
        .forecast-tabs button {
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          padding: 4px 0;
          transition: all 0.3s;
          position: relative;
        }
        .solo-mode .forecast-tabs button { color: var(--solo-text-muted); }
        .forecast-tabs button.active { color: var(--text-strong); }
        .forecast-tabs button.active::after {
          content: '';
          position: absolute;
          bottom: -13px;
          left: 0; right: 0;
          height: 1.5px;
          background: var(--accent-primary);
        }
        .solo-mode .forecast-tabs button.active { color: var(--solo-text-strong); }
        .solo-mode .forecast-tabs button.active::after { background: var(--solo-accent); }

        .insight-content { display: flex; flex-direction: column; gap: 16px; }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .condition { display: flex; align-items: center; gap: 10px; }
        .temp {
          font-size: 26px;
          font-family: var(--font-header);
          font-weight: 500;
        }

        .vibe-badge {
          background: var(--accent-soft);
          color: var(--accent-primary);
          padding: 8px 14px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
        }
        .solo-mode .vibe-badge {
          background: var(--solo-accent-soft);
          color: var(--solo-accent);
        }

        .insight-text {
          font-size: 15px;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .solo-mode .insight-text { color: var(--solo-text-muted); }

        .raw-metrics {
          display: flex;
          gap: 32px;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.04);
        }
        .solo-mode .raw-metrics { border-top-color: rgba(255,255,255,0.04); }

        .metric { display: flex; flex-direction: column; gap: 4px; }
        .metric-label-row {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--text-muted);
          font-size: 12px;
        }
        .solo-mode .metric-label-row { color: var(--solo-text-muted); }
        .label { font-weight: 500; }
        .value {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-strong);
        }
        .solo-mode .value { color: var(--solo-text-strong); }
      `}</style>
    </div>
  );
};

export default WeatherInsight;
