import * as cheerio from 'cheerio';
import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';
import { normalizeDate } from './utils.js';
import { fetchRenderedHTML } from '../firecrawl_scraper.js';

export class UWArtsConnector implements DataConnector {
  name = 'UW Arts';
  sourceUrl = 'https://art.washington.edu/calendar'; // Ensure an actual URL is provided if needed, or derived from context. Assuming a default for now.
  enabled = true;
  type = 'playwright' as const;
  category = 'education'; // Or whatever category fits best

  async scrape(): Promise<RawScrapedEvent[]> {
    const html = await fetchRenderedHTML(this.sourceUrl);
    if (!html) return [];

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
        title: title,
        description: description || 'UW Arts event',
        date: normalizeDate(dateStr),
        location_name: location || 'Various UW Venues',
        source: this.name,
        url: url ? (url.startsWith('http') ? url : new URL(url, this.sourceUrl).href) : this.sourceUrl,
      });
    });

    return events;
  }
}
