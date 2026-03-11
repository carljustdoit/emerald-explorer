import { EnvironmentData } from '../types/schema.js';

const WSDOT_SNOW_CAMS_API = 'https://api.wsdot.wa.gov/gis/SnowCam/v1';

interface WSDOTSnowCam {
  Location: {
    latitude: number;
    longitude: number;
  };
  SnowDepth: number;
  AirTemp: number;
  RoadTemp: number;
  CameraName: string;
  ImageURL: string;
}

interface WSDOTPassData {
  passName: string;
  snowDepth: number;
  temperature: number;
  roadCondition: string;
  restrictions: string[];
}

const PASS_LOCATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  'Snoqualmie Pass': { lat: 47.4241, lon: -121.4137, name: 'Snoqualmie Pass' },
  'Stevens Pass': { lat: 47.7302, lon: -121.0891, name: 'Stevens Pass' },
  'White Pass': { lat: 46.6368, lon: -121.3803, name: 'White Pass' },
  'Stampede Pass': { lat: 47.2765, lon: -121.3365, name: 'Stampede Pass' },
};

export async function fetchSnoqualmiePassConditions(): Promise<Partial<EnvironmentData>> {
  console.log('[WSDOT] Fetching pass conditions...');
  
  try {
    const response = await fetch(`${WSDOT_SNOW_CAMS_API}?$top=20&$orderby=CameraName`, {
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.error(`WSDOT API error: ${response.status}`);
      return {};
    }

    const data = (await response.json()) as { value?: WSDOTSnowCam[] };
    const cameras: WSDOTSnowCam[] = data.value || [];

    const snoqualmieCameras = cameras.filter(c => 
      c.CameraName.toLowerCase().includes('snoqualmie')
    );

    const stevensCameras = cameras.filter(c => 
      c.CameraName.toLowerCase().includes('stevens')
    );

    const envData: Partial<EnvironmentData> = {};

    if (snoqualmieCameras.length > 0) {
      const avgSnowDepth = snoqualmieCameras.reduce((sum, c) => sum + (c.SnowDepth || 0), 0) / snoqualmieCameras.length;
      envData.snoqualmie_snow_inches = Math.round(avgSnowDepth);
    }

    if (stevensCameras.length > 0) {
      const avgSnowDepth = stevensCameras.reduce((sum, c) => sum + (c.SnowDepth || 0), 0) / stevensCameras.length;
      envData.stevens_pass_snow_inches = Math.round(avgSnowDepth);
    }

    console.log('[WSDOT] Pass conditions fetched:', envData);
    return envData;
  } catch (error) {
    console.error('Error fetching WSDOT data:', error);
    return {};
  }
}

export async function fetchWeatherAndSunset(lat: number = 47.6062, lon: number = -122.3321): Promise<Partial<EnvironmentData>> {
  const envData: Partial<EnvironmentData> = {};
  
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,weather_code,temperature_2m&daily=sunset&timezone=auto`
    );
    
    if (!response.ok) {
      console.error(`Weather API error: ${response.status}`);
      return envData;
    }

    const data = (await response.json()) as {
      current?: { wind_speed_10m: number; weather_code: number; temperature_2m: number };
      daily?: { sunset?: string[] };
    };
    
    if (data.current) {
      envData.wind_speed_mph = Math.round(data.current.wind_speed_10m * 0.621371);
      envData.conditions = getConditionFromCode(data.current.weather_code);
    }

    if (data.daily?.sunset?.[0]) {
      envData.sunset_time = data.daily.sunset[0];
    }

    console.log('[Weather] Data fetched:', envData);
  } catch (error) {
    console.error('Error fetching weather data:', error);
  }

  return envData;
}

function getConditionFromCode(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Fog',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Heavy Drizzle',
    61: 'Light Rain',
    63: 'Rain',
    65: 'Heavy Rain',
    71: 'Light Snow',
    73: 'Snow',
    75: 'Heavy Snow',
    80: 'Rain Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm',
    99: 'Thunderstorm',
  };
  return conditions[code] || 'Unknown';
}

export async function fetchAllEnvironmentData(): Promise<Partial<EnvironmentData>> {
  console.log('[Environment] Fetching all environment data...');
  
  const [passData, weatherData] = await Promise.all([
    fetchSnoqualmiePassConditions(),
    fetchWeatherAndSunset(),
  ]);

  return {
    ...passData,
    ...weatherData,
  };
}
