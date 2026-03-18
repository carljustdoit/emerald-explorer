import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Discovery from './pages/Discovery';
import Settings from './pages/Settings';
import Admin from './pages/Admin';

const AppLayout = () => {
  const { rotation } = useApp();

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
            <Route path="/" element={<Home />} />
            <Route path="/discovery" element={<Discovery />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </main>

      <Navigation />

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
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}

export default App;
