import { useState, useCallback, useEffect } from 'react';
import { fetchSportsData } from '../services/api';

export const useViabilityEngine = () => {
    const [isGoldenHour, setIsGoldenHour] = useState(false);
    const [forceSummerMode, setForceSummerMode] = useState(false);

    const [sportsData, setSportsData] = useState(null);
    const [envData, setEnvData] = useState({
        tideHeight: 1.2,
        snowDepth: 0,
        temp: 45,
        condition: 'Cloudy'
    });

    const [forecast, setForecast] = useState({
        today: {
            temp: 45,
            condition: 'Cloudy',
            vibe: 'Cozy Morning',
            insight: 'Checking the pulse of the city...'
        },
        weekend: {
            temp: 52,
            condition: 'Mild',
            vibe: 'Discovery Mode',
            insight: 'Stay tuned for weekend updates.'
        },
        week: {
            summary: 'Typical Seattle',
            vibe: 'Steady Vibe',
            insight: 'Preparing your weekly outlook.'
        }
    });

    useEffect(() => {
        const fetchRealData = async () => {
            try {
                const data = await fetchSportsData();
                
                const today = data.today;
                if (!today) {
                  console.error('Sports data missing "today" object:', data);
                  return;
                }
                setSportsData(data);
                setEnvData({
                    tideHeight: today.tide_height_ft || 1.2,
                    snowDepth: today.snoqualmie_base_depth_inches || 0,
                    temp: today.temp_f || 45,
                    condition: today.conditions || 'Cloudy'
                });

                // Dynamically update forecast categories based on real tiered data
                setForecast({
                    today: {
                        temp: Math.round(today.temp_f || 45),
                        condition: today.conditions || 'Cloudy',
                        vibe: today.temp_f > 60 ? 'Lake Vibes' : 'Cozy Morning',
                        insight: today.snoqualmie_new_snow_inches > 0 
                            ? `Fresh tracks! ${today.snoqualmie_new_snow_inches}" of new snow at Snoqualmie.`
                            : `${today.wave_summary}. Lake temp is ${today.lake_union_temp_f || 62}°.`
                    },
                    tomorrow: data.tomorrow ? {
                        temp: Math.round(data.tomorrow.temp_f),
                        condition: data.tomorrow.conditions,
                        vibe: 'Next Up',
                        insight: data.tomorrow.snow_forecast_inches > 0
                            ? `Tomorrow: Expect ${data.tomorrow.snow_forecast_inches}" of fresh snow!`
                            : `Smooth sailing tomorrow with ${data.tomorrow.conditions.toLowerCase()} skies.`
                    } : null,
                    weekend: data.weekend ? {
                        temp: Math.round(data.weekend.temp_f),
                        condition: data.weekend.conditions,
                        vibe: 'Weekend Warrior',
                        insight: data.weekend.snow_forecast_inches > 0
                            ? `Big weekend coming! Total ${data.weekend.snow_forecast_inches}" snow forecast.`
                            : `Outdoor friendly weekend with highs of ${Math.round(data.weekend.temp_f)}°.`
                    } : null,
                    week: {
                        summary: 'Full Week',
                        vibe: 'Steady Vibe',
                        insight: 'Click for the 7-day temperature trend and outlook.'
                    }
                });
            } catch (error) {
                console.error('Failed to fetch real-time data for viability engine:', error);
            }
        };

        fetchRealData();
    }, []);

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

    return { isGoldenHour, forceSummerMode, setForceSummerMode, envData, forecast, sportsData, calculateScore };
};
