import { chromium } from 'playwright';

async function test() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Fetching deep page...');
  await page.goto('https://feverup.com/m/338266', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000); 

  console.log('--- ALL BUTTONS ---');
  const buttons = await page.$$eval('button, [role="button"], li', els => 
     els.map(b => (b as HTMLElement).textContent?.trim() || '')
        .filter(t => t.length > 2 && t.length < 50)
  );
  console.log([...new Set(buttons)]);
  
  // Find standard month strings
  const text = await page.textContent('body');
  const monthMatch = text?.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2}/gi);
  console.log('Month Matches:', monthMatch);

  await browser.close();
}
test().catch(console.error);
