import { RawScrapedEvent } from '../../types/schema.js';
import * as cheerio from 'cheerio';

export interface ScraperSource {
  name: string;
  url: string;
  category: string;
  parser: (html: string, baseUrl: string) => RawScrapedEvent[] | Promise<RawScrapedEvent[]>;
}

// Validate date - returns true if date is in valid range (2025-2027)
function isValidScrapedDate(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  const day = parseInt(match[3]);
  
  return year >= 2025 && year <= 2027 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// Fix invalid scraped dates
function fixScrapedDate(dateStr: string | undefined): string {
  if (isValidScrapedDate(dateStr)) {
    return dateStr!.substring(0, 10);
  }
  // Default to a reasonable date
  return '2026-03-15';
}

// Common utilities
export async function fetchHTML(url: string): Promise<string | null> {
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

// Extract venue address from event page using Playwright (to bypass bot blocking)
export async function fetchEventPageVenue(eventUrl: string): Promise<{ venue: string; address: string } | null> {
  try {
    // Import here to avoid circular dependencies
    const { fetchRenderedHTML } = await import('../firecrawl_scraper.js');
    const html = await fetchRenderedHTML(eventUrl);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    
    // Try to find venue from various sources on the page
    let venue = '';
    let address = '';
    
    // Look for venue in meta tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const dcTitle = $('meta[name="dc.title"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') || '';
    
    // Combine all text sources
    const allText = `${ogTitle} ${dcTitle} ${description} ${$('body').text()}`;
    
    // Look for known venue names in the text
    const knownVenues = [
      '5th Avenue Theatre', 'Paramount Theatre', 'The Showbox', 'Neumos',
      'The Crocodile', 'T-Mobile Park', 'Lumen Field', 'Climate Pledge Arena',
      'Benaroya Hall', 'Seattle Symphony', 'Seattle Opera', 'Jazz Alley',
      'The Moore Theatre', 'The Paramount', 'The Showbox SoDo', 'The Garage',
      'Seattle Rep', 'ACT Theatre', 'Cornish Playhouse', 'Seattle Children\'s Theatre',
      'Town Hall Seattle', 'KEXP', 'Nectar', 'Barboza', 'The Timbre Room',
      'Substation', 'Monkey Loft', 'Kremwerk', 'The Funhouse'
    ];
    
    for (const v of knownVenues) {
      if (allText.toLowerCase().includes(v.toLowerCase())) {
        venue = v;
        break;
      }
    }
    
    // Look for street address patterns (e.g., "1308 5th Ave" or "925 E Pike St")
    const addressPatterns = [
      /\b(\d{3,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Avenue|Ave|St|Street|Road|Rd|Boulevard|Blvd|Drive|Dr|Way|Lane|Ln|Plaza|Pl|Court|Ct)\b[^,]*)/gi,
      /\b(\d{3,5}\s+\w+\s+\w+)\b/gi
    ];
    
    for (const pattern of addressPatterns) {
      const matches = allText.match(pattern);
      if (matches && matches.length > 0) {
        address = matches[0].trim();
        // Clean up - remove extra whitespace
        address = address.replace(/\s+/g, ' ');
        break;
      }
    }
    
    // If we found a venue or address, return it
    if (venue || address) {
      return { venue, address };
    }
    
    return null;
  } catch (error) {
    console.error(`[Scraper] Failed to fetch venue from ${eventUrl}:`, error);
    return null;
  }
}

const SOCIAL_MEDIA_DOMAINS = [
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
  'tiktok.com', 'pinterest.com', 'reddit.com',
  'linkedin.com', 'snapchat.com', 'tumblr.com',
  'photos.google.com', 'plus.google.com'
];

const BAD_IMAGE_PATTERNS = ['cloudfront', 'cloudinary'];

export function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    const hash = urlObj.hash.toLowerCase();
    
    for (const domain of SOCIAL_MEDIA_DOMAINS) {
      if (hostname.includes(domain)) return false;
    }
    
    for (const pattern of BAD_IMAGE_PATTERNS) {
      if (pathname.includes(pattern) || hash.includes(pattern)) return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

export function normalizeDate(dateStr: string, year: number = 2026): string {
  // Handle empty or invalid input
  if (!dateStr || dateStr.length < 3) {
    return `${year}-01-01`;
  }
  
  const months: Record<string, string> = {
    'january': '01', 'jan': '01', 'february': '02', 'feb': '02',
    'march': '03', 'mar': '03', 'april': '04', 'apr': '04',
    'may': '05', 'june': '06', 'jun': '06', 'july': '07', 'jul': '07',
    'august': '08', 'aug': '08', 'september': '09', 'sep': '09', 'october': '10', 'oct': '10',
    'november': '11', 'nov': '11', 'december': '12', 'dec': '12'
  };

  dateStr = dateStr.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Skip if already looks like an ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }
  
  // Match patterns like "March 15" or "March 15, 2026" or "15 March 2026"
  let match = dateStr.match(/([a-z]+)\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (match) {
    const monthName = match[1];
    const month = months[monthName];
    // Invalid month
    if (!month) {
      return `${year}-01-01`;
    }
    const day = match[2].padStart(2, '0');
    let yr = match[3] || String(year);
    
    // Sanity check: if year is in the future beyond 2027, use default
    const yrNum = parseInt(yr);
    if (yrNum > 2027) {
      yr = String(year);
    }
    
    // Sanity check: month should be 01-12
    const monthNum = parseInt(month);
    if (monthNum < 1 || monthNum > 12) {
      return `${year}-01-01`;
    }
    
    // Sanity check: day should be 01-31
    const dayNum = parseInt(day);
    if (dayNum < 1 || dayNum > 31) {
      return `${year}-01-01`;
    }
    
    return `${yr}-${month}-${day}`;
  }
  
  // Try reverse format: "15 March 2026"
  match = dateStr.match(/(\d{1,2})\s+([a-z]+)(?:,?\s*(\d{4}))?/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2];
    const month = months[monthName];
    if (!month) {
      return `${year}-01-01`;
    }
    let yr = match[3] || String(year);
    
    const yrNum = parseInt(yr);
    if (yrNum > 2027) {
      yr = String(year);
    }
    
    return `${yr}-${month}-${day}`;
  }
  
  return `${year}-01-01`;
}

export function parseTime(timeStr: string): string {
  timeStr = timeStr.toLowerCase().trim();
  
  // Handle "7:30pm" or "7:30 pm" format
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3]?.toLowerCase();
    
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  }
  
  return '19:00:00';
}

// ============================================
// Category-Specific Scrapers
// ============================================

// Seattle Symphony
export function parseSeattleSymphony(html: string, baseUrl: string): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];
  const seenTitles = new Set<string>();

  // Get body text - replace newlines for easier parsing
  const bodyText = $('body').text().replace(/\n/g, '|');
  
  // Pattern: Event title followed by date/time
  // Example: "Onstage Rehearsal: Stravinsky the Firebird|WEDNESDAY, MARCH 18, 2026|3:30 PM|Performance|VIEW DETAILS"
  
  // List of event keywords to look for
  const eventKeywords = [
    'Onstage Rehearsal',
    'Lang Lang',
    'Discovering the Galapagos',
    'Volunteer Open House',
    'Peanuts',
    'Firebird',
    'Recital',
  ];

  for (const keyword of eventKeywords) {
    // Find all occurrences of this keyword
    let searchStr = bodyText;
    let idx = 0;
    
    while ((idx = searchStr.indexOf(keyword)) !== -1) {
      // Get context around this keyword
      const start = Math.max(0, idx - 10);
      const end = Math.min(searchStr.length, idx + keyword.length + 150);
      const context = searchStr.slice(start, end);
      
      // Extract event name - look for text before the keyword
      const titleMatch = context.match(/\|([^|]+)\|/);
      const title = titleMatch ? titleMatch[1].trim() : keyword;
      
      if (title.length < 5 || seenTitles.has(title)) {
        searchStr = searchStr.slice(idx + keyword.length);
        continue;
      }
      
      // Skip if title doesn't look like an event
      if (title.includes('VIEW DETAILS') || title.includes('Performance') || 
          title.includes('Tickets') || title.includes('Donate') ||
          title.includes('Symphony') || title.includes('Series')) {
        searchStr = searchStr.slice(idx + keyword.length);
        continue;
      }
      
      seenTitles.add(title);
      
      // Find date pattern in context
      const dateMatch = context.match(/(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
      const timeMatch = context.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
      
      if (!dateMatch) {
        searchStr = searchStr.slice(idx + keyword.length);
        continue;
      }
      
      const dateStr = `${dateMatch[2]} ${dateMatch[3]}, ${dateMatch[4]}`;
      let timeStr = '19:30:00';
      
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2];
        const period = timeMatch[3].toLowerCase();
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        timeStr = `${String(hours).padStart(2, '0')}:${minutes}:00`;
      }
      
      const finalDate = normalizeDate(dateStr);
      
      events.push({
        title: `Seattle Symphony: ${title}`,
        description: `Performance at Benaroya Hall`,
        date: `${finalDate} ${timeStr}`,
        location_name: 'Benaroya Hall, Seattle',
        source: 'Seattle Symphony',
        url: baseUrl,
      });
      
      searchStr = searchStr.slice(idx + keyword.length);
    }
  }

  return events;
}

// UW Arts
export function parseUWArts(html: string, baseUrl: string): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];

  $('.event-item, .event, article, .event-listing').each((_, el) => {
    const $el = $(el);
    
    const title = $el.find('h2, h3, .title, .event-title').first().text().trim() ||
                  $el.find('a').first().text().trim();
    if (!title || title.length < 3) return;

    const dateStr = $el.find('.date, .event-date, time').first().text().trim();
    const url = $el.find('a').first().attr('href');
    const description = $el.find('.description, .excerpt').first().text().trim();
    const location = $el.find('.location, .venue').first().text().trim();

    events.push({
      title: `UW Arts: ${title}`,
      description: description || 'UW Arts event',
      date: normalizeDate(dateStr),
      location_name: location || 'Various UW Venues',
      source: 'UW Arts',
      url: url ? (url.startsWith('http') ? url : new URL(url, baseUrl).href) : baseUrl,
    });
  });

  return events;
}

// Seattle Opera - from calendar page
export function parseSeattleOpera(html: string, baseUrl: string): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];

  // Opera calendar events are in .calendar-list-events-item elements
  $('.calendar-list-events-item').each((_, el) => {
    const $el = $(el);
    
    // Get data attributes
    const title = $el.attr('data-event-title');
    const dateStr = $el.attr('data-calendar-date');
    const location = $el.attr('data-event-location');
    
    if (!title || !title.trim()) return;
    
    // Get additional info from child elements
    const infoTitle = $el.find('.calendar-info-title a').text().trim();
    const fullTitle = title || infoTitle;
    
    const dateText = $el.find('.calendar-info-date').text().trim();
    const venue = $el.find('.calendar-info-venue').text().trim() || location || 'McCaw Hall, Seattle Center';
    const description = $el.find('.calendar-info-text').text().trim();
    const url = $el.find('.calendar-info-title a').attr('href');
    
    // Parse date and time from text like "Saturday, April 4, 2026 10:00 AM"
    let finalDate = dateStr || '2026-04-01';
    let timeStr = '19:30';
    
    const dateTimeMatch = dateText.match(/(\w+day,?\s+)?([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})?\s+(\d{1,2}):(\d{2})\s*([ap]m)?/i);
    if (dateTimeMatch) {
      const monthStr = dateTimeMatch[2];
      const day = dateTimeMatch[3];
      const year = dateTimeMatch[4] || '2026';
      const hours = parseInt(dateTimeMatch[5]);
      const mins = dateTimeMatch[6];
      const period = dateTimeMatch[7];
      
      finalDate = normalizeDate(`${monthStr} ${day}`);
      
      let hour24 = hours;
      if (period) {
        if (period.toLowerCase() === 'pm' && hours < 12) hour24 += 12;
        if (period.toLowerCase() === 'am' && hours === 12) hour24 = 0;
      }
      timeStr = `${String(hour24).padStart(2, '0')}:${mins}:00`;
    }
    
    events.push({
      title: `Seattle Opera: ${fullTitle}`,
      description: description?.substring(0, 300) || 'Seattle Opera performance',
      date: `${finalDate} ${timeStr}`,
      location_name: venue,
      source: 'Seattle Opera',
      url: url ? (url.startsWith('http') ? url : `https://www.seattleopera.org${url}`) : baseUrl,
    });
  });

  return events;
}

// Jazz Alley
export function parseJazzAlley(html: string, baseUrl: string): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];
  const seenTitles = new Set<string>();

  // Events are in divs with class "text-box" within "news-box" elements
  $('.news-box').each((_, box) => {
    const $box = $(box);
    
    // Get title from h2 inside the box
    const $titleEl = $box.find('h2');
    const title = $titleEl.text().trim();
    
    if (!title || title.length < 3 || seenTitles.has(title)) return;
    if (title.toLowerCase().includes('calendar') || title.toLowerCase().includes('menu')) return;
    
    seenTitles.add(title);
    
    // Get date from .date em element
    const $dateEl = $box.find('.date');
    const dateText = $dateEl.text().trim();
    
    // Get description from text content after the date
    const fullText = $box.text();
    const description = fullText.replace(title, '').replace(dateText, '').trim().slice(0, 300);
    
    // Get URL from the artist link
    const $link = $box.find('a[href*="artist.jsp"]').first();
    const url = $link.attr('href') || '';
    
    // Parse date - format is like "Thu, Mar 12 - Sun, Mar 15, 2026" or "Mon, Mar 23, 2026"
    let finalDate = '2026-03-15';
    
    // Match pattern: "Thu, Mar 12 - Sun, Mar 15, 2026" or "Thu, Mar 12 - Sun, Mar 15"
    const rangeMatch = dateText.match(/([A-Z][a-z]{2}),?\s*([A-Z][a-z]{2})\s*(\d{1,2})\s*[-–]\s*([A-Z][a-z]{2})\s*(\d{1,2})/);
    if (rangeMatch) {
      finalDate = normalizeDate(`${rangeMatch[2]} ${rangeMatch[3]}`);
    } else {
      // Single date: "Mon, Mar 23, 2026"
      const singleMatch = dateText.match(/([A-Z][a-z]{2}),?\s*([A-Z][a-z]{2})\s*(\d{1,2})/);
      if (singleMatch) {
        finalDate = normalizeDate(`${singleMatch[2]} ${singleMatch[3]}`);
      }
    }
    
    events.push({
      title: `Jazz Alley: ${title}`,
      description: description || `Jazz performance at Dimitriou's Jazz Alley`,
      date: `${finalDate} 19:30`,
      location_name: "Dimitriou's Jazz Alley, Seattle",
      source: 'Jazz Alley',
      url: url ? `https://www.jazzalley.com${url}` : baseUrl,
    });
  });

  return events;
}

// StubHub
export function parseStubHub(html: string, baseUrl: string): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];
  const seenUrls = new Set<string>();

  // Get event links from the homepage
  $('a[href*="/event/"]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const text = $el.text().trim();

    if (!href || href.includes('#') || seenUrls.has(href)) return;
    seenUrls.add(href);

    // Text format is like: "EventNameDay, Month DD • TimeVenue#"
    // Example: "Noah KahanSun, Aug 30 • 6:30 PMT-Mobile Park#3"

    // Extract date pattern
    const dateMatch = text.match(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat),?\s+(\w+)\s+(\d{1,2})/);

    if (!dateMatch) return;

    // Event name is everything before the day abbreviation
    const nameEndIdx = text.indexOf(dateMatch[1]);
    let title = text.slice(0, nameEndIdx).trim();

    // Clean up title - remove trailing numbers (the # rank)
    title = title.replace(/\s*#\d+\s*$/, '').trim();

    if (title.length < 3) return;

    // Extract date and time
    const monthStr = dateMatch[2];
    const day = dateMatch[3];
    const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);

    let timeStr = '19:00:00';
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2];
      const period = timeMatch[3].toLowerCase();
      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      timeStr = `${String(hours).padStart(2, '0')}:${minutes}:00`;
    }

    // Extract venue - look for known Seattle venues
    const venues = ['Lumen Field', 'T-Mobile Park', 'Climate Pledge Arena', 'Tacoma Dome', 'Moore Theatre', 'Paramount Theatre', 'The Crocodile', 'Barboza'];
    let venue = 'Seattle area';
    
    for (const v of venues) {
      if (text.includes(v)) {
        venue = v;
        break;
      }
    }

    const finalDate = normalizeDate(`${monthStr} ${day}`);

    events.push({
      title: `StubHub: ${title}`,
      description: `Tickets available on StubHub`,
      date: `${finalDate} ${timeStr}`,
      location_name: venue,
      source: 'StubHub',
      url: href.startsWith('http') ? href : `https://www.stubhub.com${href}`,
      ticket_url: href.startsWith('http') ? href : `https://www.stubhub.com${href}`,
    });
  });

  return events;
}

// Fever / Candlelight
// Fever uses client-side rendering - need to wait for network to load events
export function parseFever(html: string, baseUrl: string): RawScrapedEvent[] {
  const events: RawScrapedEvent[] = [];
  const $ = cheerio.load(html);
  
  // Extract event data from the page text
  const bodyText = $('body').text();
  
  // Clean up the text - replace multiple spaces/newlines
  const cleanText = bodyText.replace(/\s+/g, ' ');
  
  // Month mapping - support both abbreviations and full names (title case)
  const monthMap: Record<string, string> = {
    'Jan': '01', 'January': '01',
    'Feb': '02', 'February': '02',
    'Mar': '03', 'March': '03',
    'Apr': '04', 'April': '04',
    'May': '05',
    'Jun': '06', 'June': '06',
    'Jul': '07', 'July': '07',
    'Aug': '08',
    'Sep': '09', 'Sept': '09', 'September': '09',
    'Oct': '10', 'October': '10',
    'Nov': '11', 'November': '11',
    'Dec': '12', 'December': '12'
  };
  
  // Known venues
  const venues = [
    'The Museum of Flight',
    'Sparkman Cellars', 
    'The National Nordic Museum',
    'Arctic Club Hotel',
    'Langston Hughes Performing Arts Institute'
  ];
  
  // Split by "Candlelight:" to get event blocks
  const blocks = cleanText.split(/Candlelight:/).slice(1);
  const seenKeys = new Set<string>();
  const maxTotalEvents = 50; // Safety limit
  
  // Track titles globally within this parse call to avoid duplicates
  const seenTitles = new Set<string>();
  
  console.log(`[parseFever] Found ${blocks.length} Candlelight blocks, limiting to ${maxTotalEvents} events`);
  
  for (const block of blocks) {
    if (events.length >= maxTotalEvents) {
      console.log(`[parseFever] Hit limit of ${maxTotalEvents} events, stopping`);
      break;
    }
    // Extract title - it's the first part before any venue or rating
    // Look for pattern like "90s Unplugged The Museum" or "A Tribute to Adele"
    let title = '';
    let remaining = block;
    
    // Find where the title ends (at venue or rating)
    for (const venue of venues) {
      const idx = block.indexOf(venue);
      if (idx > 0 && idx < 100) {
        title = block.slice(0, idx).trim();
        remaining = block.slice(idx);
        break;
      }
    }
    
    if (!title || title.length < 3) {
      // Try another approach - title ends at number (rating)
      const match = block.match(/^([A-Za-z0-9\s&']+?)\s+\d+\.\d+/);
      if (match) {
        title = match[1].trim();
        remaining = block;
      } else {
        continue;
      }
    }
    
    // Validate title - must be meaningful
    if (title.length < 3 || title.length > 80) continue;
    
    // Skip duplicate titles - the same event appears multiple times in the page
    // Use full title (with Candlelight prefix) for dedup - normalize whitespace
    const fullTitle = `Candlelight: ${title}`.toLowerCase().replace(/\s+/g, ' ').trim();
    const titleKey = fullTitle; // Store for later use
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);
    
    // Find venue
    let venue = 'Seattle, WA';
    for (const v of venues) {
      if (remaining.includes(v)) {
        venue = v;
        break;
      }
    }
    
    // Find all dates and times in this block
    // Look for "DD Mon" pattern and associated times - only valid months
    const dateTimePairs: { date: string; time: string }[] = [];
    
    // Find all "DD Mon" patterns - only match valid month abbreviations to avoid ratings
    const dateRegex = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi;
    const dateMatches = remaining.match(dateRegex) || [];
    // Find all time patterns  
    const timeMatches = remaining.match(/\b(\d{1,2}:\d{2}\s*[AP]M)\b/gi) || [];
    
    // Match dates with times based on order in text
    // Limit to max 4 dates per event to avoid explosion
    const maxDates = 4;
    const dateMatchCount = Math.min(dateMatches.length, timeMatches.length, maxDates);
    for (let i = 0; i < dateMatchCount; i++) {
      const parts = dateMatches[i].split(/\s+/);
      const day = parts[0].padStart(2, '0');
      const monthAbbr = parts[1] || 'Mar';
      const monthKey = monthAbbr.charAt(0).toUpperCase() + monthAbbr.slice(1).toLowerCase();
      const month = monthMap[monthKey] || '03';
      dateTimePairs.push({
        date: `2026-${month}-${day}`,
        time: timeMatches[i]
      });
    }
    
    // If no times found, use default (limit to 4 dates max)
    if (dateTimePairs.length === 0 && dateMatches.length > 0) {
      for (const dm of dateMatches.slice(0, maxDates)) {
        const parts = dm.split(/\s+/);
        const day = parts[0].padStart(2, '0');
        const monthAbbr = parts[1] || 'Mar';
        const monthKey = monthAbbr.charAt(0).toUpperCase() + monthAbbr.slice(1).toLowerCase();
        const month = monthMap[monthKey] || '03';
        dateTimePairs.push({
          date: `2026-${month}-${day}`,
          time: '19:00'
        });
      }
    }
    
    // Create events for each date
    const fullEventTitle = `Candlelight: ${title}`;
    const normalizedFullTitle = fullEventTitle.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const { date, time } of dateTimePairs) {
      if (events.length >= maxTotalEvents) break;
      const timeClean = time.trim();
      const key = `${normalizedFullTitle}-${venue}-${date}-${timeClean}`.toLowerCase();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      
      events.push({
        title: `Candlelight: ${title}`,
        description: `Experience ${title} by candlelight at ${venue}`,
        date: `${date} ${time}`,
        location_name: venue,
        source: 'Fever',
        url: baseUrl,
      });
    }
  }
  
  return events;
}

// UW Huskies Sports
export function parseHuskies(html: string, baseUrl: string): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];
  const seenEvents = new Set<string>();

  // Text is concatenated without newlines - split by date headers
  const bodyText = $('body').text();
  
  // Split by day names to get individual days
  const dayPattern = /(SUNDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY),?\s+([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})/gi;
  
  // Sports we want: basketball, soccer, baseball, football
  const wantedSports = ['Basketball', 'Soccer', 'Baseball', 'Football'];
  
  let lastIndex = 0;
  let match;
  
  // Find each day section
  while ((match = dayPattern.exec(bodyText)) !== null) {
    const dayName = match[1];
    const monthStr = match[2];
    const day = match[3];
    const year = match[4];
    
    const dateStr = `${monthStr} ${day}, ${year}`;
    const dayStart = match.index + match[0].length;
    
    // Find the next day to get the section text
    const nextMatch = dayPattern.exec(bodyText);
    const dayEnd = nextMatch ? nextMatch.index : bodyText.length;
    
    // Reset regex position
    dayPattern.lastIndex = dayPattern.lastIndex - match[0].length;
    
    const dayText = bodyText.slice(dayStart, dayEnd);
    
    // Find events in this day's text
    const eventLines = dayText.split(/(?=[A-Z][a-z]+\s+vs\s+|[A-Z][a-z]+\s+at\s+)/);
    
    for (const line of eventLines) {
      // Check if line has a wanted sport
      const isWantedSport = wantedSports.some(sport => 
        line.toLowerCase().includes(sport.toLowerCase())
      );
      
      if (!isWantedSport) continue;
      
      // Check if it's a home game (vs) in Seattle
      const isHomeGame = line.includes('vs') && line.includes('Seattle');
      
      if (!isHomeGame) continue;
      
      // Extract sport type
      let sportType = 'Sports';
      if (line.toLowerCase().includes('basketball')) sportType = 'Basketball';
      else if (line.toLowerCase().includes('soccer')) sportType = 'Soccer';
      else if (line.toLowerCase().includes('baseball')) sportType = 'Baseball';
      else if (line.toLowerCase().includes('football')) sportType = 'Football';
      
      // Extract opponent
      const opponentMatch = line.match(/vs\s+(.+?)(?:\s+\d|:|$)/);
      const opponent = opponentMatch ? opponentMatch[1].trim() : 'TBD';
      
      const eventKey = `${line.slice(0, 30)}-${dateStr}`;
      if (seenEvents.has(eventKey)) continue;
      seenEvents.add(eventKey);
      
      // Extract time
      let timeStr = '19:00';
      const timeMatch = line.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2];
        const period = timeMatch[3].toLowerCase();
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        timeStr = `${String(hours).padStart(2, '0')}:${minutes}:00`;
      }
      
      const finalDate = normalizeDate(dateStr);
      
      // Determine venue based on sport
      let venue = 'Husky Stadium / Seattle';
      if (sportType === 'Baseball') venue = 'Husky Ballpark, Seattle';
      else if (sportType === 'Soccer') venue = 'Husky Soccer Stadium, Seattle';
      else if (sportType === 'Basketball') venue = 'Husky Basketball Arena, Seattle';
      
      const title = `UW ${sportType}: vs ${opponent}`;
      
      events.push({
        title,
        description: `UW ${sportType} home game`,
        date: `${finalDate} ${timeStr}`,
        location_name: venue,
        source: 'UW Huskies',
        url: baseUrl,
        ticket_url: baseUrl,
      });
    }
  }

  return events;
}

// 19hz (EDM / Raves / Shows)
export function parse19hz(html: string, baseUrl: string): RawScrapedEvent[] {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];

  // 19hz has a table with events in <tr> elements
  $('table tbody tr, tr').each((_, el) => {
    const $el = $(el);
    const $cells = $el.find('td');
    
    if ($cells.length < 3) return; // Skip header rows or incomplete rows
    
    // First cell: date like "Sun: Mar 15 (1pm)" or "1st Mondays (9pm-2am)"
    let dateCell = $cells.eq(0).text().trim();
    // Handle <br /> by looking at html() as well
    if (!dateCell.includes('(')) {
      dateCell = $cells.eq(0).html()?.replace(/<br\s*\/?>/gi, ' ') || dateCell;
      dateCell = dateCell.replace(/<[^>]+>/g, '').trim();
    }
    // Second cell: event name and venue
    const eventCell = $cells.eq(1).text().trim();
    // Third cell: genre
    const genreCell = $cells.eq(2).text().trim();
    // Fourth cell: price/age
    const priceCell = $cells.eq(3).text().trim();
    
    // Extract event name and venue from eventCell
    const eventMatch = eventCell.match(/^(.+?)\s*@(.+)$/);
    let title = eventMatch ? eventMatch[1].trim() : eventCell;
    const venue = eventMatch ? eventMatch[2].trim() : '';
    
    if (!title || title.length < 2) return;
    
    // Get URL from link in event cell
    const url = $el.find('td a').first().attr('href') || '';
    
    // Parse date - format is like "Sun: Mar 15 (1pm)" or "Mon: Mar 16 (7pm)"
    // Or recurring: "1st Mondays (9pm-2am)"
    const dateMatch = dateCell.match(/(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\w*:\s*([A-Za-z]+)\s+(\d{1,2})/i);
    
    // Extract time - look for patterns like "(1pm)", "(7pm)", "(9pm-2am)"
    // Include the closing parenthesis in the match to avoid matching issues
    const cleanDateCell = dateCell.replace(/<br\s*\/?>/gi, ' ');
    const timeMatch = cleanDateCell.match(/\((\d{1,2})(?::(\d{2}))?\s*([ap]m)\)/i);
    
    let dateStr = '2026-03-15';
    if (dateMatch) {
      dateStr = normalizeDate(`${dateMatch[1]} ${dateMatch[2]}`);
    }
    
    let timeStr = '21:00';
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = (timeMatch[2] || '0').padStart(2, '0');
      const period = timeMatch[3].toLowerCase();
      
      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      timeStr = `${String(hours).padStart(2, '0')}:${minutes}:00`;
    }

    events.push({
      title: `EDM: ${title}`,
      description: `${genreCell} | ${priceCell}`,
      date: `${dateStr} ${timeStr}`,
      location_name: venue || 'Seattle area venues',
      source: '19hz',
      url: url ? (url.startsWith('http') ? url : new URL(url, baseUrl).href) : baseUrl,
    });
  });

  return events;
}

// Events12 (filtered by specific categories only)
// Uses venue name from listing page - will be looked up in comprehensive venue DB
export async function parseEvents12Filtered(html: string, baseUrl: string): Promise<RawScrapedEvent[]> {
  const $ = cheerio.load(html);
  const events: RawScrapedEvent[] = [];

  // Only these categories from Events12
  const ALLOWED_CATEGORIES = ['dance', 'concert', 'comedy', 'ballet', 'show', 'bands'];
  
  // Exclude Candlelight concerts - we get these from Fever instead
  const EXCLUDED_KEYWORDS = ['candlelight', 'candle light'];

  $('article').each((_, article) => {
    const $article = $(article);
    const $eventPara = $article.find('p.event');
    const $h3 = $article.find('h3');
    
    const title = $h3.text().trim() || $eventPara.find('a').text().trim();
    if (!title || title.length < 3) return;
    
    // Exclude Candlelight events
    const titleLower = title.toLowerCase();
    const isExcluded = EXCLUDED_KEYWORDS.some(kw => titleLower.includes(kw));
    if (isExcluded) return;

    // Check if title matches allowed categories
    const isAllowedCategory = ALLOWED_CATEGORIES.some(cat => 
      titleLower.includes(cat) || 
      titleLower.includes(cat + 's')
    );
    
    const articleText = $article.text().toLowerCase();
    const hasCategoryKeyword = ALLOWED_CATEGORIES.some(cat => 
      articleText.includes(cat) || 
      articleText.includes(cat + 's')
    );
    
    if (!isAllowedCategory && !hasCategoryKeyword) {
      return;
    }

    const $datePara = $article.find('p.date').first();
    const $timeSpan = $datePara.find('span.nobreak').first();
    let dateStr = $datePara.text().trim();
    let timeStr = $timeSpan.text().trim();
    
    dateStr = dateStr.replace(/\(\d+.*?\)/, '').trim();
    
    if (!timeStr) {
      const timeMatch = dateStr.match(/(\d{1,2}:\d{2}\s*[ap]m)/i);
      if (timeMatch) {
        timeStr = timeMatch[1];
        dateStr = dateStr.replace(timeMatch[0], '').trim();
      }
    }
    
    if (!timeStr) timeStr = '19:00';
    
    if (timeStr && !dateStr.includes(timeStr)) {
      dateStr = `${dateStr} ${timeStr}`;
    }

    const $milesPara = $article.find('p.miles').first();
    const locationRaw = $milesPara.text().replace(/\(\d+.*?\)/, '').trim();

    let photoLink = $article.find('a.b3').first().attr('href') || '';
    if (photoLink && !isValidImageUrl(photoLink)) {
      photoLink = '';
    }

    const $eventLink = $eventPara.find('a').first();
    const url = $eventLink.attr('href') || baseUrl;
    const fullUrl = url?.startsWith('http') ? url : url ? new URL(url, baseUrl).href : baseUrl;

    // Get description
    let description = '';
    $article.find('p').each((_, p) => {
      const text = $(p).text().trim();
      if (text.length > 20 && !text.toLowerCase().includes('map') && !text.startsWith('http')) {
        description = text;
        return false;
      }
    });
    if (!description) description = title;

    const finalDate = normalizeDate(dateStr) + ' ' + parseTime(timeStr);
    const validatedDate = isValidScrapedDate(finalDate) ? finalDate : fixScrapedDate(finalDate);

    events.push({
      title,
      description,
      date: validatedDate,
      location_name: locationRaw || 'Seattle, WA',
      source: 'Events12',
      url: fullUrl,
      image: photoLink || undefined,
    });
  });

  return events;
}
