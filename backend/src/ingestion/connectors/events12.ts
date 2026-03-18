import * as cheerio from 'cheerio';
import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';
import { fetchHTML, isValidImageUrl } from './utils.js';

export class Events12Connector implements DataConnector {
  name = 'Events12';
  sourceUrl = 'https://www.events12.com/seattle/';
  enabled = true;
  type = 'http' as const;
  category = 'general';

  async scrape(): Promise<RawScrapedEvent[]> {
    const html = await fetchHTML(this.sourceUrl);
    if (!html) return [];

    const $ = cheerio.load(html);
    const events: RawScrapedEvent[] = [];

    // Existing robust parsing logic
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
      let photoLink = $article.find('a.b3').first().attr('href') || '';
      const videoLink = $article.find('a.b5').first().attr('href') || '';

      if (photoLink && !isValidImageUrl(photoLink)) {
        photoLink = '';
      }

      const $table = $article.find('table.table1, table.table2, table.table3, table.table4').first();
      const $eventLink = $eventPara.find('a').first();
      const teamName = $eventLink.text().trim() || '';
      const eventTitle = $article.find('h3').text().trim() || teamName;
      
      function expandDateRange(dStr: string): string[] {
        const rangeMatch = dStr.match(/^([A-Za-z]+\.?\s*\d+)\s*[-–]\s*(\d+)$/);
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
        return [dStr];
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
            
            if (opponent.startsWith('@')) return;
            
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
                source: this.name,
                url: $eventLink.attr('href') || this.sourceUrl,
                image: isValidImageUrl(photoLink) ? photoLink : undefined,
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
                source: this.name,
                url: $eventLink.attr('href') || this.sourceUrl,
                image: isValidImageUrl(photoLink) ? photoLink : undefined,
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
          const url = $link.attr('href') || this.sourceUrl;

          if (title.length < 3) return;

          events.push({
            title,
            description: text.slice(0, 500),
            date: dateStr,
            location_name: locationRaw || 'Seattle, WA',
            source: this.name,
            url: url?.startsWith('http') ? url : url ? new URL(url, this.sourceUrl).href : this.sourceUrl,
            image: isValidImageUrl(photoLink) ? photoLink : undefined,
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
        source: this.name,
        url: url ? (url.startsWith('http') ? url : new URL(url, this.sourceUrl).href) : this.sourceUrl,
        ticket_url: url?.includes('stubhub') ? url : undefined,
      });
    });

    // 19hz is known for having lots of unrelated out of town events when fetched via Events12, so a specific filtering logic was applied previously
    const seattleKeywords = ['seattle', 'bellevue', 'redmond', 'kirkland', 'tacoma', 'everett', 'capitol hill', 'sodo', 'fremont', 'ballard'];
    
    return events.filter(e => {
        const textToSearch = `${e.title} ${e.description} ${e.location_name}`.toLowerCase();
        return seattleKeywords.some(kw => textToSearch.includes(kw));
    });
  }
}
