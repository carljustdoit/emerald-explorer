import { fetchRenderedHTML } from './src/ingestion/firecrawl_scraper.js';
import * as cheerio from 'cheerio';

async function test() {
  console.log('Fetching deep page...');
  const html = await fetchRenderedHTML('https://feverup.com/m/338266', 5000, '');
  const $ = cheerio.load(html);
  
  console.log('--- TITLE ---');
  console.log($('h1').text().trim());

  console.log('--- IMAGES ---');
  $('img').each((i, el) => {
    if ($(el).attr('src')?.includes('fever')) {
      console.log($(el).attr('src'));
    }
  });

  console.log('--- SESSIONS / TIMES ---');
  // Attempt to find dropdown options or li blocks
  $('[data-testid="session-item"], li, option').each((i, el) => {
    const txt = $(el).text().trim();
    if (txt && (txt.includes('PM') || txt.includes('AM') || txt.includes(':00'))) {
       console.log('Session Block:', txt);
    }
  });

  console.log('--- PRICE ---');
  $('*').each((i, el) => {
    const t = $(el).text();
    if (t.includes('$') && t.length < 20) {
      console.log('Price candidate:', t.trim());
    }
  });
}
test().catch(console.error);
