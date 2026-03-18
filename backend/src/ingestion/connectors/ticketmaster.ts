import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';

export class TicketmasterConnector implements DataConnector {
  name = 'Ticketmaster';
  sourceUrl = 'https://app.ticketmaster.com/discovery/v2/events.json';
  enabled = true;
  type = 'http' as const;
  category = 'general';

  async scrape(): Promise<RawScrapedEvent[]> {
    // SECURITY NOTE: This runs exclusively on the Node.js backend.
    // By NOT prefixing with VITE_, this secret will never be bundled 
    // down to the client browsers. This is the industry standard for secrets.
    const apiKey = process.env.TICKETMASTER_API_KEY;

    if (!apiKey) {
      console.warn('[Ticketmaster] Missing TICKETMASTER_API_KEY in backend/.env. Returning 0 events.');
      return [];
    }

    try {
      const rawEvents: RawScrapedEvent[] = [];
      const totalPagesToFetch = 3; // Fetch 600 events total (200 per page)

      for (let page = 0; page < totalPagesToFetch; page++) {
        const queryParams = new URLSearchParams({
          apikey: apiKey,
          city: 'Seattle',
          stateCode: 'WA',
          size: '200', // Max allowed per page
          page: page.toString(),
          sort: 'date,asc', // Sort chronologically
        });

        const url = `${this.sourceUrl}?${queryParams.toString()}`;
        console.log(`[Ticketmaster] Fetching page ${page + 1}/${totalPagesToFetch}...`);

        const response = await fetch(url);

        if (!response.ok) {
          console.error(`[Ticketmaster] API returned ${response.status}: ${await response.text()}`);
          break; // Stop fetching on error
        }

        const data = await response.json();

        // Ticketmaster wraps arrays in the _embedded property
        const eventsList = data._embedded?.events || [];
        if (eventsList.length === 0) break; // No more events

        for (const item of eventsList) {
          if (!item.name || !item.dates?.start?.localDate) continue;

          let highResImage = item.images?.[0]?.url;
          // Prefer a wide ratio 16:9 image if available for better UI display
          const bestImage = item.images?.find((img: any) => img.ratio === '16_9' && img.width > 600);
          if (bestImage) {
            highResImage = bestImage.url;
          }

          let venueName = 'Seattle Venue';
          let venueAddress = undefined;
          let venueLat = undefined;
          let venueLon = undefined;
          
          if (item._embedded?.venues?.[0]) {
             const venue = item._embedded.venues[0];
             venueName = venue.name || venueName;
             
             if (venue.address?.line1) {
               venueAddress = venue.address.line1;
             }
             
             if (venue.location?.latitude && venue.location?.longitude) {
               venueLat = parseFloat(venue.location.latitude);
               venueLon = parseFloat(venue.location.longitude);
             }
          }

          const rawDate = item.dates.start.localDate;
          const timeZone = item.dates.timezone || 'America/Los_Angeles';

          let startTime = undefined;
          if (item.dates.start.localTime) {
             startTime = `${rawDate}T${item.dates.start.localTime}`;
          }

          rawEvents.push({
            title: item.name,
            description: item.info || item.description || `Buy tickets for ${item.name} at ${venueName}`,
            date: rawDate,
            start_time: startTime || undefined,
            location_name: venueName,
            location_address: venueAddress,
            location_lat: venueLat,
            location_lon: venueLon,
            source: this.name,
            url: item.url,
            ticket_url: item.url,
            image: highResImage,
          });
        }
      }

      console.log(`[Ticketmaster] Parsed ${rawEvents.length} events successfully.`);
      return rawEvents;
    } catch (e) {
      console.error('[Ticketmaster] Fatal error during scrape:', e);
      return [];
    }
  }
}
