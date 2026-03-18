import React from 'react';
import { Users, Zap, Heart } from 'lucide-react';

const SocialPulse = ({ isParentingWeek }) => {
  return (
    <div className={`social-pulse glass ${isParentingWeek ? 'parenting' : 'solo'}`}>
      <div className="pulse-header">
        <Users size={16} />
        <span className="label">Community Pulse</span>
      </div>

      <div className="pulse-item highlight">
        <Zap size={14} className="icon-burn" />
        <span className="text">Discovery Engine: 12 new social invitations active in your area.</span>
      </div>

      <div className="pulse-item">
        <Heart size={14} />
        <span className="text">Safe-Radius: 4 parent-verified locations added recently.</span>
      </div>

      <style>{`
        .social-pulse {
          padding: 24px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 16px;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }
        .pulse-header {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-muted);
        }
        .solo-mode .pulse-header { color: var(--solo-text-muted); }
        .pulse-header .label {
          font-size: 13px;
          font-family: var(--font-body);
          font-weight: 700;
          letter-spacing: -0.01em;
        }

        .pulse-item {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
        }
        .solo-mode .pulse-item { color: var(--solo-text-muted); }
        .pulse-item.highlight {
          color: var(--text-strong);
          font-weight: 600;
        }
        .solo-mode .pulse-item.highlight { color: var(--solo-text-strong); }

        .icon-burn {
          color: var(--accent-primary);
          filter: drop-shadow(0 0 8px var(--accent-soft));
        }
        .solo-mode .icon-burn {
          color: var(--solo-accent);
          filter: drop-shadow(0 0 12px var(--solo-accent-soft));
        }
      `}</style>
    </div>
  );
};

export default SocialPulse;
