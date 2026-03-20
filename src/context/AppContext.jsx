import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRotationEngine } from '../hooks/useRotationEngine';
import { useViabilityEngine } from '../hooks/useViabilityEngine';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { mockResources } from '../data';

const AppContext = createContext();

/** Strip undefined values and convert Date objects to ISO strings so Firestore accepts the data. */
const sanitizeForFirestore = (val) => {
    if (val === undefined || val === null) return null;
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val)) return val.map(sanitizeForFirestore);
    if (typeof val === 'object') {
        return Object.fromEntries(
            Object.entries(val)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, sanitizeForFirestore(v)])
        );
    }
    return val;
};

export const AppProvider = ({ children }) => {
    const { user } = useAuth();
    const rotation = useRotationEngine();
    const viability = useViabilityEngine();

    const [agenda, setAgenda] = useState(() => {
        const saved = localStorage.getItem('emerald_agenda');
        return saved ? JSON.parse(saved) : [];
    });

    const [preferences, setPreferences] = useState(() => {
        const saved = localStorage.getItem('emerald_preferences');
        if (saved) return JSON.parse(saved);
        return {
            breakEveryOtherDay: false,
            noEventsBefore: '08:00',
            noEventsAfter: '22:00',
        };
    });

    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('emerald_theme');
        return saved || 'auto';
    });

    // Clear local state on logout
    useEffect(() => {
        if (!user) {
            setAgenda([]);
        }
    }, [user]);

    // Firestore Sync & Migration
    useEffect(() => {
        if (!user || !db) return;

        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.agenda) setAgenda(data.agenda);
                if (data.preferences) setPreferences(data.preferences);
            } else {
                // First time login - migrate guest data to Firestore
                const currentAgenda = JSON.parse(localStorage.getItem('emerald_agenda') || '[]');
                const currentPrefs = JSON.parse(localStorage.getItem('emerald_preferences') || 'null');
                
                setDoc(userDocRef, {
                    agenda: sanitizeForFirestore(currentAgenda),
                    preferences: currentPrefs || preferences,
                    lastSynced: new Date().toISOString()
                });
            }
        });

        return () => unsubscribe();
    }, [user]);

    // Local Storage Fallback for Guests
    useEffect(() => {
        localStorage.setItem('emerald_agenda', JSON.stringify(agenda));
    }, [agenda]);

    useEffect(() => {
        localStorage.setItem('emerald_preferences', JSON.stringify(preferences));
    }, [preferences]);

    useEffect(() => {
        localStorage.setItem('emerald_theme', theme);
    }, [theme]);

    const syncToFirestore = async (newAgenda, newPrefs) => {
        if (!user || !db) return;
        const userDocRef = doc(db, 'users', user.uid);
        try {
            await setDoc(userDocRef, {
                agenda: sanitizeForFirestore(newAgenda ?? agenda),
                preferences: newPrefs || preferences,
                lastSynced: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.error('Firestore sync failed:', err);
        }
    };

    const addToAgenda = (event, status = 'added') => {
        const newAgenda = [...agenda];
        const exists = newAgenda.find(item => item.id === event.id);
        
        let updatedAgenda;
        if (exists) {
            updatedAgenda = newAgenda.map(item => item.id === event.id ? { ...item, status } : item);
        } else {
            updatedAgenda = [...newAgenda, { ...event, status }];
        }
        
        setAgenda(updatedAgenda);
        syncToFirestore(updatedAgenda);
    };

    const removeFromAgenda = (eventId) => {
        const updatedAgenda = agenda.filter(item => item.id !== eventId);
        setAgenda(updatedAgenda);
        syncToFirestore(updatedAgenda);
    };

    const updatePreferences = (newPrefs) => {
        const updatedPrefs = { ...preferences, ...newPrefs };
        setPreferences(updatedPrefs);
        syncToFirestore(null, updatedPrefs);
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
