import { RawScrapedEvent } from '../types/schema.js';
import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';
import { 
  ScraperSource, fetchHTML, isValidImageUrl,
  parseSeattleSymphony, parseUWArts, parseSeattleOpera,
  parseJazzAlley, parseStubHub, parseFever, 
  parseHuskies, parse19hz, parseEvents12Filtered
} from './scrapers/modular_scraper.js';
import { scraperEmitter } from './scraper_events.js';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

// Fetch rendered HTML using Playwright (for JS-heavy sites)
export async function fetchRenderedHTML(url: string, waitTime: number = 3000, waitStrategy: 'timeout' | 'networkidle' = 'timeout'): Promise<string | null> {
  try {
    const b = await getBrowser();
    
    // Create context with realistic user agent for sites that block bots
    const context = await b.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 90000 
    });
    
    if (!response || response.status() !== 200) {
      console.log(`[Playwright] HTTP error ${response?.status()} for ${url}`);
      await page.close();
      await context.close();
      return null;
    }
    
    // Wait for content to load based on strategy
    if (waitStrategy === 'networkidle') {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } else {
      await page.waitForTimeout(waitTime);
    }
    
    const html = await page.content();
    await page.close();
    await context.close();
    
    return html;
  } catch (error) {
    console.error(`[Playwright] Failed to fetch ${url}:`, error);
    return null;
  }
}

async function fetchSessionTimes(url: string): Promise<string[]> {
  try {
    const b = await getBrowser();
    const page = await b.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const content = await page.evaluate(() => document.body.innerText);
    
    const sessionTimes: string[] = [];
    const dateRegex = /([A-Za-z]+)\s+(\d{1,2})\s*[•-]\s*(\d{1,2}(?::\d{2})?\s*[AP]M)/gi;
    let match;
    while ((match = dateRegex.exec(content)) !== null) {
      sessionTimes.push(`${match[1]} ${match[2]} ${match[3]}`);
    }
    
    // Also try other formats
    const altRegex = /([A-Za-z]+)\s+(\d{1,2})\s*[•-]\s*(\d{1,2}:\d{2})/gi;
    while ((match = altRegex.exec(content)) !== null) {
      sessionTimes.push(`${match[1]} ${match[2]} ${match[3]}`);
    }
    
    return Array.from(new Set(sessionTimes));
  } catch (error) {
    console.error(`[Playwright] Failed to fetch ${url}:`, error);
    return [];
  }
}

async function fetchStubHubVenue(url: string): Promise<{ venue: string; address: string } | null> {
  try {
    const b = await getBrowser();
    const page = await b.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const content = await page.evaluate(() => document.body.innerText);
    const html = await page.content();
    const $ = cheerio.load(html);
    
    let venue = '';
    let address = '';
    
    // Try to find venue from the page - look for common patterns
    // StubHub typically shows venue name in the event header or near the date
    const venuePatterns = [
      /Venue:\s*([^,\n]+)/i,
      /at\s+([^,\n]+(?:Park|Theatre|Theater|Arena|Hall|Club|Lounge))/i,
      /([^,\n]+(?:Park|Theatre|Theater|Arena|Hall|Club|Lounge))\s*$/im,
    ];
    
    for (const pattern of venuePatterns) {
      const match = content.match(pattern);
      if (match) {
        venue = match[1].trim();
        break;
      }
    }
    
    // Try to find address - look for street address patterns
    const addressPatterns = [
      /\b(\d{3,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Avenue|Ave|St|Street|Road|Rd|Boulevard|Blvd|Drive|Dr|Way|Lane|Ln|Plaza|Pl|Court|Ct)\b[^,]*)/gi,
      /(\d{1,5}\s+\w+\s+\w+,\s*\w+\s+\d{5})/,
    ];
    
    for (const pattern of addressPatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        address = matches[0].trim();
        break;
      }
    }
    
    // If we found a venue or address, return it
    if (venue || address) {
      return { venue, address };
    }
    
    return null;
  } catch (error) {
    console.error(`[Playwright] Failed to fetch venue from ${url}:`, error);
    return null;
  }
}

interface EventPageInfo {
  title?: string;
  description?: string;
  venue?: string;
  address?: string;
  date?: string;
  time?: string;
  dates?: string[]; // Multiple dates for events like Fever
}

async function fetchEventPageInfo(url: string): Promise<EventPageInfo | null> {
  if (!url) return null;
  
  try {
    const b = await getBrowser();
    const page = await b.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const content = await page.evaluate(() => document.body.innerText);
    const html = await page.content();
    const $ = cheerio.load(html);
    
    const result: EventPageInfo = {};
    
    // Extract event title - from h1, og:title, or title tag
    const titleFromHtml = $('h1').first().text().trim();
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const pageTitle = $('title').text().trim();
    
    // Prefer h1, then og:title, then page title
    if (titleFromHtml && titleFromHtml.length > 5) {
      result.title = titleFromHtml;
    } else if (ogTitle && ogTitle.length > 5) {
      result.title = ogTitle;
    } else if (pageTitle && pageTitle.length > 5) {
      // Clean up page title (usually "Event Name | Venue | Ticket Seller")
      result.title = pageTitle.split('|')[0].split('-')[0].trim();
    }
    
    // Extract description - from meta description or og:description
    const metaDesc = $('meta[name="description"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const bodyText = content.slice(0, 1000); // First 1000 chars of body
    
    if (ogDesc && ogDesc.length > 20) {
      result.description = ogDesc.slice(0, 300);
    } else if (metaDesc && metaDesc.length > 20) {
      result.description = metaDesc.slice(0, 300);
    } else if (bodyText.length > 20) {
      // Use first meaningful text as description
      result.description = bodyText.split('\n')[0].slice(0, 300);
    }
    
    // Extract venue name
    const venuePatterns = [
      /Venue:\s*([^,\n]+)/i,
      /at\s+([^,\n]+(?:Park|Theatre|Theater|Arena|Hall|Club|Lounge))/i,
      /Location:\s*([^,\n]+)/i,
      /<h1[^>]*>([^<]+)<\/h1>/i,
    ];
    
    for (const pattern of venuePatterns) {
      const match = content.match(pattern);
      if (match) {
        result.venue = match[1].trim();
        break;
      }
    }
    
    // Extract address
    const addressPatterns = [
      /\b(\d{3,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Avenue|Ave|St|Street|Road|Rd|Boulevard|Blvd|Drive|Dr|Way|Lane|Ln|Plaza|Pl|Court|Ct)\b[^,]*)/gi,
      /(\d{1,5}\s+\w+\s+\w+,\s*\w+\s+\d{5})/,
    ];
    
    for (const pattern of addressPatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        result.address = matches[0].trim();
        break;
      }
    }
    
    // Extract date - look for ALL patterns like "March 15, 2026" or "Sat, Mar 15" - Fever can have multiple dates
    const datePatterns = [
      /([A-Z][a-z]+(?:ary|ruary|ch|il|ay|une|uly|ust|ember|ober|cember)\s+\d{1,2},?\s+\d{4})/gi,
      /([A-Z][a-z]{2})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/gi,
      /(Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s*([A-Z][a-z]{2})\s+(\d{1,2})/gi,
    ];
    
    // Collect all dates found
    const allDates: string[] = [];
    for (const pattern of datePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        allDates.push(...matches);
      }
    }
    
    // Remove duplicates and limit to first 10 dates
    const uniqueDates = [...new Set(allDates)].slice(0, 10);
    
    if (uniqueDates.length > 0) {
      result.date = uniqueDates[0];
      result.dates = uniqueDates; // Store all dates for multi-date events
    }
    
    // Extract time - look for patterns like "7:30 PM" or "7pm"
    const timePatterns = [
      /(\d{1,2}:\d{2}\s*[AP]M)/i,
      /(\d{1,2}\s*[AP]M)/i,
    ];
    
    for (const pattern of timePatterns) {
      const match = content.match(pattern);
      if (match) {
        result.time = match[1].trim();
        break;
      }
    }
    
    return result;
  } catch (error) {
    console.error(`[Playwright] Failed to fetch event page ${url}:`, error);
    return null;
  }
}

function parseEvents12(html: string, baseUrl: string): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];

  $('article').each((_, article) => {
    const $article = $(article);
    const $eventPara = $article.find('p.event');

    const $datePara = $article.find('p.date').first();
    let dateStr = $datePara.text().trim();
    const $timeSpan = $datePara.find('span.nobreak').first();
    const timeStr = $timeSpan.text().trim();
    
    if (timeStr && !dateStr.includes(timeStr)) {
      dateStr = `${dateStr} ${timeStr}`;
    }

    const $milesPara = $article.find('p.miles').first();
    const locationRaw = $milesPara.text().replace(/\(\d+.*?\)/, '').trim();

    const mapLink = $article.find('a.b1').first().attr('href') || '';
    const ticketLink = $article.find('a.b2').first().attr('href') || '';
    let photoLink = $article.find('a.b3').first().attr('href') || '';
    const videoLink = $article.find('a.b5').first().attr('href') || '';

    // Filter invalid images
    if (photoLink && !isValidImageUrl(photoLink)) {
      photoLink = '';
    }

    const $table = $article.find('table.table1, table.table2, table.table3, table.table4').first();
    const $eventLink = $eventPara.find('a').first();
    const teamName = $eventLink.text().trim() || '';
    const eventTitle = $article.find('h3').text().trim() || teamName;
    
    function expandDateRange(dateStr: string): string[] {
      const rangeMatch = dateStr.match(/^([A-Za-z]+\.?\s*\d+)\s*[-–]\s*(\d+)$/);
      if (rangeMatch) {
        const startPart = rangeMatch[1];
        const endDay = parseInt(rangeMatch[2]);
        const startMatch = startPart.match(/([A-Za-z]+)\.?(\d+)/);
        if (startMatch) {
          const month = startMatch[1];
          const startDay = parseInt(startMatch[2]);
          const days: string[] = [];
          for (let d = startDay; d <= endDay; d++) {
            days.push(`${month}. ${d}`);
          }
          return days;
        }
      }
      return [dateStr];
    }
    
    if ($table.length > 0) {
      const headerCells = $table.find('tr').first().find('td');
      const firstRowCells = $table.find('tr').eq(1).find('td');
      const isSportsTable = headerCells.eq(0).text().toLowerCase().includes('date') && 
                           firstRowCells.length >= 3;
      
      $table.find('tr').each((_, row) => {
        const $row = $(row);
        const $cells = $row.find('td');
        if ($cells.length < 2) return;

        const firstCell = $cells.eq(0).text().trim();
        const secondCell = $cells.eq(1).text().trim();
        const thirdCell = $cells.eq(2).text().trim();
        
        if (!firstCell || firstCell.toLowerCase() === 'date') return;

        if (isSportsTable) {
          const gameDateStr = firstCell;
          const gameTimeStr = secondCell;
          const opponent = (thirdCell + ' ' + $cells.eq(3).text().trim()).trim();
          
          // Skip away games (marked with @)
          if (opponent.startsWith('@')) {
            return;
          }
          
          const dateVariants = expandDateRange(gameDateStr);
          
          for (const dateVariant of dateVariants) {
            const displayOpponent = opponent.replace(/^@\s*/, '');
            const title = teamName && displayOpponent 
              ? `${teamName} vs ${displayOpponent}` 
              : (teamName || locationRaw);
            
            events.push({
              title,
              description: `${teamName || 'Home game'} vs ${displayOpponent} at ${locationRaw}`.trim(),
              date: `${dateVariant} ${gameTimeStr}`,
              location_name: locationRaw || 'Seattle, WA',
              source: 'Events12',
              url: $eventLink.attr('href') || baseUrl,
              image: isValidImageUrl(photoLink) ? photoLink : undefined,
              map_url: mapLink || undefined,
              ticket_url: ticketLink || undefined,
              video_url: videoLink || undefined,
            });
          }
        } else {
          const eventDate = firstCell;
          const artist = secondCell;
          const venue = thirdCell;
          
          if (!eventDate || eventDate.toLowerCase() === 'artist') return;
          
          const dateVariants = expandDateRange(eventDate);
          
          for (const dateVariant of dateVariants) {
            const title = `${eventTitle} - ${artist}`.trim();
            const description = `${artist} performing at ${venue || locationRaw}`.trim();
            
            events.push({
              title,
              description,
              date: dateVariant,
              location_name: venue || locationRaw || 'Seattle, WA',
              source: 'Events12',
              url: $eventLink.attr('href') || baseUrl,
              image: isValidImageUrl(photoLink) ? photoLink : undefined,
              map_url: mapLink || undefined,
              ticket_url: ticketLink || undefined,
              video_url: videoLink || undefined,
            });
          }
        }
      });
    } else {
      $eventPara.each((_, el) => {
        const $p = $(el);
        const text = $p.text().trim();
        const $link = $p.find('a').first();
        const title = $link.text().trim() || text.slice(0, 50);
        const url = $link.attr('href') || baseUrl;

        if (title.length < 3) return;

        events.push({
          title,
          description: text.slice(0, 500),
          date: dateStr,
          location_name: locationRaw || 'Seattle, WA',
          source: 'Events12',
          url: url?.startsWith('http') ? url : url ? new URL(url, baseUrl).href : baseUrl,
          image: isValidImageUrl(photoLink) ? photoLink : undefined,
          map_url: mapLink || undefined,
          ticket_url: ticketLink || undefined,
          video_url: videoLink || undefined,
        });
      });
    }
  });

  $('table.concerts tbody tr').each((_, row) => {
    const $row = $(row);
    const $cells = $row.find('td');
    if ($cells.length < 3) return;

    const dateStr = $cells.eq(0).text().trim();
    const $link = $cells.eq(1).find('a');
    const title = $link.text().trim();
    const url = $link.attr('href');
    const location = $cells.eq(2).text().trim();

    if (!title || title.length < 3) return;

    events.push({
      title,
      description: `Concert at ${location}`,
      date: dateStr,
      location_name: location || 'Seattle, WA',
      source: 'Events12',
      url: url ? (url.startsWith('http') ? url : new URL(url, baseUrl).href) : baseUrl,
      ticket_url: url?.includes('stubhub') ? url : undefined,
    });
  });

  return events;
}

function parseEverOut(html: string, baseUrl: string): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];

  const eventSelectors = [
    '.event-card',
    '.event-item',
    '.event-listing',
    '[data-event-id]',
    'article.event',
    '.listing-event',
  ];

  let $events = $();
  for (const selector of eventSelectors) {
    $events = $(selector);
    if ($events.length > 0) break;
  }

  if ($events.length === 0) {
    $events = $('a[href*="/event/"]').closest('div, article').filter((_, el) => $(el).text().length > 20);
  }

  $events.each((_, el) => {
    const $el = $(el);

    const title = $el.find('h2, h3, h4, .title, .event-title, [class*="title"]').first().text().trim()
      || $el.find('a').first().text().trim();

    if (!title || title.length < 3) return;

    const description = $el.find('.description, .excerpt, .summary, [class*="desc"], p').first().text().trim() || '';

    let dateStr = '';
    const dateSelectors = ['.date', '.event-date', 'time[datetime]', '[class*="date"]'];
    for (const selector of dateSelectors) {
      const $date = $el.find(selector);
      if ($date.length > 0) {
        dateStr = $date.text().trim() || $date.attr('datetime') || '';
        break;
      }
    }

    let location = '';
    const locationSelectors = ['.location', '.venue', '[class*="location"]', '[class*="venue"]'];
    for (const selector of locationSelectors) {
      const $loc = $el.find(selector);
      if ($loc.length > 0) {
        location = $loc.text().trim();
        break;
      }
    }

    const link = $el.find('a').first().attr('href');
    const url = link?.startsWith('http') ? link : link ? new URL(link, baseUrl).href : baseUrl;

    events.push({
      title: title.slice(0, 200),
      description: description.slice(0, 500),
      date: dateStr,
      location_name: location || 'Seattle, WA',
      source: 'EverOut',
      url,
    });
  });

  return events;
}

function getMockEvents(sourceName: string): RawScrapedEvent[] {
  const today = new Date();

  return [
    {
      title: 'Weekly Trivia Night',
      description: 'Test your knowledge at Seattle\'s favorite weekly trivia. Teams of up to 6 compete for prizes.',
      date: `Tuesday ${today.getMonth() + 1}/${today.getDate()} 7:00 PM`,
      location_name: 'Optimize Brewing, Capitol Hill',
      source: sourceName,
      url: 'https://example.com/events',
    },
    {
      title: 'Pike Place Farmers Market',
      description: 'Fresh local produce, artisan goods, and live music at Pike Place Market. Every Saturday.',
      date: `Saturday 9:00 AM - 3:00 PM`,
      location_name: 'Pike Place Market',
      source: sourceName,
      url: 'https://example.com/events',
    },
    {
      title: 'Tech Meetup: AI in Seattle',
      description: 'Monthly meetup for Seattle tech enthusiasts. This month: Large Language Models workshop.',
      date: `Thursday ${today.getMonth() + 1}/${today.getDate() + 2}/2026 6:30 PM`,
      location_name: 'WeWork, South Lake Union',
      source: sourceName,
      url: 'https://example.com/events',
    },
  ];
}

export async function scrapeEventSources(): Promise<RawScrapedEvent[]> {
  console.log('[Events] Starting event scraping...');

  // Define sources - some need Playwright for JS rendering
  const httpSources: ScraperSource[] = [
    { name: 'Events12', url: 'https://www.events12.com/seattle/', category: 'general', parser: parseEvents12Filtered },
    { name: '19hz', url: 'https://19hz.info/eventlisting_Seattle.php', category: 'music', parser: parse19hz },
  ];
  
  // Sources that need Playwright (JS-rendered)
  const playwrightSources: ScraperSource[] = [
    { name: 'Seattle Symphony', url: 'https://www.seattlesymphony.org/concerttickets/calendar', category: 'music', parser: parseSeattleSymphony },
    { name: 'Seattle Opera', url: 'https://www.seattleopera.org/calendar/', category: 'art', parser: parseSeattleOpera },
    { name: 'Jazz Alley', url: 'https://www.jazzalley.com/www-home/calendar.jsp', category: 'music', parser: parseJazzAlley },
    { name: 'StubHub', url: 'https://www.stubhub.com/', category: 'music', parser: parseStubHub },
  ];
   
  // Fetch Fever separately with networkidle wait (needed for client-side rendering)
  // We'll do this after allEvents is declared
  
  const allEvents: RawScrapedEvent[] = [];
  
  // Fetch Fever separately with networkidle wait (needed for client-side rendering)
  console.log('[Events] Fetching Fever (Candlelight)...');
  const feverUrl = 'https://feverup.com/en/seattle/candlelight';
  const feverHtml2 = await fetchRenderedHTML(feverUrl, 5000, 'networkidle');
  if (feverHtml2) {
    console.log(`[Events] Fever HTML length: ${feverHtml2.length}`);
    const feverEvents = await parseFever(feverHtml2, feverUrl);
    console.log(`[Events] Found ${feverEvents.length} events from Fever`);
    if (feverEvents.length > 0) {
      allEvents.push(...feverEvents);
      // Emit events as they're scraped
      for (const event of feverEvents) {
        scraperEmitter.emitEvent({ ...event, source: 'Fever' });
      }
      scraperEmitter.emitProgress('Fever', feverEvents.length, allEvents.length);
    }
  }

  // Special handling for UW Huskies - fetch a limited range for now
  console.log('[Events] Fetching UW Huskies...');
  const uwUrl = 'https://gohuskies.com/calendar/print/month/0/3-1-2026/3-31-2026/null';
  const uwHtml = await fetchRenderedHTML(uwUrl);
  console.log('[Events] UW HTML length:', uwHtml?.length || 0);
  if (uwHtml) {
    const uwEvents = parseHuskies(uwHtml, uwUrl);
    console.log('[Events] Found UW events:', uwEvents.length);
    if (uwEvents.length > 0) {
      console.log('[Events] Sample UW event:', uwEvents[0]);
      allEvents.push(...uwEvents);
      for (const event of uwEvents) {
        scraperEmitter.emitEvent({ ...event, source: 'UW Huskies' });
      }
      scraperEmitter.emitProgress('UW Huskies', uwEvents.length, allEvents.length);
    }
  } else {
    console.log('[Events] Failed to fetch UW');
  }

  // Fetch HTTP sources
  for (const { url, name, parser } of httpSources) {
    console.log(`[Events] Fetching ${name}...`);
    const html = await fetchHTML(url);

    if (!html) {
      console.log(`[Events] Failed to fetch ${name}, using mock data`);
      allEvents.push(...getMockEvents(name));
      continue;
    }

    // Events12 parser is async because it fetches individual event pages
    const events = await (parser as any)(html, url);
    console.log(`[Events] Found ${events.length} events from ${name}`);

    if (events.length === 0) {
      console.log(`[Events] No events parsed from ${name}, using mock data`);
      allEvents.push(...getMockEvents(name));
    } else {
      allEvents.push(...events);
      // Emit events as they're scraped
      for (const event of events) {
        scraperEmitter.emitEvent({ ...event, source: name });
      }
      scraperEmitter.emitProgress(name, events.length, allEvents.length);
    }
  }

  // Fetch Playwright sources (JS-rendered)
  for (const { url, name, parser } of playwrightSources) {
    console.log(`[Events] Fetching ${name} (Playwright)...`);
    const html = await fetchRenderedHTML(url);

    if (!html) {
      console.log(`[Events] Failed to fetch ${name}`);
      continue;
    }

    console.log(`[Events] HTML length for ${name}: ${html.length}`);
    
    const events = await (parser as any)(html, url);
    console.log(`[Events] Found ${events.length} events from ${name}`);
    
    if (events.length === 0) {
      console.log(`[Events] No events parsed from ${name}, skipping`);
    } else {
      allEvents.push(...events);
      // Emit events as they're scraped
      for (const event of events) {
        scraperEmitter.emitEvent({ ...event, source: name });
      }
      scraperEmitter.emitProgress(name, events.length, allEvents.length);
    }
  }

  console.log(`[Events] Total events scraped: ${allEvents.length}`);
  
  // Deduplicate events based on URL + date + title combination
  const seenEventKeys = new Set<string>();
  const uniqueEvents: RawScrapedEvent[] = [];
  let duplicatesRemoved = 0;
  
  for (const event of allEvents) {
    // Normalize the key: use source + title + normalized date to identify true duplicates
    const normalizedDate = event.date ? event.date.trim().toLowerCase().split(' ')[0] : ''; // Just the date part
    const eventUrl = event.url || event.ticket_url || '';
    const title = event.title ? event.title.toLowerCase().trim() : '';
    const key = `${event.source}-${title}-${normalizedDate}`;
    
    if (seenEventKeys.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seenEventKeys.add(key);
    uniqueEvents.push(event);
  }
  
  if (duplicatesRemoved > 0) {
    console.log(`[Events] Removed ${duplicatesRemoved} duplicate events`);
  }
  
  const deduplicatedEvents = uniqueEvents;
  
  const withTickets = deduplicatedEvents.filter(e => e.ticket_url).length;
  const withMaps = deduplicatedEvents.filter(e => e.map_url).length;
  console.log(`[Events] Events with ticket links: ${withTickets}`);
  console.log(`[Events] Events with map links: ${withMaps}`);
  
  // Enhance events with session times from ticket pages
  // Skip sports events (Hockey, Baseball) since we already have home games from table parsing
  console.log('[Events] Fetching session times from ticket pages...');
  const eventsNeedingSessions = deduplicatedEvents.filter(e => 
    e.ticket_url && 
    !e.date?.includes(',') &&
    !e.title?.includes('vs ') // Skip sports events - they have home game data from table
  );
  console.log(`[Events] Events to check for sessions: ${eventsNeedingSessions.length}`);
  
  const urlToSessions = new Map<string, string[]>();
  
  for (const event of eventsNeedingSessions) {
    if (event.ticket_url && !urlToSessions.has(event.ticket_url)) {
      console.log(`[Events] Fetching sessions from: ${event.ticket_url?.slice(0, 50)}...`);
      const sessions = await fetchSessionTimes(event.ticket_url!);
      console.log(`[Events] Found ${sessions.length} sessions for ${event.title?.slice(0, 30)}`);
      if (sessions.length > 0) {
        urlToSessions.set(event.ticket_url!, sessions);
      }
    }
  }
  
  // Fetch event page info (venue, address, date, time) - for sources that need validation
  // Events12 has garbled venue data, StubHub has generic "Seattle, WA" without real address
  // Fever uses client-side rendering - need to fetch each event page for details
  console.log('[Events] Fetching event page details for validation...');
  
  // Only validate Events12, StubHub, and Fever - they have incomplete venue/date data
  const eventsNeedingValidation = deduplicatedEvents.filter(e => 
    (e.source === 'Events12' || e.source === 'StubHub' || e.source === 'Fever') && e.url
  );
  
  console.log(`[Events] Events to validate: ${eventsNeedingValidation.length} (Events12 + StubHub + Fever)`);
  
  const urlToEventInfo = new Map<string, EventPageInfo>();
  
  // Process in batches of 5 concurrent requests
  const batchSize = 5;
  for (let i = 0; i < eventsNeedingValidation.length; i += batchSize) {
    const batch = eventsNeedingValidation.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (event) => {
      const targetUrl = event.ticket_url || event.url;
      if (!targetUrl || urlToEventInfo.has(targetUrl)) return;
      
      console.log(`[Events] Fetching event page: ${targetUrl?.slice(0, 50)}...`);
      const eventInfo = await fetchEventPageInfo(targetUrl!);
      if (eventInfo) {
        console.log(`[Events] Found - title: ${eventInfo.title?.slice(0, 30) || 'n/a'}, venue: ${eventInfo.venue || 'n/a'}, address: ${eventInfo.address || 'n/a'}`);
        urlToEventInfo.set(targetUrl!, eventInfo);
      }
    }));
    
    // Small delay between batches to be nice to servers
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Expand events with multiple sessions
  const expandedEvents: RawScrapedEvent[] = [];
  for (const event of deduplicatedEvents) {
    // Apply event page info if available (title, description, venue, address, date, time)
    let updatedEvent = { ...event };
    const targetUrl = event.ticket_url || event.url;
    
    if (targetUrl && urlToEventInfo.has(targetUrl)) {
      const eventInfo = urlToEventInfo.get(targetUrl)!;
      
      // Update title if found (only for Events12 which has garbled titles)
      if (eventInfo.title && event.source === 'Events12') {
        updatedEvent.title = eventInfo.title;
      }
      
      // Update description if found
      if (eventInfo.description && event.source === 'Events12') {
        updatedEvent.description = eventInfo.description;
      }
      
      // Update venue name if found
      if (eventInfo.venue) {
        updatedEvent.location_name = eventInfo.venue;
      }
      
      // Update address if found
      if (eventInfo.address) {
        updatedEvent.location_address = eventInfo.address;
      }
      
      // NOTE: Fever dates are already parsed from the main listing page in parseFever
      // Don't re-expand here as it creates duplicates (all events share same URL)
      // Skip Fever expansion
      
      // Update date if found and looks valid
      if (eventInfo.date && eventInfo.date.length > 5) {
        updatedEvent.date = eventInfo.date + (eventInfo.time ? ` ${eventInfo.time}` : '');
      } else if (eventInfo.time) {
        // Just update time if date is already valid
        const timeMatch = eventInfo.time.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
        if (timeMatch && updatedEvent.date) {
          // Append time to existing date
          updatedEvent.date = updatedEvent.date.replace(/\d{1,2}:\d{2}\s*[AP]M/i, timeMatch[1]);
        }
      }
    }
    
    if (updatedEvent.ticket_url && urlToSessions.has(updatedEvent.ticket_url)) {
      const sessions = urlToSessions.get(updatedEvent.ticket_url)!;
      if (sessions.length > 1) {
        for (const session of sessions) {
          expandedEvents.push({
            ...updatedEvent,
            date: session,
          });
        }
      } else {
        expandedEvents.push({
          ...updatedEvent,
          date: sessions[0] || updatedEvent.date,
        });
      }
    } else {
      expandedEvents.push(updatedEvent);
    }
  }
  
  console.log(`[Events] Expanded events: ${expandedEvents.length}`);
  
  // Emit completion
  scraperEmitter.emitComplete(expandedEvents.length);
  
  // Close browser
  if (browser) {
    await browser.close();
    browser = null;
  }
  
  return expandedEvents;
}

export async function scrapeAllEventSources(): Promise<RawScrapedEvent[]> {
  return scrapeEventSources();
}
