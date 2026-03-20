/**
 * ResortHoursScraper — fetches operating hours + season status for WA ski resorts.
 *
 * Strategy per resort:
 *  1. Try the resort's hours page with Playwright (handles JS-rendered pages)
 *  2. Parse the rendered HTML with cheerio, looking for day-specific rows and night ski blocks
 *  3. Fall back to known static API endpoints (reportpal / GetWeatherDataForHeader / mtnpowder)
 *  4. Fall back to confirmed 2025-26 season schedules as hardcoded defaults
 *
 * Stevens Pass 2025-26 schedule (confirmed from stevenspass.com/hours page):
 *   Day skiing:   9am – 4pm daily
 *   Night skiing: 3pm – 10pm Wed–Sun (starting Jan 14)
 *   Close:        April 12, 2026
 *
 * Snoqualmie 2025-26 schedule (Summit West, typical):
 *   Day skiing:   9am – 4pm weekdays, 8:30am – 4pm weekends
 *   Night skiing: 3pm – 9pm Tue–Thu, 3pm – 10pm Fri–Sun
 *   (fetched live from summitatsnoqualmie.com/hours via Playwright)
 *
 * Crystal Mountain 2025-26 (no regular night skiing):
 *   Day skiing:   9am – 4pm daily (8:30am Sat–Sun)
 *   Close:        ~April 26, 2026
 */

import * as cheerio from 'cheerio';
import { fetchRenderedHTML } from '../firecrawl_scraper.js';

export interface ResortHours {
  isOpenToday: boolean;
  openTime: string | null;
  closeTime: string | null;
  seasonStatus: 'open' | 'closed' | 'closing_soon' | 'unknown';
  note: string | null; // e.g. "Night ski 3:00 PM – 10:00 PM", "Closing Apr 12"
}

// 2025-26 confirmed/estimated season close dates
const SEASON_END: Record<string, string> = {
  snoqualmie: '2026-04-12',
  stevens:    '2026-04-12', // confirmed: "Target closing day: April 12th"
  crystal:    '2026-04-26',
};

// Stevens Pass 2025-26 confirmed schedule
const STEVENS_NIGHT_DAYS = new Set([0, 3, 4, 5, 6]); // Sun, Wed, Thu, Fri, Sat

// Snoqualmie Summit West typical night ski days
const SNOQUALMIE_NIGHT_DAYS = new Set([0, 2, 3, 4, 5, 6]); // Sun, Tue–Sat

export class ResortHoursScraper {

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private static isSkiSeason(): boolean {
    const m = new Date().getMonth();
    return m >= 10 || m <= 3; // Nov–Apr
  }

  private static daysUntil(dateStr: string): number {
    const target = new Date(dateStr + 'T00:00:00');
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - now.getTime()) / 86400000);
  }

  private static closingNote(key: keyof typeof SEASON_END): string | null {
    const d = this.daysUntil(SEASON_END[key]);
    if (d < 0) return null;
    if (d <= 21) {
      const date = new Date(SEASON_END[key] + 'T00:00:00');
      return `Closing ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }
    return null;
  }

  private static closed(note = 'Closed for the season'): ResortHours {
    return { isOpenToday: false, openTime: null, closeTime: null, seasonStatus: 'closed', note };
  }

  /**
   * Parse a single time range from a text fragment.
   * Handles: "9am - 4pm", "9:00am to 4:00pm", "9am–9pm", "9 AM - 10 PM"
   */
  private static parseRange(text: string): { open: string; close: string } | null {
    const norm = text.replace(/[–—]/g, '-').replace(/\./g, '').toLowerCase();
    const m = norm.match(/(\d{1,2}(?::\d{2})?\s*[ap]m)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*[ap]m)/);
    if (!m) return null;
    const fmt = (s: string): string => {
      const clean = s.trim().replace(/(\d)(am|pm)/, '$1 $2');
      const [tp, period] = clean.split(' ');
      const [h, min = '00'] = tp.split(':');
      return `${h}:${min} ${period.toUpperCase()}`;
    };
    return { open: fmt(m[1]), close: fmt(m[2]) };
  }

  /**
   * Pull all time ranges out of a block of text.
   * Returns them in order of appearance.
   */
  private static extractAllRanges(text: string): Array<{ open: string; close: string }> {
    const norm = text.replace(/[–—]/g, '-').replace(/\./g, '').toLowerCase();
    const re = /(\d{1,2}(?::\d{2})?\s*[ap]m)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*[ap]m)/g;
    const results: Array<{ open: string; close: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(norm)) !== null) {
      const parsed = this.parseRange(m[0]);
      if (parsed) results.push(parsed);
    }
    return results;
  }

  private static async fetchStatic(url: string, timeout = 8000): Promise<string | null> {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(id);
      return res.ok ? await res.text() : null;
    } catch (e) {
      clearTimeout(id);
      return null;
    }
  }

  // ─── Snoqualmie ────────────────────────────────────────────────────────────

  static async getSnoqualmieHours(): Promise<ResortHours> {
    if (!this.isSkiSeason() || this.daysUntil(SEASON_END.snoqualmie) < 0) {
      return this.closed();
    }

    const closing = this.closingNote('snoqualmie');
    const dow = new Date().getDay(); // 0=Sun
    const isWeekend = dow === 0 || dow === 6;

    // 1. Playwright render — page dynamically loads hours via JS dropdown
    try {
      const html = await fetchRenderedHTML('https://www.summitatsnoqualmie.com/hours', 6000, 'networkidle');
      if (html && html.length > 3000) {
        const $ = cheerio.load(html);
        const pageText = $('body').text().replace(/\s+/g, ' ');

        // Try to find night ski text block first (appears before/after day hours)
        const nightIdx = pageText.toLowerCase().indexOf('night');
        const dayRanges = this.extractAllRanges(pageText);

        if (dayRanges.length > 0) {
          const dayHours = dayRanges[0];
          // If there's a second range and "night" appears in the page, treat it as night ski
          const nightHours = dayRanges.length > 1 && nightIdx >= 0 ? dayRanges[1] : null;
          const hasNightToday = SNOQUALMIE_NIGHT_DAYS.has(dow) && nightHours;

          const parts: string[] = [];
          if (closing) parts.push(closing);
          if (hasNightToday && nightHours) parts.push(`Night ski ${nightHours.open} – ${nightHours.close}`);

          return {
            isOpenToday: true,
            openTime: dayHours.open,
            closeTime: dayHours.close,
            seasonStatus: closing ? 'closing_soon' : 'open',
            note: parts.join(' · ') || null,
          };
        }

        // Page loaded but no hours parsed — check for closed language
        if (pageText.toLowerCase().includes('closed for the season')) return this.closed();
      }
    } catch (e) {
      console.warn('[ResortHours] Snoqualmie Playwright failed:', (e as Error).message);
    }

    // 2. reportpal API — check open/closed status
    try {
      const res = await fetch('https://www.summitatsnoqualmie.com/api/reportpal?resortName=ss&useReportPal=true', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (res.ok) {
        const data = await res.json();
        const status = ((data.currentConditions?.resortStatus || data.currentConditions?.status || '') as string).toLowerCase();
        if (status.includes('closed') && !status.includes('open')) return this.closed('Closed today');
      }
    } catch { /* ignore */ }

    // 3. Hardcoded fallback: Summit West typical 2025-26 schedule
    const hasNight = SNOQUALMIE_NIGHT_DAYS.has(dow);
    const nightNote = hasNight
      ? `Night ski 3:00 PM – ${dow === 5 || dow === 6 || dow === 0 ? '10:00 PM' : '9:00 PM'}`
      : null;
    const parts = [closing, nightNote].filter(Boolean);

    return {
      isOpenToday: true,
      openTime: isWeekend ? '8:30 AM' : '9:00 AM',
      closeTime: '4:00 PM',
      seasonStatus: closing ? 'closing_soon' : 'open',
      note: parts.join(' · ') || null,
    };
  }

  // ─── Stevens Pass ──────────────────────────────────────────────────────────

  static async getStevensPassHours(): Promise<ResortHours> {
    if (!this.isSkiSeason() || this.daysUntil(SEASON_END.stevens) < 0) {
      return this.closed();
    }

    const closing = this.closingNote('stevens');
    const dow = new Date().getDay();
    const hasNightToday = STEVENS_NIGHT_DAYS.has(dow);

    // 1. Try the hours page — it renders as static HTML (confirmed readable)
    try {
      const html = await this.fetchStatic('https://www.stevenspass.com/explore-the-resort/about-the-resort/hours-of-operation.aspx', 10000);
      if (html && html.length > 2000) {
        const $ = cheerio.load(html);
        const pageText = $('body').text().replace(/\s+/g, ' ');

        // Extract all time ranges from the page
        const ranges = this.extractAllRanges(pageText);

        // Find day skiing range (first range near "Skiing" or first range overall)
        const skiIdx = pageText.toLowerCase().indexOf('skiing');
        const nightIdx = pageText.toLowerCase().indexOf('night ski');
        const dayRange = ranges[0] ?? null;

        // Look for night ski range — appears after "Night Skiing" text
        let nightRange: { open: string; close: string } | null = null;
        if (nightIdx >= 0 && ranges.length > 1) {
          // Find the range closest after the "night ski" mention
          const afterNight = pageText.substring(nightIdx);
          const nightRanges = this.extractAllRanges(afterNight);
          nightRange = nightRanges[0] ?? null;
        }

        // Detect closing date from page text e.g. "April 12th"
        const closeMatch = pageText.match(/(?:target\s+closing|closing\s+day)[^\d]*([A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/i);
        const pageCloseNote = closeMatch
          ? `Closing ${closeMatch[1].replace(/(?:st|nd|rd|th)$/, '')}`
          : closing;

        // Detect if resort is explicitly closed
        if (pageText.toLowerCase().includes('closed for the season') && !dayRange) {
          return this.closed();
        }

        if (dayRange) {
          const nightNote = hasNightToday && nightRange
            ? `Night ski ${nightRange.open} – ${nightRange.close}`
            : hasNightToday
              ? 'Night ski 3:00 PM – 10:00 PM'
              : null;
          const parts = [pageCloseNote, nightNote].filter(Boolean);
          return {
            isOpenToday: true,
            openTime: dayRange.open,
            closeTime: dayRange.close,
            seasonStatus: pageCloseNote ? 'closing_soon' : 'open',
            note: parts.join(' · ') || null,
          };
        }
      }
    } catch (e) {
      console.warn('[ResortHours] Stevens static fetch failed:', (e as Error).message);
    }

    // 2. Try Playwright if static fetch failed
    try {
      const html = await fetchRenderedHTML('https://www.stevenspass.com/explore-the-resort/about-the-resort/hours-of-operation.aspx', 5000);
      if (html && html.length > 2000) {
        const $ = cheerio.load(html);
        const pageText = $('body').text().replace(/\s+/g, ' ');
        const ranges = this.extractAllRanges(pageText);
        if (ranges.length > 0) {
          const nightNote = hasNightToday ? 'Night ski 3:00 PM – 10:00 PM' : null;
          const parts = [closing, nightNote].filter(Boolean);
          return {
            isOpenToday: true,
            openTime: ranges[0].open,
            closeTime: ranges[0].close,
            seasonStatus: closing ? 'closing_soon' : 'open',
            note: parts.join(' · ') || null,
          };
        }
      }
    } catch (e) {
      console.warn('[ResortHours] Stevens Playwright failed:', (e as Error).message);
    }

    // 3. Hardcoded fallback: confirmed 2025-26 schedule
    const nightNote = hasNightToday ? 'Night ski 3:00 PM – 10:00 PM' : null;
    const parts = [closing, nightNote].filter(Boolean);
    return {
      isOpenToday: true,
      openTime: '9:00 AM',
      closeTime: '4:00 PM',
      seasonStatus: closing ? 'closing_soon' : 'open',
      note: parts.join(' · ') || null,
    };
  }

  // ─── Crystal Mountain ──────────────────────────────────────────────────────

  static async getCrystalMountainHours(): Promise<ResortHours> {
    if (!this.isSkiSeason() || this.daysUntil(SEASON_END.crystal) < 0) {
      return this.closed();
    }

    const closing = this.closingNote('crystal');
    const isWeekend = [0, 6].includes(new Date().getDay());

    // 1. Playwright render (page is JS-heavy)
    try {
      const html = await fetchRenderedHTML('https://www.crystalmountainresort.com/about/hours-of-operations', 6000, 'networkidle');
      if (html && html.length > 3000) {
        const $ = cheerio.load(html);
        const pageText = $('body').text().replace(/\s+/g, ' ');

        if (pageText.toLowerCase().includes('closed for the season')) return this.closed();

        const ranges = this.extractAllRanges(pageText);
        if (ranges.length > 0) {
          // Crystal has no regular night skiing — just day hours
          return {
            isOpenToday: true,
            openTime: ranges[0].open,
            closeTime: ranges[0].close,
            seasonStatus: closing ? 'closing_soon' : 'open',
            note: closing,
          };
        }
      }
    } catch (e) {
      console.warn('[ResortHours] Crystal Playwright failed:', (e as Error).message);
    }

    // 2. mtnpowder API — check status and any hours field
    try {
      const res = await fetch(
        'https://mtnpowder.com/feed/v3.json?bearer_token=YUKps_bg1dtxd5ZM-ekRrkUD08tntV6XEJYssuGhWEQ&resortId%5B%5D=80',
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        const resort = Array.isArray(data) ? data[0] : data;
        const status = (resort.ResortStatus || resort.resort_status || '').toLowerCase();
        if (status === 'closed') return this.closed('Closed today');

        const hoursStr: string = resort.OperatingHours || resort.operating_hours
          || resort.mountain_report?.operating_hours || '';
        const parsed = this.parseRange(hoursStr);
        if (parsed) {
          return {
            isOpenToday: true,
            openTime: parsed.open,
            closeTime: parsed.close,
            seasonStatus: closing ? 'closing_soon' : 'open',
            note: closing,
          };
        }
      }
    } catch (e) {
      console.warn('[ResortHours] Crystal mtnpowder failed:', (e as Error).message);
    }

    // 3. Hardcoded fallback
    return {
      isOpenToday: true,
      openTime: isWeekend ? '8:30 AM' : '9:00 AM',
      closeTime: '4:00 PM',
      seasonStatus: closing ? 'closing_soon' : 'open',
      note: closing,
    };
  }

  // ─── Aggregate ─────────────────────────────────────────────────────────────

  static async getAllResortHours(): Promise<{
    snoqualmie: ResortHours;
    stevens: ResortHours;
    crystal: ResortHours;
  }> {
    const [snoqualmie, stevens, crystal] = await Promise.all([
      this.getSnoqualmieHours(),
      this.getStevensPassHours(),
      this.getCrystalMountainHours(),
    ]);
    console.log('[ResortHours]', JSON.stringify({ snoqualmie, stevens, crystal }));
    return { snoqualmie, stevens, crystal };
  }
}
