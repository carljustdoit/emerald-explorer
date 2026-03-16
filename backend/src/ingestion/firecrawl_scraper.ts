import { RawScrapedEvent } from '../types/schema.js';
import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
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
    
    return [...new Set(sessionTimes)];
  } catch (error) {
    console.error(`[Playwright] Failed to fetch ${url}:`, error);
    return [];
  }
}

async function fetchHTML(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.error(`[Scraper] HTTP error ${response.status} for ${url}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`[Scraper] Failed to fetch ${url}:`, error);
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
    const photoLink = $article.find('a.b3').first().attr('href') || '';
    const videoLink = $article.find('a.b5').first().attr('href') || '';

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
              image: photoLink || undefined,
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
              image: photoLink || undefined,
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
          image: photoLink || undefined,
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

  const sources = [
    { url: 'https://www.events12.com/seattle/', name: 'Events12', parser: parseEvents12 },
    { url: 'https://everout.com/seattle/', name: 'EverOut', parser: parseEverOut },
  ];

  const allEvents: RawScrapedEvent[] = [];

  for (const { url, name, parser } of sources) {
    console.log(`[Events] Fetching ${name}...`);
    const html = await fetchHTML(url);

    if (!html) {
      console.log(`[Events] Failed to fetch ${name}, using mock data`);
      allEvents.push(...getMockEvents(name));
      continue;
    }

    const events = parser(html, url);
    console.log(`[Events] Found ${events.length} events from ${name}`);

    if (events.length === 0) {
      console.log(`[Events] No events parsed from ${name}, using mock data`);
      allEvents.push(...getMockEvents(name));
    } else {
      allEvents.push(...events);
    }
  }

  console.log(`[Events] Total events scraped: ${allEvents.length}`);
  
  const withTickets = allEvents.filter(e => e.ticket_url).length;
  const withMaps = allEvents.filter(e => e.map_url).length;
  console.log(`[Events] Events with ticket links: ${withTickets}`);
  console.log(`[Events] Events with map links: ${withMaps}`);
  
  // Enhance events with session times from ticket pages
  // Skip sports events (Hockey, Baseball) since we already have home games from table parsing
  console.log('[Events] Fetching session times from ticket pages...');
  const eventsNeedingSessions = allEvents.filter(e => 
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
  
  // Expand events with multiple sessions
  const expandedEvents: RawScrapedEvent[] = [];
  for (const event of allEvents) {
    if (event.ticket_url && urlToSessions.has(event.ticket_url)) {
      const sessions = urlToSessions.get(event.ticket_url)!;
      if (sessions.length > 1) {
        for (const session of sessions) {
          expandedEvents.push({
            ...event,
            date: session,
          });
        }
      } else {
        expandedEvents.push({
          ...event,
          date: sessions[0] || event.date,
        });
      }
    } else {
      expandedEvents.push(event);
    }
  }
  
  console.log(`[Events] Expanded events: ${expandedEvents.length}`);
  
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
