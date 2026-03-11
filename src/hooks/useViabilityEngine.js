import { useState, useCallback, useEffect } from 'react';

export const useViabilityEngine = () => {
    const [isGoldenHour, setIsGoldenHour] = useState(false);
    const [forceSummerMode, setForceSummerMode] = useState(false);

    const [envData, setEnvData] = useState({
        tideHeight: 1.2,
        snowDepth: 4.0,
        temp: 65,
        condition: 'Sunny'
    });

    const [forecast, setForecast] = useState({
        today: {
            temp: 65,
            condition: 'Sunny',
            vibe: 'Golden Hour Paddle',
            insight: 'Perfect glass on the water. High-vis conditions.'
        },
        weekend: {
            temp: 58,
            condition: 'Crisp',
            vibe: 'Mountain Adventure',
            insight: 'New snow at Snoqualmie. Ideal for first tracks.'
        },
        week: {
            summary: 'Warming Trend',
            vibe: 'Urban Exploration',
            insight: 'Temps rising to 70° by Friday. Plan for an outdoor dinner.'
        }
    });

    const updateEnvironment = useCallback(() => {
        if (forceSummerMode) {
            setIsGoldenHour(true);
            return;
        }

        const now = new Date();
        const hour = now.getHours();
        const month = now.getMonth() + 1; // 1-12

        // Summer Mode: June (6) to August (8)
        if (month >= 6 && month <= 8) {
            setIsGoldenHour(hour >= 18 && hour <= 21);
        } else {
            setIsGoldenHour(false);
        }
    }, [forceSummerMode]);

    useEffect(() => {
        updateEnvironment();
    }, [updateEnvironment]);

    const calculateScore = (event, userResources, isParentingWeek, preferences = {}, agenda = []) => {
        let score = 50;

        // 1. Hard Constraints: Parenting vs Kids
        if (isParentingWeek && !event.isKidFriendly) {
            return 0;
        }

        // 2. Preference Constraints: Time Windows
        if (preferences.noEventsBefore || preferences.noEventsAfter) {
            const eventDate = new Date(event.startDate);
            const eventHour = eventDate.getHours();
            const eventMin = eventDate.getMinutes();
            const eventTimeVal = eventHour + (eventMin / 60);

            if (preferences.noEventsBefore) {
                const [h, m] = preferences.noEventsBefore.split(':').map(Number);
                const limit = h + (m / 60);
                if (eventTimeVal < limit) return 0;
            }

            if (preferences.noEventsAfter) {
                const [h, m] = preferences.noEventsAfter.split(':').map(Number);
                const limit = h + (m / 60);
                if (eventTimeVal > limit) return 0;
            }
        }

        // 3. Preference Constraints: Break Days
        if (preferences.breakEveryOtherDay && agenda.length > 0) {
            const dateStr = new Date(event.startDate).toDateString();
            const hasEventOnSameDay = agenda.some(item => new Date(item.startDate).toDateString() === dateStr && item.id !== event.id);

            // Check previous day
            const prevDay = new Date(event.startDate);
            prevDay.setDate(prevDay.getDate() - 1);
            const prevDayStr = prevDay.toDateString();
            const hasEventOnPrevDay = agenda.some(item => new Date(item.startDate).toDateString() === prevDayStr);

            if (hasEventOnPrevDay && !hasEventOnSameDay) {
                score -= 40; // Penalty for back-to-back days
            }
        }

        // 4. Activity Scoring: Resources & Environment
        const title = event.title.toLowerCase();

        if (title.includes('kayak')) {
            const hasKayak = userResources.some(r => r.name.toLowerCase().includes('kayak') && r.isAvailable);
            score += hasKayak ? 30 : -40;
            if (envData.tideHeight > 1.0) score += 10;
        }

        if (title.includes('ski') || title.includes('snow')) {
            const hasSkis = userResources.some(r => r.name.toLowerCase().includes('ski') && r.isAvailable);
            score += hasSkis ? 30 : -40;
            if (envData.snowDepth > 3) score += 20;
        }

        if (isGoldenHour && (title.includes('hike') || title.includes('paddle'))) {
            score += 15;
        }

        return Math.min(100, Math.max(0, score));
    };

    return { isGoldenHour, forceSummerMode, setForceSummerMode, envData, forecast, calculateScore };
};
