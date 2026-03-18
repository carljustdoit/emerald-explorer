import { RawScrapedEvent } from '../../types/schema.js';
import { DataConnector } from './types.js';

export class StubHubConnector implements DataConnector {
  name = 'StubHub';
  sourceUrl = 'https://api.stubhub.com/sellers/search/events/v3';
  enabled = true;
  type = 'http' as const;
  category = 'music';

  async scrape(): Promise<RawScrapedEvent[]> {
    const clientId = process.env.STUBHUB_CLIENT_ID;
    const clientSecret = process.env.STUBHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('[StubHub] Missing STUBHUB_CLIENT_ID or STUBHUB_CLIENT_SECRET in .env. Falling back to 0 events.');
      return [];
    }

    try {
      // Step 1: Obtain Access Token
      const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenRes = await fetch('https://account.stubhub.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'read:events'
        })
      });

      if (!tokenRes.ok) {
        console.error('[StubHub] Failed to obtain access token:', await tokenRes.text());
        return [];
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Step 2: Query Events API (Searching for Seattle Events)
      // Using geolocation or standard string queries based on StubHub docs
      const queryParams = new URLSearchParams({
        city: 'Seattle',
        state: 'WA',
        rows: '50', // Max realistic cap for a single scrape hit
      });

      const eventsRes = await fetch(`https://api.stubhub.com/sellers/search/events/v3?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!eventsRes.ok) {
        console.error('[StubHub] Failed to fetch events data:', await eventsRes.text());
        return [];
      }

      const eventsData = await eventsRes.json();
      const rawEvents: RawScrapedEvent[] = [];

      // Optional chaining in case StubHub response structure varies slightly
      const eventList = eventsData.events || [];
      
      for (const item of eventList) {
        // We know from Stage 2 Validation that URL and Date strictly need to pass
        const title = item.name || 'Unknown StubHub Event';
        // Extract out valid iso or standard dates
        const rawDate = item.eventDateLocal || item.eventDateUTC || new Date().toISOString(); 
        const urlToTicket = item.webURI || `https://www.stubhub.com/event/${item.id}`;

        rawEvents.push({
          title: title,
          description: item.description || 'Tickets available on StubHub',
          date: rawDate.split('T')[0], // Extract just the YYYY-MM-DD
          start_time: rawDate,
          location_name: item.venue?.name || 'Seattle Venue',
          source: this.name,
          url: urlToTicket,
          ticket_url: urlToTicket,
        });
      }

      console.log(`[StubHub] Successfully parsed ${rawEvents.length} distinct API events.`);
      return rawEvents;
    } catch (e) {
      console.error('[StubHub] Fatal mapping error during REST pull:', e);
      return [];
    }
  }
}
