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
        <div className="section-card glass snow">
          <div className="section-header">
            <div className="icon-box">
              <Mountain size={20} />
            </div>
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
          <div className="section-insight">
            <Zap size={14} />
            <p>{getSnowInsight()}</p>
          </div>
        </div>

        {/* Water Card */}
        <div className="section-card glass water">
          <div className="section-header">
            <div className="icon-box">
              <Waves size={20} />
            </div>
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
          <div className="section-insight">
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
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          padding: 8px 0;
        }
        .stat { display: flex; flex-direction: column; gap: 4px; }
        .stat .label { font-size: 10px; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
        .solo-mode .stat .label { color: var(--solo-text-muted); }
        .stat .value { font-size: 20px; color: var(--text-strong); font-weight: 700; font-family: var(--font-header); }
        .solo-mode .stat .value { color: var(--solo-text-strong); }
        
        .loading-state {
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .loading-state .skeleton-line {
          height: 12px;
          background: rgba(0,0,0,0.05);
          border-radius: 4px;
          width: 80%;
          margin-bottom: 8px;
        }
        .solo-mode .loading-state .skeleton-line { background: rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
};

export default SportsDataCard;
