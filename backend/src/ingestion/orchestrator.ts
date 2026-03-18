import { RawScrapedEvent, RawScrapedEventSchema } from '../types/schema.js';
import { connectorRegistry } from './connectors/index.js';

export async function scrapeAllEventSources(targetConnector?: string): Promise<RawScrapedEvent[]> {
  console.log('[Phase 1] Scrape - Running Data Connectors in Parallel');

  let connectorsToRun = connectorRegistry.getEnabledConnectors();

  if (targetConnector) {
    const specificConnector = connectorRegistry.getConnector(targetConnector);
    if (!specificConnector) {
      console.warn(`[Phase 1] Warning: Target connector "${targetConnector}" not found. Running all enabled connectors.`);
    } else {
      console.log(`[Phase 1] Targeting single connector: ${targetConnector}`);
      connectorsToRun = [specificConnector];
    }
  }

  console.log(`[Phase 1] Starting ${connectorsToRun.length} connector(s)...`);

  const scrapePromises = connectorsToRun.map(async (connector) => {
    try {
      console.log(`  -> [${connector.name}] Starting scrape from ${connector.sourceUrl}`);
      const startTime = Date.now();
      const events = await connector.scrape();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  <- [${connector.name}] Completed in ${duration}s. Found ${events.length} events.`);
      return events;
    } catch (error) {
      console.error(`  <- [${connector.name}] FAILED:`, error);
      return [];
    }
  });

  const results = await Promise.allSettled(scrapePromises);
  
  const allEvents: RawScrapedEvent[] = [];
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    }
  });

  console.log(`[Phase 1] Total raw events scraped: ${allEvents.length}`);
  return allEvents;
}

export function validateAndDeduplicate(events: RawScrapedEvent[]): RawScrapedEvent[] {
  console.log('[Phase 2] Validation & Deduplication - Formatting and cleaning data');
  
  const validEvents: RawScrapedEvent[] = [];
  let invalidCount = 0;

  // Basic format validation
  for (const event of events) {
    const result = RawScrapedEventSchema.safeParse(event);
    if (result.success && event.title && event.title.length >= 3) {
      validEvents.push(result.data);
    } else {
      invalidCount++;
      // console.debug(`[Phase 2] Dropped invalid event: ${event.title}`);
    }
  }
  
  console.log(`[Phase 2] Scrape Format Validation: ${validEvents.length} passed, ${invalidCount} dropped.`);

  // Deduplication based on Source + Title + Date
  const seenKeys = new Set<string>();
  const uniqueEvents: RawScrapedEvent[] = [];
  let duplicatesCount = 0;
  
  for (const event of validEvents) {
    // Deduplication based on Source + Title + Date + Time
    const rawDate = event.date ? event.date.trim().toLowerCase() : '';
    const rawTime = event.start_time ? event.start_time.trim().toLowerCase() : '';
    
    // Normalize date and time for the key
    const normalizedDate = rawDate.replace(/\d{1,2}:\d{2}\s*(am|pm)?/g, '').trim();
    const normalizedTime = rawTime.includes(':') ? rawTime : '';
    
    const title = event.title ? event.title.toLowerCase().trim() : '';
    const key = `${event.source}-${title}-${normalizedDate}-${normalizedTime}`;
    
    if (seenKeys.has(key)) {
      duplicatesCount++;
      continue;
    }
    seenKeys.add(key);
    uniqueEvents.push(event);
  }

  console.log(`[Phase 2] Deduplication: ${uniqueEvents.length} unique events, ${duplicatesCount} duplicates removed.`);
  return uniqueEvents;
}
