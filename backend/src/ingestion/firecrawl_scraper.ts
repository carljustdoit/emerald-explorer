import { RawScrapedEvent } from '../types/schema.js';
import * as cheerio from 'cheerio';

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

    $eventPara.each((_, el) => {
      const $p = $(el);
      const text = $p.text().trim();
      const $link = $p.find('a').first();
      const title = $link.text().trim() || text.slice(0, 50);
      const url = $link.attr('href') || baseUrl;

      if (title.length < 3) return;

      const $datePara = $article.find('p.date').first();
      const dateStr = $datePara.text().trim();

      const $milesPara = $article.find('p.miles').first();
      const locationRaw = $milesPara.text().replace(/\(\d+.*?\)/, '').trim();

      events.push({
        title,
        description: text.slice(0, 500),
        date: dateStr,
        location_name: locationRaw || 'Seattle, WA',
        source: 'Events12',
        url: url?.startsWith('http') ? url : url ? new URL(url, baseUrl).href : baseUrl,
      });
    });
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
  return allEvents;
}

export async function scrapeAllEventSources(): Promise<RawScrapedEvent[]> {
  return scrapeEventSources();
}
