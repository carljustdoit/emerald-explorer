import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BrandBanner = ({ isParentingWeek }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleAuthAction = () => {
    if (user) {
      logout();
    } else {
      navigate('/login');
    }
  };

  return (
    <div className={`brand-banner ${isParentingWeek ? 'parenting' : 'solo'}`}>
      <div className="banner-overlay" />
      <div className="banner-content">
        <span className="eyebrow">Seattle Discovery Engine</span>
        <h1>{isParentingWeek ? 'Mist & Cedar' : 'Electric Sound'}</h1>
        <p>{isParentingWeek 
          ? 'Family, stability, and neighborhood exploration.' 
          : 'High-energy social, deep adventure, and recharge.'}</p>
      </div>

      <div className="banner-actions">
        {user ? (
          <button onClick={handleAuthAction} className="auth-pill" title="Logout">
            <User size={14} />
            <span>{user.email.split('@')[0]}</span>
            <LogOut size={14} />
          </button>
        ) : (
          <button onClick={handleAuthAction} className="auth-pill login" title="Login">
            <LogIn size={14} />
            <span>Log In</span>
          </button>
        )}
      </div>

      <style>{`
        .brand-banner {
          position: relative;
          height: 200px;
          border-radius: var(--radius-xl);
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          background-size: cover;
          background-position: center 40%;
          transition: var(--transition-smooth);
        }
        .brand-banner.parenting {
          background-image: url('https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=1200');
        }
        .brand-banner.solo {
          background-image: url('https://images.unsplash.com/photo-1514525253361-bee8d488b1b0?auto=format&fit=crop&q=80&w=1200');
        }
        .banner-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
        }
        .brand-banner.parenting .banner-overlay {
          background: linear-gradient(to top, rgba(26, 26, 26, 0.75) 0%, rgba(26, 26, 26, 0.1) 60%, transparent 100%);
        }
        .brand-banner.solo .banner-overlay {
          background: linear-gradient(to top, rgba(12, 15, 26, 0.92) 0%, rgba(12, 15, 26, 0.3) 55%, transparent 100%);
        }
        .banner-content {
          position: relative;
          z-index: 2;
          padding: 24px 28px;
          color: white;
        }
        .brand-banner .eyebrow {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.6;
          display: block;
          margin-bottom: 6px;
          font-weight: 600;
        }
        .brand-banner h1 {
          font-family: var(--font-header);
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: 6px;
          color: white;
        }
        .brand-banner p {
          font-size: 13px;
          opacity: 0.72;
          max-width: 85%;
          line-height: 1.5;
          font-weight: 400;
        }
        .banner-actions {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 10;
        }
        .auth-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 40px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          transition: var(--transition-fast);
        }
        .auth-pill:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }
        .auth-pill.login {
          background: var(--accent-primary);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .solo-mode .auth-pill.login {
          background: var(--solo-accent);
          color: black;
        }
        .auth-pill span {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

export default BrandBanner;
