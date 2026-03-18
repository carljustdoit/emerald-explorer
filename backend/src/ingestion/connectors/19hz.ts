import * as cheerio from 'cheerio';
import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';
import { fetchHTML, parseTime, normalizeDate } from './utils.js';

export class NineteenHzConnector implements DataConnector {
  name = '19hz';
  sourceUrl = 'https://19hz.info/eventlisting_Seattle.php';
  enabled = true;
  type = 'http' as const;
  category = 'music';

  async scrape(): Promise<RawScrapedEvent[]> {
    const html = await fetchHTML(this.sourceUrl);
    if (!html) return [];

    const $ = cheerio.load(html);
    const events: RawScrapedEvent[] = [];

    // Table parsing logic
    $('table').first().find('tr').each((_, row) => {
      const $cols = $(row).find('td');
      // The table has 6 columns: Date, Title/Venue, Tags, Price/Age, Organizers, Links
      if ($cols.length < 4) return;

      // Col 0: "Tue: Mar 17 (6:30pm-9pm)"
      const dateTimeStr = $cols.eq(0).text().trim();
      
      // Col 1: "Event Title @ Venue (City, State)"
      const titleVenueLink = $cols.eq(1).find('a');
      const titleVenueText = $cols.eq(1).text().trim();
      let url = titleVenueLink.attr('href') || undefined;

      // Col 2: genres/tags
      const genres = $cols.eq(2).text().trim();

      // Col 3: "$10 | 21+" or "All ages"
      const priceAgeStr = $cols.eq(3).text().trim();

      if (!titleVenueText || dateTimeStr.toLowerCase().includes('date')) return;

      // Parse Title and Venue
      // Example: "Flowshop: Intro To Isolations (Poi) w/ Lilac @ Washington Hall (Seattle, WA)"
      let title = titleVenueText;
      let venue = 'Seattle, WA';
      
      if (titleVenueText.includes('@')) {
        const parts = titleVenueText.split('@');
        title = parts[0].trim();
        venue = parts[1].trim();
      }

      // Parse Price and Age Limit
      const priceAgeParts = priceAgeStr.split('|').map(p => p.trim());
      const price = priceAgeParts[0] || '';
      const ageLimit = priceAgeParts.length > 1 ? priceAgeParts[1] : (priceAgeStr.toLowerCase().includes('age') || priceAgeStr.toLowerCase().includes('all') ? priceAgeStr : '');

      // Check if URL is social media
      const isSocialMedia = url && (
        url.includes('facebook.com') || 
        url.includes('instagram.com') || 
        url.includes('twitter.com') || 
        url.includes('x.com')
      );

      // If it's social media, we might not have all info, but we still capture it.
      // The user said: "if the link goes to a social media site... we should just say we don't have the info."
      // We'll append this to the description if it's social media.
      const socialMediaNote = isSocialMedia ? " (Social media link - details may be limited)" : "";

      events.push({
        title,
        description: `Genres: ${genres}. Age: ${ageLimit}.${socialMediaNote}`,
        date: dateTimeStr, // Let enrichEvent handle the complex date/time parsing
        location_name: venue,
        source: this.name,
        url: url || '',
        price: price,
      });
    });

    return events;
  }
}
