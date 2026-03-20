import { EnvironmentData } from '../types/schema.js';
import { fetchLakeUnionTemp, fetchTideData, fetchCedarRiverFlow } from '../ingestion/usgs.js';
import { SnowScraper } from '../ingestion/scrapers/SnowScraper.js';

export interface SportsData {
  today: EnvironmentData & { snow_forecast_inches: number };
  tomorrow: EnvironmentData & { snow_forecast_inches: number; icon: string };
  weekend?: EnvironmentData & { snow_forecast_inches: number; icon: string };
  thisWeek?: { temp_f: number; wind_speed_mph: number; conditions: string; snow_forecast_inches: number; icon: string };
  weekly_forecast: Array<{
    day: string;
    high: number;
    low: number;
    icon: string;
    condition: string;
  }>;
  resort_hours: {
    snoqualmie: import('../ingestion/scrapers/ResortHoursScraper.js').ResortHours;
    stevens: import('../ingestion/scrapers/ResortHoursScraper.js').ResortHours;
    crystal: import('../ingestion/scrapers/ResortHoursScraper.js').ResortHours;
  };
}

export class SportsDataService {
  private static cache: { data: SportsData | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private static CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  static async getSportsData(forceReload = false): Promise<SportsData> {
    const now = Date.now();
    if (!forceReload && this.cache.data && now - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      console.log('[SportsDataService] Fetching real-time sports and weather data...');
      
      const [snowData, weatherData, usgsData, mountainForecast] = await Promise.all([
        SnowScraper.getAllSnowData(),
        this.fetchNWSWeather(), // City weather (includes windDirection per period)
        this.fetchWaterData(),
        this.fetchMountainForecast(), // Mountain forecast for snow
      ]);

      const todaySnowForecast = this.parseSnowInches(mountainForecast.periods[0]?.detailedForecast || '');
      const tomorrowSnowForecast = this.parseSnowInches(mountainForecast.periods[2]?.detailedForecast || '') + 
                                   this.parseSnowInches(mountainForecast.periods[3]?.detailedForecast || '');

      // Simple weekend aggregation (assuming today is Wed, weekend is periods index 6-9 roughly)
      // Sat Day (idx 6), Sat Night (idx 7), Sun Day (idx 8), Sun Night (idx 9)
      const weekendPeriods = mountainForecast.periods.filter((p: any) => p.name.includes('Saturday') || p.name.includes('Sunday'));
      const weekendSnow = weekendPeriods.reduce((acc: number, p: any) => acc + this.parseSnowInches(p.detailedForecast), 0);
      const weekendTemp = Math.max(...weekendPeriods.map((p: any) => p.temperature));
      const weekendWind = Math.max(...weekendPeriods.map((p: any) => parseInt(p.windSpeed) || 0));

      // NWS windDirection is a string like "SW", "NW", "N", "SSW" etc.
      const todayWindDir: string = weatherData.periods[0]?.windDirection || usgsData.lake_washington_wind_dir || 'SW';
      const tomorrowWindDir: string = weatherData.periods[2]?.windDirection || 'SW';
      const weekendWindDir: string = weekendPeriods[0]?.windDirection || 'SW';

      const combinedData: SportsData = {
        today: {
          snoqualmie_base_depth_inches: snowData.snoqualmie.baseDepth,
          snoqualmie_mid_depth_inches: snowData.snoqualmie.midDepth,
          snoqualmie_peak_depth_inches: snowData.snoqualmie.peakDepth,
          snoqualmie_snow_condition: snowData.snoqualmie.condition,
          stevens_pass_new_snow_inches: snowData.stevens.newSnow24h,
          stevens_pass_base_depth_inches: snowData.stevens.baseDepth,
          stevens_pass_snow_condition: snowData.stevens.condition,
          crystal_mountain_new_snow_inches: snowData.crystal.newSnow24h,
          crystal_mountain_base_depth_inches: snowData.crystal.baseDepth,
          crystal_mountain_mid_depth_inches: snowData.crystal.midDepth,
          crystal_mountain_peak_depth_inches: snowData.crystal.peakDepth,
          crystal_mountain_snow_condition: snowData.crystal.condition,
          lake_union_temp_f: usgsData.lake_union_temp_f ?? 62,
          lake_washington_temp_f: usgsData.lake_washington_temp_f ?? 60,
          lake_washington_wind_mph: usgsData.lake_washington_wind_mph ?? 4,
          lake_washington_wind_dir: usgsData.lake_washington_wind_dir ?? todayWindDir,
          puget_sound_temp_f: usgsData.puget_sound_temp_f ?? 52,
          puget_sound_wind_mph: usgsData.puget_sound_wind_mph ?? 8,
          puget_sound_wind_dir: usgsData.puget_sound_wind_dir ?? todayWindDir,
          wave_summary: this.calculateWaves(usgsData.lake_washington_wind_mph, usgsData.puget_sound_wind_mph),
          cedar_river_flow_cfs: usgsData.cedar_river_flow_cfs ?? 450,
          temp_f: weatherData.periods[0]?.temperature ?? 45,
          wind_speed_mph: parseInt(weatherData.periods[0]?.windSpeed) ?? 5,
          sunset_time: '20:00',
          tide_height_ft: usgsData.tide_height_ft ?? 1.5,
          conditions: weatherData.periods[0]?.shortForecast ?? 'Fair',
          snow_forecast_inches: todaySnowForecast,
        },
        tomorrow: {
          snoqualmie_base_depth_inches: (snowData.snoqualmie.baseDepth || 0) + todaySnowForecast,
          snoqualmie_mid_depth_inches: (snowData.snoqualmie.midDepth || 0) + todaySnowForecast,
          snoqualmie_peak_depth_inches: (snowData.snoqualmie.peakDepth || 0) + todaySnowForecast,
          snoqualmie_snow_condition: todaySnowForecast > 2 ? 'Fresh Powder' : (snowData.snoqualmie.condition || 'Unknown'),
          stevens_pass_new_snow_inches: todaySnowForecast,
          stevens_pass_base_depth_inches: (snowData.stevens.baseDepth || 0) + todaySnowForecast,
          stevens_pass_snow_condition: todaySnowForecast > 2 ? 'Fresh Powder' : (snowData.stevens.condition || 'Unknown'),
          crystal_mountain_new_snow_inches: todaySnowForecast,
          crystal_mountain_base_depth_inches: (snowData.crystal.baseDepth || 0) + todaySnowForecast,
          crystal_mountain_mid_depth_inches: (snowData.crystal.midDepth || 0) + todaySnowForecast,
          crystal_mountain_peak_depth_inches: (snowData.crystal.peakDepth || 0) + todaySnowForecast,
          crystal_mountain_snow_condition: todaySnowForecast > 2 ? 'Fresh Powder' : (snowData.crystal.condition || 'Unknown'),
          lake_union_temp_f: usgsData.lake_union_temp_f ?? 62,
          lake_washington_temp_f: usgsData.lake_washington_temp_f ?? 60,
          lake_washington_wind_mph: parseInt(weatherData.periods[2]?.windSpeed) || 5,
          lake_washington_wind_dir: tomorrowWindDir,
          puget_sound_temp_f: usgsData.puget_sound_temp_f ?? 52,
          puget_sound_wind_mph: parseInt(weatherData.periods[2]?.windSpeed) ? parseInt(weatherData.periods[2]?.windSpeed) + 2 : 7,
          puget_sound_wind_dir: tomorrowWindDir,
          wave_summary: this.calculateWaves(parseInt(weatherData.periods[2]?.windSpeed) || 5, (parseInt(weatherData.periods[2]?.windSpeed) || 5) + 2),
          cedar_river_flow_cfs: usgsData.cedar_river_flow_cfs ?? 450,
          temp_f: mountainForecast.periods[2]?.temperature || 42,
          wind_speed_mph: parseInt(mountainForecast.periods[2]?.windSpeed) || 10,
          sunset_time: '20:01',
          tide_height_ft: (usgsData.tide_height_ft ?? 1.5) + 0.2,
          conditions: mountainForecast.periods[2]?.shortForecast || 'Overcast',
          snow_forecast_inches: tomorrowSnowForecast,
          icon: mountainForecast.periods[2]?.icon || '',
        },
        weekend: {
          snoqualmie_base_depth_inches: (snowData.snoqualmie.baseDepth || 0) + weekendSnow,
          snoqualmie_mid_depth_inches: (snowData.snoqualmie.midDepth || 0) + weekendSnow,
          snoqualmie_peak_depth_inches: (snowData.snoqualmie.peakDepth || 0) + weekendSnow,
          snoqualmie_snow_condition: weekendSnow > 3 ? 'Fresh Powder' : (snowData.snoqualmie.condition || 'Unknown'),
          stevens_pass_new_snow_inches: weekendSnow,
          stevens_pass_base_depth_inches: (snowData.stevens.baseDepth || 0) + weekendSnow,
          stevens_pass_snow_condition: weekendSnow > 3 ? 'Fresh Powder' : (snowData.stevens.condition || 'Unknown'),
          crystal_mountain_new_snow_inches: weekendSnow,
          crystal_mountain_base_depth_inches: (snowData.crystal.baseDepth || 0) + weekendSnow,
          crystal_mountain_mid_depth_inches: (snowData.crystal.midDepth || 0) + weekendSnow,
          crystal_mountain_peak_depth_inches: (snowData.crystal.peakDepth || 0) + weekendSnow,
          crystal_mountain_snow_condition: weekendSnow > 3 ? 'Fresh Powder' : (snowData.crystal.condition || 'Unknown'),
          lake_union_temp_f: usgsData.lake_union_temp_f ?? 62,
          lake_washington_temp_f: usgsData.lake_washington_temp_f ?? 60,
          lake_washington_wind_mph: weekendWind,
          lake_washington_wind_dir: weekendWindDir,
          puget_sound_temp_f: usgsData.puget_sound_temp_f ?? 52,
          puget_sound_wind_mph: weekendWind + 2,
          puget_sound_wind_dir: weekendWindDir,
          wave_summary: this.calculateWaves(weekendWind, weekendWind + 2),
          cedar_river_flow_cfs: usgsData.cedar_river_flow_cfs ?? 450,
          temp_f: weekendTemp,
          wind_speed_mph: weekendWind,
          sunset_time: '20:02',
          tide_height_ft: (usgsData.tide_height_ft ?? 1.5) + 0.3,
          conditions: weekendPeriods[0]?.shortForecast || 'Variable',
          snow_forecast_inches: weekendSnow,
          icon: weekendPeriods[0]?.icon,
        },
        weekly_forecast: (() => {
          const periods = weatherData.periods;
          const dayPeriods = periods.filter((p: any) => p.isDaytime);

          return dayPeriods.map((p: any) => {
            const index = periods.indexOf(p);
            const night = periods[index + 1];

            let dayName = p.name;
            if (dayName.toLowerCase().startsWith('this')) {
              dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            }

            return {
              day: dayName.substring(0, 3),
              high: p.temperature,
              low: (night && !night.isDaytime) ? night.temperature : (p.temperature - 12),
              icon: p.icon,
              condition: p.shortForecast,
            };
          });
        })(),
        resort_hours: {
          snoqualmie: snowData.snoqualmie.hours ?? { isOpenToday: true, openTime: '9:00 AM', closeTime: '4:00 PM', seasonStatus: 'open', note: null },
          stevens: snowData.stevens.hours ?? { isOpenToday: true, openTime: '9:00 AM', closeTime: '4:00 PM', seasonStatus: 'open', note: null },
          crystal: snowData.crystal.hours ?? { isOpenToday: true, openTime: '9:00 AM', closeTime: '4:00 PM', seasonStatus: 'open', note: null },
        },
      };

      this.cache = { data: combinedData, timestamp: now };
      return combinedData;
    } catch (error) {
      console.error('[SportsDataService] Error fetching sports data:', error);
      return this.cache.data || this.getDefaultData();
    }
  }

  private static async fetchWithTimeout(url: string, options: any = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  private static async fetchMountainForecast() {
    try {
      const response = await this.fetchWithTimeout('https://api.weather.gov/gridpoints/PDT/63,197/forecast');
      const data = await response.json();
      return data.properties;
    } catch (e: any) {
      console.warn('[SportsDataService] Mountain forecast fetch failed:', e.message);
      return { periods: [] };
    }
  }

  private static parseSnowInches(text: string): number {
    if (!text) return 0;
    // Look for "New snow accumulation of X to Y inches possible"
    // or "New snow accumulation of less than X inch possible"
    const rangeMatch = text.match(/snow accumulation of ([\d.]+)\s*to\s*([\d.]+)\s*inches/i);
    if (rangeMatch) return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
    
    const lessThanMatch = text.match(/less than ([\d.]+)\s*inch/i);
    if (lessThanMatch) return parseFloat(lessThanMatch[1]) * 0.5; // Average of 0-X

    const singleMatch = text.match(/around ([\d.]+)\s*inch/i);
    if (singleMatch) return parseFloat(singleMatch[1]);

    return 0;
  }

  private static async fetchNWSWeather() {
    try {
      const response = await this.fetchWithTimeout('https://api.weather.gov/gridpoints/SEW/125,68/forecast');
      if (!response.ok) throw new Error('NWS API failed');
      const data = await response.json();
      return data.properties;
    } catch (e: any) {
      console.warn('[SportsDataService] NWS weather fetch failed:', e.message);
      return { periods: [] };
    }
  }

  private static async fetchWaterData() {
    try {
      const [lakeUnion, cedarRiver, tide, lakeWA, ndbc] = await Promise.all([
          fetchLakeUnionTemp().catch(() => undefined),
          fetchCedarRiverFlow().catch(() => undefined),
          fetchTideData().catch(() => undefined),
          this.fetchKingCountyBuoy('0540').catch(() => undefined),
          this.fetchNDBCWind('WPOW1').catch(() => undefined),
      ]);

      const pugetSoundTemp = await this.fetchNOAAWaterTemp('9447130').catch(() => undefined);

      return {
          lake_union_temp_f: lakeUnion?.temp,
          cedar_river_flow_cfs: cedarRiver?.flow,
          tide_height_ft: tide?.height,
          puget_sound_temp_f: pugetSoundTemp,
          puget_sound_wind_mph: ndbc?.windSpeed,
          puget_sound_wind_dir: ndbc?.windDir,
          lake_washington_temp_f: lakeWA?.temp,
          lake_washington_wind_mph: lakeWA?.wind,
          lake_washington_wind_dir: lakeWA?.windDir,
      };
    } catch (e) {
      console.error('[SportsDataService] Error in fetchWaterData:', e);
      return {};
    }
  }

  private static async fetchKingCountyBuoy(stationId: string) {
    try {
      const url = `https://data.kingcounty.gov/resource/kngk-29j2.json?$where=station_id='${stationId}' AND parameter IN ('Water Temperature', 'Wind Speed', 'Wind Direction')&$order=datetime DESC&$limit=15`;
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) return undefined;
      const data = await response.json();

      const temp = data.find((r: any) => r.parameter === 'Water Temperature')?.value;
      const wind = data.find((r: any) => r.parameter === 'Wind Speed')?.value;
      const windDirDeg = data.find((r: any) => r.parameter === 'Wind Direction')?.value;

      return {
        temp: temp ? parseFloat(temp) : undefined,
        wind: wind ? parseFloat(wind) : undefined,
        windDir: windDirDeg ? this.degreesToCompass(parseFloat(windDirDeg)) : undefined,
      };
    } catch {
      return undefined;
    }
  }

  private static async fetchNDBCWind(stationId: string) {
    try {
      const url = `https://www.ndbc.noaa.gov/data/latest_obs/${stationId.toLowerCase()}.rss`;
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) return undefined;
      const text = await response.text();

      const speedMatch = text.match(/Wind Speed:<\/strong>\s*([\d.]+)\s*mph/);
      const dirMatch = text.match(/Wind Direction:<\/strong>\s*([\d.]+)\s*deg/i)
                    || text.match(/Wind Direction:<\/strong>\s*([A-Z]{1,3})/i);

      let windDir: string | undefined;
      if (dirMatch) {
        const val = dirMatch[1];
        windDir = isNaN(Number(val)) ? val : this.degreesToCompass(parseFloat(val));
      }

      return {
        windSpeed: speedMatch ? parseFloat(speedMatch[1]) : undefined,
        windDir,
      };
    } catch {
      return undefined;
    }
  }

  /** Convert meteorological wind direction degrees → compass label (wind blowing FROM that direction) */
  static degreesToCompass(deg: number): string {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(((deg % 360) / 22.5)) % 16];
  }

  private static calculateWaves(lakeWind?: number, soundWind?: number): string {
    const maxWind = Math.max(lakeWind || 0, soundWind || 0);
    if (maxWind > 15) return 'Chippy with significant whitecaps';
    if (maxWind > 8) return 'Light chop, some surface texture';
    return 'Calm, glassy conditions';
  }

  private static async fetchNOAAWaterTemp(stationId: string): Promise<number | undefined> {
    try {
        const response = await this.fetchWithTimeout(
          `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station_id=${stationId}&product=water_temperature&datum=MLLW&units=english&time_zone=lst_ldt&format=json`
        );
        if (!response.ok) return undefined;
        const data = await response.json();
        return parseFloat(data.data?.[0]?.v);
    } catch {
        return undefined;
    }
  }

  private static getDefaultData(): SportsData {
    return {
      today: {
        snoqualmie_base_depth_inches: 40,
        snoqualmie_mid_depth_inches: 55,
        snoqualmie_peak_depth_inches: 70,
        snoqualmie_snow_condition: 'Packed Powder',
        stevens_pass_new_snow_inches: 0,
        stevens_pass_base_depth_inches: 50,
        stevens_pass_snow_condition: 'Machine Groomed',
        crystal_mountain_new_snow_inches: 0,
        crystal_mountain_base_depth_inches: 60,
        crystal_mountain_mid_depth_inches: 75,
        crystal_mountain_peak_depth_inches: 90,
        crystal_mountain_snow_condition: 'Powder',
        lake_union_temp_f: 62,
        lake_washington_temp_f: 60,
        lake_washington_wind_mph: 4,
        lake_washington_wind_dir: 'SW',
        puget_sound_temp_f: 52,
        puget_sound_wind_mph: 8,
        puget_sound_wind_dir: 'SW',
        wave_summary: 'Calm, glassy conditions',
        cedar_river_flow_cfs: 450,
        wind_speed_mph: 5,
        temp_f: 45,
        sunset_time: '20:00',
        tide_height_ft: 1.5,
        conditions: 'Fair',
        snow_forecast_inches: 0,
      },
      tomorrow: {
        snoqualmie_base_depth_inches: 42,
        snoqualmie_mid_depth_inches: 57,
        snoqualmie_peak_depth_inches: 72,
        snoqualmie_snow_condition: 'Packed Powder',
        stevens_pass_new_snow_inches: 2,
        stevens_pass_base_depth_inches: 52,
        stevens_pass_snow_condition: 'Machine Groomed',
        crystal_mountain_new_snow_inches: 2,
        crystal_mountain_base_depth_inches: 62,
        crystal_mountain_mid_depth_inches: 77,
        crystal_mountain_peak_depth_inches: 92,
        crystal_mountain_snow_condition: 'Powder',
        lake_union_temp_f: 62,
        lake_washington_temp_f: 60,
        lake_washington_wind_mph: 6,
        lake_washington_wind_dir: 'SSW',
        puget_sound_temp_f: 52,
        puget_sound_wind_mph: 10,
        puget_sound_wind_dir: 'SSW',
        wave_summary: 'Light chop',
        cedar_river_flow_cfs: 450,
        temp_f: 42,
        wind_speed_mph: 10,
        sunset_time: '20:01',
        tide_height_ft: 1.7,
        conditions: 'Overcast',
        snow_forecast_inches: 2,
        icon: 'https://api.weather.gov/icons/land/day/snow,50?size=medium',
      },
      weekend: {
        snoqualmie_base_depth_inches: 45,
        snoqualmie_mid_depth_inches: 60,
        snoqualmie_peak_depth_inches: 76,
        snoqualmie_snow_condition: 'Fresh Powder',
        stevens_pass_new_snow_inches: 5,
        stevens_pass_base_depth_inches: 55,
        stevens_pass_snow_condition: 'Fresh Powder',
        crystal_mountain_new_snow_inches: 5,
        crystal_mountain_base_depth_inches: 65,
        crystal_mountain_mid_depth_inches: 80,
        crystal_mountain_peak_depth_inches: 96,
        crystal_mountain_snow_condition: 'Deep Powder',
        lake_union_temp_f: 62,
        lake_washington_temp_f: 60,
        lake_washington_wind_mph: 12,
        lake_washington_wind_dir: 'S',
        puget_sound_temp_f: 52,
        puget_sound_wind_mph: 15,
        puget_sound_wind_dir: 'S',
        wave_summary: 'Chippy with significant whitecaps',
        cedar_river_flow_cfs: 480,
        temp_f: 40,
        wind_speed_mph: 14,
        sunset_time: '20:04',
        tide_height_ft: 1.8,
        conditions: 'Snow Showers',
        snow_forecast_inches: 5,
        icon: 'https://api.weather.gov/icons/land/day/snow,70?size=medium',
      },
      weekly_forecast: [],
      resort_hours: {
        snoqualmie: { isOpenToday: false, openTime: '9:00 AM', closeTime: '4:00 PM', seasonStatus: 'unknown', note: null },
        stevens: { isOpenToday: false, openTime: '9:00 AM', closeTime: '4:00 PM', seasonStatus: 'unknown', note: null },
        crystal: { isOpenToday: false, openTime: '9:00 AM', closeTime: '4:00 PM', seasonStatus: 'unknown', note: null },
      },
    };
  }
}
