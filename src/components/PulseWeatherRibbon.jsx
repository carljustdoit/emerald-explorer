import React from 'react';
import { Droplets, Snowflake, Sunrise } from 'lucide-react';

const PulseWeatherRibbon = ({ isParentingWeek, envData, isGoldenHour }) => {
  return (
    <div className={`weather-ribbon glass ${isParentingWeek ? 'parenting' : 'solo'}`}>
      <div className="metrics">
        <div className="metric">
          <Droplets size={16} />
          <span className="label">Tide: {envData.tideHeight.toFixed(1)}ft</span>
        </div>
        <div className="metric pulse">
          <Snowflake size={16} />
          <span className="label">SNO: {envData.snowDepth.toFixed(0)}" fresh</span>
        </div>
      </div>

      {isGoldenHour && (
        <div className="golden-hour">
          <Sunrise size={16} />
          <span className="label caps">Golden Hour: Perfect for Sunset Paddle</span>
        </div>
      )}

      <style jsx>{`
        .weather-ribbon {
          padding: 16px 20px;
          border-radius: 16px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: var(--transition-smooth);
        }
        .metrics {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }
        .metric {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 700;
        }
        .solo-mode .metric { color: var(--solo-text-muted); }
        
        .pulse {
          animation: pulse-animation 2.5s infinite ease-in-out;
        }
        @keyframes pulse-animation {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        .golden-hour {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ea580c;
          font-weight: 800;
          font-size: 11px;
          animation: slide-down 0.4s ease-out;
        }
        @keyframes slide-down {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .caps { text-transform: uppercase; letter-spacing: 1.5px; }
      `}</style>
    </div>
  );
};

export default PulseWeatherRibbon;
