import React, { useState, useEffect, useRef, useMemo } from 'react';
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

const EpisodeThumbnail: React.FC<EpisodeThumbnailProps> = React.memo(({
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
      className="mt-2.5 relative max-w-xs sm:max-w-sm rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 group/thumb hover:border-pink-500/60 cursor-pointer shadow-md transition-all active:scale-[0.98]"
    >
      <div className="aspect-video w-full relative bg-zinc-950">
        {(!imageLoaded || isLoadingMetadata) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-1.5 pointer-events-none">
            <div className="w-5 h-5 rounded-full border-2 border-pink-500 border-t-transparent animate-spin drop-shadow-sm" />
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
          className={`w-full h-full object-cover group-hover/thumb:scale-105 transition-opacity duration-200 ${
            imageLoaded && !isLoadingMetadata ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? 'bg-pink-500 text-white scale-110 shadow-lg shadow-pink-500/50'
                : 'bg-black/70 text-white group-hover/thumb:scale-110 group-hover/thumb:bg-pink-500'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Pill Badge for Duration & Rating */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
          <span className="px-2 py-0.5 rounded-md bg-black/90 text-[10px] font-bold text-white font-mono border border-zinc-800">
            EP {ep}
          </span>
          {duration && (
            <span className="px-1.5 py-0.5 rounded-md bg-black/80 text-[9px] text-zinc-300 font-mono">
              {duration}m
            </span>
          )}
          {rating && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-950/90 text-[9px] text-amber-300 font-mono border border-amber-500/30">
              ★ {rating}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

EpisodeThumbnail.displayName = 'EpisodeThumbnail';

const avatarBgGradients = [
  'from-pink-500 to-rose-600',
  'from-purple-500 to-indigo-600',
  'from-cyan-500 to-blue-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-fuchsia-500 to-pink-600',
];

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
  const latestEp = useMemo(() => getLatestEpisode(anime), [anime]);
  const totalEpCount = latestEp > 0 ? latestEp : (parsedTotal > 0 ? parsedTotal : (metadataList.length > 0 ? metadataList.length : 1));
  const maxEpCount = totalEpCount;

  const episodeNumbers = useMemo(() => Array.from({ length: maxEpCount }, (_, i) => i + 1), [maxEpCount]);

  // Map metadata by episode number for fast lookup
  const metadataByEpNumber = useMemo(() => {
    const map = new Map<number, AnimeEpisodeMetadata>();
    metadataList.forEach((ep) => {
      if (typeof ep.number === 'number') {
        map.set(ep.number, ep);
      }
    });
    return map;
  }, [metadataList]);

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

    const match = query.match(/(?:ep(?:isode)?\s*)?(\d+)/i);
    let targetEp: number | null = null;

    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= maxEpCount) {
        targetEp = num;
      }
    }

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

  const cleanSearchQuery = searchText.trim().toLowerCase();
  const isDirectNumber = /^(\d+|ep\s*\d+|episode\s*\d+)$/i.test(cleanSearchQuery);

  const displayedEpisodeNumbers = useMemo(() => {
    if (cleanSearchQuery && !isDirectNumber) {
      return episodeNumbers.filter((ep) => {
        const meta = metadataByEpNumber.get(ep);
        const titleMatch = meta?.title?.toLowerCase().includes(cleanSearchQuery);
        const descMatch = meta?.description?.toLowerCase().includes(cleanSearchQuery);
        const numMatch = `ep ${ep}`.includes(cleanSearchQuery) || `${ep}` === cleanSearchQuery;
        return titleMatch || descMatch || numMatch;
      });
    }
    return episodeNumbers;
  }, [cleanSearchQuery, isDirectNumber, episodeNumbers, metadataByEpNumber]);

  const totalPages = Math.max(1, Math.ceil(displayedEpisodeNumbers.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * PAGE_SIZE;
  const paginatedEpisodeNumbers = useMemo(
    () => displayedEpisodeNumbers.slice(startIndex, startIndex + PAGE_SIZE),
    [displayedEpisodeNumbers, startIndex, PAGE_SIZE]
  );

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={`episodes-drawer-${anime.id}`}
          key="episodes-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80"
          onClick={onClose}
        >
          <motion.div
            key="episodes-drawer-sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="w-full max-w-lg mx-auto h-[84vh] sm:h-[80vh] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-1 mt-3 shrink-0" />

            {/* Header */}
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-zinc-100 flex items-center gap-1.5">
                  <span>Episodes</span>
                  <span className="text-xs font-mono font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
                    {displayedEpisodeNumbers.length} / {maxEpCount}
                  </span>
                </h3>
                {loadingMetadata && (
                  <span className="text-[10px] text-pink-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 animate-spin" />
                    Syncing info...
                  </span>
                )}
              </div>

              <button
                id={`btn-close-episodes-${anime.id}`}
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors shrink-0 cursor-pointer active:scale-90 border border-zinc-800"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Range Pagination Selector Bar */}
            {totalPages > 1 && (
              <div className="px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
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
                          ? 'bg-pink-500 text-white shadow-md shadow-pink-500/30'
                          : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700'
                      }`}
                    >
                      {rangeStart}-{rangeEnd}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Episode Comments List */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4 divide-y divide-zinc-800/60">
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
                  const epTitle = meta?.title ? meta.title : `Episode ${ep}`;
                  const epDescription =
                    meta?.description ||
                    (meta
                      ? 'No description available for this episode.'
                      : `${anime.title} - Episode ${ep} official release.`);

                  const gradHex = avatarBgGradients[(ep - 1) % avatarBgGradients.length];
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
                      className={`flex gap-3 items-start pt-3.5 first:pt-0 group transition-colors rounded-2xl ${
                        isHighlighted
                          ? 'bg-pink-500/20 p-3 -mx-2.5 ring-2 ring-pink-500 shadow-lg'
                          : isPlaying
                          ? 'bg-pink-950/30 p-2.5 -mx-2.5 border border-pink-500/30'
                          : ''
                      }`}
                    >
                      {/* Episode Initial Avatar Badge */}
                      <div className="relative shrink-0">
                        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr ${gradHex} text-white font-extrabold font-mono text-xs shadow-md flex items-center justify-center shrink-0 ring-2 ring-zinc-800`}>
                          E{ep}
                        </div>

                        {isPlaying ? (
                          <div className="absolute -bottom-0.5 -right-0.5 bg-pink-500 text-white rounded-full p-0.5 ring-2 ring-zinc-900 shadow-sm z-10">
                            <Play className="w-2.5 h-2.5 fill-current" />
                          </div>
                        ) : (
                          <span className="absolute -bottom-0.5 -right-0.5 bg-zinc-900 text-zinc-300 text-[8px] font-mono font-extrabold px-1 py-0.2 rounded-full border border-zinc-800 z-10">
                            {ep}
                          </span>
                        )}
                      </div>

                      {/* Comment Body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-zinc-100 group-hover:text-pink-400 transition-colors flex items-center gap-1">
                            <span>{anime.title}</span>
                            <span
                              title="Verified"
                              className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-sky-400 shrink-0 shadow-xs"
                            >
                              <Check className="w-2 h-2 text-white stroke-[3.5]" />
                            </span>
                          </span>

                          {isPlaying && (
                            <span className="text-[9px] bg-pink-500 text-white px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider flex items-center gap-0.5 border border-pink-400/40">
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
                            <span className="text-[9px] bg-amber-500/90 text-black font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                              <span>SKIP FILLER</span>
                              <span className="text-[8px]">⏭️</span>
                            </span>
                          )}
                        </div>

                        {meta?.title && (
                          <div className="text-[11px] font-semibold text-zinc-300 mt-0.5">
                            "{epTitle}"
                          </div>
                        )}

                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed break-words select-text">
                          {epDescription}
                        </p>

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

                      {/* Like Button */}
                      <button
                        onClick={() => toggleEpisodeLike(ep, baseLikes)}
                        className="flex flex-col items-center justify-center p-2 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/40 text-zinc-400 hover:text-pink-500 shrink-0 cursor-pointer transition-all active:scale-110 select-none shadow-xs"
                        title="Like Episode"
                      >
                        <Heart
                          className={`w-4 h-4 transition-colors ${
                            likeState.isLiked ? 'fill-pink-500 text-pink-500' : 'text-zinc-400'
                          }`}
                        />
                        <span className="text-[10px] text-zinc-400 mt-0.5 font-mono font-bold">{likeState.likes}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-t border-zinc-800 shrink-0 text-xs select-none">
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

            {/* Search Bar */}
            <form
              onSubmit={handleSearchSubmit}
              className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center gap-2.5 shrink-0"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center text-pink-400 shadow-sm">
                <Search className="w-4 h-4" />
              </div>
              <input
                id={`input-search-episodes-${anime.id}`}
                type="text"
                placeholder="Search or enter episode # to highlight & jump (e.g. 5)..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="flex-1 bg-zinc-900 text-xs text-zinc-200 placeholder-zinc-500 px-3.5 py-2 rounded-full border border-zinc-800 focus:outline-none focus:border-pink-500/50"
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
