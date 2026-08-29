import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Plus, Check, Captions, CaptionsOff } from 'lucide-react';
import { AnimeItem, getLatestEpisode } from '../types/anime';
import { checkDubAvailable, getCachedDubAvailability } from '../services/animeApi';

interface SidebarActionsProps {
  anime: AnimeItem;
  currentEp?: number;
  liked: boolean;
  likeCount: number;
  saved?: boolean;
  saveCount?: number;
  commentCount: number;
  skipState?: { show: boolean; label: string; onSkip: () => void; isSkippable?: boolean; start?: number; end?: number } | null;
  onToggleLike: () => void;
  onToggleSave?: () => void;
  onToggleFullscreen?: () => void;
  onOpenComments: () => void;
  onOpenMore: () => void;
  isDub: boolean;
  onToggleDub: (checked: boolean) => void;
  onDubUnavailable?: (animeTitle: string) => void;
  hideFeedUi?: boolean;
  hasSubtitles?: boolean;
  onOpenSubtitleSettings?: () => void;
}

export const SidebarActions: React.FC<SidebarActionsProps> = React.memo(({
  anime,
  currentEp = 1,
  liked,
  likeCount,
  saved = false,
  saveCount = 0,
  commentCount,
  skipState,
  onToggleLike,
  onToggleSave,
  onToggleFullscreen,
  onOpenComments,
  onOpenMore,
  isDub,
  onToggleDub,
  onDubUnavailable,
  hideFeedUi = false,
  hasSubtitles = true,
  onOpenSubtitleSettings,
}) => {
  const [followed, setFollowed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => typeof document !== 'undefined' ? !!document.fullscreenElement : false
  );
  const [hasDub, setHasDub] = useState<boolean | null>(() => {
    if (typeof anime.is_dub === 'number') {
      return anime.is_dub > 0;
    }
    return getCachedDubAvailability(anime.slug, currentEp);
  });

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(typeof document !== 'undefined' ? !!document.fullscreenElement : false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    if (typeof anime.is_dub === 'number') {
      setHasDub(anime.is_dub > 0);
      return;
    }
    checkDubAvailable(anime.slug, currentEp).then((avail) => {
      if (isCurrent) {
        setHasDub(avail);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [anime.slug, anime.is_dub, currentEp]);

  const handleDubClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // If currently in Sub and user wants to switch to Dub
    if (!isDub) {
      let isAvailable = hasDub;
      if (isAvailable === null) {
        isAvailable = await checkDubAvailable(anime.slug, currentEp);
        setHasDub(isAvailable);
      }

      if (!isAvailable) {
        // Dub is not available - notify immediately without disturbing video playback or player state
        if (onDubUnavailable) {
          onDubUnavailable(anime.title || anime.slug);
        }
        return;
      }
      onToggleDub(true);
    } else {
      // Switching from Dub back to Sub
      onToggleDub(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (isFullscreen || hideFeedUi) return null;

  return (
    <div
      id={`sidebar-actions-${anime.id}`}
      className={`absolute z-45 flex flex-col items-center text-white pointer-events-auto select-none transition-all duration-300 ${
        isFullscreen
          ? 'right-3 sm:right-6 bottom-14 sm:bottom-16 gap-1.5 sm:gap-2 scale-90 sm:scale-100 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]'
          : 'right-2 sm:right-3 bottom-18 sm:bottom-22 gap-2 sm:gap-3'
      }`}
    >
      {/* Dub/Sub Switch Toggle - Only shown if anime has available Dub */}
      {Boolean(hasDub === true || (typeof anime.is_dub === 'number' && anime.is_dub > 0) || getCachedDubAvailability(anime.slug, currentEp)) && (
        <div className="flex flex-col items-center mb-0.5">
          <button
            id={`btn-toggle-dub-${anime.id}`}
            onClick={handleDubClick}
            className={`w-13 h-6 sm:w-14 sm:h-6.5 rounded-full p-0.5 transition-all duration-300 relative flex items-center shadow-xl border backdrop-blur-md cursor-pointer ${
              isDub
                ? 'bg-pink-600/90 border-pink-400/80 shadow-pink-500/30'
                : 'bg-black/70 border-white/30 hover:border-white/50'
            }`}
            title={`Switch to ${isDub ? 'Original Japanese (SUB)' : 'English Dub (DUB)'}`}
          >
            {/* Background inactive text indicator */}
            <span
              className={`absolute text-[8px] font-black tracking-wider transition-opacity select-none ${
                isDub ? 'left-1.5 text-white/90' : 'right-1.5 text-zinc-300'
              }`}
            >
              {isDub ? 'EN' : 'JP'}
            </span>

            {/* Sliding Knob with SUB / DUB Text inside */}
            <div
              className={`w-6 h-5 sm:w-6.5 sm:h-5.5 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center font-black text-[8px] tracking-tight ${
                isDub
                  ? 'translate-x-6 sm:translate-x-6.5 text-pink-600'
                  : 'translate-x-0 text-zinc-900'
              }`}
            >
              {isDub ? 'DUB' : 'SUB'}
            </div>
          </button>
        </div>
      )}

      {/* Creator Avatar with Follow button */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenSubtitleSettings) onOpenSubtitleSettings();
        }}
        className="relative group cursor-pointer mb-0.5 active:scale-95 transition-transform"
        title="Click to configure Subtitles & Captions"
      >
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full ring-2 ring-white/80 p-0.5 overflow-hidden bg-black shadow-xl transition-transform group-hover:scale-105">
          <img
            src={anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150'}
            alt={anime.title}
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <div
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-white shadow-md transition-all select-none pointer-events-none ${
            hasSubtitles ? 'bg-pink-500 shadow-pink-500/20' : 'bg-zinc-600'
          }`}
          title={hasSubtitles ? 'English Subtitles (CC) Available' : 'No Subtitles Available'}
        >
          {hasSubtitles ? (
            <Captions className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
          ) : (
            <CaptionsOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-zinc-300 stroke-[2.5]" />
          )}
        </div>
      </div>

      {/* Like Button */}
      <button
        id={`btn-like-${anime.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLike();
        }}
        className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white">
          <Heart
            className={`w-6.5 h-6.5 sm:w-7.5 sm:h-7.5 transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] ${
              liked ? 'fill-pink-500 text-pink-500 scale-110 animate-bounce' : 'fill-white text-white group-hover:scale-110'
            }`}
          />
        </div>
        <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 text-white shadow-black drop-shadow">
          {formatNumber(likeCount)}
        </span>
      </button>
 
      {/* Comment Button */}
      <button
        id={`btn-comment-${anime.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpenComments();
        }}
        className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white">
          <MessageCircle className="w-6.5 h-6.5 sm:w-7.5 sm:h-7.5 fill-white text-white group-hover:scale-110 transition-transform drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
        </div>
        <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 text-white shadow-black drop-shadow">
          EP {getLatestEpisode(anime)}
        </span>
      </button>
 
      {/* Fullscreen Button with 4 corner Ls icon */}
      <button
        id={`btn-fullscreen-${anime.id}`}
        onClick={(e) => {
          e.stopPropagation();
          if (onToggleFullscreen) {
            onToggleFullscreen();
          } else {
            // Find player or slide element to enter fullscreen landscape
            const slide = document.getElementById(`video-player-${anime.id}`) || document.getElementById(`feed-slide-${anime.id}`);
            if (slide) {
              if (!document.fullscreenElement) {
                if (slide.requestFullscreen) {
                  slide.requestFullscreen().then(() => {
                    try {
                      if (window.screen?.orientation && (window.screen.orientation as any).lock) {
                        (window.screen.orientation as any).lock('landscape').catch(() => {});
                      }
                    } catch (err) {}
                  }).catch(() => {});
                }
              } else {
                if (document.exitFullscreen) {
                  document.exitFullscreen().then(() => {
                    try {
                      if (window.screen?.orientation && (window.screen.orientation as any).unlock) {
                        (window.screen.orientation as any).unlock();
                      }
                    } catch (err) {}
                  }).catch(() => {});
                }
              }
            }
          }
        }}
        className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
        title="Fullscreen Landscape"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white">
          {/* 4 Corner Ls Fullscreen Icon */}
          <svg
            className="w-6.5 h-6.5 sm:w-7.5 sm:h-7.5 text-white group-hover:scale-110 transition-transform drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Top-Left Corner L */}
            <path d="M3 8V3h5" />
            {/* Top-Right Corner L */}
            <path d="M21 8V3h-5" />
            {/* Bottom-Left Corner L */}
            <path d="M3 16v5h5" />
            {/* Bottom-Right Corner L */}
            <path d="M21 16v5h-5" />
          </svg>
        </div>
        <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 text-white shadow-black drop-shadow">
          Full
        </span>
      </button>
 
      {/* More Button */}
      <button
        id={`btn-more-${anime.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpenMore();
        }}
        className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-white">
          <MoreHorizontal className="w-6.5 h-6.5 sm:w-7.5 sm:h-7.5 text-white group-hover:scale-110 transition-transform drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
        </div>
        <span className="text-[10px] sm:text-[11px] font-bold mt-0.5 text-white shadow-black drop-shadow">
          More
        </span>
      </button>

      {/* Spinning Vinyl Audio Disc / Avatar at Bottom with Thinking Cloud Overlay */}
      <div className="relative mt-1 flex flex-col items-center">
        {/* Thinking Cloud Style Overlay on top of Avatar */}
        {skipState && skipState.show && (
          <button
            id={`btn-skip-${anime.id}`}
            onClick={(e) => {
              e.stopPropagation();
              skipState.onSkip();
            }}
            className="absolute -top-9 z-40 animate-bounce cursor-pointer group/cloud"
            title={skipState.label}
          >
            {/* Thought Cloud Body */}
            <div className="relative bg-white text-zinc-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white flex items-center justify-center tracking-wider select-none hover:scale-105 active:scale-95 transition-transform whitespace-nowrap">
              <span className="uppercase font-black text-pink-600 tracking-wider">SKIP</span>

              {/* Thinking Cloud Circles Trail pointing down to avatar */}
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-white shadow-sm border border-white/80" />
                <div className="w-1.2 h-1.2 rounded-full bg-white/90 shadow-2xs -mt-0.5" />
              </div>
            </div>
          </button>
        )}

        <div
          onClick={(e) => {
            if (skipState && skipState.show) {
              e.stopPropagation();
              skipState.onSkip();
            }
          }}
          className={`relative rounded-full p-[2px] transition-all duration-500 cursor-pointer overflow-hidden ${
            skipState?.isSkippable && !skipState.show
              ? 'bg-transparent shadow-[0_0_12px_rgba(236,72,153,0.4)]'
              : 'bg-transparent'
          }`}
        >
          {/* Circling Border Color Indicator when skippable but not yet showing skip */}
          {skipState?.isSkippable && !skipState.show && (
            <div 
              className="absolute inset-0 bg-[conic-gradient(from_0deg,#ec4899,#06b6d4,#8b5cf6,#ec4899)] animate-spin rounded-full" 
              style={{ animationDuration: '3s' }} 
            />
          )}

          <div
            className={`relative z-10 w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center animate-spin shadow-2xl transition-all duration-300 ${
              skipState && skipState.show
                ? 'border-2 border-pink-500 ring-2 ring-pink-500 ring-offset-1 ring-offset-black shadow-[0_0_15px_rgba(236,72,153,0.8)]'
                : skipState?.isSkippable
                ? 'border-2 border-transparent'
                : 'border-2 border-white/80'
            }`}
            style={{ animationDuration: '4s' }}
          >
            <img
              src={anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150'}
              alt="Audio"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
