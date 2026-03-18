import { EnvironmentData } from '../types/schema.js';
import { fetchLakeUnionTemp, fetchTideData, fetchCedarRiverFlow } from '../ingestion/usgs.js';
import { fetchSnoqualmiePassConditions, fetchWeatherAndSunset } from '../ingestion/wsdot.js';

export interface SportsData extends EnvironmentData {
  lake_washington_temp_f?: number;
  puget_sound_temp_f?: number;
  crystal_mountain_snow_inches: number;
}

export class SportsDataService {
  private static cache: { data: SportsData | null; timestamp: number } = {
    data: null,
    timestamp: 0,
  };
  private static CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  static async getSportsData(): Promise<SportsData> {
    const now = Date.now();
    if (this.cache.data && now - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      console.log('[SportsDataService] Fetching fresh sports data...');
      
      // Fetch data in parallel from existing sources
      const [passData, weatherData, usgsData] = await Promise.all([
        fetchSnoqualmiePassConditions(),
        fetchWeatherAndSunset(),
        this.fetchWaterData(),
      ]);

      // Fetch Crystal Mountain Snow (via Open-Meteo for now as a fallback if WSDOT lacks it)
      const crystalSnow = await this.fetchCrystalMountainSnow();

      const combinedData: SportsData = {
        snoqualmie_snow_inches: passData.snoqualmie_snow_inches ?? 0,
        stevens_pass_snow_inches: passData.stevens_pass_snow_inches ?? 0,
        crystal_mountain_snow_inches: crystalSnow,
        lake_union_temp_f: usgsData.lake_union_temp_f ?? 62,
        lake_washington_temp_f: usgsData.lake_washington_temp_f ?? usgsData.lake_union_temp_f ?? 60,
        puget_sound_temp_f: usgsData.puget_sound_temp_f ?? 52,
        cedar_river_flow_cfs: usgsData.cedar_river_flow_cfs ?? 450,
        wind_speed_mph: weatherData.wind_speed_mph ?? 5,
        sunset_time: weatherData.sunset_time ?? '20:00',
        tide_height_ft: usgsData.tide_height_ft ?? 1.5,
        conditions: weatherData.conditions ?? 'Fair',
      };

      this.cache = { data: combinedData, timestamp: now };
      return combinedData;
    } catch (error) {
      console.error('[SportsDataService] Error fetching sports data:', error);
      // Return stale cache if available, or defaults
      return this.cache.data || {
        snoqualmie_snow_inches: 0,
        stevens_pass_snow_inches: 0,
        crystal_mountain_snow_inches: 0,
        lake_union_temp_f: 62,
        cedar_river_flow_cfs: 450,
        wind_speed_mph: 5,
        sunset_time: '20:00',
        conditions: 'Fair',
      };
    }
  }

  private static async fetchWaterData() {
    // Reusing usgs.ts logic while adding Lake WA and Puget Sound specifics
    const [lakeUnion, cedarRiver, tide] = await Promise.all([
        fetchLakeUnionTemp(),
        fetchCedarRiverFlow(),
        fetchTideData(),
    ]);

    // For Puget Sound Temp, we can use the NOAA 9447130 station but with 'water_temp' product
    const pugetSoundTemp = await this.fetchNOAAWaterTemp('9447130');

    return {
        lake_union_temp_f: lakeUnion?.temp,
        cedar_river_flow_cfs: cedarRiver?.flow,
        tide_height_ft: tide?.height,
        puget_sound_temp_f: pugetSoundTemp,
        lake_washington_temp_f: lakeUnion?.temp ? lakeUnion.temp - 2 : undefined, // Proxy for now
    };
  }

  private static async fetchNOAAWaterTemp(stationId: string): Promise<number | undefined> {
    try {
        const response = await fetch(
          `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station_id=${stationId}&product=water_temperature&datum=MLLW&units=english&time_zone=lst_ldt&format=json`
        );
        if (!response.ok) return undefined;
        const data = await response.json();
        return parseFloat(data.data?.[0]?.v);
    } catch {
        return undefined;
    }
  }

  private static async fetchCrystalMountainSnow(): Promise<number> {
    try {
        // Lat/Lon for Crystal Mountain
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=46.9351&longitude=-121.4735&current=snowfall`
        );
        if (!response.ok) return 0;
        const data = await response.json();
        return data.current?.snowfall ?? 0;
    } catch {
        return 0;
    }
  }
}
