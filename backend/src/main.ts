import 'dotenv/config';
import { EmeraldFeed, EnvironmentData, EmeraldEventSchema, EmeraldEvent } from './types/schema.js';
import { fetchAllEnvironmentData } from './ingestion/wsdot.js';
import { fetchEnvironmentData as fetchWaterData } from './ingestion/usgs.js';
import { scrapeAllEventSources, validateAndDeduplicate } from './ingestion/orchestrator.js';
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
    // Parse CLI args for a specific connector
    const args = process.argv.slice(2);
    let targetConnector: string | undefined;
    const connectorArg = args.find(a => a.startsWith('--connector='));
    if (connectorArg) {
      targetConnector = connectorArg.split('=')[1];
    }

    console.log('[Stage 1] Ingestion - Parallel Scraping from sources...');
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
    const rawEvents = await scrapeAllEventSources(targetConnector);

    console.log('');
    console.log('[Stage 2] Validation & Deduplication...');
    console.log('-'.repeat(50));
    
    const validRawEvents = validateAndDeduplicate(rawEvents);

    console.log('');
    console.log('[Stage 3] Enrichment - AI processing...');
    console.log('-'.repeat(50));

    const enrichedEvents = await enrichAllEvents(validRawEvents);

    console.log('');
    console.log('[Stage 4] Greenlight Validation & Deployment...');
    console.log('-'.repeat(50));

    const greenlightedEvents: EmeraldEvent[] = [];
    let greenlightFailures = 0;

    for (const event of enrichedEvents) {
      const result = EmeraldEventSchema.safeParse(event);
      if (result.success) {
        greenlightedEvents.push(result.data);
      } else {
        greenlightFailures++;
        console.warn(`[Stage 4] Validation failed for enriched event: ${event.title}`);
      }
    }

    console.log(`[Stage 4] Greenlighted ${greenlightedEvents.length} events. ${greenlightFailures} failed validation.`);

    const feed: EmeraldFeed = {
      metadata: {
        last_updated: new Date().toISOString(),
        environment: environmentData,
      },
      events: greenlightedEvents,
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
