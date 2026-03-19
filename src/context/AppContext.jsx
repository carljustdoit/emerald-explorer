import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRotationEngine } from '../hooks/useRotationEngine';
import { useViabilityEngine } from '../hooks/useViabilityEngine';
import { mockResources } from '../data';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const rotation = useRotationEngine();
    const viability = useViabilityEngine();

    const [agenda, setAgenda] = useState(() => {
        const saved = localStorage.getItem('emerald_agenda');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('emerald_agenda', JSON.stringify(agenda));
    }, [agenda]);

    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('emerald_theme');
        return saved || 'auto';
    });

    useEffect(() => {
        localStorage.setItem('emerald_theme', theme);
    }, [theme]);

    const [preferences, setPreferences] = useState({
        breakEveryOtherDay: false,
        noEventsBefore: '08:00',
        noEventsAfter: '22:00',
    });

    const addToAgenda = (event, status = 'added') => {
        setAgenda(prev => {
            const exists = prev.find(item => item.id === event.id);
            if (exists) {
                return prev.map(item => item.id === event.id ? { ...item, status } : item);
            }
            return [...prev, { ...event, status }];
        });
    };

    const removeFromAgenda = (eventId) => {
        setAgenda(prev => prev.filter(item => item.id !== eventId));
    };

    const updatePreferences = (newPrefs) => {
        setPreferences(prev => ({ ...prev, ...newPrefs }));
    };

    const toggleSummerMode = () => {
        viability.setForceSummerMode(prev => !prev);
    };

    const effectiveIsParenting = theme === 'light' || (theme === 'auto' && rotation.isParentingWeek);

    const value = {
        rotation,
        viability,
        agenda,
        addToAgenda,
        removeFromAgenda,
        preferences,
        updatePreferences,
        toggleSummerMode,
        theme,
        setTheme,
        effectiveIsParenting,
        mockResources
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
