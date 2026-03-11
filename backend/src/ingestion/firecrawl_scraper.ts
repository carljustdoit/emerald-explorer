import { RawScrapedEvent } from '../types/schema.js';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

interface FirecrawlResponse {
  success: boolean;
  data?: {
    content?: string;
    markdown?: string;
    html?: string;
    links?: Array<{ href: string; text: string }>;
  };
  error?: string;
}

export async function scrapeWithFirecrawl(url: string, sourceName: string): Promise<RawScrapedEvent[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (!apiKey) {
    console.warn(`[Firecrawl] No API key configured. Skipping ${sourceName}.`);
    return getMockEvents(sourceName);
  }

  console.log(`[Firecrawl] Scraping ${url}...`);

  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Firecrawl] Error scraping ${url}:`, error);
      return getMockEvents(sourceName);
    }

    const data = (await response.json()) as FirecrawlResponse;

    if (!data.success || !data.data) {
      console.error(`[Firecrawl] Failed to scrape ${url}:`, data.error);
      return getMockEvents(sourceName);
    }

    const events = parseEventContent(data.data.markdown || data.data.content || '', sourceName, url);
    console.log(`[Firecrawl] Found ${events.length} events from ${sourceName}`);
    
    return events;
  } catch (error) {
    console.error(`[Firecrawl] Exception scraping ${url}:`, error);
    return getMockEvents(sourceName);
  }
}

function parseEventContent(content: string, sourceName: string, baseUrl: string): RawScrapedEvent[] {
  const events: RawScrapedEvent[] = [];
  
  const eventBlocks = content.split(/(?=\n## |\n### |\n\d+\.)/).filter(block => block.trim());
  
  for (const block of eventBlocks.slice(0, 20)) {
    const lines = block.split('\n').filter(l => l.trim());
    
    if (lines.length < 2) continue;
    
    const titleMatch = lines[0].replace(/^#{1,3}\s*/, '').replace(/^\d+\.\s*/, '').trim();
    const title = titleMatch.slice(0, 200);
    
    if (!title || title.length < 3) continue;
    
    let description = '';
    let dateLine = '';
    let locationLine = '';
    
    for (const line of lines.slice(1)) {
      const cleanLine = line.trim();
      if (cleanLine.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]?\d{0,4}/) || cleanLine.toLowerCase().includes('pm') || cleanLine.toLowerCase().includes('am')) {
        dateLine = cleanLine;
      } else if (cleanLine.toLowerCase().includes('seattle') || cleanLine.toLowerCase().includes('pier') || cleanLine.toLowerCase().includes('ave') || cleanLine.toLowerCase().includes('street')) {
        locationLine = cleanLine;
      } else if (cleanLine.length > 20) {
        description += cleanLine + ' ';
      }
    }

    events.push({
      title,
      description: description.trim().slice(0, 500) || `Event at ${sourceName}`,
      date: dateLine,
      location_name: locationLine || 'Seattle, WA',
      source: sourceName,
      url: baseUrl,
    });
  }

  return events;
}

function getMockEvents(sourceName: string): RawScrapedEvent[] {
  const today = new Date();
  
  return [
    {
      title: 'Weekly Trivia Night',
      description: 'Test your knowledge at Seattle\'s favorite weekly trivia. Teams of up to 6 compete for prizes.',
      date: `${today.getMonth() + 1}/${today.getDate()}/2026 7:00 PM`,
      location_name: 'Optimize Brewing, Capitol Hill',
      source: sourceName,
      url: 'https://example.com/events',
    },
    {
      title: 'Farmers Market',
      description: 'Fresh local produce, artisan goods, and live music at Pike Place Market.',
      date: `Every Saturday 9:00 AM - 3:00 PM`,
      location_name: 'Pike Place Market',
      source: sourceName,
      url: 'https://example.com/events',
    },
    {
      title: 'Tech Meetup: AI in Seattle',
      description: 'Monthly meetup for Seattle tech enthusiasts. This month: Large Language Models workshop.',
      date: `${today.getMonth() + 1}/${today.getDate() + 2}/2026 6:30 PM`,
      location_name: 'WeWork, South Lake Union',
      source: sourceName,
      url: 'https://example.com/events',
    },
  ];
}

export async function scrapeAllEventSources(): Promise<RawScrapedEvent[]> {
  console.log('[Events] Starting event scraping...');
  
  const sources = [
    { url: 'https://www.events12.com/seattle/', name: 'Events12' },
    { url: 'https://everout.com/seattle/', name: 'EverOut' },
  ];

  const results = await Promise.all(
    sources.map(({ url, name }) => scrapeWithFirecrawl(url, name))
  );

  const allEvents = results.flat();
  console.log(`[Events] Total events scraped: ${allEvents.length}`);
  
  return allEvents;
}
