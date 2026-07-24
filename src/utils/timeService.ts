/**
 * Network Real-Time Synchronization Service.
 * Ensures all app timestamps, agenda dates, expert sessions, financial transactions,
 * audit logs, and reports rely on accurate online network time (Africa/Cairo timezone)
 * instead of relying on local device clock which could be inaccurate or tampered with.
 */

interface SyncStatus {
  isSynced: boolean;
  offsetMs: number;
  lastSyncTime: number | null;
  source: string;
}

class TimeService {
  private offsetMs = 0;
  private isSyncedState = false;
  private lastSyncTimestamp: number | null = null;
  private syncSource = 'none';
  private syncedBaseRealTimeMs = 0;
  private syncedPerfMarkMs = 0;
  private syncPromise: Promise<boolean> | null = null;
  private syncIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Restore cached offset from localStorage if available for offline boot
    this.restoreCachedOffset();

    if (typeof window !== 'undefined') {
      // Auto-sync when coming back online
      window.addEventListener('online', () => {
        this.syncNetworkTime();
      });

      // Start periodic re-sync every 10 minutes
      this.syncIntervalTimer = setInterval(() => {
        this.syncNetworkTime();
      }, 10 * 60 * 1000);

      // Initial sync
      this.syncNetworkTime();
    }
  }

  /**
   * Restores cached offset from previous successful syncs
   */
  private restoreCachedOffset() {
    try {
      const cached = localStorage.getItem('__law_time_sync__');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (typeof parsed.offsetMs === 'number') {
          this.offsetMs = parsed.offsetMs;
          this.lastSyncTimestamp = parsed.lastSyncTimestamp || null;
          this.syncSource = 'cache';
          this.updatePerfBase(Date.now() + this.offsetMs);
        }
      }
    } catch {
      // Ignore cache read error
    }
  }

  /**
   * Cache offset locally for offline persistence
   */
  private saveCachedOffset() {
    try {
      localStorage.setItem('__law_time_sync__', JSON.stringify({
        offsetMs: this.offsetMs,
        lastSyncTimestamp: this.lastSyncTimestamp,
      }));
    } catch {
      // Ignore cache write error
    }
  }

  private updatePerfBase(syncedNowMs: number) {
    this.syncedBaseRealTimeMs = syncedNowMs;
    this.syncedPerfMarkMs = typeof performance !== 'undefined' ? performance.now() : 0;
  }

  /**
   * Synchronize time with online NTP/Time APIs
   */
  public async syncNetworkTime(): Promise<boolean> {
    if (this.syncPromise) return this.syncPromise;

    this.syncPromise = (async () => {
      let networkTimeMs: number | null = null;
      let source = '';

      const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 4000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, { ...options, signal: controller.signal });
          clearTimeout(id);
          return res;
        } catch (e) {
          clearTimeout(id);
          throw e;
        }
      };

      // Attempt Source 1: WorldTimeAPI (Africa/Cairo)
      try {
        const t0 = performance.now();
        const res = await fetchWithTimeout('https://worldtimeapi.org/api/timezone/Africa/Cairo');
        const t1 = performance.now();
        if (res.ok) {
          const data = await res.json();
          if (data.unixtime) {
            const latency = (t1 - t0) / 2;
            networkTimeMs = (data.unixtime * 1000) + latency;
            source = 'worldtimeapi';
          }
        }
      } catch {
        // Fall through to next endpoint
      }

      // Attempt Source 2: TimeAPI.io
      if (!networkTimeMs) {
        try {
          const t0 = performance.now();
          const res = await fetchWithTimeout('https://timeapi.io/api/time/current/zone?timeZone=Africa/Cairo');
          const t1 = performance.now();
          if (res.ok) {
            const data = await res.json();
            if (data.dateTime) {
              const latency = (t1 - t0) / 2;
              networkTimeMs = new Date(data.dateTime).getTime() + latency;
              source = 'timeapi';
            }
          }
        } catch {
          // Fall through
        }
      }

      // Attempt Source 3: Fetch Response Date Header from origin or reliable server
      if (!networkTimeMs) {
        try {
          const t0 = performance.now();
          const res = await fetchWithTimeout('/api/health', { method: 'HEAD' });
          const t1 = performance.now();
          const dateHeader = res.headers.get('date');
          if (dateHeader) {
            const latency = (t1 - t0) / 2;
            networkTimeMs = new Date(dateHeader).getTime() + latency;
            source = 'server_header';
          }
        } catch {
          // Fall through
        }
      }

      if (networkTimeMs) {
        const deviceNow = Date.now();
        this.offsetMs = networkTimeMs - deviceNow;
        this.isSyncedState = true;
        this.lastSyncTimestamp = deviceNow;
        this.syncSource = source;
        this.updatePerfBase(networkTimeMs);
        this.saveCachedOffset();
        this.notifyListeners();
        return true;
      } else {
        // If all network sources failed (offline), ensure perf base is kept
        if (!this.isSyncedState && this.offsetMs === 0) {
          this.updatePerfBase(Date.now());
        }
        return false;
      }
    })().finally(() => {
      this.syncPromise = null;
    });

    return this.syncPromise;
  }

  /**
   * Get current synchronized timestamp (ms)
   * Uses high-precision performance.now() elapsed time to prevent manual clock tampering during session
   */
  public getNowTimestamp(): number {
    if (typeof performance !== 'undefined' && this.syncedBaseRealTimeMs > 0) {
      const elapsed = performance.now() - this.syncedPerfMarkMs;
      return Math.round(this.syncedBaseRealTimeMs + elapsed);
    }
    return Date.now() + this.offsetMs;
  }

  /**
   * Get current synchronized Date object
   */
  public getNowDate(): Date {
    return new Date(this.getNowTimestamp());
  }

  /**
   * Get ISO string based on network time
   */
  public getISOString(): string {
    return this.getNowDate().toISOString();
  }

  /**
   * Get YYYY-MM-DD string in Africa/Cairo timezone
   */
  public getCairoYMD(dateObj?: Date): string {
    const d = dateObj || this.getNowDate();
    // Format to Cairo timezone
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(d); // Outputs YYYY-MM-DD
    } catch {
      return d.toISOString().split('T')[0];
    }
  }

  /**
   * Get Arabic formatted date string in Cairo timezone
   */
  public formatCairoDate(dateStrOrObj?: string | Date, options?: Intl.DateTimeFormatOptions): string {
    if (!dateStrOrObj) return '';
    try {
      const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
      if (isNaN(d.getTime())) return String(dateStrOrObj);

      const defaultOpts: Intl.DateTimeFormatOptions = {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
      };

      return d.toLocaleDateString('ar-EG', defaultOpts);
    } catch {
      return String(dateStrOrObj);
    }
  }

  /**
   * Format time in 12h or 24h format for Cairo timezone
   */
  public formatCairoTime(dateStrOrObj?: string | Date): string {
    try {
      const d = dateStrOrObj ? (typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj) : this.getNowDate();
      return d.toLocaleTimeString('ar-EG', {
        timeZone: 'Africa/Cairo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  }

  public getStatus(): SyncStatus {
    return {
      isSynced: this.isSyncedState,
      offsetMs: this.offsetMs,
      lastSyncTime: this.lastSyncTimestamp,
      source: this.syncSource,
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }
}

export const timeService = new TimeService();

// Export convenience helper functions
export const getNetworkTimestamp = () => timeService.getNowTimestamp();
export const getNetworkDate = () => timeService.getNowDate();
export const getNetworkISOString = () => timeService.getISOString();
export const getSyncedCairoDate = () => timeService.getCairoYMD();
export const formatCairoDate = (date?: string | Date, options?: Intl.DateTimeFormatOptions) => timeService.formatCairoDate(date, options);
export const formatCairoTime = (date?: string | Date) => timeService.formatCairoTime(date);
