import * as cheerio from 'cheerio';
import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';
import { normalizeDate } from './utils.js';
import { fetchRenderedHTML } from '../firecrawl_scraper.js';

export class SeattleOperaConnector implements DataConnector {
  name = 'Seattle Opera';
  sourceUrl = 'https://www.seattleopera.org/calendar/';
  enabled = true;
  type = 'playwright' as const;
  category = 'art';

  async scrape(): Promise<RawScrapedEvent[]> {
    const html = await fetchRenderedHTML(this.sourceUrl);
    if (!html) return [];

    const $ = cheerio.load(html);
    const events: RawScrapedEvent[] = [];

    $('.calendar-list-events-item').each((_, el) => {
      const $el = $(el);
      
      const title = $el.attr('data-event-title');
      const dateStr = $el.attr('data-calendar-date');
      const location = $el.attr('data-event-location');
      
      if (!title || !title.trim()) return;
      
      const infoTitle = $el.find('.calendar-info-title a').text().trim();
      const fullTitle = title || infoTitle;
      
      const dateText = $el.find('.calendar-info-date').text().trim();
      const venue = $el.find('.calendar-info-venue').text().trim() || location || 'McCaw Hall, Seattle Center';
      const description = $el.find('.calendar-info-text').text().trim();
      const url = $el.find('.calendar-info-title a').attr('href');
      
      let finalDate = dateStr || '2026-04-01';
      let timeStr = '19:30';
      
      const dateTimeMatch = dateText.match(/(\w+day,?\s+)?([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})?\s+(\d{1,2}):(\d{2})\s*([ap]m)?/i);
      if (dateTimeMatch) {
        const monthStr = dateTimeMatch[2];
        const day = dateTimeMatch[3];
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
        title: fullTitle,
        description: description?.substring(0, 300) || 'Seattle Opera performance',
        date: `${finalDate} ${timeStr}`,
        location_name: venue,
        source: this.name,
        url: url ? (url.startsWith('http') ? url : `https://www.seattleopera.org${url}`) : this.sourceUrl,
      });
    });

    return events;
  }
}
