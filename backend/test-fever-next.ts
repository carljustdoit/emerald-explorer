import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function test() {
  console.log('Fetching deep page...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://feverup.com/m/338266', { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  const $ = cheerio.load(html);
  
  const nextData = $('#__NEXT_DATA__').html();
  console.log('Has NEXT_DATA?', !!nextData);
  if (nextData) {
      try {
          const parsed = JSON.parse(nextData);
          console.log('Next keys:', Object.keys(parsed));
          if (parsed.props?.pageProps?.plan) {
             const plan = parsed.props.pageProps.plan;
             console.log('Plan Sessions:', plan.sessions?.length);
             if (plan.sessions && plan.sessions.length > 0) {
                 console.log(plan.sessions[0]);
             }
          }
      } catch(e) {
          console.log('Error parsing NEXT_DATA', e);
      }
  }

  await browser.close();
}
test().catch(console.error);
