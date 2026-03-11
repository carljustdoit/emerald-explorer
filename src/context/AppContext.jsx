import React, { createContext, useContext, useState } from 'react';
import { useRotationEngine } from '../hooks/useRotationEngine';
import { useViabilityEngine } from '../hooks/useViabilityEngine';
import { mockResources } from '../data';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const rotation = useRotationEngine();
    const viability = useViabilityEngine();

    const [agenda, setAgenda] = useState([]);

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

    const value = {
        rotation,
        viability,
        agenda,
        addToAgenda,
        removeFromAgenda,
        preferences,
        updatePreferences,
        toggleSummerMode,
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
