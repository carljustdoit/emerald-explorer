import { EnvironmentData } from '../types/schema.js';

const USGS_BASE_URL = 'https://waterservices.usgs.gov/nwis';

interface USGSResponse {
  value: {
    timeSeries: Array<{
      variable: {
        variableName: string;
        unit: { unitCode: string };
      };
      values: Array<{
        value: Array<{
          value: string;
          dateTime: string;
        }>;
      }>;
    }>;
  };
}

export async function fetchLakeUnionTemp(): Promise<{ temp: number; dateTime: string } | null> {
  const siteCode = '12159100';
  const parameterCode = '00010';

  try {
    const response = await fetch(
      `${USGS_BASE_URL}/iv/?format=json&site=${siteCode}&parameterCd=${parameterCode}&period=P1D`
    );
    
    if (!response.ok) {
      console.error(`USGS API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as USGSResponse;
    const timeSeries = data.value.timeSeries[0];
    
    if (!timeSeries?.values?.[0]?.value?.[0]) {
      return null;
    }

    const latestValue = timeSeries.values[0].value[0];
    return {
      temp: parseFloat(latestValue.value),
      dateTime: latestValue.dateTime,
    };
  } catch (error) {
    console.error('Error fetching Lake Union temp:', error);
    return null;
  }
}

export async function fetchCedarRiverFlow(): Promise<{ flow: number; dateTime: string } | null> {
  const siteCode = '12119000';
  const parameterCode = '00060';

  try {
    const response = await fetch(
      `${USGS_BASE_URL}/iv/?format=json&site=${siteCode}&parameterCd=${parameterCode}&period=P1D`
    );
    
    if (!response.ok) {
      console.error(`USGS API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as USGSResponse;
    const timeSeries = data.value.timeSeries[0];
    
    if (!timeSeries?.values?.[0]?.value?.[0]) {
      return null;
    }

    const latestValue = timeSeries.values[0].value[0];
    return {
      flow: parseFloat(latestValue.value),
      dateTime: latestValue.dateTime,
    };
  } catch (error) {
    console.error('Error fetching Cedar River flow:', error);
    return null;
  }
}

export async function fetchTideData(): Promise<{ height: number; dateTime: string } | null> {
  const stationId = '9447130';
  
  try {
    const response = await fetch(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station_id=${stationId}&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt&format=json`
    );
    
    if (!response.ok) {
      console.error(`NOAA Tide API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { predictions: Array<{ prediction: string; t: string }> };
    const predictions = data.predictions;
    
    if (!predictions || predictions.length === 0) {
      return null;
    }

    const latest = predictions[predictions.length - 1];
    return {
      height: parseFloat(latest.prediction),
      dateTime: latest.t,
    };
  } catch (error) {
    console.error('Error fetching tide data:', error);
    return null;
  }
}

export async function fetchEnvironmentData(): Promise<Partial<EnvironmentData>> {
  console.log('[USGS] Fetching environment data...');
  
  const [lakeUnion, cedarRiver, tide] = await Promise.all([
    fetchLakeUnionTemp(),
    fetchCedarRiverFlow(),
    fetchTideData(),
  ]);

  const envData: Partial<EnvironmentData> = {};

  if (lakeUnion) {
    envData.lake_union_temp_f = lakeUnion.temp;
  }

  if (cedarRiver) {
    envData.cedar_river_flow_cfs = cedarRiver.flow;
  }

  if (tide) {
    envData.tide_height_ft = tide.height;
  }

  console.log('[USGS] Environment data fetched:', envData);
  return envData;
}
