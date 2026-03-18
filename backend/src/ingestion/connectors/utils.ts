import * as cheerio from 'cheerio';

// Validate date - returns true if date is in valid range (2025-2027)
export function isValidScrapedDate(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  const day = parseInt(match[3]);
  
  return year >= 2025 && year <= 2027 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// Fix invalid scraped dates
export function fixScrapedDate(dateStr: string | undefined): string {
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
    
    // Look for street address patterns 
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
