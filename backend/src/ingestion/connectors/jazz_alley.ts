import * as cheerio from 'cheerio';
import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';
import { normalizeDate } from './utils.js';
import { fetchRenderedHTML } from '../firecrawl_scraper.js';

export class JazzAlleyConnector implements DataConnector {
  name = 'Jazz Alley';
  sourceUrl = 'https://www.jazzalley.com/www-home/calendar.jsp';
  enabled = true;
  type = 'playwright' as const;
  category = 'music';

  async scrape(): Promise<RawScrapedEvent[]> {
    const html = await fetchRenderedHTML(this.sourceUrl);
    if (!html) return [];

    const $ = cheerio.load(html);
    const events: RawScrapedEvent[] = [];
    const seenTitles = new Set<string>();

    const $newsBoxes = $('.news-box').toArray();

    for (const box of $newsBoxes) {
      const $box = $(box);
      
      const $titleEl = $box.find('h2');
      const title = $titleEl.text().trim();
      
      if (!title || title.length < 3 || seenTitles.has(title)) continue;
      if (title.toLowerCase().includes('calendar') || title.toLowerCase().includes('menu')) continue;
      
      seenTitles.add(title);
      
      const $dateEl = $box.find('.date');
      const dateText = $dateEl.text().trim();
      
      const fullText = $box.text();
      const overviewDesc = fullText.replace(title, '').replace(dateText, '').trim().slice(0, 300);
      
      const $link = $box.find('a[href*="artist.jsp"]').first();
      const urlStr = $link.attr('href') || '';
      if (!urlStr) continue;
      
      let finalDate = '2026-03-15';
      const rangeMatch = dateText.match(/([A-Z][a-z]{2}),?\s*([A-Z][a-z]{2})\s*(\d{1,2})\s*[-–]\s*([A-Z][a-z]{2})\s*(\d{1,2})/);
      if (rangeMatch) {
        finalDate = normalizeDate(`${rangeMatch[2]} ${rangeMatch[3]}`);
      } else {
        const singleMatch = dateText.match(/([A-Z][a-z]{2}),?\s*([A-Z][a-z]{2})\s*(\d{1,2})/);
        if (singleMatch) {
          finalDate = normalizeDate(`${singleMatch[2]} ${singleMatch[3]}`);
        }
      }

      // -----------------------------------------------------
      // Deep Scrape: Event Details Page
      // -----------------------------------------------------
      const fullUrl = `https://www.jazzalley.com${urlStr}`;
      console.log(`[Jazz Alley] Deep scraping ${title}...`);
      const eventHtml = await fetchRenderedHTML(fullUrl);
      
      let imageUrl = '';
      let artistInfo = overviewDesc;
      let price = 'Various Prices'; // Default
      const sessions: any[] = [];

      if (eventHtml) {
        const rawEventHtml = eventHtml;
        const $event = cheerio.load(eventHtml);
        
        // Extract Artist Info & Image from "<!-- Start Artist Info -->" block
        const artistInfoMatch = rawEventHtml.match(/<!--\s*Start Artist Info\s*-->(.*?)<!--/is);
        if (artistInfoMatch) {
          const $artistBlock = cheerio.load(artistInfoMatch[1]);
          const imgPath = $artistBlock('img').attr('src');
          if (imgPath) {
             imageUrl = imgPath.startsWith('http') ? imgPath : `https://www.jazzalley.com${imgPath}`;
          }
          
          const textContent = $artistBlock.text().trim().replace(/\s+/g, ' ');
          if (textContent.length > 20) {
            artistInfo = textContent.slice(0, 500); // Truncate cleanly
          }
        }

        // Extract Price (e.g., "$35.50")
        const priceMatch = rawEventHtml.match(/\$\d{2,3}(\.\d{2})?/);
        if (priceMatch) {
          price = priceMatch[0];
        }

        // Extract Sessions Matrix
        const $select = $event('select').filter(function() {
            return $event(this).find('option[value="0"]').text().includes('Choose a Performance');
        });

        if ($select.length > 0) {
            $select.find('option').each((_, opt) => {
                const optVal = $event(opt).attr('value');
                const optText = $event(opt).text().trim();
                if (optVal !== "0" && optText) {
                    const parts = optText.split('@');
                    let sDate = finalDate;
                    let sTime = undefined;
                    
                    if (parts.length > 1) {
                       const parsedDate = normalizeDate(parts[0].trim());
                       sDate = parsedDate !== '2026-03-15' ? parsedDate : finalDate;
                       sTime = parts[1].trim();
                    }
                    
                    sessions.push({
                        date: sDate,
                        start_time: sTime,
                        price: price
                    });
                }
            });
        }
      }

      events.push({
        title: title,
        description: artistInfo,
        date: finalDate,
        start_time: '19:30',
        price: price,
        sessions: sessions.length > 0 ? sessions : undefined,
        image: imageUrl || undefined,
        location_name: "Dimitriou's Jazz Alley, Seattle",
        source: this.name,
        url: fullUrl,
      });
    }

    return events;
  }
}
