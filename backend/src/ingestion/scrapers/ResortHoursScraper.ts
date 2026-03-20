/**
 * ResortHoursScraper — fetches operating hours + season status for WA ski resorts.
 * Tries known APIs first; scrapes mountain-report HTML pages as fallback;
 * falls back to day-of-week defaults if all else fails.
 */
import * as cheerio from 'cheerio';

export interface ResortHours {
  isOpenToday: boolean;
  openTime: string | null;   // e.g. "9:00 AM"
  closeTime: string | null;  // e.g. "4:00 PM"
  seasonStatus: 'open' | 'closed' | 'closing_soon' | 'unknown';
  note: string | null;       // e.g. "Closing April 20", "Night skiing Fri–Sat"
}

const SEASON_END_DATES: Record<string, string> = {
  snoqualmie: '2026-04-12',
  stevens: '2026-04-19',
  crystal: '2026-04-26',
};

export class ResortHoursScraper {
  private static async fetchWithTimeout(url: string, timeout = 8000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EmeraldExplorer/1.0)' },
      });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  /** Returns true if today is within the Washington ski season (Nov–Apr). */
  private static isSkiSeason(): boolean {
    const m = new Date().getMonth(); // 0-indexed
    return m >= 10 || m <= 3;
  }

  /** Days until date string (YYYY-MM-DD). Negative = past. */
  private static daysUntil(dateStr: string): number {
    const target = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - now.getTime()) / 86400000);
  }

  private static seasonNote(resort: keyof typeof SEASON_END_DATES): string | null {
    const days = this.daysUntil(SEASON_END_DATES[resort]);
    if (days < 0) return 'Closed for the season';
    if (days <= 21) return `Closing ${new Date(SEASON_END_DATES[resort] + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    return null;
  }

  private static defaultHours(): Pick<ResortHours, 'openTime' | 'closeTime'> {
    const isWeekend = [0, 6].includes(new Date().getDay());
    return { openTime: isWeekend ? '8:30 AM' : '9:00 AM', closeTime: '4:00 PM' };
  }

  /** Try to extract "H:MM AM - H:MM PM" style strings from an arbitrary text blob. */
  private static parseHoursFromText(text: string): { open: string | null; close: string | null } {
    // Match patterns like "9:00 AM - 4:00 PM", "9AM to 4PM", "9 a.m.–4 p.m."
    const m = text.match(/(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)\s*(?:to|–|-|—)\s*(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i);
    if (!m) return { open: null, close: null };
    const normalize = (s: string) => s.replace(/\./g, '').replace(/(\d)(am|pm)/i, '$1 $2').replace(/\s+/g, ' ').toUpperCase();
    return { open: normalize(m[1]), close: normalize(m[2]) };
  }

  // ─── Snoqualmie ────────────────────────────────────────────────────────────

  static async getSnoqualmieHours(): Promise<ResortHours> {
    const seasonNote = this.seasonNote('snoqualmie');
    if (!this.isSkiSeason() || this.daysUntil(SEASON_END_DATES.snoqualmie) < 0) {
      return { isOpenToday: false, openTime: null, closeTime: null, seasonStatus: 'closed', note: 'Closed for the season' };
    }

    try {
      const res = await this.fetchWithTimeout('https://www.summitatsnoqualmie.com/api/reportpal?resortName=ss&useReportPal=true');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Reportpal puts resort-wide status in currentConditions
      const cc = data.currentConditions || {};
      const rawStatus: string = (cc.resortStatus || cc.status || '').toLowerCase();
      const isOpenToday = rawStatus.includes('open') && !rawStatus.includes('closed');

      // Operating hours — various possible field locations
      const hoursText: string = cc.operatingHours || cc.hours || data.operatingHours || data.hours || '';
      const parsed = this.parseHoursFromText(hoursText);

      const defaults = this.defaultHours();
      return {
        isOpenToday: isOpenToday || !rawStatus, // if status unknown, assume open in season
        openTime: parsed.open || defaults.openTime,
        closeTime: parsed.close || defaults.closeTime,
        seasonStatus: seasonNote?.startsWith('Closing') ? 'closing_soon' : 'open',
        note: seasonNote,
      };
    } catch (e) {
      console.warn('[ResortHours] Snoqualmie API failed, using defaults:', (e as Error).message);
    }

    // HTML fallback
    try {
      const res = await this.fetchWithTimeout('https://www.summitatsnoqualmie.com/mountain-report', 10000);
      const html = await res.text();
      const $ = cheerio.load(html);
      const hoursText = $('[class*="hour"], [class*="Hour"], [class*="operating"]').first().text();
      const parsed = this.parseHoursFromText(hoursText);
      const defaults = this.defaultHours();
      return {
        isOpenToday: !html.toLowerCase().includes('closed for the season'),
        openTime: parsed.open || defaults.openTime,
        closeTime: parsed.close || defaults.closeTime,
        seasonStatus: seasonNote?.startsWith('Closing') ? 'closing_soon' : 'open',
        note: seasonNote,
      };
    } catch (e) {
      console.warn('[ResortHours] Snoqualmie HTML fallback failed:', (e as Error).message);
    }

    const defaults = this.defaultHours();
    return { isOpenToday: true, ...defaults, seasonStatus: 'open', note: seasonNote };
  }

  // ─── Stevens Pass ──────────────────────────────────────────────────────────

  static async getStevensPassHours(): Promise<ResortHours> {
    const seasonNote = this.seasonNote('stevens');
    if (!this.isSkiSeason() || this.daysUntil(SEASON_END_DATES.stevens) < 0) {
      return { isOpenToday: false, openTime: null, closeTime: null, seasonStatus: 'closed', note: 'Closed for the season' };
    }

    try {
      const res = await this.fetchWithTimeout('https://www.stevenspass.com/api/PageApi/GetWeatherDataForHeader');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const rawStatus: string = (data.ResortStatus || data.MountainStatus || '').toLowerCase();
      const isOpenToday = rawStatus === 'open' || !rawStatus;
      const hoursText: string = data.OperatingHours || data.Hours || '';
      const parsed = this.parseHoursFromText(hoursText);
      const defaults = this.defaultHours();
      return {
        isOpenToday,
        openTime: parsed.open || defaults.openTime,
        closeTime: parsed.close || defaults.closeTime,
        seasonStatus: seasonNote?.startsWith('Closing') ? 'closing_soon' : 'open',
        note: seasonNote,
      };
    } catch (e) {
      console.warn('[ResortHours] Stevens API failed:', (e as Error).message);
    }

    // Try alternate Alterra endpoint
    try {
      const res = await this.fetchWithTimeout('https://www.stevenspass.com/api/PageApi/GetMountainStatus');
      if (res.ok) {
        const data = await res.json();
        const hoursText: string = data.OperatingHours || data.Hours || '';
        const parsed = this.parseHoursFromText(hoursText);
        const defaults = this.defaultHours();
        return {
          isOpenToday: (data.Status || '').toLowerCase() !== 'closed',
          openTime: parsed.open || defaults.openTime,
          closeTime: parsed.close || defaults.closeTime,
          seasonStatus: seasonNote?.startsWith('Closing') ? 'closing_soon' : 'open',
          note: seasonNote,
        };
      }
    } catch (e) {
      // ignore
    }

    const defaults = this.defaultHours();
    return { isOpenToday: true, ...defaults, seasonStatus: 'open', note: seasonNote };
  }

  // ─── Crystal Mountain ──────────────────────────────────────────────────────

  static async getCrystalMountainHours(): Promise<ResortHours> {
    const seasonNote = this.seasonNote('crystal');
    if (!this.isSkiSeason() || this.daysUntil(SEASON_END_DATES.crystal) < 0) {
      return { isOpenToday: false, openTime: null, closeTime: null, seasonStatus: 'closed', note: 'Closed for the season' };
    }

    try {
      const res = await this.fetchWithTimeout(
        'https://mtnpowder.com/feed/v3.json?bearer_token=YUKps_bg1dtxd5ZM-ekRrkUD08tntV6XEJYssuGhWEQ&resortId%5B%5D=80'
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const resort = Array.isArray(data) ? data[0] : data;

      // mtnpowder v3 schema possibilities
      const rawStatus: string = (resort.ResortStatus || resort.resort_status || '').toLowerCase();
      const isOpenToday = rawStatus === 'open' || !rawStatus;
      const hoursText: string =
        resort.OperatingHours || resort.operating_hours ||
        resort.mountain_report?.operating_hours || '';
      const parsed = this.parseHoursFromText(hoursText);
      const defaults = this.defaultHours();

      // Crystal sometimes has extended/night hours — check for extra note
      const nightNote = (resort.SpecialHours || resort.special_hours || '');

      return {
        isOpenToday,
        openTime: parsed.open || defaults.openTime,
        closeTime: parsed.close || defaults.closeTime,
        seasonStatus: seasonNote?.startsWith('Closing') ? 'closing_soon' : 'open',
        note: seasonNote || (nightNote ? nightNote : null),
      };
    } catch (e) {
      console.warn('[ResortHours] Crystal API failed:', (e as Error).message);
    }

    const defaults = this.defaultHours();
    return { isOpenToday: true, ...defaults, seasonStatus: 'open', note: seasonNote };
  }

  static async getAllResortHours(): Promise<{ snoqualmie: ResortHours; stevens: ResortHours; crystal: ResortHours }> {
    const [snoqualmie, stevens, crystal] = await Promise.all([
      this.getSnoqualmieHours(),
      this.getStevensPassHours(),
      this.getCrystalMountainHours(),
    ]);
    console.log('[ResortHours] Fetched:', { snoqualmie, stevens, crystal });
    return { snoqualmie, stevens, crystal };
  }
}
