import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Flame, Star, Play, Loader2, Sparkles, Compass } from 'lucide-react';
import { AnimeItem, AnimeEpisodeMetadata, getLatestEpisode } from '../types/anime';
import { searchAnimeOnApi, fetchAnimeByGenreOnApi, fetchAnimeEpisodesMetadata } from '../services/animeApi';
import { BottomNav } from './BottomNav';
import { GradientCircleSpinner } from './LazyLoadSkeleton';

interface SearchViewProps {
  allAnime: AnimeItem[];
  isOpen: boolean;
  onClose: () => void;
  onSelectAnime: (anime: AnimeItem, episode?: number) => void;
  initialGenre?: string | null;
  currentNav?: 'home' | 'explore' | 'history' | 'profile';
  onChangeNav?: (nav: 'home' | 'explore' | 'history' | 'profile') => void;
  onOpenUpload?: () => void;
  isAuthenticated?: boolean;
  userProfile?: any;
  onRequireAuth?: () => void;
}

const GENRE_TAGS = [
  'Action',
  'Fantasy',
  'Comedy',
  'Romance',
  'Drama',
  'Adventure',
  'School',
  'Sci-Fi',
  'Mystery',
  'Supernatural',
  'Sports',
  'Mecha',
  'Horror',
  'Thriller',
  'Slice of Life',
  'Historical',
  'Dementia',
  'Shounen',
  'Harem',
  'Music',
  'Isekai',
  'Seinen',
  'Shoujo',
  'Super Power',
  'Ecchi'
];

export const SearchView: React.FC<SearchViewProps> = ({
  allAnime,
  isOpen,
  onClose,
  onSelectAnime,
  initialGenre = null,
  currentNav = 'explore',
  onChangeNav,
  onOpenUpload,
  isAuthenticated,
  userProfile,
  onRequireAuth,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(initialGenre);
  const [results, setResults] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Refs for Lazy Loader and Scrolling
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loaderSentinelRef = useRef<HTMLDivElement>(null);

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Filter/Sort states
  const [subDubFilter, setSubDubFilter] = useState<'all' | 'sub' | 'dub'>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'none' | 'atoz' | 'ztoa' | 'score'>('none');

  // Detail Modal states
  const [selectedDetailAnime, setSelectedDetailAnime] = useState<AnimeItem | null>(null);
  const [episodesMetadata, setEpisodesMetadata] = useState<AnimeEpisodeMetadata[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedDetailAnime) {
      setEpisodesMetadata([]);
      return;
    }
    
    let active = true;
    const aniId = selectedDetailAnime.ani_id || selectedDetailAnime.mal_id || selectedDetailAnime.id;
    
    setLoadingEpisodes(true);
    fetchAnimeEpisodesMetadata(aniId)
      .then((data) => {
        if (active) {
          setEpisodesMetadata(data || []);
          setLoadingEpisodes(false);
        }
      })
      .catch((err) => {
        console.error('Error fetching episodes metadata:', err);
        if (active) {
          setLoadingEpisodes(false);
        }
      });
      
    return () => {
      active = false;
    };
  }, [selectedDetailAnime]);

  useEffect(() => {
    if (isOpen) {
      setSelectedGenre(initialGenre);
      // If we are given an initial genre, reset query to prevent conflicting filters
      if (initialGenre) {
        setQuery('');
      }
      // Reset filter options upon open
      setSubDubFilter('all');
      setMinRating(0);
      setSortBy('none');
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [initialGenre, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    async function handleSearchAndGenre() {
      // If neither is selected, default to the initial static feed list
      if (!query.trim() && !selectedGenre) {
        setResults(allAnime);
        setLoading(false);
        setPage(1);
        setHasMore(false);
        return;
      }

      setLoading(true);
      setPage(1);
      setHasMore(true);

      try {
        if (selectedGenre) {
          // If genre is selected, query the live genre API (page 1)
          const genreResults = await fetchAnimeByGenreOnApi(selectedGenre, 1);
          if (!active) return;
          
          if (query.trim()) {
            // Filter genre results locally by query if user has entered one
            const filtered = genreResults.filter(a => 
              a.title.toLowerCase().includes(query.toLowerCase()) || 
              (a.description && a.description.toLowerCase().includes(query.toLowerCase()))
            );
            setResults(filtered);
          } else {
            setResults(genreResults);
          }
          setHasMore(genreResults.length >= 8);
        } else {
          // Query the live search API
          const searchResults = await searchAnimeOnApi(query);
          if (!active) return;
          setResults(searchResults);
          setHasMore(false);
        }
      } catch (err) {
        console.error('[SearchView API error]', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    // Debounce query search if no genre is selected to prevent excessive network spam
    const delay = query.trim() && !selectedGenre ? 350 : 0;
    const timer = setTimeout(() => {
      handleSearchAndGenre();
    }, delay);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, selectedGenre, isOpen, allAnime]);

  const handleLoadMore = useCallback(async () => {
    if (!selectedGenre || loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const nextResults = await fetchAnimeByGenreOnApi(selectedGenre, nextPage);
      if (nextResults.length > 0) {
        setResults((prev) => {
          // Prevent duplicates by checking id
          const existingIds = new Set(prev.map((x) => x.id));
          const uniqueNew = nextResults.filter((x) => !existingIds.has(x.id));
          return [...prev, ...uniqueNew];
        });
        setPage(nextPage);
        setHasMore(nextResults.length >= 8);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more genre results:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [selectedGenre, loadingMore, hasMore, loading, page]);

  // Infinite Scroll / Lazy Load Intersection Observer
  useEffect(() => {
    if (!isOpen || !selectedGenre || !hasMore || loadingMore || loading) return;

    const sentinel = loaderSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          handleLoadMore();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '300px', // trigger prefetch 300px before reaching bottom
        threshold: 0.05,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [isOpen, selectedGenre, hasMore, loadingMore, loading, handleLoadMore]);

  const handleGenreToggle = (genre: string | null) => {
    if (!isAuthenticated && onRequireAuth) {
      onRequireAuth();
      return;
    }
    setSelectedGenre((prev) => (prev === genre ? null : genre));
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Compute filtered & sorted results dynamically
  const filteredResults = React.useMemo(() => {
    let list = [...results];

    // 1. Filter by Sub / Dub
    if (subDubFilter === 'sub') {
      list = list.filter(item => item.is_sub !== undefined && item.is_sub > 0);
    } else if (subDubFilter === 'dub') {
      list = list.filter(item => item.is_dub !== undefined && item.is_dub > 0);
    }

    // 2. Filter by Rating Score
    if (minRating > 0) {
      list = list.filter(item => {
        const scoreVal = parseFloat(item.score);
        return !isNaN(scoreVal) && scoreVal >= minRating;
      });
    }

    // 3. Sort Order
    if (sortBy === 'atoz') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'ztoa') {
      list.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === 'score') {
      list.sort((a, b) => {
        const scoreA = parseFloat(a.score) || 0;
        const scoreB = parseFloat(b.score) || 0;
        return scoreB - scoreA;
      });
    }

    return list;
  }, [results, subDubFilter, minRating, sortBy]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-45 bg-zinc-950/98 backdrop-blur-2xl flex flex-col p-3 sm:p-4 pb-16 sm:pb-20 animate-fade-in text-zinc-200">
      <div className="max-w-7xl mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Search Header */}
        <div className="flex items-center gap-3 pt-2 pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex-1 relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search anime title, genres, tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 pl-9 pr-8 py-2.5 rounded-2xl border border-zinc-800 focus:outline-none focus:border-pink-500/50 transition-colors"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 text-zinc-400 hover:text-zinc-200 p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors bg-zinc-900/60 hover:bg-zinc-800 rounded-xl border border-zinc-800/80 cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Genre Filter Pills */}
        <div className="py-2.5 flex gap-2 overflow-x-auto no-scrollbar border-b border-zinc-850 shrink-0 select-none">
          <button
            onClick={() => handleGenreToggle(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              selectedGenre === null
                ? 'bg-zinc-700 text-zinc-100 shadow-xs'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            All Genres
          </button>
          {GENRE_TAGS.map((g) => (
            <button
              key={g}
              onClick={() => handleGenreToggle(g)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1 ${
                selectedGenre === g
                  ? 'bg-pink-500 text-white font-bold shadow-md shadow-pink-500/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <span>#{g}</span>
            </button>
          ))}
        </div>

        {/* Advanced Filter & Sorting Panel */}
        <div className="py-2 px-1 border-b border-zinc-900 flex flex-wrap gap-x-4 gap-y-2 items-center text-xs text-zinc-400 select-none bg-zinc-950 shrink-0">
          {/* Audio (Sub/Dub) Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500">Audio:</span>
            <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
              {(['all', 'sub', 'dub'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSubDubFilter(type)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase transition-all ${
                    subDubFilter === type
                      ? 'bg-pink-500 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Min Score Rating Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500">Rating:</span>
            <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
              {([0, 7.0, 8.0, 8.5] as const).map((scoreVal) => (
                <button
                  key={scoreVal}
                  onClick={() => setMinRating(scoreVal)}
                  className={`px-2 py-1 rounded-md text-[10px] font-extrabold transition-all ${
                    minRating === scoreVal
                      ? 'bg-amber-550 text-amber-300 font-black'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {scoreVal === 0 ? 'All' : `${scoreVal}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Alphabetical & Score Sorter */}
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-zinc-500">Sort:</span>
            <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
              {([
                { id: 'none', label: 'Default' },
                { id: 'atoz', label: 'A-Z' },
                { id: 'ztoa', label: 'Z-A' },
                { id: 'score', label: 'Rating' },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold transition-all ${
                    sortBy === opt.id
                      ? 'bg-zinc-850 text-zinc-100 font-black border border-zinc-700/50'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Grid with Infinite Scroll & Lazy Loader */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto py-4 pr-0.5 overscroll-contain">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              {loading ? (
                <span>Fetching {selectedGenre ? `#${selectedGenre}` : 'streams'}...</span>
              ) : (
                <span>
                  {filteredResults.length} {selectedGenre ? `#${selectedGenre} ` : ''}Anime Streams Found
                </span>
              )}
            </div>
            {loading && <Loader2 className="w-4 h-4 text-pink-500 animate-spin" />}
          </div>

          {filteredResults.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
              <span className="text-3xl">🔍</span>
              <p className="text-sm font-semibold text-zinc-400">No matching streams found.</p>
              <p className="text-xs text-zinc-500">Try adjusting your search query, genre, or audio/rating filters.</p>
              {(subDubFilter !== 'all' || minRating > 0 || sortBy !== 'none') && (
                <button
                  onClick={() => {
                    setSubDubFilter('all');
                    setMinRating(0);
                    setSortBy('none');
                  }}
                  className="mt-4 px-4 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-850 text-xs font-bold transition-all cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Responsive Grid: up to 6 per row in widescreen displays */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredResults.map((anime) => (
                  <div
                    key={anime.id}
                    onClick={() => {
                      setSelectedDetailAnime(anime);
                    }}
                    className="group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800/90 cursor-pointer hover:border-zinc-700 transition-all active:scale-[0.98] animate-fade-in flex flex-col justify-between"
                  >
                    <div className="aspect-[3/4] relative overflow-hidden bg-zinc-950">
                      <img
                        src={anime.poster}
                        alt={anime.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-80" />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-amber-300 flex items-center gap-0.5 shadow-sm">
                        <Star className="w-3 h-3 fill-amber-400" /> {anime.score || '7.5'}
                      </div>
                      {anime.is_dub !== undefined && anime.is_dub > 0 && (
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-pink-500 text-[9px] font-black text-white uppercase tracking-wider select-none shadow-sm">
                          DUB
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-lg shadow-pink-500/30 transform group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 flex flex-col justify-between">
                      <h4 className="text-xs font-semibold text-zinc-100 truncate group-hover:text-pink-300 transition-colors" title={anime.title}>
                        {anime.title}
                      </h4>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                        {anime.episodes ? `${anime.episodes} Eps` : 'Ongoing'} • {anime.rating || 'PG-13'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Lazy Loader Skeleton Stream Cards when fetching more */}
              {loadingMore && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3 sm:gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={`skeleton-${idx}`}
                      className="bg-zinc-900/60 rounded-2xl overflow-hidden border border-zinc-800/60 animate-pulse flex flex-col"
                    >
                      <div className="aspect-[3/4] bg-zinc-800/40 relative flex items-center justify-center">
                        <GradientCircleSpinner size="sm" />
                      </div>
                      <div className="p-2.5 space-y-2">
                        <div className="h-3 bg-zinc-800/70 rounded w-4/5" />
                        <div className="h-2 bg-zinc-800/40 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Infinite Scroll Sentinel */}
              {selectedGenre && hasMore && filteredResults.length > 0 && (
                <div
                  ref={loaderSentinelRef}
                  className="w-full py-6 flex flex-col items-center justify-center text-xs text-zinc-400 gap-2 min-h-[60px]"
                >
                  <GradientCircleSpinner size="sm" />
                  <span className="text-[11px] font-medium text-zinc-500">
                    {loadingMore ? 'Loading more anime...' : 'Scroll down to lazy load more streams'}
                  </span>
                </div>
              )}

              {/* End of results indicator */}
              {selectedGenre && !hasMore && filteredResults.length > 0 && !loading && (
                <div className="w-full py-8 text-center text-xs text-zinc-500 font-medium flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400/70" />
                  <span>You&apos;ve reached the end of #{selectedGenre} streams</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Immersive Info & Episode Picker Dialog Overlay */}
      {selectedDetailAnime && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up text-left">
            {/* Modal Header */}
            <div className="flex justify-between items-start gap-4 mb-4 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-black text-zinc-100 line-clamp-2 leading-snug">
                  {selectedDetailAnime.title}
                </h3>
                {selectedDetailAnime.alternative && (
                  <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1 italic font-medium">
                    {selectedDetailAnime.alternative}
                  </p>
                )}
              </div>
              <button 
                onClick={() => setSelectedDetailAnime(null)}
                className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-90 shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 no-scrollbar">
              {/* Cover & General Metadata */}
              <div className="flex gap-4 items-start">
                <div className="w-24 sm:w-28 aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 shadow-lg relative">
                  <img 
                    src={selectedDetailAnime.poster} 
                    alt={selectedDetailAnime.title} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer" 
                  />
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] font-bold text-amber-300 flex items-center gap-0.5">
                    ★ {selectedDetailAnime.score || '7.5'}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 text-[11px] text-zinc-300">
                  {selectedDetailAnime.rating && (
                    <div>
                      <span className="text-zinc-500 font-extrabold text-[9px] uppercase tracking-wider block">Rating</span>
                      <span className="font-semibold text-zinc-200">{selectedDetailAnime.rating}</span>
                    </div>
                  )}
                  {selectedDetailAnime.status && (
                    <div>
                      <span className="text-zinc-500 font-extrabold text-[9px] uppercase tracking-wider block">Status</span>
                      <span className="font-semibold text-zinc-200">{selectedDetailAnime.status}</span>
                    </div>
                  )}
                  {selectedDetailAnime.duration && (
                    <div>
                      <span className="text-zinc-500 font-extrabold text-[9px] uppercase tracking-wider block">Duration</span>
                      <span className="font-semibold text-zinc-200">{selectedDetailAnime.duration}</span>
                    </div>
                  )}
                  {(selectedDetailAnime.season || selectedDetailAnime.year) && (
                    <div>
                      <span className="text-zinc-500 font-extrabold text-[9px] uppercase tracking-wider block">Season</span>
                      <span className="font-semibold text-zinc-200 capitalize">
                        {selectedDetailAnime.season || 'Fall'} {selectedDetailAnime.year || '2023'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description / Synopsis */}
              {selectedDetailAnime.description && (
                <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-850">
                  <span className="text-zinc-500 font-extrabold text-[9px] uppercase tracking-wider block mb-1">Synopsis</span>
                  <p className="text-[11px] text-zinc-300 leading-relaxed max-h-24 overflow-y-auto no-scrollbar">
                    {selectedDetailAnime.description.replace(/<[^>]*>/g, '')}
                  </p>
                </div>
              )}

              {/* Episodes Segment */}
              <div className="mt-1">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-zinc-400 font-extrabold text-[10px] uppercase tracking-wider">
                    Select Episode
                  </span>
                  <span className="text-[9px] text-zinc-400 font-bold bg-zinc-800 px-2 py-0.5 rounded-full">
                    {episodesMetadata.length > 0 ? episodesMetadata.length : getLatestEpisode(selectedDetailAnime)} Episodes
                  </span>
                </div>

                {/* Skeletons Lazy Loader */}
                {loadingEpisodes ? (
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="animate-pulse flex flex-col gap-1.5 bg-zinc-950/30 p-1.5 rounded-xl border border-zinc-850/50">
                        <div className="aspect-[16/10] bg-zinc-800/80 rounded-lg" />
                        <div className="h-2.5 bg-zinc-800 rounded w-2/3 mx-auto mt-1" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {/* Render episodes using fetched metadata, or generate list from episode totals */}
                    {(episodesMetadata.length > 0 
                      ? episodesMetadata.map(ep => ep.number) 
                      : Array.from({ length: getLatestEpisode(selectedDetailAnime) }, (_, i) => i + 1)
                    ).map((epNum) => {
                      const epMeta = episodesMetadata.find(e => e.number === epNum);
                      return (
                        <button
                          key={epNum}
                          onClick={() => {
                            if (!isAuthenticated && onRequireAuth) {
                              onRequireAuth();
                              return;
                            }
                            onSelectAnime(selectedDetailAnime, epNum);
                            setSelectedDetailAnime(null);
                            onClose();
                          }}
                          className="group flex flex-col p-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 hover:border-pink-500 transition-all cursor-pointer text-center relative overflow-hidden text-zinc-200"
                        >
                          {epMeta?.image ? (
                            <div className="w-full aspect-[16/10] rounded-lg overflow-hidden mb-1 relative bg-zinc-900 shrink-0">
                              <img src={epMeta.image} alt={`Ep ${epNum}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-3.5 h-3.5 fill-white text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-full aspect-[16/10] bg-zinc-900 rounded-lg mb-1 flex items-center justify-center text-zinc-600 font-bold shrink-0">
                              <span>EP {epNum}</span>
                            </div>
                          )}
                          <span className="text-[11px] font-extrabold text-zinc-200 mt-0.5">Episode {epNum}</span>
                          {epMeta?.title && (
                            <span className="text-[9px] text-zinc-400 font-medium truncate w-full mt-0.5 max-w-full">
                              {epMeta.title}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      {onChangeNav && (
        <BottomNav
          currentNav={currentNav}
          onChangeNav={(nav) => {
            if (nav !== 'explore') {
              onClose();
            }
            onChangeNav(nav);
          }}
          onOpenUpload={onOpenUpload || (() => {})}
          isAuthenticated={isAuthenticated}
          userProfile={userProfile}
        />
      )}
    </div>
  );
};
