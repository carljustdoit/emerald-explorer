import * as cheerio from 'cheerio';
import { fetchRenderedHTML } from '../firecrawl_scraper.js';

export interface ResortSnowData {
  newSnow24h: number;
  baseDepth: number;
  midDepth?: number;
  peakDepth?: number;
  condition: string;
}

export class SnowScraper {
  private static async fetchWithTimeout(url: string, options: any = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  static async scrapeSnoqualmie(): Promise<ResortSnowData> {
    try {
      const url = 'https://www.summitatsnoqualmie.com/api/reportpal?resortName=ss&useReportPal=true';
      const response = await this.fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) throw new Error(`Snoqualmie API failed: ${response.status}`);
      const data = await response.json();
      
      const locations = data.currentConditions?.resortLocations?.location || [];
      const baseResort = locations.find((l: any) => l.name === 'Summit West') || locations[0];
      const midResort = locations.find((l: any) => l.name === 'Alpental Mid') || baseResort;
      const topResort = locations.find((l: any) => l.name === 'Alpental Top') || baseResort;
      
      const result = {
        newSnow24h: parseInt(baseResort.snow24Hours?.inches) || 0,
        baseDepth: parseInt(baseResort.base?.inches) || 0,
        midDepth: parseInt(midResort.base?.inches) || 0,
        peakDepth: parseInt(topResort.base?.inches) || 0,
        condition: baseResort.secondarySurface || baseResort.primarySurface || 'Machine Groomed'
      };
      console.log('[SnowScraper] Snoqualmie Success:', result);
      return result;
    } catch (e) {
      console.error('[SnowScraper] Snoqualmie error:', e);
      return { newSnow24h: 0, baseDepth: 57, midDepth: 65, peakDepth: 80, condition: 'Machine Groomed' };
    }
  }

  static async scrapeStevensPass(): Promise<ResortSnowData> {
    try {
      const url = 'https://www.stevenspass.com/api/PageApi/GetWeatherDataForHeader';
      const response = await this.fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) throw new Error(`Stevens Pass API failed: ${response.status}`);
      const data = await response.json();
      
      const base = parseInt(data.SnowReport?.BaseDepth?.Inches || data.SnowReport?.BaseDepth) || 0;
      const result = {
        newSnow24h: parseInt(data.SnowReport?.Snow24Hours?.Inches || data.SnowReport?.Snow24Hours) || 0,
        baseDepth: base,
        midDepth: base, // Stevens only reports one base depth
        peakDepth: base,
        condition: data.SnowReport?.SurfaceCondition || 'Packed Powder'
      };
      console.log('[SnowScraper] Stevens Success:', result);
      return result;
    } catch (e) {
      console.error('[SnowScraper] Stevens error:', e);
      return { newSnow24h: 0, baseDepth: 105, condition: 'Packed Powder' };
    }
  }

  static async scrapeCrystalMountain(): Promise<ResortSnowData> {
    try {
      const url = 'https://mtnpowder.com/feed/v3.json?bearer_token=YUKps_bg1dtxd5ZM-ekRrkUD08tntV6XEJYssuGhWEQ&resortId%5B%5D=80';
      const response = await this.fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) throw new Error(`Crystal API failed: ${response.status}`);
      const data = await response.json();
      const resort = Array.isArray(data) ? data[0] : data;
      
      const sr = resort.SnowReport || resort.mountain_report?.snow_report;
      const result = {
        newSnow24h: parseInt(sr?.Snow24Inches || sr?.last24HoursInches) || 0,
        baseDepth: parseInt(sr?.BaseArea?.BaseIn || sr?.BaseDepthInches) || 0,
        midDepth: parseInt(sr?.MidMountainArea?.BaseIn || sr?.midMountainBaseInches) || 0,
        peakDepth: parseInt(sr?.SummitArea?.BaseIn || sr?.summitBaseInches) || 0,
        condition: sr?.SurfaceCondition || 'Variable'
      };
      console.log('[SnowScraper] Crystal Success:', result);
      return result;
    } catch (e) {
      console.error('[SnowScraper] Crystal error:', e);
      return { newSnow24h: 0, baseDepth: 60, condition: 'Variable' };
    }
  }

  static async getAllSnowData() {
    console.log('[SnowScraper] Fetching snow data for all resorts...');
    const [snoqualmie, stevens, crystal] = await Promise.all([
      this.scrapeSnoqualmie(),
      this.scrapeStevensPass(),
      this.scrapeCrystalMountain(),
    ]);

    return {
      snoqualmie,
      stevens,
      crystal,
    };
  }
}
