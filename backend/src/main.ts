import 'dotenv/config';
import { EmeraldFeed, EnvironmentData } from './types/schema.js';
import { fetchAllEnvironmentData } from './ingestion/wsdot.js';
import { fetchEnvironmentData as fetchWaterData } from './ingestion/usgs.js';
import { scrapeAllEventSources } from './ingestion/firecrawl_scraper.js';
import { enrichAllEvents } from './enrichment/gemini_tagger.js';
import { uploadToCDN, generateFeedJSON } from './deployment/upload_to_cdn.js';

const DEFAULT_ENV_DATA: EnvironmentData = {
  snoqualmie_snow_inches: 0,
  stevens_pass_snow_inches: 0,
  lake_union_temp_f: 55,
  cedar_river_flow_cfs: 500,
  wind_speed_mph: 5,
  sunset_time: '19:30',
  conditions: 'Clear',
};

async function runPipeline() {
  console.log('='.repeat(50));
  console.log('EMERALD SOURCING ENGINE - Starting ETL Pipeline');
  console.log('='.repeat(50));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  const startTime = Date.now();

  try {
    console.log('[Phase 1] Ingestion - Fetching data from sources...');
    console.log('-'.repeat(50));

    console.log('[Ingestion] Fetching environmental data...');
    const [wsdotData, usgsData] = await Promise.all([
      fetchAllEnvironmentData(),
      fetchWaterData(),
    ]);

    const environmentData: EnvironmentData = {
      ...DEFAULT_ENV_DATA,
      ...wsdotData,
      ...usgsData,
    };

    console.log('[Ingestion] Fetching events...');
    const rawEvents = await scrapeAllEventSources();

    console.log('');
    console.log('[Phase 2] Enrichment - AI processing...');
    console.log('-'.repeat(50));

    const enrichedEvents = await enrichAllEvents(rawEvents);

    console.log('');
    console.log('[Phase 3] Deployment - Building feed...');
    console.log('-'.repeat(50));

    const feed: EmeraldFeed = {
      metadata: {
        last_updated: new Date().toISOString(),
        environment: environmentData,
      },
      events: enrichedEvents,
    };

    const feedUrl = await uploadToCDN(feed);

    console.log('');
    console.log('='.repeat(50));
    console.log('Pipeline Complete!');
    console.log('='.repeat(50));
    console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`Events: ${feed.events.length}`);
    console.log(`Environment: ${environmentData.conditions}, ${environmentData.snoqualmie_snow_inches}" snow, ${environmentData.lake_union_temp_f}°F`);
    console.log(`Feed URL: ${feedUrl}`);
    console.log('');

    return feed;
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

runPipeline();
