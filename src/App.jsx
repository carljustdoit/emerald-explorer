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
  const { rotation } = useApp();
  const { user } = useAuth();

  useEffect(() => {
    if (rotation.isParentingWeek) {
      document.body.classList.remove('solo-mode');
    } else {
      document.body.classList.add('solo-mode');
    }
  }, [rotation.isParentingWeek]);

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
          padding-bottom: 80px;
        }

        main {
          padding: 24px 20px;
          max-width: 650px;
          margin: 0 auto;
        }
        .content-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
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
