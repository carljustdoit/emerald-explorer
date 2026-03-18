import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';
import { fetchRenderedHTML } from '../firecrawl_scraper.js';

export class FeverConnector implements DataConnector {
  name = 'Fever';
  sourceUrl = 'https://feverup.com/en/seattle/candlelight';
  enabled = true;
  type = 'playwright' as const;
  category = 'music';

  async scrape(): Promise<RawScrapedEvent[]> {
    const html = await fetchRenderedHTML(this.sourceUrl, 5000, 'networkidle');
    if (!html) return [];

    const $ = cheerio.load(html);
    const eventLinks = new Set<string>();
    
    // Grab all /m/ detail links from the index page
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/m/')) {
         eventLinks.add(href.startsWith('http') ? href : `https://feverup.com${href}`);
      }
    });

    const urls = Array.from(eventLinks).slice(0, 15); // limit deep scraping for performance
    const events: RawScrapedEvent[] = [];
    
    console.log(`[Fever] Found ${urls.length} event links to deep scrape...`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    for (const url of urls) {
      if (events.length >= 50) break;
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000); // Wait for React
        
        const pageHtml = await page.content();
        const detail$ = cheerio.load(pageHtml);
        
        let title = '';
        let description = '';
        let image = '';
        let price = 'Various';
        let venue = 'Seattle, WA';
        let lat: number | undefined;
        let lon: number | undefined;
        
        // 1. Extract JSON-LD for highest accuracy
        const ldJsonTags: any[] = [];
        detail$('script[type="application/ld+json"]').each((i, el) => {
            try {
              ldJsonTags.push(JSON.parse(detail$(el).html() || '{}'));
            } catch(e) {}
        });

        const productLD = ldJsonTags.find(t => t['@type'] === 'Product' || t['@type'] === 'Event');
        if (productLD) {
            title = productLD.name?.replace(/^Candlelight: /i, '').trim() || '';
            description = productLD.description?.trim() || '';
            
            if (productLD.image) {
                image = typeof productLD.image === 'string' ? productLD.image : productLD.image.contentUrl;
            }
            
            if (productLD.offers && productLD.offers.length > 0) {
               const offer = productLD.offers[0];
               if (offer.price) price = `$${offer.price}`;
               
               if (offer.areaServed?.name) venue = offer.areaServed.name;
               if (offer.areaServed?.geo) {
                  lat = offer.areaServed.geo.latitude;
                  lon = offer.areaServed.geo.longitude;
               }
            } else if (productLD.location) {
               venue = productLD.location.name || venue;
               if (productLD.location.geo) {
                  lat = productLD.location.geo.latitude;
                  lon = productLD.location.geo.longitude;
               }
            }
        }
        
        // Fallback DOM extraction
        if (!title) title = detail$('h1').text().replace(/^Candlelight: /i, '').trim();
        if (!description) description = detail$('.event-description, [data-testid="event-description"]').text().trim();
        if (!image) {
            const imgs = await page.$$eval('img', els => els.map(img => (img as HTMLImageElement).src).filter(s => s.includes('upload') && !s.includes('logo')));
            if (imgs.length > 0) image = imgs[0];
        }

        if (!title || title.length < 3) {
            await page.close();
            continue;
        }

        // 2. Extract Sessions (Dates & Times)
        const pageText = await page.textContent('body') || '';
        
        // Looking for explicit dates like "April 23"
        const dateMatch = pageText.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{1,2}\b/gi) || [];
        const timeMatch = pageText.match(/\b\d{1,2}:\d{2}\s[AP]M\b/gi) || [];
        
        const monthMap: Record<string, string> = {
          'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
          'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };

        const uniqueRawDates = Array.from(new Set(dateMatch));
        const uniqueRawTimes = Array.from(new Set(timeMatch));
        
        let sessions: { date: string, start_time: string, price: string }[] = [];
        
        if (uniqueRawDates.length > 0 && uniqueRawTimes.length > 0) {
            // Default cross-product (Fever plays all sessions every date)
            for (const d of uniqueRawDates) {
                const parts = d.split(/\s+/);
                const monthStr = parts[0].substring(0, 3);
                const dayStr = parts[1].padStart(2, '0');
                const isoDate = `2026-${monthMap[monthStr] || '03'}-${dayStr}`;
                
                for (const t of uniqueRawTimes) {
                    sessions.push({
                        date: isoDate,
                        start_time: t,
                        price: price !== 'Various' ? price : 'See site for details'
                    });
                }
            }
        } else {
            // Fallback safe session
            sessions.push({ date: '2026-03-30', start_time: '19:00', price });
        }
        
        events.push({
            title: title,
            description: description || `Experience ${title} by candlelight.`,
            date: sessions[0].date + ' ' + (sessions[0].start_time || ''),
            location_name: venue,
            location_lat: lat,
            location_lon: lon,
            source: this.name,
            url: url,
            image: image,
            sessions: sessions
        });

        await page.close();
      } catch (err) {
        console.warn(`[Fever] Failed to deep scrape ${url}`, err);
      }
    }
    
    await browser.close();
    return events;
  }
}
