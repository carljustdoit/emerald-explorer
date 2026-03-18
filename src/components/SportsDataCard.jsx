import React from 'react';
import { Mountain, Waves, Wind, Thermometer, Sun, Zap } from 'lucide-react';

const SportsDataCard = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="sports-card glass loading-state">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    );
  }

  const getSnowInsight = () => {
    const depths = [
      data.snoqualmie_snow_inches,
      data.stevens_pass_snow_inches,
      data.crystal_mountain_snow_inches
    ];
    const max = Math.max(...depths);
    if (max > 12) return "Powder alert! Conditions are epic.";
    if (max > 5) return "Fresh snow detected. Great for carving.";
    return "Typical mountain conditions. Enjoy the crisp air.";
  };

  const getWaterInsight = () => {
    if (data.wind_speed_mph < 5 && data.lake_union_temp_f > 60) {
      return "Glassy water & warm air – Perfect for a paddle session.";
    }
    if (data.wind_speed_mph > 15) {
      return "Strong winds – Watch out for chop on the sound.";
    }
    return "Stable conditions for water activities.";
  };

  return (
    <div className="sports-data-container">
      <div className="sports-grid">
        {/* Snow Card */}
        <div className="sports-card glass snow">
          <div className="card-header">
            <Mountain className="icon snow-icon" size={20} />
            <h3>Mountain Report</h3>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span className="label">Snoqualmie</span>
              <span className="value">{data.snoqualmie_snow_inches}"</span>
            </div>
            <div className="stat">
              <span className="label">Stevens</span>
              <span className="value">{data.stevens_pass_snow_inches}"</span>
            </div>
            <div className="stat">
              <span className="label">Crystal</span>
              <span className="value">{data.crystal_mountain_snow_inches}"</span>
            </div>
          </div>
          <div className="insight">
            <Zap size={14} />
            <p>{getSnowInsight()}</p>
          </div>
        </div>

        {/* Water Card */}
        <div className="sports-card glass water">
          <div className="card-header">
            <Waves className="icon water-icon" size={20} />
            <h3>Water & Wind</h3>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span className="label">Lake Washington</span>
              <span className="value">{data.lake_washington_temp_f || data.lake_union_temp_f}°F</span>
            </div>
            <div className="stat">
              <span className="label">Puget Sound</span>
              <span className="value">{data.puget_sound_temp_f || 52}°F</span>
            </div>
            <div className="stat">
              <span className="label">Wind Speed</span>
              <span className="value">{data.wind_speed_mph} mph</span>
            </div>
          </div>
          <div className="insight">
            <Sun size={14} />
            <p>{getWaterInsight()}</p>
          </div>
        </div>
      </div>

      <style>{`
        .sports-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 600px) {
          .sports-grid { grid-template-columns: 1fr; }
        }
        .sports-card {
          padding: 20px;
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .card-header {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .card-header h3 {
          font-size: 15px;
          color: var(--text-strong);
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .icon { padding: 8px; border-radius: 12px; }
        .snow-icon { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .water-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .stat { display: flex; flex-direction: column; gap: 4px; }
        .stat .label { font-size: 10px; color: var(--text-muted); font-weight: 500; }
        .stat .value { font-size: 18px; color: var(--text-strong); font-weight: 700; }
        
        .insight {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px;
          background: rgba(0,0,0,0.03);
          border-radius: 12px;
          color: var(--text-muted);
        }
        .solo-mode .insight { background: rgba(255,255,255,0.04); }
        .insight p { font-size: 12px; line-height: 1.4; font-weight: 500; }
        .insight svg { flex-shrink: 0; margin-top: 1px; color: var(--accent-primary); }
        .solo-mode .insight svg { color: var(--solo-accent); }

        .loading-state .skeleton-line {
          height: 12px;
          background: rgba(0,0,0,0.05);
          border-radius: 4px;
          width: 80%;
        }
      `}</style>
    </div>
  );
};

export default SportsDataCard;
