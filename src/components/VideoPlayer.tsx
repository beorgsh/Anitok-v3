import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, AlertCircle, RefreshCw, Terminal, X, Copy, Check, Trash2, RotateCcw, RotateCw, ChevronLeft, Sliders, SkipBack, SkipForward, ListVideo, Eye, EyeOff } from 'lucide-react';
import { AnimeItem, ServerType, StreamData, SubtitleSettings } from '../types/anime';
import { fetchAnimeStream, getProxiedM3u8Url, getCachedStream, checkDubAvailable } from '../services/animeApi';
import { UnifiedMediaManager } from '../services/UnifiedMediaManager';
import { saveWatchProgress, getSavedTimestamp } from '../services/watchHistory';
import { GradientCircleSpinner } from './LazyLoadSkeleton';

interface VttCueItem {
  start: number;
  end: number;
  text: string;
}

function parseVttTimeString(str: string): number {
  if (!str) return 0;
  const cleanStr = str.trim().split(/\s+/)[0].replace(',', '.');
  const parts = cleanStr.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  } else if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }
  return 0;
}

function cleanVttText(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // Preserve WebVTT voice tags: <v Naruto>Believe it!</v> -> Naruto: Believe it!
  text = text.replace(/<v\s+([^>]+)>(.*?)<\/v>/gi, '$1: $2');
  text = text.replace(/<v\s+([^>]+)>/gi, '$1: ');

  return text
    .replace(/<\d{2}:\d{2}[:.]\d{2,3}>/g, '') // strip inline karaoke timestamps
    .replace(/<[^>]*>/g, '') // strip remaining HTML tags (<c>, <i>, <b>, <font>)
    .replace(/\{[^}]*\}/g, '') // strip ASS style tags ({\an8}, {\pos(..)})
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parseVttContent(vttText: string): VttCueItem[] {
  const cues: VttCueItem[] = [];
  if (!vttText) return cues;

  const lines = vttText.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const parts = line.split('-->');
      const start = parseVttTimeString(parts[0]);
      const end = parseVttTimeString(parts[1]);
      i++;

      const textLines: string[] = [];
      while (i < lines.length) {
        const textLine = lines[i].trim();
        // Break if empty line or next cue timestamp line
        if (!textLine || textLine.includes('-->')) {
          break;
        }
        if (!textLine.startsWith('NOTE') && !textLine.startsWith('STYLE')) {
          const cleanedLine = cleanVttText(textLine);
          if (cleanedLine) {
            textLines.push(cleanedLine);
          }
        }
        i++;
      }

      const rawText = textLines.join('\n');
      if (rawText && end > start) {
        cues.push({ start, end, text: rawText });
      }
    } else {
      i++;
    }
  }

  cues.sort((a, b) => a.start - b.start);
  return cues;
}

interface VideoPlayerProps {
  anime: AnimeItem;
  isActive: boolean;
  shouldPreload: boolean;
  server: ServerType;
  currentEp: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onDoubleTapLike: (e: React.MouseEvent<HTMLDivElement>) => void;
  onVideoEnd?: () => void;
  onProgressUpdate?: (
    progress: number,
    currentTime: number,
    duration: number,
    onSeek: (percentage: number) => void
  ) => void;
  onSubtitleChange?: (subtitle: string) => void;
  onSkipStateChange?: (skipState: { show: boolean; label: string; onSkip: () => void; isSkippable?: boolean; start?: number; end?: number } | null) => void;
  isReels?: boolean;
  onWatchFull?: () => void;
  isDub?: boolean;
  onDubFailed?: () => void;
  subtitleOffset?: number;
  subtitleSize?: 'small' | 'medium' | 'large';
  subtitleColor?: 'white' | 'yellow' | 'cyan';
  subtitleVisible?: boolean;
  subtitleSettings?: SubtitleSettings;
  initialStartTime?: number;
  onOpenSettings?: () => void;
  onNextEp?: () => void;
  onPrevEp?: () => void;
  onNextVideo?: () => void;
  onPrevVideo?: () => void;
  onOpenEpisodesDrawer?: () => void;
  onSubtitlesLoaded?: (hasSubtitles: boolean) => void;
  hideFeedUi?: boolean;
  onToggleHideFeedUi?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = React.memo(({
  anime,
  isActive,
  shouldPreload,
  server,
  currentEp,
  isMuted,
  onToggleMute,
  onDoubleTapLike,
  onVideoEnd,
  onNextVideo,
  onPrevVideo,
  onProgressUpdate,
  onSubtitleChange,
  onSkipStateChange,
  isReels = false,
  onWatchFull,
  isDub = false,
  onDubFailed,
  subtitleOffset: propSubtitleOffset = 0,
  subtitleSize = 'medium',
  subtitleColor = 'white',
  subtitleVisible = true,
  subtitleSettings,
  initialStartTime = 0,
  onOpenSettings,
  onNextEp,
  onPrevEp,
  onOpenEpisodesDrawer,
  onSubtitlesLoaded,
  hideFeedUi = false,
  onToggleHideFeedUi,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const parsedVttCuesRef = useRef<VttCueItem[]>([]);

  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 16, height: 9 });
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setStageDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  const [streamData, setStreamData] = useState<StreamData | null>(() => {
    return getCachedStream(anime, server, currentEp, isDub ? 'dub' : 'sub');
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !getCachedStream(anime, server, currentEp, isDub ? 'dub' : 'sub') && shouldPreload;
  });
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isUserPaused, setIsUserPaused] = useState<boolean>(false);
  const [bufferedProgress, setBufferedProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [qualityLabel, setQualityLabel] = useState<string>('Auto');

  // Video Debug Logs & Diagnostics HUD state
  const [showDebugLogs, setShowDebugLogs] = useState<boolean>(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [logsCopied, setLogsCopied] = useState<boolean>(false);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setDebugLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  // Scrubbing / Drag to seek state
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubProgress, setScrubProgress] = useState<number>(0);
  const [scrubTime, setScrubTime] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const wasPlayingBeforeScrubRef = useRef<boolean>(false);

  // Fullscreen Landscape and Controls Visibility State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => typeof document !== 'undefined' ? !!document.fullscreenElement : false);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    }
  }, [isPlaying]);

  const onNextVideoRef = useRef(onNextVideo);
  useEffect(() => {
    onNextVideoRef.current = onNextVideo;
  }, [onNextVideo]);

  const wasFullscreenRef = useRef<boolean>(false);

  useEffect(() => {
    const onFsChange = () => {
      const isFs = typeof document !== 'undefined' ? !!document.fullscreenElement : false;
      wasFullscreenRef.current = isFs;
      setIsFullscreen(isFs);
      setControlsVisible(true);
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const target = document.getElementById(`video-player-${anime.id}`);
    if (!target) return;

    if (!document.fullscreenElement) {
      try {
        if (target.requestFullscreen) {
          await target.requestFullscreen();
        } else if ((target as any).webkitRequestFullscreen) {
          await (target as any).webkitRequestFullscreen();
        }
        if (window.screen?.orientation && (window.screen.orientation as any).lock) {
          try {
            await (window.screen.orientation as any).lock('landscape');
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Error entering fullscreen:', err);
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        if (window.screen?.orientation && (window.screen.orientation as any).unlock) {
          try {
            (window.screen.orientation as any).unlock();
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Error exiting fullscreen:', err);
      }
    }
  }, [anime.id]);

  const hasSoughtToMiddleRef = useRef<boolean>(false);
  const reelStartTimeRef = useRef<number | null>(null);
  const isReelsLoopingRef = useRef<boolean>(false);
  const [showAdOverlay, setShowAdOverlay] = useState<boolean>(false);
  const hasShownAdRef = useRef<boolean>(false);

  // Watch timestamps and resume tracking
  const pendingResumeTimeRef = useRef<number>(initialStartTime || getSavedTimestamp(anime.slug, currentEp));
  const lastHistorySaveTimeRef = useRef<number>(0);

  // Sync pending resume when anime or episode or initialStartTime changes
  useEffect(() => {
    const saved = initialStartTime > 0 ? initialStartTime : getSavedTimestamp(anime.slug, currentEp);
    pendingResumeTimeRef.current = saved;
  }, [anime.slug, currentEp, initialStartTime]);

  // When switching audio (isDub) or server, save current playback timestamp to resume smoothly without resetting
  const prevDubRef = useRef<boolean>(isDub);
  const prevServerRef = useRef<ServerType>(server);
  useEffect(() => {
    if (prevDubRef.current !== isDub || prevServerRef.current !== server) {
      if (videoRef.current && videoRef.current.currentTime > 0.5) {
        pendingResumeTimeRef.current = videoRef.current.currentTime;
        saveWatchProgress(anime, currentEp, videoRef.current.currentTime, videoRef.current.duration || 0, prevDubRef.current, prevServerRef.current);
      }
      prevDubRef.current = isDub;
      prevServerRef.current = server;
    }
  }, [isDub, server, anime, currentEp]);

  useEffect(() => {
    hasSoughtToMiddleRef.current = false;
    reelStartTimeRef.current = null;
    isReelsLoopingRef.current = false;
    hasShownAdRef.current = false;
    setShowAdOverlay(false);
  }, [anime.id, currentEp, server]);

  // Hold gesture for 2X playback speed
  const [isHolding2x, setIsHolding2x] = useState<boolean>(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const is2xActiveRef = useRef<boolean>(false);
  const pointerDownTimeRef = useRef<number>(0);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Double tap state & visual seek feedback
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [seekFeedback, setSeekFeedback] = useState<{ side: 'left' | 'right'; key: number } | null>(null);
  const lastSubtitleRef = useRef<string>('');
  const lastSkipStatusRef = useRef<'none' | 'intro' | 'outro'>('none');
  const lastSkippableRef = useRef<boolean>(false);
  const onSkipStateChangeRef = useRef(onSkipStateChange);
  onSkipStateChangeRef.current = onSkipStateChange;

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Skip Intro / Outro helper logic
  const introData = streamData?.intro;
  const outroData = streamData?.outro;

  const hasIntroData = !!(
    introData &&
    typeof introData.start === 'number' &&
    typeof introData.end === 'number' &&
    introData.end > introData.start
  );

  const hasOutroData = !!(
    outroData &&
    typeof outroData.start === 'number' &&
    typeof outroData.end === 'number' &&
    outroData.end > outroData.start
  );

  const isCurrentIntro = hasIntroData && currentTime >= (introData?.start ?? 0) && currentTime < (introData?.end ?? 0);
  const isCurrentOutro = hasOutroData && currentTime >= (outroData?.start ?? 0) && currentTime < (outroData?.end ?? 0);

  const handleSkipIntroOrOutro = useCallback((e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    const intro = streamData?.intro;
    const outro = streamData?.outro;

    if (isCurrentIntro && intro) {
      if (videoRef.current) {
        videoRef.current.currentTime = intro.end;
        setCurrentTime(intro.end);
        if (duration > 0) {
          const newProg = (intro.end / duration) * 100;
          setProgress(newProg);
          if (onProgressUpdate) {
            onProgressUpdate(newProg, intro.end, duration, handleSeek);
          }
        }
        updateSubtitle(intro.end);
      }
    } else if (isCurrentOutro && outro) {
      if (videoRef.current) {
        videoRef.current.currentTime = outro.end;
        setCurrentTime(outro.end);
        if (duration > 0) {
          const newProg = (outro.end / duration) * 100;
          setProgress(newProg);
          if (onProgressUpdate) {
            onProgressUpdate(newProg, outro.end, duration, handleSeek);
          }
        }
        updateSubtitle(outro.end);
      }
    }
    resetControlsTimeout();
  }, [isCurrentIntro, isCurrentOutro, streamData, duration, onProgressUpdate, resetControlsTimeout]);

  // Subtitle sync offset (in seconds)
  const [subtitleOffset, setSubtitleOffset] = useState<number>(propSubtitleOffset);

  useEffect(() => {
    setSubtitleOffset(propSubtitleOffset);
  }, [propSubtitleOffset]);

  // Check for active subtitle cues with exact timestamp matching
  const updateSubtitle = (curTime: number) => {
    if (!isActive || !onSubtitleChange) return;

    let subText = '';
    const adjustedTime = curTime + subtitleOffset;

    // 1. Direct parsed VTT cues with strict exact timestamp matching
    if (parsedVttCuesRef.current.length > 0) {
      const matches = parsedVttCuesRef.current.filter(
        (c) => adjustedTime >= c.start && adjustedTime < c.end
      );
      if (matches.length > 0) {
        const uniqueLines: string[] = [];
        matches.forEach((m) => {
          const splitLines = m.text.split('\n');
          splitLines.forEach((l) => {
            const trimmed = l.trim();
            if (trimmed && !uniqueLines.includes(trimmed)) {
              uniqueLines.push(trimmed);
            }
          });
        });
        subText = uniqueLines.join('\n');
      }
    }

    // 2. Fallback to video textTracks
    if (!subText && videoRef.current?.textTracks && videoRef.current.textTracks.length > 0) {
      const tracks = videoRef.current.textTracks;
      const uniqueLines: string[] = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.activeCues && track.activeCues.length > 0) {
          for (let j = 0; j < track.activeCues.length; j++) {
            const cue = track.activeCues[j] as VTTCue;
            if (cue && cue.text) {
              const cleaned = cleanVttText(cue.text);
              const splitLines = cleaned.split('\n');
              splitLines.forEach((l) => {
                const trimmed = l.trim();
                if (trimmed && !uniqueLines.includes(trimmed)) {
                  uniqueLines.push(trimmed);
                }
              });
            }
          }
        }
      }
      if (uniqueLines.length > 0) {
        subText = uniqueLines.join('\n');
      }
    }

    // Only fire state update if subtitle text has actually changed
    if (lastSubtitleRef.current !== subText) {
      lastSubtitleRef.current = subText;
      setCurrentSubtitle(subText);
      if (onSubtitleChange) {
        onSubtitleChange(subText);
      }
    }
  };

  useEffect(() => {
    if (!isActive) {
      setCurrentSubtitle('');
      lastSubtitleRef.current = '';
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        const currentFs = document.fullscreenElement;
        const myPlayer = document.getElementById(`video-player-${anime.id}`);
        const mySlide = document.getElementById(`feed-slide-${anime.id}`);
        if (currentFs === myPlayer || currentFs === mySlide) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          }
        }
      }
    }
  }, [isActive, anime.id]);

  // High-frequency 60fps subtitle sync animation frame loop
  useEffect(() => {
    if (!isActive || !isPlaying) return;

    let animId: number;
    const loop = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        updateSubtitle(video.currentTime);
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isActive, isPlaying]);

  // Track when user enters a card for scroll telemetry
  useEffect(() => {
    if (isActive) {
      UnifiedMediaManager.trackCardEnter(anime.slug);
    }
  }, [isActive, anime.slug]);

  // Stream loading: Load stream whenever anime, server, or episode changes (when preloading is enabled)
  useEffect(() => {
    if (!shouldPreload) return;

    let isMounted = true;
    const abortController = new AbortController();
    UnifiedMediaManager.registerFetch(anime.slug, abortController);

    async function loadStream() {
      let requestedType: 'sub' | 'dub' = isDub ? 'dub' : 'sub';
      if (isDub) {
        const hasDub = await checkDubAvailable(anime.slug, currentEp);
        if (!hasDub) {
          requestedType = 'sub';
        }
      }

      const cached = getCachedStream(anime, server, currentEp, requestedType);
      if (cached && cached.m3u8) {
        setStreamData((prev) => (prev?.m3u8 === cached.m3u8 ? prev : cached));
        setLoading(false);
        setError(null);
        return;
      }

      // Don't reset streamData to null or show loading spinner if we already have a functional stream
      if (!streamData) {
        setLoading(true);
      }
      setError(null);
      addLog(`FETCH START: ${anime.slug} (MAL ID=${anime.mal_id || anime.id}, Server=${server}, Ep=${currentEp}, Type=${requestedType.toUpperCase()})`);

      const data = await fetchAnimeStream(anime, server, currentEp, requestedType, abortController.signal);
      if (isMounted && !abortController.signal.aborted) {
        if (data && data.m3u8) {
          setStreamData((prev) => (prev?.m3u8 === data.m3u8 ? prev : data));
          setError(null);
          addLog(`FETCH SUCCESS: ${data.m3u8.substring(0, 45)}...`);
        } else if (!abortController.signal.aborted) {
          if (requestedType === 'dub') {
            addLog(`DUB FETCH FAILED for ${anime.slug}, falling back to SUB`);
            // Fetch SUB so playback remains unbroken if sub stream is available
            const subData = await fetchAnimeStream(anime, server, currentEp, 'sub', abortController.signal);
            if (isMounted && !abortController.signal.aborted && subData && subData.m3u8) {
              setStreamData((prev) => (prev?.m3u8 === subData.m3u8 ? prev : subData));
              setError(null);
              addLog(`SUB FALLBACK FETCH SUCCESS: ${subData.m3u8.substring(0, 45)}...`);
            } else if (!abortController.signal.aborted) {
              setStreamData(null);
              setError(`Unable to load stream for server "${server.toUpperCase()}". Tap Retry or switch server.`);
              addLog(`FETCH ERROR: Stream not available for ${anime.slug}`);
            }
          } else {
            setStreamData(null);
            setError(`Unable to load stream for server "${server.toUpperCase()}". Tap Retry or switch server.`);
            addLog(`FETCH ERROR: Could not fetch stream for ${anime.slug}`);
          }
        }
        setLoading(false);
      }
    }

    loadStream();

    return () => {
      isMounted = false;
      UnifiedMediaManager.abortFetch(anime.slug);
      abortController.abort();
    };
  }, [anime.slug, server, currentEp, shouldPreload, isDub, addLog]);

  const onSubtitlesLoadedRef = useRef(onSubtitlesLoaded);
  onSubtitlesLoadedRef.current = onSubtitlesLoaded;
  const onSubtitleChangeRef = useRef(onSubtitleChange);
  onSubtitleChangeRef.current = onSubtitleChange;

  // Direct VTT subtitle fetch & parse fallback for 100% subtitle reliability
  useEffect(() => {
    if (!streamData?.subtitles || streamData.subtitles.length === 0) {
      parsedVttCuesRef.current = [];
      if (isActive && onSubtitleChangeRef.current) onSubtitleChangeRef.current('');
      if (onSubtitlesLoadedRef.current) onSubtitlesLoadedRef.current(false);
      return;
    }

    // Prefer English subtitle if available, otherwise first item
    const sub =
      streamData.subtitles.find(
        (s) => s.label?.toLowerCase().includes('eng') || s.default
      ) || streamData.subtitles[0];

    if (!sub?.file) {
      parsedVttCuesRef.current = [];
      if (onSubtitlesLoadedRef.current) onSubtitlesLoadedRef.current(false);
      return;
    }

    const proxiedVttUrl = getProxiedM3u8Url(sub.file, streamData.referer || 'https://megaplay.buzz/');
    fetch(proxiedVttUrl)
      .then((res) => res.text())
      .then((text) => {
        const rawCues = parseVttContent(text);
        // Use user-defined subtitle sync offset without hardcoded -1.5s delay
        parsedVttCuesRef.current = UnifiedMediaManager.shiftParsedCues(rawCues, propSubtitleOffset);
        const hasSubs = parsedVttCuesRef.current.length > 0;
        if (onSubtitlesLoadedRef.current) onSubtitlesLoadedRef.current(hasSubs);
        if (isActive) {
          updateSubtitle(videoRef.current?.currentTime || 0);
        }
      })
      .catch((err) => {
        console.warn('Failed to load VTT subtitles:', err);
        parsedVttCuesRef.current = [];
        if (onSubtitlesLoadedRef.current) onSubtitlesLoadedRef.current(false);
      });
  }, [streamData, isActive, propSubtitleOffset]);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const isUserPausedRef = useRef(isUserPaused);
  isUserPausedRef.current = isUserPaused;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Handle HLS initialization and video source attachment
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamData?.m3u8) return;

    const proxyUrl = getProxiedM3u8Url(streamData.m3u8, streamData.referer || 'https://megaplay.buzz/');
    addLog(`HLS INIT: Attaching source (${streamData.m3u8.substring(0, 40)}...)`);

    const mode = isReels ? 'reels' : (currentEp > 1 || (anime.episodes && parseInt(anime.episodes) > 1) ? 'latest' : 'for_you');

    // Reels Controller
    let cleanupReels: (() => void) | undefined;
    if (mode === 'reels') {
      cleanupReels = UnifiedMediaManager.setupReelsController(video);
    }

    // Subtitle sync listeners
    const handleSubtitleSync = () => {
      UnifiedMediaManager.applySubtitleOffset(video, propSubtitleOffset);
    };
    video.addEventListener('loadeddata', handleSubtitleSync);
    video.addEventListener('seeked', handleSubtitleSync);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = UnifiedMediaManager.createHlsInstance(mode);
      hlsRef.current = hls;
      hls.loadSource(proxyUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const currentLevel = hls.levels[data.level];
        if (currentLevel) {
          const label = currentLevel.height ? `${currentLevel.height}p (Auto)` : 'Auto';
          setQualityLabel(label);
          addLog(`HLS ABR: Auto-adapted quality to ${label} (${Math.round(currentLevel.bitrate / 1000)} kbps)`);
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const topQuality = data.levels && data.levels.length > 0 && data.levels[0].height ? `${data.levels[0].height}p` : 'HD';
        setQualityLabel(topQuality);
        addLog(`HLS: Manifest Parsed (${data.levels?.length || 0} adaptive levels found)`);

        // Resume saved playback timestamp seamlessly
        const targetResume = pendingResumeTimeRef.current;
        if (targetResume > 0.5 && (!isReels || targetResume < 28)) {
          try {
            video.currentTime = targetResume;
            setCurrentTime(targetResume);
            addLog(`RESUME: Restored timestamp ${targetResume.toFixed(1)}s`);
          } catch (e) {}
        }

        if (isActiveRef.current && !isUserPausedRef.current) {
          video.muted = isMutedRef.current;
          video.volume = 1.0;
          video.play().then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
            addLog('PLAY SUCCESS: Video started playing');
            if (!isMutedRef.current && video.muted) {
              video.muted = false;
            }
          }).catch((err) => {
            addLog(`PLAY AUTOPLAY BLOCKED: Muting & retrying... (${err.message})`);
            video.muted = true;
            video.play().then(() => {
              setIsPlaying(true);
              setIsBuffering(false);
              addLog('PLAY SUCCESS (MUTED)');
            }).catch((e2) => {
              addLog(`PLAY FAILED: ${e2.message}`);
            });
          });
        }
      });

      hls.on(Hls.Events.AUDIO_TRACK_LOADED, () => {
        addLog('HLS: Audio Track Loaded');
        if (!isMutedRef.current && videoRef.current && videoRef.current.muted) {
          videoRef.current.muted = false;
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (video.readyState >= 2) {
          setIsBuffering(false);
        }
      });

      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        if (video.readyState >= 2) {
          setIsBuffering(false);
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        addLog(`HLS ERROR: type=${data.type}, details=${data.details}, fatal=${data.fatal}`);
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          addLog('HLS ABR: Buffer stalled, stepping down quality');
          if (hls.autoLevelEnabled && hls.currentLevel > 0) {
            hls.currentLevel = Math.max(0, hls.currentLevel - 1);
          }
        }
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              addLog('HLS FATAL NETWORK_ERROR: Retrying startLoad() on lowest level');
              if (hls.autoLevelEnabled && hls.currentLevel > 0) {
                hls.currentLevel = 0; // Force lowest resolution level when network is slow/failing
              }
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              addLog('HLS FATAL MEDIA_ERROR: Executing recoverMediaError()');
              hls.recoverMediaError();
              break;
            default:
              addLog('HLS FATAL: Unrecoverable stream error');
              hls.destroy();
              setError('Failed to load video stream. Tap Retry or switch server.');
              setIsBuffering(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      addLog('HLS: Using Safari native playback');
      video.src = proxyUrl;
      if (isActiveRef.current && !isUserPausedRef.current) {
        video.play().then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
          addLog('PLAY SUCCESS (Safari Native)');
        }).catch((err) => {
          addLog(`PLAY FAIL (Safari Native): ${err.message}`);
        });
      }
    }

    return () => {
      video.removeEventListener('loadeddata', handleSubtitleSync);
      video.removeEventListener('seeked', handleSubtitleSync);
      if (cleanupReels) cleanupReels();
      UnifiedMediaManager.destroyPlayerInstance(videoRef.current, hlsRef.current);
      hlsRef.current = null;
    };
  }, [streamData, isReels, currentEp, anime.episodes, addLog]);

  // Play or pause video when active state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      setIsUserPaused(false);
      video.muted = isMuted;
      video.volume = 1.0;

      if (hlsRef.current) {
        hlsRef.current.startLoad();
      }

      if (video.readyState >= 2) {
        setIsBuffering(false);
      }

      const attemptPlay = () => {
        if (!video || !isActive) return;
        video.muted = isMuted;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              setIsBuffering(false);
              if (!isMuted && video.muted) {
                video.muted = false;
              }
            })
            .catch(() => {
              video.muted = true;
              video.play().then(() => {
                setIsPlaying(true);
                setIsBuffering(false);
              }).catch(() => {
                setIsBuffering(false);
              });
            });
        }
      };

      attemptPlay();

      const onCanPlay = () => {
        setIsBuffering(false);
        attemptPlay();
      };

      video.addEventListener('canplay', onCanPlay, { once: true });
      video.addEventListener('loadeddata', onCanPlay, { once: true });

      updateSubtitle(video.currentTime);

      return () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('loadeddata', onCanPlay);
      };
    } else {
      setIsBuffering(false);
      setIsPlaying(false);
      if (video && !video.paused) {
        video.pause();
      }
      lastSubtitleRef.current = '';
      if (onSubtitleChange) {
        onSubtitleChange('');
      }
    }
  }, [isActive, streamData, isMuted]);

  // Sync mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Automated Stalled Buffer Watcher & Self-Healing Stream Recovery
  useEffect(() => {
    if (!isBuffering || !isActive || isUserPaused || loading || error || showAdOverlay) return;

    // Phase 1 (After 5s of continuous buffering): Only attempt recovery if video is not already progressing
    const retryTimer = setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.readyState >= 3) {
        setIsBuffering(false);
        return;
      }
      addLog('STALL RECOVERY (5s): Attempting load and playback recovery');
      if (hlsRef.current) {
        hlsRef.current.startLoad();
      }
      if (video.paused) {
        video.play().catch((err) => {
          addLog(`STALL RECOVERY PLAY FAIL: ${err.message}`);
        });
      }
    }, 5000);

    return () => {
      clearTimeout(retryTimer);
    };
  }, [isBuffering, isActive, isUserPaused, loading, error, streamData, anime.slug, addLog]);

  // Track time updates, buffering & progress
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const cur = video.currentTime;
    const dur = video.duration || 0;

    UnifiedMediaManager.trackWatchProgress(anime.slug, cur, dur);

    if (isReels && dur > 0) {
      if (!hasSoughtToMiddleRef.current) {
        const startTime = dur / 2;
        hasSoughtToMiddleRef.current = true;
        reelStartTimeRef.current = startTime;
        video.currentTime = startTime;
        addLog(`REELS: Seeking to middle of anime: ${formatTime(startTime)}`);
        return;
      }

      const startTime = reelStartTimeRef.current || (dur / 2);
      if (cur >= startTime + 30) {
        addLog(`REELS: 30 seconds elapsed. Repeating snippet instantly.`);
        isReelsLoopingRef.current = true;
        video.currentTime = startTime;
        setIsBuffering(false);
        return;
      }
    }

    const checkTime = isReels ? (cur - (reelStartTimeRef.current || 0)) : cur;
    if (isReels && checkTime >= 26 && !hasShownAdRef.current) {
      const adDismissed = localStorage.getItem(`anime-ad-shown-${anime.id}`);
      if (!adDismissed) {
        hasShownAdRef.current = true;
        setShowAdOverlay(true);
        video.pause();
        setIsPlaying(false);
        addLog(`AD: Triggered ad overlay for anime ${anime.title}`);
        return;
      }
    }

    const prog = dur > 0 ? (cur / dur) * 100 : 0;

    if (!isScrubbing) {
      setCurrentTime(cur);
      setDuration(dur);
      if (isReels) {
        const startTime = reelStartTimeRef.current || (dur / 2);
        const rel = Math.max(0, Math.min(30, cur - startTime));
        setProgress((rel / 30) * 100);
      } else {
        setProgress(prog);
      }
    }

    // Calculate actual buffered progress percentage
    if (video.buffered && video.buffered.length > 0 && dur > 0) {
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= cur && cur <= video.buffered.end(i)) {
          if (isReels) {
            const startTime = reelStartTimeRef.current || (dur / 2);
            const bufStart = video.buffered.start(i);
            const bufEnd = video.buffered.end(i);
            const overlapStart = Math.max(startTime, bufStart);
            const overlapEnd = Math.min(startTime + 30, bufEnd);
            const overlapLen = Math.max(0, overlapEnd - overlapStart);
            setBufferedProgress((overlapLen / 30) * 100);
          } else {
            setBufferedProgress((video.buffered.end(i) / dur) * 100);
          }
          break;
        }
      }
    }

    // When time is progressing, video is definitely playing
    if (isBuffering && video.readyState >= 2) {
      setIsBuffering(false);
    }

    if (isActive && onProgressUpdate && !isScrubbing) {
      onProgressUpdate(
        isReels ? ((Math.max(0, Math.min(30, cur - (reelStartTimeRef.current || (dur / 2)))) / 30) * 100) : prog,
        cur,
        dur,
        (percentage: number) => {
          if (videoRef.current && dur > 0) {
            if (isReels) {
              const startTime = reelStartTimeRef.current || (dur / 2);
              const newTime = startTime + (percentage / 100) * 30;
              videoRef.current.currentTime = newTime;
              setProgress(percentage);
              setCurrentTime(newTime);
              updateSubtitle(newTime);
            } else {
              const newTime = (percentage / 100) * dur;
              videoRef.current.currentTime = newTime;
              setProgress(percentage);
              setCurrentTime(newTime);
              updateSubtitle(newTime);
            }
          }
        }
      );
    }

    updateSubtitle(cur);

    // Periodically save playback progress to watch history
    if (cur > 1 && dur > 0) {
      const now = Date.now();
      if (now - lastHistorySaveTimeRef.current > 2000) {
        lastHistorySaveTimeRef.current = now;
        saveWatchProgress(anime, currentEp, cur, dur, isDub, server);
      }
    }
  };

  // Real-time Scrub / Drag seeking logic
  const calculateScrubPosition = (clientX: number) => {
    const dur = isReels ? 30 : duration;
    if (!progressBarRef.current || !dur) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (clientX - rect.left) / rect.width;
    const clampedPos = Math.max(0, Math.min(1, pos));
    return clampedPos;
  };

  const handleScrubStart = (clientX: number) => {
    const video = videoRef.current;
    const dur = isReels ? 30 : duration;
    if (!video || !dur) return;

    wasPlayingBeforeScrubRef.current = !video.paused;
    setIsScrubbing(true);

    const pos = calculateScrubPosition(clientX);
    const newProgress = pos * 100;
    
    let newTime;
    let storeScrubTime;
    if (isReels) {
      const startTime = reelStartTimeRef.current || (video.duration / 2);
      storeScrubTime = pos * 30;
      newTime = startTime + storeScrubTime;
    } else {
      storeScrubTime = pos * video.duration;
      newTime = storeScrubTime;
    }

    setScrubProgress(newProgress);
    setScrubTime(storeScrubTime);
    video.currentTime = newTime;
    updateSubtitle(newTime);
  };

  const handleScrubMove = (clientX: number) => {
    const video = videoRef.current;
    const dur = isReels ? 30 : duration;
    if (!video || !dur || !isScrubbing) return;

    const pos = calculateScrubPosition(clientX);
    const newProgress = pos * 100;
    
    let newTime;
    let storeScrubTime;
    if (isReels) {
      const startTime = reelStartTimeRef.current || (video.duration / 2);
      storeScrubTime = pos * 30;
      newTime = startTime + storeScrubTime;
    } else {
      storeScrubTime = pos * video.duration;
      newTime = storeScrubTime;
    }

    setScrubProgress(newProgress);
    setScrubTime(storeScrubTime);
    video.currentTime = newTime;
    updateSubtitle(newTime);
  };

  const handleScrubEnd = () => {
    const video = videoRef.current;
    if (!isScrubbing) return;

    setIsScrubbing(false);
    if (video) {
      if (isReels) {
        const startTime = reelStartTimeRef.current || (video.duration / 2);
        const newTimeInVideo = startTime + scrubTime;
        setProgress((scrubTime / 30) * 100);
        setCurrentTime(newTimeInVideo);
        updateSubtitle(newTimeInVideo);
      } else {
        setProgress(scrubProgress);
        setCurrentTime(scrubTime);
        updateSubtitle(scrubTime);
      }
      if (wasPlayingBeforeScrubRef.current && !isUserPaused) {
        video.play().then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }).catch(() => {});
      }
    }
  };

  // Global listeners for mouse/touch up during active scrubbing
  useEffect(() => {
    if (!isScrubbing) return;

    const onPointerMove = (e: PointerEvent) => {
      handleScrubMove(e.clientX);
    };

    const onPointerUp = () => {
      handleScrubEnd();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleScrubMove(e.touches[0].clientX);
      }
    };

    const onTouchEnd = () => {
      handleScrubEnd();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isScrubbing, scrubProgress, scrubTime, duration]);

  const handleSeek = (percentage: number) => {
    if (videoRef.current && duration > 0) {
      const newTime = (percentage / 100) * duration;
      videoRef.current.currentTime = newTime;
      setProgress(percentage);
      setCurrentTime(newTime);
      updateSubtitle(newTime);
    }
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const current = video.currentTime || 0;
    const maxDur = duration || video.duration || 0;
    const targetTime = Math.max(0, Math.min(maxDur > 0 ? maxDur : 99999, current + seconds));
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
    if (maxDur > 0) {
      const newProg = (targetTime / maxDur) * 100;
      setProgress(newProg);
      if (onProgressUpdate) {
        onProgressUpdate(newProg, targetTime, maxDur, handleSeek);
      }
    }
    updateSubtitle(targetTime);
  };

  // Check intro / outro skip timestamps and notify parent only on state transitions
  useEffect(() => {
    if (!isActive) {
      if (lastSkipStatusRef.current !== 'none') {
        lastSkipStatusRef.current = 'none';
        onSkipStateChangeRef.current?.(null);
      }
      return;
    }

    const intro = streamData?.intro;
    const outro = streamData?.outro;

    const hasIntro = !!(
      intro &&
      typeof intro.start === 'number' &&
      typeof intro.end === 'number' &&
      intro.end > intro.start
    );

    const hasOutro = !!(
      outro &&
      typeof outro.start === 'number' &&
      typeof outro.end === 'number' &&
      outro.end > outro.start
    );

    const isIntro = hasIntro && currentTime >= intro.start && currentTime < intro.end;
    const isOutro = hasOutro && currentTime >= outro.start && currentTime < outro.end;
    const currentStatus: 'none' | 'intro' | 'outro' = isIntro ? 'intro' : isOutro ? 'outro' : 'none';
    const isSkippable = hasIntro || hasOutro;

    if (currentStatus !== lastSkipStatusRef.current || isSkippable !== lastSkippableRef.current) {
      lastSkipStatusRef.current = currentStatus;
      lastSkippableRef.current = isSkippable;

      if (currentStatus === 'intro' && intro) {
        onSkipStateChangeRef.current?.({
          show: true,
          label: 'Skip Intro',
          isSkippable: true,
          start: intro.start,
          end: intro.end,
          onSkip: () => {
            if (videoRef.current) {
              videoRef.current.currentTime = intro.end;
              setCurrentTime(intro.end);
              if (duration > 0) {
                const newProg = (intro.end / duration) * 100;
                setProgress(newProg);
                if (onProgressUpdate) {
                  onProgressUpdate(newProg, intro.end, duration, handleSeek);
                }
              }
              updateSubtitle(intro.end);
            }
          },
        });
      } else if (currentStatus === 'outro' && outro) {
        onSkipStateChangeRef.current?.({
          show: true,
          label: 'Skip Outro',
          isSkippable: true,
          start: outro.start,
          end: outro.end,
          onSkip: () => {
            if (videoRef.current) {
              videoRef.current.currentTime = outro.end;
              setCurrentTime(outro.end);
              if (duration > 0) {
                const newProg = (outro.end / duration) * 100;
                setProgress(newProg);
                if (onProgressUpdate) {
                  onProgressUpdate(newProg, outro.end, duration, handleSeek);
                }
              }
              updateSubtitle(outro.end);
            }
          },
        });
      } else {
        if (isSkippable) {
          onSkipStateChangeRef.current?.({
            show: false,
            label: '',
            isSkippable: true,
            onSkip: () => {},
          });
        } else {
          onSkipStateChangeRef.current?.(null);
        }
      }
    }
  }, [isActive, currentTime, streamData, duration]);

  // Click handler for single tap (play/pause) & double tap left/right (seek 10s)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showAdOverlay) {
      e.stopPropagation();
      return;
    }
    // Block all tap/click gestures while loader is active or stream is not ready
    const isLoaderActive = loading || (isBuffering && (!videoRef.current || videoRef.current.readyState < 2)) || !streamData;
    if (isLoaderActive) return;

    if (isScrubbing || is2xActiveRef.current || isHolding2x) return;
    // If the press was a long press hold (> 220ms), skip click handling
    if (Date.now() - pointerDownTimeRef.current > 220) return;

    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeft = clickX < rect.width / 2;
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current.time < DOUBLE_TAP_DELAY) {
      // Double tap triggered - cancel single tap toggle
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapRef.current = { time: 0, x: 0 };

      if (isLeft) {
        seekBy(-10);
        setSeekFeedback({ side: 'left', key: now });
      } else {
        seekBy(10);
        setSeekFeedback({ side: 'right', key: now });
      }

      setTimeout(() => {
        setSeekFeedback((prev) => (prev?.key === now ? null : prev));
      }, 650);
    } else {
      lastTapRef.current = { time: now, x: clickX };
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      singleTapTimeoutRef.current = setTimeout(() => {
        if (isFullscreen) {
          setControlsVisible((prev) => {
            const next = !prev;
            if (next) resetControlsTimeout();
            return next;
          });
        } else {
          setControlsVisible(true);
          togglePlayPause();
        }
        lastTapRef.current = { time: 0, x: 0 };
        singleTapTimeoutRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (showAdOverlay) return;
    // Block gestures while loader is active
    const isLoaderActive = loading || (isBuffering && (!videoRef.current || videoRef.current.readyState < 2)) || !streamData;
    if (isLoaderActive) return;

    // If clicking inside interactive controls (like progress bar, buttons), do not trigger hold
    if ((e.target as HTMLElement).closest('button, [role="button"], input, select, a')) {
      return;
    }

    const now = Date.now();
    pointerDownTimeRef.current = now;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };

    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    holdTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && isActive) {
        is2xActiveRef.current = true;
        setIsHolding2x(true);
        videoRef.current.playbackRate = 2.0;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }
    }, 220);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimeoutRef.current && !is2xActiveRef.current) {
      const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
      const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
      // Cancel hold if finger swiped/dragged significantly
      if (dx > 10 || dy > 10) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
    }
  };

  const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartPosRef.current = null;
  };

  const handlePointerUpOrCancel = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (is2xActiveRef.current) {
      is2xActiveRef.current = false;
      setIsHolding2x(false);
      if (videoRef.current) {
        videoRef.current.playbackRate = 1.0;
      }
      lastTapRef.current = { time: 0, x: 0 };
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      setIsUserPaused(false);
      video.muted = isMuted;
      video.volume = 1.0;
      video.play().then(() => {
        setIsPlaying(true);
        setIsBuffering(false);
        if (!isMuted && video.muted) {
          video.muted = false;
        }
      }).catch(() => {
        setIsBuffering(false);
      });
    } else {
      video.pause();
      setIsUserPaused(true);
      setIsPlaying(false);
      setIsBuffering(false);
    }
  };

  const displayProgress = isScrubbing ? scrubProgress : progress;
  const displayCurrentTime = isReels
    ? (isScrubbing ? scrubTime : Math.max(0, Math.min(30, currentTime - (reelStartTimeRef.current || (duration / 2)))))
    : (isScrubbing ? scrubTime : currentTime);

  return (
    <div
      id={`video-player-${anime.id}`}
      className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center select-none cursor-pointer touch-pan-y"
      style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
      onClick={handleContainerClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onPointerLeave={handlePointerUpOrCancel}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
    >
      {/* Video display stage offset above bottom navbar in portrait, full screen in fullscreen */}
      <div
        ref={stageRef}
        className={`absolute top-0 left-0 right-0 ${
          isFullscreen ? 'bottom-0' : 'bottom-14 sm:bottom-15'
        } flex items-center justify-center overflow-hidden bg-black select-none pointer-events-none`}
      >
        {/* Dynamic Video Aspect Ratio Frame Container */}
        <div
          style={(() => {
            const videoAspect = (videoDimensions.width && videoDimensions.height)
              ? videoDimensions.width / videoDimensions.height
              : 16 / 9;

            if (stageDimensions.width > 0 && stageDimensions.height > 0) {
              const stageAspect = stageDimensions.width / stageDimensions.height;
              let renderWidth: number;
              let renderHeight: number;

              if (stageAspect > videoAspect) {
                renderHeight = stageDimensions.height;
                renderWidth = stageDimensions.height * videoAspect;
              } else {
                renderWidth = stageDimensions.width;
                renderHeight = stageDimensions.width / videoAspect;
              }

              return {
                position: 'relative' as const,
                width: `${renderWidth}px`,
                height: `${renderHeight}px`,
                maxWidth: '100%',
                maxHeight: '100%',
              };
            }

            return {
              position: 'relative' as const,
              width: '100%',
              height: '100%',
              aspectRatio: `${videoAspect}`,
              maxWidth: '100%',
              maxHeight: '100%',
            };
          })()}
          className="relative flex items-center justify-center overflow-hidden pointer-events-none"
        >
          {/* Video Element */}
          <video
            ref={videoRef}
            playsInline
            crossOrigin="anonymous"
            muted={isMuted}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }}
            style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
            onTimeUpdate={handleTimeUpdate}
            onEnded={onVideoEnd}
            onLoadedMetadata={(e) => {
              const vid = e.currentTarget;
              if (vid.videoWidth && vid.videoHeight) {
                setVideoDimensions({ width: vid.videoWidth, height: vid.videoHeight });
              }
              if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
              setIsBuffering(false);
            }}
            onWaiting={() => {
              addLog('VIDEO_EVENT: waiting');
              if (showAdOverlay) return;
              if (isReels && isReelsLoopingRef.current) return;
              if (!isUserPaused) {
                if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
                waitingTimeoutRef.current = setTimeout(() => {
                  const vid = videoRef.current;
                  if (vid && (vid.readyState < 3 || vid.paused) && !isUserPaused) {
                    setIsBuffering(true);
                  }
                }, 400);
              }
            }}
            onPlaying={() => {
              if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
              addLog('VIDEO_EVENT: playing');
              isReelsLoopingRef.current = false;
              setIsBuffering(false);
              setIsPlaying(true);
            }}
            onPause={() => {
              if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
              addLog('VIDEO_EVENT: pause');
              setIsPlaying(false);
            }}
            onCanPlay={() => {
              if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
              addLog('VIDEO_EVENT: canplay');
              setIsBuffering(false);
            }}
            onLoadedData={() => {
              if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
              setIsBuffering(false);
            }}
            onStalled={() => {
              addLog('VIDEO_EVENT: stalled');
            }}
            onError={(e) => {
              const errCode = (e.currentTarget as HTMLVideoElement).error?.code;
              const errMsg = (e.currentTarget as HTMLVideoElement).error?.message;
              addLog(`VIDEO_EVENT: error (code=${errCode || 'unknown'}, msg=${errMsg || 'none'})`);
            }}
            onCanPlayThrough={() => {
              if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
              setIsBuffering(false);
            }}
            onSeeked={() => {
              if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
              setIsBuffering(false);
            }}
            className="w-full h-full object-fill relative z-10 max-h-full max-w-full pointer-events-none"
          />

          {/* Subtitle rendered strictly INSIDE the anime video at the bottom of the original ratio */}
          {currentSubtitle && (subtitleSettings?.visible ?? subtitleVisible) && (() => {
            const lines = currentSubtitle
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean);

            if (lines.length === 0) return null;

            // Background color with opacity
            const hexToRgb = (hex: string) => {
              const cleanHex = (hex || '#000000').replace('#', '');
              const bigint = parseInt(cleanHex, 16) || 0;
              const r = (bigint >> 16) & 255;
              const g = (bigint >> 8) & 255;
              const b = bigint & 255;
              return `${r}, ${g}, ${b}`;
            };

            const chosenBg = subtitleSettings?.backgroundColor || '#000000';
            const rawOpacity = subtitleSettings?.bgOpacity ?? 85;
            const chosenOpacity = rawOpacity / 100;
            const isNoneBg =
              chosenBg === 'none' ||
              chosenBg === 'transparent' ||
              rawOpacity === 0;

            const bgRgba = isNoneBg
              ? 'transparent'
              : `rgba(${hexToRgb(chosenBg)}, ${chosenOpacity})`;

            const chosenColor = subtitleSettings?.color || subtitleColor || 'white';
            let textColorHex = '#ffffff';
            let borderColor = 'rgba(255, 255, 255, 0.2)';
            if (chosenColor === 'yellow') {
              textColorHex = '#fef08a';
              borderColor = 'rgba(234, 179, 8, 0.35)';
            } else if (chosenColor === 'cyan') {
              textColorHex = '#67e8f9';
              borderColor = 'rgba(6, 182, 212, 0.35)';
            }

            const borderStyle = isNoneBg ? 'none' : `1px solid ${borderColor}`;
            const shadowStyle = isNoneBg ? 'none' : '0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7)';

            const customSizePx = subtitleSettings?.size || (subtitleSize === 'small' ? 12 : subtitleSize === 'large' ? 18 : 14);
            const customRadiusPx = subtitleSettings?.borderRadius ?? 8;
            const customHeightOffsetPx = subtitleSettings?.heightPosition ?? 8;

            // Direct height position with zero extra offset when 0 is selected
            const bottomOffsetPx = isFullscreen && controlsVisible
              ? Math.max(customHeightOffsetPx, 44)
              : customHeightOffsetPx;

            return (
              <div
                className="absolute inset-x-0 z-25 flex flex-col items-center justify-end pointer-events-none transition-none"
                style={{
                  bottom: `${bottomOffsetPx}px`,
                }}
              >
                <div
                  className={`inline-flex flex-col items-center gap-0.5 max-w-[94%] sm:max-w-[88%] ${
                    isNoneBg ? '' : 'backdrop-blur-xs'
                  } px-3 py-1 leading-snug tracking-wide subtitle-text-stroke text-center break-words select-none transition-none`}
                  style={{
                    fontSize: `${customSizePx}px`,
                    borderRadius: isNoneBg ? '0px' : `${customRadiusPx}px`,
                    backgroundColor: bgRgba,
                    border: borderStyle,
                    boxShadow: shadowStyle,
                    color: textColorHex,
                  }}
                >
                  {lines.map((line, idx) => {
                    const isAudioOrSound = /^[\[(].*[\])]$|^[♪♫]/.test(line);
                    const speakerMatch = line.match(/^([A-Za-z0-9_\-\s]{2,18}):\s*(.*)$/);
                    const isDialogueDash = line.startsWith('- ');

                    if (isAudioOrSound) {
                      return (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1 text-zinc-300 italic text-[10px] sm:text-xs"
                        >
                          <span>🎵</span>
                          <span className="break-words">{line}</span>
                        </div>
                      );
                    }

                    if (speakerMatch) {
                      const speakerName = speakerMatch[1];
                      const dialogueText = speakerMatch[2];
                      return (
                        <div
                          key={idx}
                          className="inline-flex items-baseline justify-center gap-1.5 flex-wrap leading-snug"
                        >
                          <span className="font-extrabold text-pink-400 shrink-0 text-[10px] sm:text-[11px] bg-pink-950/80 px-1.5 py-0.5 rounded border border-pink-500/30 inline-flex items-center gap-1">
                            <span>🎙️</span>
                            <span>{speakerName}</span>
                          </span>
                          <span>{dialogueText}</span>
                        </div>
                      );
                    }

                    if (isDialogueDash) {
                      return (
                        <div
                          key={idx}
                          className="inline-flex items-baseline justify-center gap-1.5 flex-wrap leading-snug"
                        >
                          <span className="text-pink-400 font-bold shrink-0">💬</span>
                          <span>{line.replace(/^-\s*/, '')}</span>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="leading-snug break-words">
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Buffering Loader Spinner */}
        {isActive && ((loading && !streamData) || (isBuffering && !isUserPaused)) && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="w-9 h-9 border-3 border-pink-500/20 border-t-pink-500 rounded-full animate-spin shadow-[0_0_15px_rgba(236,72,153,0.5)] animate-fade-in" />
          </div>
        )}

        {/* 2X Playback Speed HUD Overlay when holding */}
        {isHolding2x && (
          <div className="absolute top-14 sm:top-18 left-1/2 -translate-x-1/2 z-45 flex items-center justify-center w-11 h-11 rounded-full bg-black/80 backdrop-blur-md text-white border border-zinc-700 text-sm font-black shadow-2xl tracking-wider select-none animate-pulse pointer-events-none">
            2x
          </div>
        )}

        {/* Double Tap Seek Feedback Indicator (Circle arrow with pure shadow, no background) */}
        {seekFeedback?.side === 'left' && (
          <div
            key={seekFeedback.key}
            className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center animate-seek-feedback z-35 select-none"
          >
            <span className="text-6xl sm:text-7xl text-white font-bold leading-none select-none drop-shadow-[0_6px_20px_rgba(0,0,0,0.95)]">
              ↺
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-white font-mono mt-1 select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
              10s
            </span>
          </div>
        )}

        {seekFeedback?.side === 'right' && (
          <div
            key={seekFeedback.key}
            className="absolute right-1/4 top-1/2 translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center animate-seek-feedback z-35 select-none"
          >
            <span className="text-6xl sm:text-7xl text-white font-bold leading-none select-none drop-shadow-[0_6px_20px_rgba(0,0,0,0.95)]">
              ↻
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-white font-mono mt-1 select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
              10s
            </span>
          </div>
        )}

        {/* Dark gradient shadow overlays for TikTok look */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none z-20" />

        {/* Error / Fallback State */}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 p-6 bg-black/80 text-center">
            <AlertCircle className="w-12 h-12 text-pink-500 mb-3 animate-bounce" />
            <h4 className="text-white font-bold text-base mb-1">{anime.title}</h4>
            <p className="text-gray-300 text-xs mb-4 max-w-xs">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setError(null);
                  setLoading(true);
                  setIsBuffering(true);
                  fetchAnimeStream(anime.slug, server, currentEp).then((d) => {
                    setStreamData(d);
                    setLoading(false);
                  });
                }}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Load
              </button>
            </div>
          </div>
        )}

        {/* Beautiful Glassy Black Ad Overlay */}
        {showAdOverlay && (
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-xl z-45 flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              localStorage.setItem(`anime-ad-shown-${anime.id}`, 'true');
              setShowAdOverlay(false);
              if (videoRef.current) {
                videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
              }
            }}
          >
            {/* Transparent Glass Card */}
            <div
              className="w-full max-w-sm bg-zinc-900/95 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 animate-fade-in cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Poster Image */}
              <div className="relative w-32 h-44 rounded-xl overflow-hidden shadow-xl border border-zinc-800 shrink-0">
                <img
                  src={anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150'}
                  alt={anime.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-pink-600 text-[10px] font-bold uppercase tracking-wider shadow-md">
                  ANI REELS
                </div>
              </div>

              {/* Content text */}
              <div className="flex flex-col gap-1.5 px-2">
                <h3 className="font-extrabold text-base leading-tight text-white line-clamp-1">
                  {anime.title}
                </h3>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Enjoying the snippet? Watch the full episodes now!
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full mt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    localStorage.setItem(`anime-ad-shown-${anime.id}`, 'true');
                    setShowAdOverlay(false);
                    if (videoRef.current) {
                      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                    }
                    if (onWatchFull) {
                      onWatchFull();
                    } else {
                      const btn = document.getElementById(`btn-episodes-drawer-${anime.id}`);
                      if (btn) btn.click();
                    }
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-500 hover:opacity-95 active:scale-95 text-white font-extrabold text-xs transition-all shadow-lg"
                >
                  Watch Now
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    localStorage.setItem(`anime-ad-shown-${anime.id}`, 'true');
                    setShowAdOverlay(false);
                    if (videoRef.current) {
                      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                    }
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 active:scale-95 border border-zinc-700 text-zinc-200 font-semibold text-xs transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Real-time Draggable Scrubber Progress Bar for Standard Portrait Feed (Fixed right above bottom navigation bar or at bottom edge when UI is hidden) */}
      {!isFullscreen && (
        <div
          ref={progressBarRef}
          className={`absolute left-0 right-0 h-4 z-40 cursor-pointer flex items-end group touch-none select-none px-0 transition-all duration-300 ease-out ${
            hideFeedUi ? 'bottom-2 sm:bottom-3' : 'bottom-14 sm:bottom-15'
          } ${
            controlsVisible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            e.stopPropagation();
            handleScrubStart(e.clientX);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            if (e.touches.length > 0) {
              handleScrubStart(e.touches[0].clientX);
            }
          }}
        >
          {/* Floating Timestamp Preview Tooltip when Scrubbing or Hovering */}
          {(isScrubbing || isPlaying) && duration > 0 && (
            <div
              className={`absolute bottom-5 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 backdrop-blur-md border border-zinc-800 text-white font-mono text-[10px] font-semibold pointer-events-none shadow-xl transition-opacity duration-150 z-50 ${
                isScrubbing ? 'opacity-100 scale-105' : 'opacity-0 group-hover:opacity-100'
              }`}
              style={{
                left: `${Math.max(6, Math.min(94, displayProgress))}%`,
              }}
            >
              <span>{formatTime(displayCurrentTime)}</span>
              <span className="text-gray-400 mx-1">/</span>
              <span className="text-gray-400">{formatTime(isReels ? 30 : duration)}</span>
            </div>
          )}

          {/* Progress Track Line Container */}
          <div className="relative w-full h-[2.5px] group-hover:h-1 transition-all duration-150 bg-white/20 flex items-center">
            {/* Highlighted Intro and Outro Segments */}
            {duration > 0 && streamData?.intro && typeof streamData.intro.start === 'number' && typeof streamData.intro.end === 'number' && streamData.intro.end > streamData.intro.start && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: `${(streamData.intro.start / duration) * 100}%`,
                  width: `${((streamData.intro.end - streamData.intro.start) / duration) * 100}%`,
                  backgroundColor: 'rgba(255, 0, 255, 0.4)',
                }}
              />
            )}
            {duration > 0 && streamData?.outro && typeof streamData.outro.start === 'number' && typeof streamData.outro.end === 'number' && streamData.outro.end > streamData.outro.start && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: `${(streamData.outro.start / duration) * 100}%`,
                  width: `${((streamData.outro.end - streamData.outro.start) / duration) * 100}%`,
                  backgroundColor: 'rgba(255, 0, 255, 0.4)',
                }}
              />
            )}

            {/* Buffered media range bar */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-white/40 transition-all duration-300 pointer-events-none rounded-r-full"
              style={{ width: `${Math.max(displayProgress, bufferedProgress)}%` }}
            />

            {/* Active playback progress bar */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-pink-500 rounded-r-full pointer-events-none"
              style={{ width: `${displayProgress}%` }}
            />

            {/* Buffering shimmer effect on progress bar when loading or buffering */}
            {(loading || (isBuffering && !isUserPaused)) && isActive && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-pink-400/80 to-transparent animate-buffer-slide" />
              </div>
            )}

            {/* Sleek, Centered Draggable Thumb Dot (always on top of lines and shimmer) */}
            <div
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full border border-pink-500 shadow-md pointer-events-none transition-transform z-30 ${
                isScrubbing ? 'scale-125 ring-2 ring-pink-500/50' : 'scale-0 group-hover:scale-100'
              }`}
              style={{ left: `${displayProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Dedicated Landscape Fullscreen Controls HUD Overlay */}
      {isFullscreen && (
        <div
          className={`absolute inset-0 z-40 flex flex-col justify-between p-4 sm:p-6 transition-opacity duration-300 ease-out select-none overflow-hidden ${
            controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => {
            // Keep controls open on clicking inside HUD
            resetControlsTimeout();
          }}
        >
          {/* Top Bar: Back / Exit Fullscreen, Title & Badges, Audio & Subtitle Settings (Slides down from top) */}
          <div
            className={`flex items-center justify-between gap-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent -m-4 sm:-m-6 p-4 sm:p-6 transition-transform duration-300 ease-out transform ${
              controlsVisible ? 'translate-y-0' : '-translate-y-full'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Exit / Back Fullscreen Button with '<' icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-zinc-800 flex items-center justify-center text-white hover:bg-zinc-800 active:scale-95 transition-all shadow-lg cursor-pointer"
                title="Back / Exit Fullscreen"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>

              <div className="flex flex-col">
                <h2 className="text-white font-extrabold text-sm sm:text-base line-clamp-1 drop-shadow-md">
                  {anime.title}
                </h2>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-300 flex-wrap">
                  <span className="bg-pink-600/80 px-2 py-0.5 rounded text-white font-mono">
                    EP {currentEp}
                  </span>
                  <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-cyan-300 uppercase font-mono">
                    {server} • {qualityLabel}
                  </span>
                  {((streamData?.subtitles && streamData.subtitles.length > 0) || parsedVttCuesRef.current.length > 0) && (
                    <span className="bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold text-[10px] flex items-center gap-1 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      CC LOADED
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Top Buttons: EP List, Debugger (if enabled), Audio & Subtitle Settings */}
            <div className="flex items-center gap-2">
              {/* Skip Intro / Outro Button: ONLY shown if skip timestamps exist for the anime episode and video is currently in the skip timestamp range */}
              {(isCurrentIntro || isCurrentOutro) && (
                <button
                  onClick={handleSkipIntroOrOutro}
                  className="px-3.5 py-1.5 rounded-full bg-pink-600 hover:bg-pink-500 active:scale-95 border border-pink-400/50 backdrop-blur-md flex items-center gap-1.5 text-white text-xs font-bold shadow-lg transition-all cursor-pointer animate-pulse"
                  title={isCurrentIntro ? 'Skip Intro' : 'Skip Outro'}
                >
                  <span>{isCurrentIntro ? 'Skip Intro' : 'Skip Outro'}</span>
                  <SkipForward className="w-3.5 h-3.5 fill-white" />
                </button>
              )}

              {/* Episode List Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenEpisodesDrawer) {
                    onOpenEpisodesDrawer();
                  }
                  resetControlsTimeout();
                }}
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/30 hover:bg-amber-500/20 flex items-center justify-center text-amber-300 active:scale-95 transition-all shadow-lg cursor-pointer"
                title="Episode List"
              >
                <ListVideo className="w-5 h-5 text-amber-400" />
              </button>

              {subtitleSettings?.showTerminalIcon && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDebugLogs((prev) => !prev);
                    resetControlsTimeout();
                  }}
                  className={`w-10 h-10 rounded-full border backdrop-blur-md transition-all flex items-center justify-center shadow-lg active:scale-95 cursor-pointer ${
                    showDebugLogs
                      ? 'bg-pink-600/90 border-pink-400 ring-2 ring-pink-500/50 text-white'
                      : 'bg-black/60 border-zinc-800 hover:bg-zinc-800 text-gray-200'
                  }`}
                  title="Toggle Video Debug Logs"
                >
                  <Terminal className={`w-5 h-5 ${showDebugLogs ? 'text-white' : 'text-pink-400'}`} />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenSettings) {
                    onOpenSettings();
                  }
                  resetControlsTimeout();
                }}
                className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-zinc-800 hover:bg-zinc-800 flex items-center justify-center text-white active:scale-95 transition-all shadow-lg cursor-pointer"
                title="Subtitle & Player Settings"
              >
                <Sliders className="w-5 h-5 text-pink-400" />
              </button>
            </div>
          </div>

          {/* Center Playback Controls (Scales in & out) */}
          <div
            className={`flex items-center justify-center gap-8 sm:gap-14 my-auto transition-all duration-300 ease-out transform ${
              controlsVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
            }`}
          >
            {/* Previous Episode Button (No background or border, filled icon) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onPrevEp) {
                  onPrevEp();
                } else {
                  seekBy(-10);
                }
                resetControlsTimeout();
              }}
              disabled={currentEp <= 1}
              className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-white hover:scale-125 active:scale-90 transition-all disabled:opacity-30 disabled:hover:scale-100 cursor-pointer group drop-shadow-lg"
              title={currentEp > 1 ? `Previous Episode (EP ${currentEp - 1})` : 'First Episode'}
            >
              <SkipBack className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" />
            </button>

            {/* Big Play / Pause */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
                resetControlsTimeout();
              }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-pink-600/90 backdrop-blur-md border-2 border-pink-400/50 flex items-center justify-center text-white hover:bg-pink-500 hover:scale-105 active:scale-90 transition-all shadow-[0_0_30px_rgba(236,72,153,0.5)] cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" />
              ) : (
                <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white translate-x-0.5" />
              )}
            </button>

            {/* Next Episode Button (No background or border, filled icon) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onNextEp) {
                  onNextEp();
                } else {
                  seekBy(10);
                }
                resetControlsTimeout();
              }}
              disabled={anime.episodes ? currentEp >= (parseInt(String(anime.episodes), 10) || 0) : false}
              className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-white hover:scale-125 active:scale-90 transition-all disabled:opacity-30 disabled:hover:scale-100 cursor-pointer group drop-shadow-lg"
              title={anime.episodes && currentEp >= (parseInt(String(anime.episodes), 10) || 0) ? 'Latest Episode' : `Next Episode (EP ${currentEp + 1})`}
            >
              <SkipForward className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" />
            </button>
          </div>

          {/* Bottom Bar: Timeline Scrubber & Timecode in 1 line (Slides up from bottom) */}
          <div
            className={`flex items-center gap-2.5 sm:gap-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent -m-4 sm:-m-6 p-4 sm:p-6 transition-transform duration-300 ease-out transform ${
              controlsVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            {/* Left Timestamp: Current time */}
            <span className="text-pink-400 font-bold text-xs sm:text-sm font-mono tracking-wider shrink-0 select-none">
              {formatTime(displayCurrentTime)}
            </span>

            {/* Middle Scrubber Progress Bar */}
            <div
              ref={progressBarRef}
              className="relative flex-1 h-5 cursor-pointer flex items-center group touch-none select-none"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleScrubStart(e.clientX);
                resetControlsTimeout();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (e.touches.length > 0) {
                  handleScrubStart(e.touches[0].clientX);
                  resetControlsTimeout();
                }
              }}
            >
              {/* Tooltip when scrubbing */}
              {(isScrubbing || isPlaying) && duration > 0 && (
                <div
                  className={`absolute -top-7 -translate-x-1/2 px-2.5 py-1 rounded-md bg-black/95 backdrop-blur-md border border-zinc-800 text-white font-mono text-xs font-bold pointer-events-none shadow-2xl transition-opacity duration-150 z-50 ${
                    isScrubbing ? 'opacity-100 scale-105' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  style={{
                    left: `${Math.max(6, Math.min(94, displayProgress))}%`,
                  }}
                >
                  <span>{formatTime(displayCurrentTime)}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-gray-400">{formatTime(isReels ? 30 : duration)}</span>
                </div>
              )}

              {/* Progress Line */}
              <div className="relative w-full h-1.5 group-hover:h-2 transition-all duration-150 bg-white/25 rounded-full flex items-center overflow-visible">
                {/* Highlighted Intro and Outro Segments */}
                {duration > 0 && streamData?.intro && typeof streamData.intro.start === 'number' && typeof streamData.intro.end === 'number' && streamData.intro.end > streamData.intro.start && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none rounded-full"
                    style={{
                      left: `${(streamData.intro.start / duration) * 100}%`,
                      width: `${((streamData.intro.end - streamData.intro.start) / duration) * 100}%`,
                      backgroundColor: 'rgba(255, 0, 255, 0.4)',
                    }}
                  />
                )}
                {duration > 0 && streamData?.outro && typeof streamData.outro.start === 'number' && typeof streamData.outro.end === 'number' && streamData.outro.end > streamData.outro.start && (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none rounded-full"
                    style={{
                      left: `${(streamData.outro.start / duration) * 100}%`,
                      width: `${((streamData.outro.end - streamData.outro.start) / duration) * 100}%`,
                      backgroundColor: 'rgba(255, 0, 255, 0.4)',
                    }}
                  />
                )}

                <div
                  className="absolute top-0 bottom-0 left-0 bg-white/40 rounded-full pointer-events-none"
                  style={{ width: `${Math.max(displayProgress, bufferedProgress)}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 left-0 bg-pink-500 rounded-full pointer-events-none"
                  style={{ width: `${displayProgress}%` }}
                />
                <div
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-pink-500 shadow-xl pointer-events-none transition-transform z-30 ${
                    isScrubbing ? 'scale-125 ring-4 ring-pink-500/50' : 'scale-75 group-hover:scale-100'
                  }`}
                  style={{ left: `${displayProgress}%` }}
                />
              </div>
            </div>

            {/* Right Timestamp: Total duration */}
            <span className="text-gray-300 font-semibold text-xs sm:text-sm font-mono tracking-wider shrink-0 select-none">
              {formatTime(isReels ? 30 : duration)}
            </span>
          </div>

          {/* Floating Skip Pill in Fullscreen when playback is within skip timestamps */}
          {isFullscreen && (isCurrentIntro || isCurrentOutro) && (
            <div className="absolute bottom-20 right-6 z-40 pointer-events-auto">
              <button
                onClick={handleSkipIntroOrOutro}
                className="px-4 py-2 rounded-full bg-pink-600 hover:bg-pink-500 active:scale-95 border border-pink-400/50 backdrop-blur-md flex items-center gap-2 text-white text-xs font-black shadow-[0_4px_20px_rgba(236,72,153,0.7)] transition-all cursor-pointer animate-bounce"
              >
                <span>{isCurrentIntro ? 'SKIP INTRO' : 'SKIP OUTRO'}</span>
                <SkipForward className="w-4 h-4 fill-white" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Top right floating action buttons (Feed / Non-Fullscreen mode ONLY) */}
      {!isFullscreen && (
        <div className="absolute top-14 sm:top-16 right-3 sm:right-4 z-30 flex flex-col items-center gap-2">
          {onToggleHideFeedUi && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleHideFeedUi();
              }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border backdrop-blur-md transition-all flex items-center justify-center shadow-xl active:scale-90 cursor-pointer ${
                hideFeedUi
                  ? 'bg-black/30 border-zinc-800 text-white/40 opacity-40 hover:opacity-100'
                  : 'bg-black/50 border-zinc-800 hover:bg-black/70 text-gray-200'
              }`}
              title={hideFeedUi ? 'Show Full Feed UI' : 'Hide Feed UI (Theatre Mode)'}
            >
              {hideFeedUi ? (
                <EyeOff className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white/60" />
              ) : (
                <Eye className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-pink-400" />
              )}
            </button>
          )}

          {subtitleSettings?.showTerminalIcon && !hideFeedUi && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDebugLogs((prev) => !prev);
              }}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border backdrop-blur-md transition-all flex items-center justify-center shadow-xl active:scale-90 cursor-pointer ${
                showDebugLogs
                  ? 'bg-pink-600/90 border-pink-400 ring-2 ring-pink-500/50 text-white'
                  : 'bg-black/50 border-zinc-800 hover:bg-black/70 text-gray-200'
              }`}
              title="Toggle Video Debug Logs"
            >
              <Terminal className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${showDebugLogs ? 'text-white' : 'text-pink-400'}`} />
            </button>
          )}

          {!hideFeedUi && (
            <button
              id={`btn-settings-${anime.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenSettings) {
                  onOpenSettings();
                }
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md border border-zinc-800 flex items-center justify-center text-white hover:bg-black/70 active:scale-90 transition-all shadow-xl cursor-pointer"
              title="Subtitle & Player Settings"
            >
              <Sliders className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-pink-400" />
            </button>
          )}
        </div>
      )}

      {/* Video Debugger Diagnostics Overlay */}
      {showDebugLogs && (
        <div
          className="absolute inset-x-2 top-20 bottom-20 z-50 bg-zinc-950/98 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 flex flex-col text-white shadow-2xl select-text overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-pink-400" />
              <h3 className="font-bold text-sm tracking-wide text-gray-100">Video Diagnostics & Logs</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const logText = debugLogs.join('\n');
                  navigator.clipboard.writeText(logText);
                  setLogsCopied(true);
                  setTimeout(() => setLogsCopied(false), 2000);
                }}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-[11px] font-mono flex items-center gap-1 transition-colors"
                title="Copy logs to clipboard"
              >
                {logsCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-300" />}
                <span>{logsCopied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => setDebugLogs([])}
                className="p-1 bg-zinc-900 hover:bg-red-500/20 text-gray-300 hover:text-red-400 border border-zinc-800 rounded-md transition-colors"
                title="Clear logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowDebugLogs(false)}
                className="p-1 bg-zinc-900 hover:bg-zinc-800 text-gray-300 rounded-md border border-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Telemetry Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[11px] font-mono">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2">
              <span className="text-gray-400 block text-[10px]">Status</span>
              <span className={`font-bold ${isPlaying ? 'text-green-400' : isBuffering ? 'text-yellow-400' : 'text-gray-300'}`}>
                {loading ? 'LOADING' : isBuffering ? 'BUFFERING' : isPlaying ? 'PLAYING' : 'PAUSED'}
              </span>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2">
              <span className="text-gray-400 block text-[10px]">Quality & Server</span>
              <span className="font-semibold text-cyan-300 truncate block">{qualityLabel} | {server.toUpperCase()}</span>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2">
              <span className="text-gray-400 block text-[10px]">ReadyState</span>
              <span className="font-semibold text-pink-300">State: {videoRef.current?.readyState ?? 0}</span>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-2">
              <span className="text-gray-400 block text-[10px]">Buffered</span>
              <span className="font-semibold text-emerald-300">{bufferedProgress.toFixed(1)}%</span>
            </div>
          </div>

          {/* Stream URL & Subtitle Sync Controls */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-2 mb-3 text-[10px] font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-gray-400 truncate select-all flex-1">
              <span className="text-pink-400 font-bold mr-1">URL:</span>
              {streamData?.m3u8 || 'No stream loaded'}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-gray-400 text-[10px]">Sub Sync:</span>
              <button
                onClick={() => setSubtitleOffset((prev) => Math.max(prev - 0.5, -10))}
                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-cyan-300 active:scale-95 transition-all"
                title="Delay Subtitles by 0.5s"
              >
                -0.5s
              </button>
              <span className="text-pink-300 font-bold px-1">{subtitleOffset >= 0 ? `+${subtitleOffset.toFixed(1)}s` : `${subtitleOffset.toFixed(1)}s`}</span>
              <button
                onClick={() => setSubtitleOffset((prev) => Math.min(prev + 0.5, 10))}
                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-cyan-300 active:scale-95 transition-all"
                title="Advance Subtitles by 0.5s"
              >
                +0.5s
              </button>
              {subtitleOffset !== 0 && (
                <button
                  onClick={() => setSubtitleOffset(0)}
                  className="px-1.5 py-0.5 bg-pink-500/30 hover:bg-pink-500/50 rounded border border-pink-400/50 text-pink-200 active:scale-95 transition-all ml-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Live Log Stream */}
          <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1 bg-black/80 p-2.5 rounded-xl border border-zinc-800 shadow-inner custom-scrollbar">
            {debugLogs.length === 0 ? (
              <div className="text-gray-500 italic text-center py-6">No log events recorded yet.</div>
            ) : (
              debugLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed break-all ${
                    log.includes('ERROR') || log.includes('FAIL')
                      ? 'text-red-400 bg-red-950/30 px-1 rounded'
                      : log.includes('SUCCESS') || log.includes('Parsed')
                      ? 'text-green-400'
                      : log.includes('FETCH')
                      ? 'text-cyan-300'
                      : 'text-gray-300'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});


