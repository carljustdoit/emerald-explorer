import { useState, useCallback, useEffect } from 'react';

// Patterns define the number of days for [Parent A, Parent B, Parent A, Parent B, ...]
export const ROTATION_PATTERNS = {
  WEEKLY: [7, 7],
  TWO_TWO_FIVE_FIVE: [2, 2, 5, 5],
  TWO_TWO_THREE: [2, 2, 3],
  MANUAL: [] // User-driven
};

export const useRotationEngine = (initialStartDate = new Date('2026-03-09')) => {
  const [rotationStartDate, setRotationStartDate] = useState(initialStartDate);
  const [pattern, setPattern] = useState('WEEKLY');
  const [isParentingWeek, setIsParentingWeek] = useState(false);
  const [overrides, setOverrides] = useState({}); // { '2026-03-10': true }

  const calculateStateOnDate = useCallback((targetDate, start, patternKey, manualOverrides = {}) => {
    const dateStr = targetDate.toISOString().split('T')[0];

    // Check manual overrides first
    if (manualOverrides[dateStr] !== undefined) {
      return manualOverrides[dateStr];
    }

    if (patternKey === 'MANUAL') return false;

    const days = ROTATION_PATTERNS[patternKey];
    const totalCycleDays = days.reduce((a, b) => a + b, 0);

    // Normalize dates to start of day
    const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const d1 = startOfDay(start);
    const d2 = startOfDay(targetDate);

    const diffDays = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return false;

    let dayInCycle = diffDays % totalCycleDays;
    let accumulated = 0;

    for (let i = 0; i < days.length; i++) {
      accumulated += days[i];
      if (dayInCycle < accumulated) {
        return i % 2 === 0;
      }
    }
    return false;
  }, []);

  const updateCurrentState = useCallback(() => {
    setIsParentingWeek(calculateStateOnDate(new Date(), rotationStartDate, pattern, overrides));
  }, [calculateStateOnDate, rotationStartDate, pattern, overrides]);

  useEffect(() => {
    updateCurrentState();
  }, [updateCurrentState]);

  const toggleMode = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setOverrides(prev => ({
      ...prev,
      [todayStr]: !isParentingWeek
    }));
  };

  const setManualOverride = (date, state) => {
    const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
    setOverrides(prev => ({
      ...prev,
      [dateStr]: state
    }));
  };

  const getScheduleForRange = (daysCount = 14) => {
    const schedule = [];
    const now = new Date();
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      schedule.push({
        date,
        isParenting: calculateStateOnDate(date, rotationStartDate, pattern, overrides)
      });
    }
    return schedule;
  };

  return {
    isParentingWeek,
    toggleMode,
    pattern,
    setPattern,
    rotationStartDate,
    setRotationStartDate,
    overrides,
    setManualOverride,
    getScheduleForRange,
    calculateStateOnDate
  };
};
