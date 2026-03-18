import { RawScrapedEvent } from '../../types/schema.js';

export interface DataConnector {
  /** Uniquely identifies the connector (e.g., 'Seattle Symphony', 'StubHub') */
  name: string;
  
  /** The primary URL this connector scrapes from */
  sourceUrl: string;
  
  /** Indicates whether this connector should be run by default */
  enabled: boolean;
  
  /** 
   * The type of scraping this connector performs. 
   * 'http' uses standard fetch, 'playwright' uses a headless browser.
   */
  type: 'http' | 'playwright';
  
  /** Category of events this connector typically returns */
  category: string;

  /**
   * Executes the scraping logic for this connector.
   * @returns An array of RawScrapedEvent
   */
  scrape(): Promise<RawScrapedEvent[]>;
}
