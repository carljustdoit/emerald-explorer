import React from 'react';

const BrandBanner = ({ isParentingWeek }) => {
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
      `}</style>
    </div>
  );
};

export default BrandBanner;
