import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, LogIn, Chrome } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Failed to log in. Please check your credentials.');
      console.error(err);
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      setError('Failed to log in with Google.');
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-card glass">
        <div className="login-header">
          <div className="logo-sparkle">✦</div>
          <h1>Welcome Back</h1>
          <p>Sign in to explore Seattle's best events</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <Mail size={18} />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <Lock size={18} />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
            {!loading && <LogIn size={18} />}
          </button>
        </form>

        <div className="divider">
          <span>or continue with</span>
        </div>

        <button onClick={handleGoogleLogin} className="google-btn" disabled={loading}>
          <Chrome size={18} />
          Google
        </button>

        <p className="signup-link">
          Don't have an account? <Link to="/signup">Sign up for free</Link>
        </p>
      </div>

      <style>{`
        .login-page {
          min-height: 90vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .login-card {
          width: 100%;
          max-width: 380px;
          padding: 36px;
          border-radius: var(--radius-xl);
          text-align: center;
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-header {
          margin-bottom: 32px;
        }

        .logo-sparkle {
          font-size: 32px;
          color: var(--accent-primary);
          margin-bottom: 12px;
          animation: pulse 2s infinite ease-in-out;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }

        .login-header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }

        .login-header p {
          color: var(--text-muted);
          font-size: 15px;
        }

        .error-message {
          background: rgba(244, 67, 54, 0.1);
          color: #f44336;
          padding: 12px;
          border-radius: 12px;
          margin-bottom: 24px;
          font-size: 14px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
          background: var(--bg-surface);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 0 14px;
          transition: var(--transition-fast);
        }

        .solo-mode .input-group {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .input-group:focus-within {
          background: white;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 1px var(--accent-primary);
        }

        .solo-mode .input-group:focus-within {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--solo-accent);
          box-shadow: 0 0 0 1px var(--solo-accent);
        }

        .input-group input {
          width: 100%;
          padding: 16px 12px;
          border: none;
          background: transparent;
          font-size: 15px;
          outline: none;
        }

        .input-group svg {
          color: var(--text-muted);
        }

        .login-btn {
          margin-top: 8px;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          padding: 14px;
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .solo-mode .login-btn {
          background: var(--solo-accent);
          color: #0c0f1a;
        }

        .login-btn:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .login-btn:active {
          transform: translateY(0);
        }

        .divider {
          margin: 32px 0;
          position: relative;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }

        .solo-mode .divider {
          border-top-color: rgba(255, 255, 255, 0.1);
        }

        .divider span {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--bg-main);
          padding: 0 12px;
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .google-btn {
          width: 100%;
          background: var(--bg-surface);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 13px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .solo-mode .google-btn {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .google-btn:hover {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.2);
        }

        .solo-mode .google-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .signup-link {
          margin-top: 32px;
          font-size: 14px;
          color: var(--text-muted);
        }

        .signup-link a {
          color: var(--accent-primary);
          font-weight: 600;
          text-decoration: none;
        }

        .solo-mode .signup-link a {
          color: var(--solo-accent);
        }
      `}</style>
    </div>
  );
};

export default Login;
