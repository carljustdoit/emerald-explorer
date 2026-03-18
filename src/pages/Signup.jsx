import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, UserPlus } from 'lucide-react';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    try {
      setError('');
      setLoading(true);
      await signup(email, password);
      navigate('/');
    } catch (err) {
      setError('Failed to create an account. ' + err.message);
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-card glass">
        <div className="login-header">
          <div className="logo-sparkle">✦</div>
          <h1>Create Account</h1>
          <p>Join Emerald Explorer today</p>
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

          <div className="input-group">
            <Lock size={18} />
            <input 
              type="password" 
              placeholder="Confirm Password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
            {!loading && <UserPlus size={18} />}
          </button>
        </form>

        <p className="signup-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>

      <style>{`
        /* Reusing styles from Login.jsx */
        .login-page { min-height: 90vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .login-card { width: 100%; max-width: 400px; padding: 40px; border-radius: 32px; text-align: center; }
        .login-header { margin-bottom: 32px; }
        .logo-sparkle { font-size: 32px; color: var(--accent-primary); margin-bottom: 12px; }
        .login-header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .login-header p { color: var(--text-muted); font-size: 15px; }
        .error-message { background: rgba(244, 67, 54, 0.1); color: #f44336; padding: 12px; border-radius: 12px; margin-bottom: 24px; font-size: 14px; }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .input-group { position: relative; display: flex; align-items: center; background: rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.05); border-radius: 16px; padding: 0 16px; }
        .input-group input { width: 100%; padding: 16px 12px; border: none; background: transparent; outline: none; }
        .login-btn { margin-top: 8px; background: var(--accent-primary); color: white; border: none; border-radius: 16px; padding: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
        .signup-link { margin-top: 32px; font-size: 14px; color: var(--text-muted); }
        .signup-link a { color: var(--accent-primary); font-weight: 600; text-decoration: none; }
        .solo-mode .login-btn { background: var(--solo-accent); color: black; }
        .solo-mode .signup-link a { color: var(--solo-accent); }
      `}</style>
    </div>
  );
};

export default Signup;
