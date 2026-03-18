import * as cheerio from 'cheerio';
import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';
import { normalizeDate } from './utils.js';
import { fetchRenderedHTML } from '../firecrawl_scraper.js';

export class SeattleSymphonyConnector implements DataConnector {
  name = 'Seattle Symphony';
  sourceUrl = 'https://www.seattlesymphony.org/en/concerttickets/calendar';
  enabled = true;
  type = 'playwright' as const;
  category = 'music';

  // Cache detail page data to avoid redundant fetches for the same program
  private detailCache: Map<string, { description: string; image?: string }> = new Map();

  async scrape(): Promise<RawScrapedEvent[]> {
    const events: RawScrapedEvent[] = [];
    let currentPage = 1;
    const maxPages = 5; // Restored for full scrape

    while (currentPage <= maxPages) {
      console.log(`[Symphony] Scraping page ${currentPage}...`);
      const url = `${this.sourceUrl}?page=${currentPage}`;
      // Using networkidle to ensure all cards are loaded
      const html = await fetchRenderedHTML(url, 5000, 'networkidle');
      if (!html) {
        console.log(`[Symphony] Failed to fetch HTML for page ${currentPage}`);
        break;
      }

      const $ = cheerio.load(html);
      
      // Let's try to find titles first as anchors for the cards
      const titleLinks = $('a.f-font-heading');
      console.log(`[Symphony] Found ${titleLinks.length} title links on page ${currentPage}`);

      if (titleLinks.length === 0) {
        // Log a snippet of the body to see what's actually there
        console.log(`[Symphony] Body snippet: ${$('body').text().slice(0, 500).replace(/\n/g, ' ')}`);
        break;
      }

      for (const titleLink of titleLinks.toArray()) {
        const $title = $(titleLink);
        const title = $title.text().trim();
        const detailHref = $title.attr('href');
        const detailUrl = detailHref ? (detailHref.startsWith('http') ? detailHref : `https://www.seattlesymphony.org${detailHref}`) : null;

        // The date/time usually follows the title link in a div
        const infoDiv = $title.next('div');
        const dateStr = infoDiv.find('div').first().text().trim();
        const timeStr = infoDiv.find('div:nth-child(2) div').first().text().trim();

        console.log(`[Symphony] Found card candidate: "${title}" | Date: "${dateStr}" | Time: "${timeStr}"`);

        if (!title || !dateStr || !detailUrl) {
          console.log(`[Symphony] Skipping incomplete card: ${title}`);
          continue;
        }

        // Get rich data from cache or fetch
        let richData = this.detailCache.get(detailUrl);
        if (!richData) {
          console.log(`[Symphony] Deep scraping: ${detailUrl}`);
          
          // Add a jittered delay to avoid 429s (1-3 seconds)
          const delay = Math.floor(Math.random() * 2000) + 1000;
          await new Promise(resolve => setTimeout(resolve, delay));

          // Detail pages might also need networkidle if they are JS heavy
          const detailHtml = await fetchRenderedHTML(detailUrl, 2000, 'networkidle');
          if (detailHtml) {
            const $detail = cheerio.load(detailHtml);
            const description = $detail('div.f-m-0.lap\\:f-m-0').text().trim();
            
            // Look for hero images containing /media/ and specifically event-images
            const allMediaImages = $detail('img[src*="/media/"]').toArray();
            let imgUrl = undefined;

            // Heuristic: The hero image is usually the first one in event-images and is large
            for (const img of allMediaImages) {
              const src = $(img).attr('src');
              if (!src) continue;
              
              // Skip logos, icons, and small thumbnails
              if (src.includes('logo') || src.includes('icon') || src.includes('pixel') || src.includes('spacer') || src.includes('226x280')) {
                continue;
              }

              if (src.includes('event-images')) {
                imgUrl = src;
                break; 
              }
            }

            // Fallback to the first media image if no specific event-image found
            if (!imgUrl && allMediaImages.length > 0) {
              const firstSrc = $(allMediaImages[0]).attr('src');
              if (firstSrc && !firstSrc.includes('logo')) {
                imgUrl = firstSrc;
              }
            }

            richData = { 
              description: description || 'No description available.', 
              image: imgUrl ? (imgUrl.startsWith('http') ? imgUrl : `https://www.seattlesymphony.org${imgUrl}`) : undefined 
            };
            this.detailCache.set(detailUrl, richData);
          } else {
            console.warn(`[Symphony] Failed to load details for ${detailUrl}, using placeholder.`);
            richData = { description: 'Description pending...' };
          }
        }

        const normalizedDate = normalizeDate(dateStr);
        let finalStartTime = '19:30:00'; // Default
        if (timeStr) {
          const tMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
          if (tMatch) {
            let hours = parseInt(tMatch[1]);
            const minutes = tMatch[2];
            const ampm = tMatch[3].toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
            finalStartTime = `${String(hours).padStart(2, '0')}:${minutes}:00`;
          }
        }

        events.push({
          title,
          description: richData.description,
          image: richData.image,
          date: `${normalizedDate} ${finalStartTime}`,
          url: detailUrl,
          location_name: 'Benaroya Hall, Seattle',
          source: this.name,
        });
      }

      currentPage++;
    }

    console.log(`[Symphony] Scraped total of ${events.length} event instances.`);
    return events;
  }
}
