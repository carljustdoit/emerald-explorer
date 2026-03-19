import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Discovery from './pages/Discovery';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Signup from './pages/Signup';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/" />;

  return children;
};

const AppLayout = () => {
  const { effectiveIsParenting } = useApp();
  const { user } = useAuth();
  
  useEffect(() => {
    if (effectiveIsParenting) {
      document.body.classList.remove('solo-mode');
    } else {
      document.body.classList.add('solo-mode');
    }
  }, [effectiveIsParenting]);

  return (
    <div className="app-container">
      <main>
        <div className="content-wrapper">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<Home />} />
            <Route path="/discovery" element={<Discovery />} />
            <Route path="/settings" element={<Settings />} />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute adminOnly={true}>
                  <Admin />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </div>
      </main>

      {user && <Navigation />}

      <style>{`
        .app-container {
          min-height: 100vh;
          padding-bottom: 88px;
        }

        main {
          padding: 20px 16px;
          max-width: 600px;
          margin: 0 auto;
        }
        .content-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
      `}</style>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
