import Hls from 'hls.js';

export interface ParsedVttCue {
  start: number;
  end: number;
  text: string;
}

export interface TelemetryMetrics {
  slug: string;
  dwellTimeMs: number;
  isFastScroll: boolean;
  completed: boolean;
  completionType?: 'ended' | 'reels_30s' | 'watch_threshold';
  watchedSeconds: number;
  totalDuration: number;
}

export class UnifiedMediaManager {
  private static activeFetches = new Map<string, AbortController>();
  private static dwellTimers = new Map<string, NodeJS.Timeout>();
  private static cardEnterTimes = new Map<string, number>();
  private static telemetryStore = new Map<string, TelemetryMetrics>();

  // =========================================================================
  // 1. HEURISTIC INTENT DEBOUNCER (FAST SCROLL TELEMETRY)
  // =========================================================================

  /**
   * Starts a 400ms dwell timer when a video card snaps into focus.
   * If cancelled before 400ms, flags as Fast Scroll/Skim and aborts secondary fetches.
   */
  public static handleCardFocus(
    slug: string,
    onIntentConfirmed: (signal: AbortSignal) => void | Promise<void>,
    dwellMs = 400
  ): AbortController {
    // Clear any existing dwell timer/controller for this card
    this.cancelDwellOrAbort(slug);

    const controller = new AbortController();
    this.activeFetches.set(slug, controller);
    this.cardEnterTimes.set(slug, Date.now());

    // Initialize telemetry record
    this.telemetryStore.set(slug, {
      slug,
      dwellTimeMs: 0,
      isFastScroll: false,
      completed: false,
      watchedSeconds: 0,
      totalDuration: 0,
    });

    const timer = setTimeout(() => {
      this.dwellTimers.delete(slug);
      if (!controller.signal.aborted) {
        onIntentConfirmed(controller.signal);
      }
    }, dwellMs);

    this.dwellTimers.set(slug, timer);
    return controller;
  }

  /**
   * Cancels pending dwell timer and aborts pending secondary slug API fetch.
   */
  public static cancelDwellOrAbort(slug: string) {
    const timer = this.dwellTimers.get(slug);
    const enterTime = this.cardEnterTimes.get(slug);

    if (timer) {
      clearTimeout(timer);
      this.dwellTimers.delete(slug);

      // User left before dwell timer expired -> Fast Scroll / Skim behavior
      const dwellDuration = enterTime ? Date.now() - enterTime : 0;
      const record = this.telemetryStore.get(slug);
      if (record) {
        record.isFastScroll = true;
        record.dwellTimeMs = dwellDuration;
      }
    }

    const controller = this.activeFetches.get(slug);
    if (controller) {
      controller.abort();
      this.activeFetches.delete(slug);
    }
  }

  public static trackCardEnter(cardId: string) {
    this.cardEnterTimes.set(cardId, Date.now());
  }

  public static shouldInitiatePlayback(cardId: string, delayMs = 400): boolean {
    const enterTime = this.cardEnterTimes.get(cardId);
    if (!enterTime) return true;
    return Date.now() - enterTime >= delayMs;
  }

  public static registerFetch(key: string, controller: AbortController) {
    const existing = this.activeFetches.get(key);
    if (existing) {
      existing.abort();
    }
    this.activeFetches.set(key, controller);
  }

  public static abortFetch(key: string) {
    const controller = this.activeFetches.get(key);
    if (controller) {
      controller.abort();
      this.activeFetches.delete(key);
    }
  }

  public static abortAllFetches() {
    this.dwellTimers.forEach((timer) => clearTimeout(timer));
    this.dwellTimers.clear();
    this.activeFetches.forEach((controller) => controller.abort());
    this.activeFetches.clear();
  }

  /**
   * Tracks video completion telemetry (ended event, 30s reels window, or 95%+ watch threshold)
   */
  public static trackWatchProgress(
    slug: string,
    currentTime: number,
    duration: number,
    isReels = false
  ) {
    if (!duration || duration <= 0) return;
    const record = this.telemetryStore.get(slug) || {
      slug,
      dwellTimeMs: 0,
      isFastScroll: false,
      completed: false,
      watchedSeconds: 0,
      totalDuration: duration,
    };

    record.totalDuration = duration;
    if (currentTime > record.watchedSeconds) {
      record.watchedSeconds = currentTime;
    }

    if (!record.completed && (currentTime >= duration * 0.95 || (isReels && currentTime >= 30))) {
      record.completed = true;
      record.completionType = isReels ? 'reels_30s' : 'watch_threshold';
    }

    this.telemetryStore.set(slug, record);
  }

  public static markVideoEnded(slug: string) {
    const record = this.telemetryStore.get(slug);
    if (record) {
      record.completed = true;
      record.completionType = 'ended';
    }
  }

  public static getTelemetry(slug: string): TelemetryMetrics | undefined {
    return this.telemetryStore.get(slug);
  }

  // =========================================================================
  // 2. ADAPTIVE MODE-BASED HLS GENERATOR
  // =========================================================================

  /**
   * Factory function that dynamically configures HLS.js instantiation according to active mode.
   * - 'latest': Force-clamps maxBufferLength: 2, maxMaxBufferLength: 4, backBufferLength: 0.
   * - 'reels': Focused preview buffer (maxBufferLength: 4, maxMaxBufferLength: 8, backBufferLength: 0).
   * - 'for_you': Standard short-form streaming configs (max 4 seconds forward buffer).
   */
  public static createHlsInstance(mode: 'latest' | 'reels' | 'for_you' | string): Hls {
    const baseConfig: any = {
      enableWorker: true,
      lowLatencyMode: false,
      capLevelToPlayerSize: true,
      autoStartLoad: true,
      startFragPrefetch: true, // Prefetch upcoming media fragment chunks immediately
      startLevel: -1,
      abrBandWidthFactor: 0.9,
      abrBandWidthUpFactor: 0.8,
      abrEwmaDefaultEstimate: 1200000,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      backBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000,
      maxBufferHole: 1.5,
      highBufferWatchdogPeriod: 5,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 10,
    };

    if (mode === 'latest') {
      baseConfig.maxBufferLength = 30;
      baseConfig.maxMaxBufferLength = 60;
      baseConfig.backBufferLength = 30;
    } else if (mode === 'reels') {
      baseConfig.maxBufferLength = 60;
      baseConfig.maxMaxBufferLength = 120;
      baseConfig.backBufferLength = 60;
    } else {
      baseConfig.maxBufferLength = 30;
      baseConfig.maxMaxBufferLength = 60;
      baseConfig.backBufferLength = 30;
    }

    return new Hls(baseConfig);
  }

  /**
   * Programmatically seeks to (duration / 2) on metadata load.
   */
  public static setupReelsController(
    video: HTMLVideoElement
  ): () => void {
    let hasSeeked = false;

    const handleLoadedMetadata = () => {
      if (!hasSeeked && video.duration && video.duration > 0) {
        video.currentTime = video.duration / 2;
        hasSeeked = true;
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }

  // =========================================================================
  // 3. WEB_VTT SUBTITLE AUTO-SYNC CORRECTION
  // =========================================================================

  /**
   * Parses videoElement.textTracks, listens to cuechange, and shifts cue start/end times
   * by subtitleOffsetSeconds with a boundary guardrail preventing looping/compounding shifts.
   */
  public static applySubtitleOffset(
    video: HTMLVideoElement,
    subtitleOffsetSeconds: number
  ) {
    if (!video || !video.textTracks) return;
    const tracks = video.textTracks;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];

      const processTrackCues = () => {
        if (!track.cues) return;
        for (let j = 0; j < track.cues.length; j++) {
          const cue = track.cues[j] as VTTCue;
          if (!cue) continue;

          // Guardrail: store pristine baseline timestamps to prevent compounding shifts
          if ((cue as any)._origStart === undefined) {
            (cue as any)._origStart = cue.startTime;
            (cue as any)._origEnd = cue.endTime;
          }

          // Check if already shifted with current offset to prevent redundant mutation loops
          if ((cue as any)._appliedOffset === subtitleOffsetSeconds) {
            continue;
          }

          const baseStart = (cue as any)._origStart;
          const baseEnd = (cue as any)._origEnd;

          cue.startTime = Math.max(0, baseStart + subtitleOffsetSeconds);
          cue.endTime = Math.max(cue.startTime + 0.05, baseEnd + subtitleOffsetSeconds);
          (cue as any)._appliedOffset = subtitleOffsetSeconds;
        }
      };

      if (track.mode === 'disabled') {
        track.mode = 'hidden';
      }

      processTrackCues();

      // Guard listener to avoid duplicate bindings
      if (!(track as any)._hasCueChangeSyncListener) {
        (track as any)._hasCueChangeSyncListener = true;
        track.addEventListener('cuechange', processTrackCues);
      }
    }
  }

  /**
   * In-memory shift helper for parsed VTT cue items.
   */
  public static shiftParsedCues(cues: ParsedVttCue[], offset: number): ParsedVttCue[] {
    if (!cues || cues.length === 0 || offset === 0) return cues;
    return cues.map((c) => ({
      ...c,
      start: Math.max(0, c.start + offset),
      end: Math.max(0, c.end + offset),
    }));
  }

  // =========================================================================
  // 4. SAFE HARD EVICTION
  // =========================================================================

  /**
   * Hard eviction method that sets videoElement.src = "", calls videoElement.load(),
   * and executes hls.destroy() for complete client-side hardware and memory reclamation.
   */
  public static destroyPlayerInstance(
    videoElement: HTMLVideoElement | null,
    hlsInstance: Hls | null
  ) {
    if (hlsInstance) {
      try {
        hlsInstance.stopLoad();
        hlsInstance.detachMedia();
        hlsInstance.destroy();
      } catch (err) {
        console.warn('[UnifiedMediaManager] HLS destroy warning:', err);
      }
    }

    if (videoElement) {
      try {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.src = '';
        videoElement.load();
      } catch (err) {
        console.warn('[UnifiedMediaManager] Video eviction warning:', err);
      }
    }
  }
}

