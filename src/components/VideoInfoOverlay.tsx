import React, { useState, useRef, useEffect } from 'react';
import { Music, Star, Tag, ChevronDown, ChevronUp, Mic, Check } from 'lucide-react';
import { AnimeItem, ServerType } from '../types/anime';

interface VideoInfoOverlayProps {
  anime: AnimeItem;
  currentEp: number;
  totalEp?: string;
  server: ServerType;
  activeSubtitle?: string;
  onChangeEp?: (ep: number) => void;
  onChangeServer: (s: ServerType) => void;
  subtitleSize?: 'small' | 'medium' | 'large';
  subtitleColor?: 'white' | 'yellow' | 'cyan';
  subtitleVisible?: boolean;
  hideFeedUi?: boolean;
  onSelectGenre?: (genre: string) => void;
}

export const VideoInfoOverlay: React.FC<VideoInfoOverlayProps> = React.memo(({
  anime,
  currentEp,
  server,
  onChangeServer,
  hideFeedUi = false,
  onSelectGenre,
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [tagsExpanded, setTagsExpanded] = useState<boolean>(false);
  const [hasTagsOverflow, setHasTagsOverflow] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => typeof document !== 'undefined' ? !!document.fullscreenElement : false
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);

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
    if (expanded && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [expanded]);

  // Check if tags actually overflow 2 lines (>50px)
  useEffect(() => {
    const checkOverflow = () => {
      if (tagsRef.current) {
        setHasTagsOverflow(tagsRef.current.scrollHeight > 52);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [anime.id, server, anime.is_sub, anime.is_dub]);

  const genres = anime.terms_by_type?.genre || ['Anime', 'Action'];
  const studioName = anime.terms_by_type?.studios?.[0] || anime.source || 'Official Studio';
  const isMovie = anime.terms_by_type?.type?.[0]?.toLowerCase() === 'movie' || 
                  anime.title?.toLowerCase().includes('movie') || 
                  anime.episodes === '1';

  if (isFullscreen || hideFeedUi) return null;

  return (
    <div
      id={`video-info-overlay-${anime.id}`}
      className={`absolute z-45 flex flex-col gap-1.5 text-white pointer-events-auto transition-all duration-300 ${
        isFullscreen
          ? 'bottom-12 sm:bottom-16 left-3 sm:left-6 right-20 sm:right-24 max-w-sm sm:max-w-xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]'
          : 'bottom-18 sm:bottom-22 left-2.5 sm:left-3 right-14 sm:right-16 max-w-[270px] sm:max-w-xl pb-0.5'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Studio Name with Verified Badge */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1 min-w-0 max-w-[220px] sm:max-w-none">
          <h2 className="text-xs sm:text-sm md:text-base font-bold tracking-tight text-white drop-shadow-md truncate">
            {studioName}
          </h2>
          {/* Verified Icon: Skyblue circle with white checkmark (smaller) */}
          <span
            title="Verified Studio"
            className="inline-flex items-center justify-center w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-sky-400 shrink-0 shadow-xs"
          >
            <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white stroke-[3.5]" />
          </span>
        </div>
      </div>

      {/* Description text with Anime Title on its own line */}
      <div
        className="relative text-[11px] sm:text-xs text-gray-200 leading-snug max-w-[260px] sm:max-w-md cursor-pointer select-none"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
      >
        <div
          ref={contentRef}
          className={`drop-shadow ${
            expanded
              ? 'max-h-28 sm:max-h-36 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-md p-2 rounded-xl text-gray-100 shadow-xl'
              : ''
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <h3 className={`font-extrabold text-white text-xs sm:text-sm drop-shadow-xs leading-tight ${expanded ? '' : 'line-clamp-2'}`}>
              Anime: {anime.title} {!isMovie ? `(EP ${currentEp})` : ''}
            </h3>
            <p className={`text-gray-200 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
              {anime.description || 'Watch the latest episodes of this trending anime series with high-quality stream links on TikTok Anime Short.'}
            </p>
          </div>
        </div>
        {anime.description && anime.description.length > 60 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
            className="text-[10px] sm:text-[11px] font-bold text-gray-300 hover:text-white mt-0.5 inline-flex items-center gap-0.5 outline-none select-none"
          >
            {expanded ? (
              <>Show Less <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" /></>
            ) : (
              <>...more <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" /></>
            )}
          </button>
        )}
      </div>

      {/* Tags section: Clean layout with conditional overflow toggle */}
      <div className="flex flex-col items-center w-full pt-0.5">
        <div className="relative w-full">
          <div
            ref={tagsRef}
            className={`flex flex-wrap items-center gap-1.5 w-full transition-all duration-300 ${
              tagsExpanded || !hasTagsOverflow ? 'max-h-none' : 'max-h-[46px] sm:max-h-[50px] overflow-hidden'
            }`}
          >
            {/* HD Tag & Server Switcher */}
            <button
              id={`btn-server-switch-${anime.id}`}
              onClick={() => {
                const serversOrder: ServerType[] = ['hd-2', 'hd-1'];
                const nextServer = serversOrder[(serversOrder.indexOf(server) + 1) % serversOrder.length];
                onChangeServer(nextServer);
              }}
              className="bg-emerald-500/30 backdrop-blur-md text-emerald-200 border border-emerald-500/40 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 shadow-xs hover:scale-105 active:scale-95 transition-transform"
              title="Click to switch Streaming Server"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {server.toUpperCase()}
            </button>

            {/* Score Tag */}
            {anime.score && (
              <span className="bg-amber-500/30 backdrop-blur-md text-amber-200 border border-amber-500/40 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-xs">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                {anime.score}
              </span>
            )}

            {/* Year Tag */}
            {anime.year && (
              <span className="bg-blue-500/30 backdrop-blur-md text-blue-200 border border-blue-500/40 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-xs">
                {anime.year}
              </span>
            )}

            {/* Status Tag */}
            <span className="bg-purple-500/30 backdrop-blur-md text-purple-200 border border-purple-500/40 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-xs">
              {anime.status && (anime.status.toLowerCase().includes('finish') || anime.status.toLowerCase().includes('completed')) ? 'Finished' : 'Airing'}
            </span>

            {/* Sub/Dub and Total EP Count Indicators */}
            {anime.is_sub !== undefined && anime.is_sub > 0 && (
              <span className="bg-cyan-500/25 backdrop-blur-md text-cyan-200 border border-cyan-500/30 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-xs">
                CC {anime.is_sub}
              </span>
            )}

            {anime.is_dub !== undefined && anime.is_dub > 0 && (
              <span className="bg-pink-500/25 backdrop-blur-md text-pink-200 border border-pink-500/30 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-xs">
                <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                <span>DUB {anime.is_dub}</span>
              </span>
            )}

            {anime.episodes && (
              <span className="bg-white/15 backdrop-blur-md text-white/90 border border-white/10 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-xs">
                EP {anime.episodes}
              </span>
            )}

            {/* Genre Pills */}
            {genres.map((g, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectGenre) onSelectGenre(g);
                }}
                className="text-[9px] sm:text-[10px] font-semibold text-pink-300 bg-pink-950/60 border border-pink-500/30 px-2 py-0.5 rounded-full flex items-center gap-0.5 hover:bg-pink-900/80 cursor-pointer transition-colors hover:scale-105 active:scale-95"
              >
                <Tag className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                {g}
              </button>
            ))}
          </div>

          {/* Fading gradient at bottom ONLY when collapsed AND actually overflowing */}
          {!tagsExpanded && hasTagsOverflow && (
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none z-10" />
          )}
        </div>

        {/* Centered Chevron merge button ONLY rendered when tags actually overflow 2 lines */}
        {hasTagsOverflow && (
          <div className="w-full flex justify-center -mt-2 z-20">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTagsExpanded((prev) => !prev);
              }}
              className="bg-black/80 backdrop-blur-md text-cyan-300 border border-cyan-500/50 p-0.5 rounded-full shadow-lg hover:bg-cyan-950 hover:border-cyan-400 cursor-pointer active:scale-90 transition-all flex items-center justify-center"
              title={tagsExpanded ? 'Collapse tags' : 'Uncollapse tags'}
            >
              {tagsExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* TikTok Audio Marquee Ticker */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <Music className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white animate-pulse" />
        <div className="overflow-hidden whitespace-nowrap w-36 sm:w-48 text-[10px] sm:text-[11px] text-gray-200 font-medium">
          <div className="inline-block animate-marquee">
            Original Audio - {anime.title} • Episode {currentEp} Subbed •
          </div>
        </div>
      </div>
    </div>
  );
});
