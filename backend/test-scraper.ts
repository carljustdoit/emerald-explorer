import { SnowScraper } from './src/ingestion/scrapers/SnowScraper.js';

async function test() {
  console.log('Testing Snoqualmie Scraper...');
  const data = await SnowScraper.scrapeSnoqualmie();
  console.log('Result:', JSON.stringify(data, null, 2));
}

test();
