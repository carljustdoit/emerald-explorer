import { useState, useCallback, useEffect } from 'react';
import { fetchSportsData } from '../services/api';

const getVibe = (temp, condition, snow, isWeekend) => {
    const cond = (condition || '').toLowerCase();
    const isSunny = cond.includes('sun') || cond.includes('clear');
    const isPartlyCloudy = cond.includes('partly cloudy');
    const isRainy = cond.includes('rain') || cond.includes('shower') || cond.includes('drizzle');
    const isSnowy = cond.includes('snow');

    if (snow > 2) return isWeekend ? 'Ski Weekend' : 'Powder Day';
    if (temp > 68 && isSunny) return 'Prime Lake Day';
    if (temp > 60 && (isSunny || isPartlyCloudy)) return 'Lake Vibes';
    if (temp > 55) return 'Outdoor Ready';
    if (temp > 48 && isSunny) return 'Crisp & Clear';
    if (isRainy) return 'Cozy Indoors';
    if (isSnowy) return isWeekend ? 'Ski Weekend' : 'Powder Day';
    if (temp < 40) return 'Bundle Up';
    return isWeekend ? 'Weekend Explorer' : 'City Explorer';
};

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
                const todaySnow = today.snoqualmie_new_snow_inches || 0;
                const todayTemp = today.temp_f || 45;
                const todayCondition = today.conditions || 'Cloudy';

                const tomorrowSnow = data.tomorrow?.snow_forecast_inches || 0;
                const tomorrowTemp = data.tomorrow?.temp_f || 45;
                const tomorrowCondition = data.tomorrow?.conditions || 'Cloudy';

                // Find weekend days (Sat/Sun) in weekly_forecast
                const weeklyForecast = data.weekly_forecast || [];
                const weekendEntries = weeklyForecast.filter(day => {
                    const d = new Date(day.date);
                    return d.getDay() === 0 || d.getDay() === 6; // Sun or Sat
                });
                const weekendHigh = weekendEntries.length > 0
                    ? Math.max(...weekendEntries.map(d => d.high ?? (data.weekend?.temp_f + 5 ?? 57)))
                    : (data.weekend?.temp_f ?? 52) + 5;
                const weekendLow = weekendEntries.length > 0
                    ? Math.min(...weekendEntries.map(d => d.low ?? (data.weekend?.temp_f - 8 ?? 44)))
                    : (data.weekend?.temp_f ?? 52) - 8;
                const weekendSnow = data.weekend?.snow_forecast_inches || 0;
                const weekendTemp = data.weekend?.temp_f || 52;
                const weekendCondition = data.weekend?.conditions || 'Cloudy';

                setForecast({
                    today: {
                        temp: Math.round(todayTemp),
                        condition: todayCondition,
                        high: data.weekly_forecast?.[0]?.high,
                        low: data.weekly_forecast?.[0]?.low,
                        vibe: getVibe(todayTemp, todayCondition, todaySnow, false),
                        insight: todaySnow > 0
                            ? `Fresh tracks! ${todaySnow}" of new snow at Snoqualmie.`
                            : `${today.wave_summary}. Lake temp is ${today.lake_union_temp_f || 62}°.`
                    },
                    tomorrow: data.tomorrow ? {
                        temp: Math.round(tomorrowTemp),
                        condition: tomorrowCondition,
                        high: data.weekly_forecast?.[1]?.high,
                        low: data.weekly_forecast?.[1]?.low,
                        vibe: getVibe(tomorrowTemp, tomorrowCondition, tomorrowSnow, false),
                        insight: tomorrowSnow > 0
                            ? `Tomorrow: Expect ${tomorrowSnow}" of fresh snow!`
                            : `Smooth sailing tomorrow with ${tomorrowCondition.toLowerCase()} skies.`
                    } : null,
                    weekend: data.weekend ? {
                        temp: Math.round(weekendTemp),
                        condition: weekendCondition,
                        high: weekendHigh,
                        low: weekendLow,
                        vibe: getVibe(weekendTemp, weekendCondition, weekendSnow, true),
                        insight: weekendSnow > 0
                            ? `Big weekend coming! Total ${weekendSnow}" snow forecast.`
                            : `Outdoor friendly weekend with highs of ${Math.round(weekendTemp)}°.`
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
