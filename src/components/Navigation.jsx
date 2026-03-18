import { useAuth } from '../context/AuthContext';
import { Home, Compass, Settings, Shield, LogOut } from 'lucide-react';

const Navigation = () => {
  const { isAdmin, logout } = useAuth();

  return (
    <nav className="bottom-nav glass">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <Home size={20} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/discovery" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Compass size={20} />
        <span>Discover</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Settings size={20} />
        <span>Settings</span>
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Shield size={20} />
          <span>Admin</span>
        </NavLink>
      )}

      <style jsx>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 68px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding-bottom: env(safe-area-inset-bottom);
          z-index: 1000;
          background: var(--glass-bg);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-top: 1px solid var(--glass-border);
        }
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: var(--text-muted);
          text-decoration: none;
          transition: all 0.3s ease;
          flex: 1;
        }
        .solo-mode .nav-item { color: var(--solo-text-muted); }
        .nav-item span {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.3px;
        }
        .nav-item.active {
          color: var(--accent-primary);
        }
        .solo-mode .nav-item.active {
          color: var(--solo-accent);
        }
      `}</style>
    </nav>
  );
};

export default Navigation;
