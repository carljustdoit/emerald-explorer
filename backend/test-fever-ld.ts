import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function test() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Fetching deep page...');
  await page.goto('https://feverup.com/m/338266', { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  
  const $ = cheerio.load(html);
  
  const ldJsonTags = [];
  $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '{}');
        ldJsonTags.push(parsed);
      } catch(e) {}
  });
  
  console.log('Found LD-JSON length:', ldJsonTags.length);
  if (ldJsonTags.length > 0) {
      console.log(JSON.stringify(ldJsonTags, null, 2));
  }

  await browser.close();
}
test().catch(console.error);
