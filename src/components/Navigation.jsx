import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Compass, Settings, Shield, LogIn } from 'lucide-react';

const Navigation = () => {
  const { user, isAdmin } = useAuth();

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <Home size={20} strokeWidth={1.5} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/discovery" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Compass size={20} strokeWidth={1.5} />
        <span>Discover</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Settings size={20} strokeWidth={1.5} />
        <span>Settings</span>
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Shield size={20} strokeWidth={1.5} />
          <span>Admin</span>
        </NavLink>
      )}
      {!user && (
        <NavLink to="/login" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LogIn size={20} strokeWidth={1.5} />
          <span>Login</span>
        </NavLink>
      )}

      <style>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 72px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding-bottom: env(safe-area-inset-bottom);
          z-index: 1000;
          background: rgba(245, 243, 239, 0.88);
          backdrop-filter: blur(28px) saturate(1.4);
          -webkit-backdrop-filter: blur(28px) saturate(1.4);
          border-top: 1px solid rgba(0, 0, 0, 0.04);
        }
        .solo-mode .bottom-nav {
          background: rgba(12, 15, 26, 0.9);
          border-top-color: rgba(255,255,255,0.05);
        }
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          color: var(--text-muted);
          text-decoration: none;
          transition: var(--transition-fast);
          flex: 1;
          padding: 8px 0;
        }
        .solo-mode .nav-item { color: var(--solo-text-muted); }
        .nav-item span {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }
        .nav-item svg {
          transition: var(--transition-fast);
        }
        .nav-item.active {
          color: var(--accent-primary);
        }
        .nav-item.active svg {
          transform: translateY(-1px);
        }
        .solo-mode .nav-item.active {
          color: var(--solo-accent);
        }
      `}</style>
    </nav>
  );
};

export default Navigation;
