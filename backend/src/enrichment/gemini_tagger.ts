import { GoogleGenerativeAI } from '@google/generative-ai';
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
};

function generateEventId(event: RawScrapedEvent): string {
  const str = `${event.title}-${event.date || 'undated'}-${event.source}`;
  return createHash('sha256').update(str).digest('hex').slice(0, 12);
}

function parseDate(dateStr: string): { start_time: string; end_time: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  let startTime = today;
  let endTime = today;
  
  if (!dateStr) {
    return {
      start_time: `${today}T19:00:00`,
      end_time: `${today}T22:00:00`,
    };
  }

  const timeMatch = dateStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  let hour = 19;
  let minute = 0;
  
  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    if (timeMatch[2]) minute = parseInt(timeMatch[2]);
    if (timeMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (timeMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0;
  }

  const dateMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    startTime = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } else if (dateStr.toLowerCase().includes('saturday')) {
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + (6 - now.getDay()));
    startTime = saturday.toISOString().split('T')[0];
  } else if (dateStr.toLowerCase().includes('sunday')) {
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + (7 - now.getDay()));
    startTime = sunday.toISOString().split('T')[0];
  }

  endTime = startTime;
  
  const endHourMatch = dateStr.match(/-?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (endHourMatch && endHourMatch[1] !== timeMatch?.[1]) {
    let endHour = parseInt(endHourMatch[1]);
    if (endHourMatch[3]?.toLowerCase() === 'pm' && endHour < 12) endHour += 12;
    if (endHourMatch[3]?.toLowerCase() === 'am' && endHour === 12) endHour = 0;
    endTime = `${startTime}T${String(endHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  return {
    start_time: `${startTime}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    end_time: `${endTime}T${String(hour + 2).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
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
  
  return {
    name: locationName,
    lat: 47.6062 + (Math.random() - 0.5) * 0.1,
    lon: -122.3321 + (Math.random() - 0.5) * 0.1,
  };
}

function estimateIsKidFriendly(event: RawScrapedEvent): boolean {
  const text = `${event.title} ${event.description} ${event.location_name}`.toLowerCase();
  
  const adultIndicators = [
    '21+', '18+', 'adult', 'nightclub', 'cocktail', 'bar', 'brewery',
    'dance club', 'late night', 'after dark', '21 and over',
    'speakeasy', 'wine bar', 'pub crawl'
  ];
  
  const kidFriendlyIndicators = [
    'family', 'kids', 'children', 'all ages', 'kid friendly',
    'farmers market', 'story time', 'playground', 'zoo', 'aquarium',
    'museum', 'park', 'nature', 'walk', 'market', 'festival'
  ];
  
  for (const indicator of adultIndicators) {
    if (text.includes(indicator)) return false;
  }
  
  for (const indicator of kidFriendlyIndicators) {
    if (text.includes(indicator)) return true;
  }
  
  return true;
}

function estimateVibeTags(event: RawScrapedEvent): string[] {
  const text = `${event.title} ${event.description} ${event.location_name}`.toLowerCase();
  const tags: string[] = [];
  
  const tagMappings: [string, string[]][] = [
    ['tech', ['technology', 'code', 'developer', 'software', 'ai', 'startup']],
    ['music', ['concert', 'live music', 'dj', 'band', 'jazz', 'rock']],
    ['food', ['dinner', 'lunch', 'brunch', 'food', 'restaurant', 'tasting']],
    ['outdoor', ['hike', 'walk', 'park', 'trail', 'kayak', 'paddle']],
    ['sports', ['game', 'match', 'watch party', 'sports bar']],
    ['art', ['gallery', 'art exhibit', 'museum', 'theater', 'theatre']],
    ['fitness', ['yoga', 'run', 'marathon', 'workout', 'gym']],
    ['drinks', ['wine', 'beer', 'cocktail', 'brew', 'happy hour']],
    ['market', ['market', 'fair', 'festival', 'vendor']],
    ['education', ['class', 'workshop', 'learn', 'talk', 'meetup']],
    ['nightlife', ['night', 'evening', 'late', 'club']],
    ['family', ['family', 'kids', 'children', 'all ages']],
  ];

  for (const [tag, keywords] of tagMappings) {
    if (keywords.some((kw: string) => text.includes(kw)) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) tags.push('general');

  return tags.slice(0, 3);
}

export async function enrichEventWithAI(event: RawScrapedEvent): Promise<EnrichedEvent> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return enrichEventLocally(event);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this Seattle event and return JSON with:
1. is_kid_friendly: boolean (true if appropriate for families with children)
2. vibe_tags: array of 1-3 lowercase tags from: tech, music, food, outdoor, sports, art, fitness, drinks, market, education, nightlife, family, chill, high-energy
3. location_lat: number (latitude, default 47.6062 if unknown)
4. location_lon: number (longitude, default -122.3321 if unknown)
5. cleaned_description: string (2-3 sentence description)

Event: ${event.title}
Description: ${event.description}
Location: ${event.location_name}
Source: ${event.source}

Respond ONLY with valid JSON like:
{"is_kid_friendly": true, "vibe_tags": ["tech", "outdoor"], "location_lat": 47.6185, "location_lon": -122.3389, "cleaned_description": "..."}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return enrichEventLocally(event);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    const times = parseDate(event.date || '');
    const location = parseLocation(event.location_name);

    return {
      id: generateEventId(event),
      source: event.source,
      title: event.title,
      description: parsed.cleaned_description || event.description || '',
      start_time: times.start_time,
      end_time: times.end_time,
      is_kid_friendly: parsed.is_kid_friendly ?? estimateIsKidFriendly(event),
      vibe_tags: parsed.vibe_tags || estimateVibeTags(event),
      location: {
        name: event.location_name || location.name,
        lat: parsed.location_lat ?? location.lat,
        lon: parsed.location_lon ?? location.lon,
      },
      url: event.url || '',
    };
  } catch (error) {
    console.error(`[Gemini] Error enriching event "${event.title}":`, error);
    return enrichEventLocally(event);
  }
}

function enrichEventLocally(event: RawScrapedEvent): EnrichedEvent {
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
  
  const enrichedEvents: EnrichedEvent[] = [];
  
  const batchSize = 5;
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(enrichEventWithAI));
    enrichedEvents.push(...results);
    
    console.log(`[Enrichment] Processed ${Math.min(i + batchSize, events.length)}/${events.length}`);
  }

  console.log(`[Enrichment] Complete. ${enrichedEvents.length} events enriched.`);
  return enrichedEvents;
}
