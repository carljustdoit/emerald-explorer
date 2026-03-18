import * as cheerio from 'cheerio';
import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';
import { fetchRenderedHTML } from '../firecrawl_scraper.js';

export class UWHuskiesConnector implements DataConnector {
  name = 'UW Huskies';
  sourceUrl = 'https://gohuskies.com/calendar/print/month/0/3-1-2026/3-31-2026/null'; // Using static date for demo purposes
  enabled = true;
  type = 'playwright' as const;
  category = 'sports';

  async scrape(): Promise<RawScrapedEvent[]> {
    const html = await fetchRenderedHTML(this.sourceUrl);
    if (!html) return [];

    const $ = cheerio.load(html);
    const events: RawScrapedEvent[] = [];
    const seenEvents = new Set<string>();

    const bodyText = $('body').text();
    const dayPattern = /(SUNDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY),?\s+([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})/gi;
    const wantedSports = ['Basketball', 'Soccer', 'Baseball', 'Football'];
    
    let match;
    while ((match = dayPattern.exec(bodyText)) !== null) {
      const monthStr = match[2];
      const day = match[3];
      const year = match[4];
      
      const dateStr = `${monthStr} ${day}, ${year}`;
      const dayStart = match.index + match[0].length;
      
      const nextMatch = dayPattern.exec(bodyText);
      const dayEnd = nextMatch ? nextMatch.index : bodyText.length;
      
      dayPattern.lastIndex = dayPattern.lastIndex - match[0].length;
      
      const dayText = bodyText.slice(dayStart, dayEnd);
      
      const eventLines = dayText.split(/(?=[A-Z][a-z]+\s+vs\s+|[A-Z][a-z]+\s+at\s+)/);
      
      for (const line of eventLines) {
        const isWantedSport = wantedSports.some(sport => line.toLowerCase().includes(sport.toLowerCase()));
        if (!isWantedSport) continue;
        
        const isHomeGame = line.includes('vs'); // removed requirement to explicitly include 'Seattle' 
        if (!isHomeGame) continue;
        
        let sportType = 'Sports';
        if (line.toLowerCase().includes('basketball')) sportType = 'Basketball';
        else if (line.toLowerCase().includes('soccer')) sportType = 'Soccer';
        else if (line.toLowerCase().includes('baseball')) sportType = 'Baseball';
        else if (line.toLowerCase().includes('football')) sportType = 'Football';
        
        const opponentMatch = line.match(/vs\s+(.+?)(?:\s+\d|:|$)/);
        const opponent = opponentMatch ? opponentMatch[1].trim() : 'TBD';
        
        const eventKey = `${line.slice(0, 30)}-${dateStr}`;
        if (seenEvents.has(eventKey)) continue;
        seenEvents.add(eventKey);
        
        const timeMatch = line.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        let timeStr = '19:00:00';
        
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2];
          const period = timeMatch[3].toUpperCase();
          
          if (period === 'PM' && hours < 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          
          timeStr = `${String(hours).padStart(2, '0')}:${minutes}:00`;
        }
        
        const monthNum = {
          'JANUARY': '01', 'FEBRUARY': '02', 'MARCH': '03', 'APRIL': '04',
          'MAY': '05', 'JUNE': '06', 'JULY': '07', 'AUGUST': '08',
          'SEPTEMBER': '09', 'OCTOBER': '10', 'NOVEMBER': '11', 'DECEMBER': '12'
        }[monthStr.toUpperCase()] || '01';
        
        const finalDateStr = `${year}-${monthNum}-${day.padStart(2, '0')} ${timeStr}`;
        
        const venueMap: Record<string, string> = {
          'Football': 'Husky Stadium',
          'Basketball': 'Alaska Airlines Arena',
          'Baseball': 'Husky Ballpark',
          'Soccer': 'Husky Soccer Stadium'
        };
        
        events.push({
          title: `${sportType} vs. ${opponent}`,
          description: `UW Huskies ${sportType} home game against ${opponent}`,
          date: finalDateStr,
          location_name: venueMap[sportType] || 'UW Campus, Seattle',
          source: this.name,
          url: 'https://gohuskies.com',
        });
      }
    }

    return events;
  }
}
