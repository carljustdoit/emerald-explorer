import { EventEmitter } from 'events';

export interface StreamEvent {
  type: 'event' | 'progress' | 'error' | 'complete';
  data: any;
  timestamp: string;
}

class ScraperEmitter extends EventEmitter {
  private progress: { source: string; count: number; total: number } = { source: '', count: 0, total: 0 };

  emitEvent(event: any): void {
    const streamEvent: StreamEvent = {
      type: 'event',
      data: event,
      timestamp: new Date().toISOString(),
    };
    this.emit('event', streamEvent);
  }

  emitProgress(source: string, count: number, total: number): void {
    this.progress = { source, count, total };
    const streamEvent: StreamEvent = {
      type: 'progress',
      data: { source, count, total },
      timestamp: new Date().toISOString(),
    };
    this.emit('progress', streamEvent);
  }

  emitError(error: string): void {
    const streamEvent: StreamEvent = {
      type: 'error',
      data: { error },
      timestamp: new Date().toISOString(),
    };
    this.emit('error', streamEvent);
  }

  emitComplete(totalEvents: number): void {
    const streamEvent: StreamEvent = {
      type: 'complete',
      data: { totalEvents },
      timestamp: new Date().toISOString(),
    };
    this.emit('complete', streamEvent);
  }

  getProgress() {
    return this.progress;
  }
}

export const scraperEmitter = new ScraperEmitter();
