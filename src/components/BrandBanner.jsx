import React from 'react';

const BrandBanner = ({ isParentingWeek }) => {
  return (
    <div className={`brand-banner ${isParentingWeek ? 'parenting' : 'solo'}`}>
      <div className="banner-overlay" />
      <div className="banner-content">
        <span className="eyebrow">Seattle Discovery Engine</span>
        <h1>{isParentingWeek ? 'Mist & Cedar' : 'Electric Sound'}</h1>
        <p>{isParentingWeek ? 'Family, stability, and neighborhood exploration.' : 'High-energy social, deep adventure, and recharge.'}</p>
      </div>

      <style>{`
        .brand-banner {
          position: relative;
          height: 220px;
          border-radius: var(--radius-xl);
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          background-size: cover;
          background-position: center;
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
          background: linear-gradient(to top, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.3) 50%, transparent 100%);
        }
        .banner-content {
          position: relative;
          z-index: 2;
          padding: 28px;
          color: white;
        }
        .eyebrow {
          font-size: 11px;
          letter-spacing: 0.5px;
          opacity: 0.7;
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }
        h1 {
          font-family: var(--font-header);
          font-size: 32px;
          font-weight: 500;
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 8px;
          color: white;
        }
        p {
          font-size: 14px;
          opacity: 0.8;
          max-width: 80%;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

export default BrandBanner;
