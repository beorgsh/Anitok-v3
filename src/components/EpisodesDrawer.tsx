import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Heart, Sparkles, CheckCircle2, Search, ArrowUpRight, Check } from 'lucide-react';
import { AnimeItem, AnimeEpisodeMetadata, getLatestEpisode } from '../types/anime';
import { fetchAnimeEpisodesMetadata } from '../services/animeApi';

interface EpisodesDrawerProps {
  anime: AnimeItem;
  currentEp: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectEp: (ep: number) => void;
}

interface EpisodeCommentState {
  ep: number;
  likes: number;
  isLiked: boolean;
}

interface EpisodeThumbnailProps {
  src?: string;
  fallbackPoster?: string;
  alt: string;
  isPlaying: boolean;
  ep: number;
  duration?: string;
  rating?: number | string;
  isLoadingMetadata: boolean;
  onClick: () => void;
}

const EpisodeThumbnail: React.FC<EpisodeThumbnailProps> = ({
  src,
  fallbackPoster,
  alt,
  isPlaying,
  ep,
  duration,
  rating,
  isLoadingMetadata,
  onClick,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const defaultFallback = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300';
  const displaySrc = (!imageError && src) ? src : (fallbackPoster || defaultFallback);

  return (
    <div
      onClick={onClick}
      className="mt-2.5 relative max-w-xs sm:max-w-sm rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 group/thumb hover:border-pink-500/60 cursor-pointer shadow-md transition-all active:scale-[0.98]"
    >
      <div className="aspect-video w-full relative bg-zinc-900">
        {/* Clean Buffering Loader with no heavy background box or border */}
        {(!imageLoaded || isLoadingMetadata) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-1.5 pointer-events-none">
            <div className="w-6 h-6 rounded-full border-2 border-pink-500 border-t-transparent animate-spin drop-shadow-sm" />
          </div>
        )}

        <img
          src={displaySrc}
          alt={alt}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(true);
          }}
          className={`w-full h-full object-cover group-hover/thumb:scale-105 transition-all duration-300 ${
            imageLoaded && !isLoadingMetadata ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-pink-500 text-white scale-110 shadow-lg shadow-pink-500/50'
                : 'bg-black/60 text-white group-hover/thumb:scale-110 group-hover/thumb:bg-pink-500'
            }`}
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>

        {/* Pill Badge for Duration & Rating */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
          <span className="px-2 py-0.5 rounded-md bg-black/80 text-[10px] font-bold text-white font-mono border border-zinc-800">
            EP {ep}
          </span>
          {duration && (
            <span className="px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] text-zinc-300 font-mono">
              {duration}m
            </span>
          )}
          {rating && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-950/80 text-[9px] text-amber-300 font-mono border border-amber-500/30">
              ★ {rating}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const EpisodesDrawer: React.FC<EpisodesDrawerProps> = ({
  anime,
  currentEp,
  isOpen,
  onClose,
  onSelectEp,
}) => {
  const [metadataList, setMetadataList] = useState<AnimeEpisodeMetadata[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState<boolean>(false);
  const [likedEpisodes, setLikedEpisodes] = useState<Record<number, EpisodeCommentState>>({});
  const [searchText, setSearchText] = useState('');
  const [highlightedEp, setHighlightedEp] = useState<number | null>(null);
  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState<number>(() => Math.max(1, Math.ceil(currentEp / PAGE_SIZE)));
  const episodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Reset or align page on opening
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(Math.max(1, Math.ceil(currentEp / PAGE_SIZE)));
    }
  }, [isOpen, currentEp]);

  // Fetch episode metadata with thumbnails, title, and description using ani_id or mal_id
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const aniId = anime.ani_id || anime.mal_id || anime.id;

    if (aniId) {
      setLoadingMetadata(true);
      fetchAnimeEpisodesMetadata(aniId)
        .then((episodes) => {
          if (isMounted) {
            setMetadataList(episodes);
            setLoadingMetadata(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoadingMetadata(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, anime.ani_id, anime.mal_id, anime.id]);

  const parsedTotal = anime.episodes ? parseInt(String(anime.episodes), 10) : 0;
  const latestEp = getLatestEpisode(anime);
  const totalEpCount = latestEp > 0 ? latestEp : (parsedTotal > 0 ? parsedTotal : (metadataList.length > 0 ? metadataList.length : 1));
  const maxEpCount = totalEpCount;
  const episodeNumbers = Array.from({ length: maxEpCount }, (_, i) => i + 1);

  // Map metadata by episode number for fast lookup
  const metadataByEpNumber = new Map<number, AnimeEpisodeMetadata>();
  metadataList.forEach((ep) => {
    if (typeof ep.number === 'number') {
      metadataByEpNumber.set(ep.number, ep);
    }
  });

  const toggleEpisodeLike = (ep: number, defaultLikes: number) => {
    setLikedEpisodes((prev) => {
      const current = prev[ep] || { ep, likes: defaultLikes, isLiked: false };
      return {
        ...prev,
        [ep]: {
          ep,
          likes: current.isLiked ? current.likes - 1 : current.likes + 1,
          isLiked: !current.isLiked,
        },
      };
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchText.trim();
    if (!query) return;

    // Check if query is an episode number (e.g. "5", "ep 5", "episode 12")
    const match = query.match(/(?:ep(?:isode)?\s*)?(\d+)/i);
    let targetEp: number | null = null;

    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= maxEpCount) {
        targetEp = num;
      }
    }

    // If not a pure number, search by title in metadata
    if (!targetEp) {
      const found = metadataList.find((m) =>
        m.title?.toLowerCase().includes(query.toLowerCase())
      );
      if (found && typeof found.number === 'number') {
        targetEp = found.number;
      }
    }

    if (targetEp) {
      const targetPage = Math.max(1, Math.ceil(targetEp / PAGE_SIZE));
      setCurrentPage(targetPage);
      setHighlightedEp(targetEp);
      setTimeout(() => {
        const el = episodeRefs.current[targetEp!];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      setTimeout(() => {
        setHighlightedEp(null);
      }, 3000);
    }
  };

  // Filter episodes if search text has characters and is not just scrolling to an ep
  const cleanSearchQuery = searchText.trim().toLowerCase();
  const isDirectNumber = /^(\d+|ep\s*\d+|episode\s*\d+)$/i.test(cleanSearchQuery);

  const displayedEpisodeNumbers = cleanSearchQuery && !isDirectNumber
    ? episodeNumbers.filter((ep) => {
        const meta = metadataByEpNumber.get(ep);
        const titleMatch = meta?.title?.toLowerCase().includes(cleanSearchQuery);
        const descMatch = meta?.description?.toLowerCase().includes(cleanSearchQuery);
        const numMatch = `ep ${ep}`.includes(cleanSearchQuery) || `${ep}` === cleanSearchQuery;
        return titleMatch || descMatch || numMatch;
      })
    : episodeNumbers;

  const totalPages = Math.max(1, Math.ceil(displayedEpisodeNumbers.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * PAGE_SIZE;
  const paginatedEpisodeNumbers = displayedEpisodeNumbers.slice(startIndex, startIndex + PAGE_SIZE);

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={`episodes-drawer-${anime.id}`}
          key="episodes-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        >
          <motion.div
            key="episodes-drawer-sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="w-full max-w-lg mx-auto h-[84vh] sm:h-[80vh] bg-zinc-900/98 backdrop-blur-2xl border-t border-zinc-800 rounded-t-3xl flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        {/* TikTok Drag Handle */}
        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-1 mt-3 shrink-0" />

        {/* TikTok Comments Header */}
        <div className="px-4 py-2.5 border-b border-zinc-800/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-100 flex items-center gap-1.5">
              <span>Episodes</span>
              <span className="text-xs font-mono font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                {displayedEpisodeNumbers.length} / {maxEpCount}
              </span>
            </h3>
            {loadingMetadata && (
              <span className="text-[10px] text-pink-400 animate-pulse flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Syncing info...
              </span>
            )}
          </div>

          <button
            id={`btn-close-episodes-${anime.id}`}
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors shrink-0 cursor-pointer active:scale-90"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Range Pagination Selector Bar */}
        {totalPages > 1 && (
          <div className="px-3 py-2 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
            {Array.from({ length: totalPages }, (_, i) => {
              const pageNum = i + 1;
              const rangeStart = (pageNum - 1) * PAGE_SIZE + 1;
              const rangeEnd = Math.min(pageNum * PAGE_SIZE, displayedEpisodeNumbers.length);
              const isSelected = activePage === pageNum;
              return (
                <button
                  key={pageNum}
                  id={`btn-ep-range-${pageNum}`}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30 ring-1 ring-pink-400'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  {rangeStart}-{rangeEnd}
                </button>
              );
            })}
          </div>
        )}

        {/* TikTok Comments List where each Episode is a Comment with Attached Thumbnail */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-5 divide-y divide-zinc-800/50">
          {paginatedEpisodeNumbers.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Search className="w-8 h-8 text-zinc-600 mb-2" />
              <p className="text-sm font-semibold text-zinc-300">No episodes found</p>
              <p className="text-xs text-zinc-500 mt-1">Try entering episode number like "5" or title keyword</p>
            </div>
          ) : (
            paginatedEpisodeNumbers.map((ep) => {
              const isPlaying = ep === currentEp;
              const isLatest = ep === latestEp;
              const isHighlighted = highlightedEp === ep;
              const meta = metadataByEpNumber.get(ep);
              const epThumbnail =
                meta?.image || anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300';
              const epTitle = meta?.title ? meta.title : `Episode ${ep}`;
              const epDescription =
                meta?.description ||
                (meta
                  ? 'No description available for this episode.'
                  : `${anime.title} - Episode ${ep} official release.`);

              // Palette of colorful backgrounds for the comment avatars
              const avatarBgColors = ['b6e3f4', 'ffd5dc', 'c0aede', 'd1d4f9', 'ffdfbf', 'c7f9cc'];
              const bgHex = avatarBgColors[(ep - 1) % avatarBgColors.length];

              // Dicebear avatar for episode character representation with vibrant background
              const dicebearAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(
                anime.slug || 'anime'
              )}_ep_${ep}&backgroundColor=${bgHex}`;

              const idStr = String(anime.id || 'anime');
              const baseLikes = 25 + ((ep * 17 + idStr.length * 7) % 85);
              const likeState = likedEpisodes[ep] || { ep, likes: baseLikes, isLiked: false };

              return (
                <div
                  key={ep}
                  ref={(el) => {
                    episodeRefs.current[ep] = el;
                  }}
                  id={`comment-episode-${ep}`}
                  className={`flex gap-3 items-start pt-4 first:pt-0 group transition-all duration-300 rounded-2xl ${
                    isHighlighted
                      ? 'bg-pink-500/25 p-3 -mx-2.5 ring-2 ring-pink-500 shadow-lg shadow-pink-500/20 animate-pulse'
                      : isPlaying
                      ? 'bg-pink-950/20 p-2.5 -mx-2.5 border border-pink-500/30'
                      : ''
                  }`}
                >
                  {/* Dicebear Avatar with Colorful BG & Episode Badge */}
                  <div className="relative shrink-0">
                    {meta?.isFiller || ep % 5 === 0 ? (
                      <>
                        {/* Circling Gradient Border around Avatar for Filler/Skip */}
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full p-[2.5px] bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 animate-[spin_3s_linear_infinite] shadow-lg shadow-amber-500/20 flex items-center justify-center">
                          <div className="w-full h-full rounded-full bg-zinc-900 p-0.5 flex items-center justify-center overflow-hidden">
                            <img
                              src={dicebearAvatar}
                              alt={`${anime.title} EP ${ep}`}
                              className="w-full h-full rounded-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        </div>

                        {/* Skip Chat Style Bubble with Pumping Animation */}
                        <div className="absolute -top-3.5 -right-2 z-20 animate-bounce">
                          <div className="relative bg-gradient-to-r from-amber-500 to-pink-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-lg shadow-lg border border-amber-300/60 flex items-center gap-0.5 tracking-tight uppercase select-none animate-pulse">
                            <span>SKIP</span>
                            <span className="text-[9px]">💬</span>
                            {/* Chat bubble tail arrow */}
                            <div className="absolute -bottom-1 left-2 w-1.5 h-1.5 bg-pink-500 rotate-45 border-r border-b border-amber-300/40" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-0.5 bg-zinc-800 ring-2 ring-zinc-700/80 group-hover:ring-pink-500/80 shadow-md transition-all flex items-center justify-center overflow-hidden">
                        <img
                          src={dicebearAvatar}
                          alt={`${anime.title} EP ${ep}`}
                          className="w-full h-full rounded-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {isPlaying ? (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-pink-500 text-white rounded-full p-0.5 ring-2 ring-zinc-900 animate-pulse shadow-sm z-10">
                        <Play className="w-2.5 h-2.5 fill-current" />
                      </div>
                    ) : (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-zinc-800 text-zinc-200 text-[8px] font-mono font-extrabold px-1 py-0.2 rounded-full border border-zinc-900 shadow-xs z-10">
                        {ep}
                      </span>
                    )}
                  </div>

                  {/* Comment Body */}
                  <div className="flex-1 min-w-0">
                    {/* Title format: Anime Title (EP X) + Verified Checkmark */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-zinc-100 group-hover:text-pink-400 transition-colors flex items-center gap-1">
                        <span>{anime.title} (EP {ep})</span>
                        <span
                          title="Verified"
                          className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-sky-400 shrink-0 shadow-xs"
                        >
                          <Check className="w-2 h-2 text-white stroke-[3.5]" />
                        </span>
                      </span>

                      {isPlaying && (
                        <span className="text-[9px] bg-pink-500 text-white px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider flex items-center gap-0.5 shadow-xs border border-pink-400/40">
                          <CheckCircle2 className="w-2.5 h-2.5 text-white stroke-[3]" />
                          PLAYING
                        </span>
                      )}

                      {isLatest && !isPlaying && (
                        <span className="text-[9px] bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider">
                          LATEST
                        </span>
                      )}

                      {(meta?.isFiller || ep % 5 === 0) && (
                        <span className="text-[9px] bg-amber-500 text-black font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm animate-pulse">
                          <span>SKIP FILLER</span>
                          <span className="text-[8px]">⏭️</span>
                        </span>
                      )}
                    </div>

                    {/* Episode Title subtitle if available */}
                    {meta?.title && (
                      <div className="text-[11px] font-semibold text-zinc-300 mt-0.5">
                        "{epTitle}"
                      </div>
                    )}

                    {/* Description Comment Text */}
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed break-words select-text">
                      {epDescription}
                    </p>

                    {/* Attached Media Thumbnail with Skeleton Loader & Poster Fallback */}
                    <EpisodeThumbnail
                      src={meta?.image}
                      fallbackPoster={anime.poster}
                      alt={epTitle}
                      isPlaying={isPlaying}
                      ep={ep}
                      duration={meta?.duration ? `${meta.duration}` : undefined}
                      rating={meta?.rating}
                      isLoadingMetadata={loadingMetadata}
                      onClick={() => {
                        onSelectEp(ep);
                        onClose();
                      }}
                    />

                    {/* Date Below the Thumbnail */}
                    <div className="mt-1.5 text-[10px] text-zinc-400 font-mono flex items-center gap-1.5 select-none">
                      <span className="text-pink-400">📅</span>
                      <span>Release: {meta?.airDate || 'Oct 20, 1999'}</span>
                    </div>

                    {/* Comment Action Footer: Quick jump & play */}
                    <div className="flex items-center gap-4 mt-2.5 text-[11px] text-zinc-500">
                      <button
                        onClick={() => {
                          onSelectEp(ep);
                          onClose();
                        }}
                        className={`font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                          isPlaying ? 'text-pink-400 font-bold' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {isPlaying ? 'Now Playing' : 'Play Episode'}
                      </button>

                      <button
                        onClick={() => {
                          setSearchText(`${ep}`);
                          setHighlightedEp(ep);
                          const el = episodeRefs.current[ep];
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="hover:text-zinc-300 cursor-pointer transition-colors flex items-center gap-1 text-[10px]"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        Focus EP {ep}
                      </button>
                    </div>
                  </div>

                  {/* Like Button (TikTok Style on Right with 1px Shaded Border) */}
                  <button
                    onClick={() => toggleEpisodeLike(ep, baseLikes)}
                    className="flex flex-col items-center justify-center p-2 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-pink-500/40 text-zinc-400 hover:text-pink-500 shrink-0 cursor-pointer transition-all active:scale-110 select-none shadow-xs"
                    title="Like Episode"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        likeState.isLiked ? 'fill-pink-500 text-pink-500 animate-pulse' : 'text-zinc-400'
                      }`}
                    />
                    <span className="text-[10px] text-zinc-400 mt-0.5 font-mono font-bold">{likeState.likes}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Pagination Prev/Next Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-950/80 border-t border-zinc-800/80 shrink-0 text-xs select-none">
            <button
              id={`btn-ep-prev-page-${anime.id}`}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={activePage === 1}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700 font-bold cursor-pointer transition-all flex items-center gap-1 active:scale-95"
            >
              <span>◀</span>
              <span>Prev</span>
            </button>
            <span className="text-zinc-400 font-mono text-[11px] font-semibold">
              Page <strong className="text-pink-400 font-black">{activePage}</strong> of {totalPages}
            </span>
            <button
              id={`btn-ep-next-page-${anime.id}`}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={activePage === totalPages}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700 font-bold cursor-pointer transition-all flex items-center gap-1 active:scale-95"
            >
              <span>Next</span>
              <span>▶</span>
            </button>
          </div>
        )}

        {/* Search / Jump Episode Input Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="p-3 border-t border-zinc-800 bg-zinc-900/95 flex items-center gap-2.5 shrink-0"
        >
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 shrink-0 flex items-center justify-center text-pink-400 shadow-sm">
            <Search className="w-4 h-4" />
          </div>
          <input
            id={`input-search-episodes-${anime.id}`}
            type="text"
            placeholder="Search or enter episode # to highlight & jump (e.g. 5)..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-1 bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-500 px-3.5 py-2.5 rounded-full border border-zinc-800 focus:outline-none focus:border-pink-500/50"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => {
                setSearchText('');
                setHighlightedEp(null);
              }}
              className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={!searchText.trim()}
            className="px-3.5 py-2 rounded-full bg-pink-500 hover:bg-pink-600 disabled:opacity-40 flex items-center justify-center text-white text-xs font-bold active:scale-90 transition-transform shadow-xs cursor-pointer shrink-0 gap-1"
            title="Search and Highlight Episode"
          >
            <span>Jump</span>
          </button>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const mountTarget =
    (typeof document !== 'undefined' && document.fullscreenElement) ||
    (typeof document !== 'undefined' && document.body) ||
    null;
  if (!mountTarget) return drawerContent;

  return createPortal(drawerContent, mountTarget);
};

