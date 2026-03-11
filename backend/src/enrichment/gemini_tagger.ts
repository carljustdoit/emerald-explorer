import { RawScrapedEvent, EnrichedEvent, Location } from '../types/schema.js';
import { createHash } from 'crypto';

const DEFAULT_SEATTLE_COORDS: Location = {
  name: 'Seattle, WA',
  lat: 47.6062,
  lon: -122.3321,
};

const KNOWN_VENUES: Record<string, Location> = {
  'pike place': { name: 'Pike Place Market', lat: 47.6101, lon: -122.3421 },
  'capitol hill': { name: 'Capitol Hill', lat: 47.6253, lon: -122.3222 },
  'south lake union': { name: 'South Lake Union', lat: 47.6185, lon: -122.3389 },
  'belltown': { name: 'Belltown', lat: 47.6163, lon: -122.3556 },
  'fremont': { name: 'Fremont', lat: 47.6693, lon: -122.3417 },
  'ballard': { name: 'Ballard', lat: 47.6793, lon: -122.3862 },
  'queen anne': { name: 'Queen Anne', lat: 47.6372, lon: -122.3571 },
  'university district': { name: 'University District', lat: 47.6553, lon: -122.3032 },
  'wework': { name: 'WeWork South Lake Union', lat: 47.6185, lon: -122.3389 },
  'amazon': { name: 'Amazon Spheres', lat: 47.6220, lon: -122.3368 },
  'space needle': { name: 'Space Needle', lat: 47.6205, lon: -122.3493 },
  'seattle aquarium': { name: 'Seattle Aquarium', lat: 47.6067, lon: -122.3406 },
  'paramount': { name: 'Paramount Theatre', lat: 47.6129, lon: -122.3320 },
  'climate pledge': { name: 'Climate Pledge Arena', lat: 47.5952, lon: -122.3316 },
  't-mobile park': { name: 'T-Mobile Park', lat: 47.5917, lon: -122.3327 },
  'lumen field': { name: 'Lumen Field', lat: 47.5952, lon: -122.3316 },
  'chihuly': { name: 'Chihuly Garden and Glass', lat: 47.6206, lon: -122.3506 },
  'museum of pop culture': { name: 'MoPOP', lat: 47.6219, lon: -122.3480 },
  'woodland park zoo': { name: 'Woodland Park Zoo', lat: 47.6651, lon: -122.3523 },
  'seattle art museum': { name: 'Seattle Art Museum', lat: 47.6073, lon: -122.3358 },
  'seattle central library': { name: 'Seattle Central Library', lat: 47.6065, lon: -122.3304 },
  'kerry park': { name: 'Kerry Park', lat: 47.6321, lon: -122.3603 },
  'gas works park': { name: 'Gas Works Park', lat: 47.6456, lon: -122.3345 },
  'discovery park': { name: 'Discovery Park', lat: 47.6564, lon: -122.4069 },
  'volunteer park': { name: 'Volunteer Park', lat: 47.6304, lon: -122.3167 },
  'cal anderson park': { name: 'Cal Anderson Park', lat: 47.6258, lon: -122.3169 },
  'seward park': { name: 'Seward Park', lat: 47.6866, lon: -122.2952 },
  'green lake': { name: 'Green Lake', lat: 47.6793, lon: -122.3389 },
  'golden gardens': { name: 'Golden Gardens', lat: 47.6904, lon: -122.4021 },
  'alki beach': { name: 'Alki Beach', lat: 47.5778, lon: -122.4078 },
  'lake union': { name: 'Lake Union', lat: 47.6253, lon: -122.3370 },
  'lake washington': { name: 'Lake Washington', lat: 47.6097, lon: -122.3331 },
};

function generateEventId(event: RawScrapedEvent): string {
  const str = `${event.title}-${event.date || 'undated'}-${event.source}`;
  return createHash('sha256').update(str).digest('hex').slice(0, 12);
}

function parseDate(dateStr: string | undefined): { start_time: string; end_time: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (!dateStr) {
    return {
      start_time: `${today}T19:00:00`,
      end_time: `${today}T22:00:00`,
    };
  }

  let startTime = today;
  let endTime = today;
  let startHour = 19;
  let startMin = 0;
  let endHour = 22;
  let endMin = 0;

  const timeMatch = dateStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    startHour = parseInt(timeMatch[1]);
    startMin = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    if (timeMatch[3]?.toLowerCase() === 'pm' && startHour < 12) startHour += 12;
    if (timeMatch[3]?.toLowerCase() === 'am' && startHour === 12) startHour = 0;
  }

  const times = dateStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (times && times[4]) {
    endHour = parseInt(times[4]);
    endMin = times[5] ? parseInt(times[5]) : 0;
    if (times[6]?.toLowerCase() === 'pm' && endHour < 12) endHour += 12;
    if (times[6]?.toLowerCase() === 'am' && endHour === 12) endHour = 0;
  } else {
    endHour = startHour + 2;
  }

  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthMatch = dateStr.toLowerCase().match(new RegExp(`(${monthNames.join('|')})\\s+(\\d{1,2})`));
  const dateNumMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  
  if (monthMatch) {
    const month = monthNames.indexOf(monthMatch[1]) + 1;
    const day = parseInt(monthMatch[2]);
    startTime = `${now.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } else if (dateNumMatch) {
    const month = parseInt(dateNumMatch[1]);
    const day = parseInt(dateNumMatch[2]);
    const year = dateNumMatch[3] ? parseInt(dateNumMatch[3]) : now.getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    startTime = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const dayOfWeek: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6,
  };

  const dayMatch = dateStr.toLowerCase().match(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  if (dayMatch && !monthMatch && !dateNumMatch) {
    const targetDay = dayOfWeek[dayMatch[1].toLowerCase()];
    const currentDay = now.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysToAdd);
    startTime = targetDate.toISOString().split('T')[0];
  }

  endTime = startTime;

  return {
    start_time: `${startTime}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`,
    end_time: `${endTime}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`,
  };
}

function parseLocation(locationName: string | undefined): Location {
  if (!locationName) return DEFAULT_SEATTLE_COORDS;

  const lower = locationName.toLowerCase();

  for (const [key, coords] of Object.entries(KNOWN_VENUES)) {
    if (lower.includes(key)) {
      return coords;
    }
  }

  const addressMatch = locationName.match(/(\d{1,5})\s+(\w+)/);
  if (addressMatch) {
    return {
      name: locationName,
      lat: 47.6062 + (Math.random() - 0.5) * 0.05,
      lon: -122.3321 + (Math.random() - 0.5) * 0.05,
    };
  }

  return {
    name: locationName,
    lat: DEFAULT_SEATTLE_COORDS.lat + (Math.random() - 0.5) * 0.08,
    lon: DEFAULT_SEATTLE_COORDS.lon + (Math.random() - 0.5) * 0.08,
  };
}

function estimateIsKidFriendly(event: RawScrapedEvent): boolean {
  const text = `${event.title} ${event.description} ${event.location_name}`.toLowerCase();

  const adultIndicators = [
    { pattern: /\b(21|18|plus)\s*\+?\b/i, name: '21+/18+' },
    { pattern: /\b(adults?\s*only|21\s*and\s*over|18\s*and\s*over)\b/i, name: 'adults only' },
    { pattern: /\b(nightclub|dance\s*club|speakeasy)\b/i, name: 'nightclub' },
    { pattern: /\b(cocktail\s*bar|wine\s*bar|brewery)\b/i, name: 'bar' },
    { pattern: /\b(late\s*night|after\s*dark)\b/i, name: 'late night' },
    { pattern: /\b(pub\s*crawl|bar\s*crawl)\b/i, name: 'pub crawl' },
    { pattern: /\b(strip|gentleman|ladies\s*night)\b/i, name: 'adult venue' },
  ];

  for (const { pattern, name } of adultIndicators) {
    if (pattern.test(text)) return false;
  }

  const kidFriendlyIndicators = [
    { pattern: /\b(family|kids?|children|all\s*ages)\b/i, name: 'family' },
    { pattern: /\b(farmers?\s*market|market)\b/i, name: 'market' },
    { pattern: /\b(zoo|aquarium|museum)\b/i, name: 'zoo/aquarium/museum' },
    { pattern: /\b(park|playground|trail|hike)\b/i, name: 'outdoor' },
    { pattern: /\b(story\s*time|music\s*class|kids\s*club)\b/i, name: 'kids activity' },
    { pattern: /\b(festival|fair|celebration)\b/i, name: 'festival' },
    { pattern: /\b(movie\s*night|film|concert)\b/i, name: 'film/concert' },
  ];

  for (const { pattern, name } of kidFriendlyIndicators) {
    if (pattern.test(text)) return true;
  }

  if (text.includes('bar') || text.includes('brew') || text.includes('night')) {
    return false;
  }

  return true;
}

function estimateVibeTags(event: RawScrapedEvent): string[] {
  const text = `${event.title} ${event.description} ${event.location_name}`.toLowerCase();
  const tags: string[] = [];

  const tagMappings: [string, string[]][] = [
    ['tech', ['tech', 'technology', 'code', 'developer', 'software', 'ai', 'startup', 'coding', 'programming', 'data science', 'machine learning', 'llm']],
    ['music', ['music', 'concert', 'live music', 'dj', 'band', 'jazz', 'rock', 'hip hop', 'electronic', 'edm', 'folk', 'indie', 'orchestra', 'symphony']],
    ['food', ['food', 'dinner', 'lunch', 'brunch', 'restaurant', 'tasting', 'cooking', 'chef', 'wine tasting', 'brewery', 'food truck', 'pizza']],
    ['outdoor', ['outdoor', 'hike', 'walk', 'park', 'trail', 'kayak', 'paddle', 'camping', 'climbing', 'biking', 'running', 'fitness', 'nature']],
    ['sports', ['sports', 'game', 'match', 'watch party', 'seahawks', 'mariners', 'sounders', 'tennis', 'golf', 'football', 'baseball', 'soccer']],
    ['art', ['art', 'gallery', 'exhibit', 'museum', 'theater', 'theatre', 'film', 'dance', 'performance', 'opera', 'ballet', 'comedy']],
    ['drinks', ['drinks', 'wine', 'beer', 'cocktail', 'brew', 'happy hour', 'pub', 'bar', 'speakeasy', 'tasting']],
    ['market', ['market', 'fair', 'festival', 'vendor', 'craft', 'artisan', 'farmers', 'flea', 'pop-up']],
    ['education', ['education', 'class', 'workshop', 'learn', 'talk', 'meetup', 'conference', 'seminar', 'training']],
    ['nightlife', ['nightlife', 'night', 'evening', 'late', 'club', 'party', 'dance', 'clubbing']],
    ['family', ['family', 'kids', 'children', 'all ages', 'parent', 'tot']],
    ['fitness', ['fitness', 'yoga', 'pilates', 'gym', 'workout', 'run', 'marathon', 'spin', 'crossfit']],
    ['wellness', ['wellness', 'health', 'spa', 'meditation', 'yoga', 'sound bath', 'healing', 'reiki']],
    ['community', ['community', 'volunteer', 'meetup', 'social', 'network', 'connect', 'group']],
  ];

  for (const [tag, keywords] of tagMappings) {
    if (keywords.some(kw => text.includes(kw)) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) tags.push('general');

  return tags.slice(0, 3);
}

export function enrichEvent(event: RawScrapedEvent): EnrichedEvent {
  const times = parseDate(event.date || '');
  const location = parseLocation(event.location_name);

  return {
    id: generateEventId(event),
    source: event.source,
    title: event.title,
    description: event.description || `Event at ${event.location_name || 'Seattle'}`,
    start_time: times.start_time,
    end_time: times.end_time,
    is_kid_friendly: estimateIsKidFriendly(event),
    vibe_tags: estimateVibeTags(event),
    location,
    url: event.url || '',
  };
}

export async function enrichAllEvents(events: RawScrapedEvent[]): Promise<EnrichedEvent[]> {
  console.log(`[Enrichment] Processing ${events.length} events...`);

  const enrichedEvents = events.map(enrichEvent);

  const kidFriendlyCount = enrichedEvents.filter(e => e.is_kid_friendly).length;
  const tagCounts: Record<string, number> = {};
  for (const event of enrichedEvents) {
    for (const tag of event.vibe_tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  console.log(`[Enrichment] Complete. ${enrichedEvents.length} events enriched.`);
  console.log(`[Enrichment] Kid-friendly: ${kidFriendlyCount}/${enrichedEvents.length}`);
  console.log(`[Enrichment] Top tags:`, Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}(${v})`).join(', '));

  return enrichedEvents;
}
