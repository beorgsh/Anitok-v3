import React, { useEffect, useState, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { fetchUserDataFromFirebase, syncLikesToFirebase } from './lib/firebaseStore';
import { getCachedUserProfile, saveCachedUserProfile } from './lib/cookies';
import { AnimeItem, ServerType, SubtitleSettings, getLatestEpisode } from './types/anime';
import { setWatchHistory, getWatchHistory } from './services/watchHistory';
import { fetchRecentAnime, prefetchAnimeStreams } from './services/animeApi';
import { VideoPlayer } from './components/VideoPlayer';
import { SidebarActions } from './components/SidebarActions';
import { VideoInfoOverlay } from './components/VideoInfoOverlay';
import { TopHeader, TopHeaderHandle } from './components/TopHeader';
import { BottomNav, ActiveProgressData } from './components/BottomNav';
import { EpisodesDrawer } from './components/EpisodesDrawer';
import { ShareDrawer } from './components/ShareDrawer';
import { SubtitleSettingsModal } from './components/SubtitleSettingsModal';
import { ProfileView } from './components/ProfileView';
import { SearchView } from './components/SearchView';
import { HistoryView } from './components/HistoryView';
import { UploadModal } from './components/UploadModal';
import { AuthModal } from './components/AuthModal';
import { ProfileSetupModal } from './components/ProfileSetupModal';
import { AccountModal } from './components/AccountModal';
import { LazyLoadSkeleton } from './components/LazyLoadSkeleton';
import { InstallPWAModal } from './components/InstallPWAModal';
import { RefreshCw, Heart, Bookmark, Trash2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

type TabType = 'following' | 'foryou' | 'latest' | 'reels';
const TABS: TabType[] = ['following', 'foryou', 'latest', 'reels'];

interface TabFeedState {
  items: AnimeItem[];
  activeIndex: number;
  loading: boolean;
  isPrefetching: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  visitedPages: Set<number>;
}

export default function App() {
  // Navigation & Tab state
  const [activeTab, setActiveTab] = useState<TabType>('foryou');
  const [currentNav, setCurrentNav] = useState<'home' | 'explore' | 'history' | 'profile'>('home');
  const [server, setServer] = useState<ServerType>('hd-2');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Per-tab feed states
  const [tabFeeds, setTabFeeds] = useState<Record<TabType, TabFeedState>>({
    following: { items: [], activeIndex: 0, loading: false, isPrefetching: false, error: null, page: 1, totalPages: 1, visitedPages: new Set() },
    foryou: { items: [], activeIndex: 0, loading: true, isPrefetching: false, error: null, page: 1, totalPages: 1, visitedPages: new Set() },
    latest: { items: [], activeIndex: 0, loading: false, isPrefetching: false, error: null, page: 1, totalPages: 1, visitedPages: new Set() },
    reels: { items: [], activeIndex: 0, loading: false, isPrefetching: false, error: null, page: 1, totalPages: 1, visitedPages: new Set() },
  });

  // User interactions: likes, saves, selected episodes, and dub settings
  const [epMap, setEpMap] = useState<Record<number, number>>({});
  const [initialStartTimeMap, setInitialStartTimeMap] = useState<Record<number, number>>({});

  // Persisted liked state & hearted anime items for the Following tab
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem('anime_liked_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [savedLikedItems, setSavedLikedItems] = useState<Record<number, AnimeItem>>(() => {
    try {
      const saved = localStorage.getItem('anime_hearted_items');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [likeCountMap, setLikeCountMap] = useState<Record<number, number>>({});

  const [savedMap, setSavedMap] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem('anime_saved_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [saveCountMap, setSaveCountMap] = useState<Record<number, number>>({});

  const [globalDub, setGlobalDub] = useState<boolean>(false);

  const handleToggleDub = useCallback((checked: boolean) => {
    setGlobalDub(checked);
  }, []);

  // Track loaded subtitle status per anime ID
  const [subtitlesLoadedMap, setSubtitlesLoadedMap] = useState<Record<number, boolean>>({});

  // Comprehensive Subtitle Settings State
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => {
    const defaults: SubtitleSettings = {
      visible: true,
      size: 14,
      heightPosition: 12,
      borderRadius: 8,
      backgroundColor: '#000000',
      bgOpacity: 85,
      color: 'white',
      syncOffset: 0,
    };
    try {
      const saved = localStorage.getItem('anime_subtitle_settings');
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return defaults;
  });

  const handleUpdateSubtitleSettings = useCallback((updated: Partial<SubtitleSettings>) => {
    setSubtitleSettings((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('anime_subtitle_settings', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  // PWA Install Prompt state & logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaModal, setShowPwaModal] = useState<boolean>(false);
  const videoViewCounterRef = useRef<number>(0);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        console.log('User signed in, syncing from Firebase...', user.uid);
        const data = await fetchUserDataFromFirebase();
        
        // Replace Likes (Clear local, load from cloud)
        const newLikedMap: Record<number, boolean> = {};
        const newSavedItems: Record<number, AnimeItem> = {};
        if (data && data.likes && Array.isArray(data.likes)) {
          data.likes.forEach((item) => {
            newLikedMap[item.id] = true;
            newSavedItems[item.id] = item;
          });
        }
        setLikedMap(newLikedMap);
        setSavedLikedItems(newSavedItems);

        // Replace History (Clear local, load from cloud)
        if (data && data.history && Array.isArray(data.history)) {
          setWatchHistory(data.history);
        } else {
          setWatchHistory([]);
        }

        // Check if Profile exists
        if (!data || !data.profile) {
          const cached = getCachedUserProfile();
          if (cached) {
            setUserProfile(cached);
          } else {
            setIsProfileSetupOpen(true);
          }
        } else {
          setUserProfile(data.profile);
          saveCachedUserProfile(data.profile);
        }

      } else {
        setIsAuthenticated(false);
        setUserProfile(getCachedUserProfile());
        setIsProfileSetupOpen(false);
        setIsAccountModalOpen(false);
        setCurrentNav('home');
        setActiveTab('foryou');
      }
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      unsubscribe();
    };
  }, []);

  // Save liked state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('anime_liked_map', JSON.stringify(likedMap));
    } catch (e) {
      console.error('Failed to save likedMap', e);
    }
  }, [likedMap]);

  // Save hearted anime objects to localStorage and Firebase
  useEffect(() => {
    try {
      localStorage.setItem('anime_hearted_items', JSON.stringify(savedLikedItems));
      const likesArray = Object.values(savedLikedItems);
      syncLikesToFirebase(likesArray);
    } catch (e) {
      console.error('Failed to save savedLikedItems', e);
    }
  }, [savedLikedItems]);

  // Save bookmarks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('anime_saved_map', JSON.stringify(savedMap));
    } catch (e) {
      console.error('Failed to save savedMap', e);
    }
  }, [savedMap]);

  // Helper to trigger toaster notifications using react-hot-toast
  const triggerToast = useCallback((msg: string) => {
    toast(msg, {
      duration: 3500,
      id: 'dub-unavailable-toast',
      style: {
        background: 'rgba(24, 24, 27, 0.95)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        fontSize: '13px',
        fontWeight: '600',
        padding: '10px 16px',
        boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.7)',
      },
      icon: '🎙️',
    });
  }, []);

  // Flying hearts animation on double tap
  const [flyingHearts, setFlyingHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  // Subtitle, progress & skip state
  const [activeProgressData, setActiveProgressData] = useState<ActiveProgressData | null>(null);
  const [activeSubtitle, setActiveSubtitle] = useState<string>('');
  const [activeSkipState, setActiveSkipState] = useState<{ show: boolean; label: string; onSkip: () => void; isSkippable?: boolean; start?: number; end?: number } | null>(null);
  const [hideFeedUi, setHideFeedUi] = useState<boolean>(false);

  // Modals & Drawers
  const [isCommentsOpen, setIsCommentsOpen] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileSetupOpen, setIsProfileSetupOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<any>(() => getCachedUserProfile());
  const [showUpdatesModal, setShowUpdatesModal] = useState<boolean>(false);
  const [searchInitialGenre, setSearchInitialGenre] = useState<string | null>(null);
  const [isSubSettingsOpen, setIsSubSettingsOpen] = useState<boolean>(false);
  const [commits, setCommits] = useState<any[]>([]);
  const [loadingCommits, setLoadingCommits] = useState<boolean>(true);

  useEffect(() => {
    // Nuke service workers to fix cache issues
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      });
    }
    const fetchCommits = async () => {
      try {
        const res = await fetch("https://api.github.com/repos/beorgsh/Anitok-v1.0.2/commits?per_page=5");
        if (!res.ok) throw new Error("Failed to fetch commits");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCommits(data);
          const latestSha = data[0].sha;
          const lastSeenSha = localStorage.getItem('last_seen_commit_sha');
          const lastSeenVersion = localStorage.getItem('last_seen_update_version');

          if (lastSeenSha !== latestSha) {
            // If they have never seen any commit SHA, but have already acknowledged the current version (e.g. from a fallback check or previous session),
            // we initialize the SHA silently to avoid displaying the modal until a genuine NEW push occurs.
            if (!lastSeenSha && lastSeenVersion === "1.3.1") {
              localStorage.setItem('last_seen_commit_sha', latestSha);
            } else {
              setShowUpdatesModal(true);
            }
          }
        }
      } catch (e) {
        console.error("Error fetching commits:", e);
        // Fallback version checking
        const CURRENT_UPDATE_VERSION = "1.3.1";
        const lastSeen = localStorage.getItem('last_seen_update_version');
        if (lastSeen !== CURRENT_UPDATE_VERSION) {
          setShowUpdatesModal(true);
        }
      } finally {
        setLoadingCommits(false);
      }
    };

    fetchCommits();
  }, []);

  const handleDismissUpdatesModal = () => {
    setShowUpdatesModal(false);
    try {
      if (commits.length > 0) {
        localStorage.setItem('last_seen_commit_sha', commits[0].sha);
      }
      localStorage.setItem('last_seen_update_version', "1.3.1");
    } catch (e) {}
  };

  // Real-time horizontal swipe & drag state
  const carouselTrackRef = useRef<HTMLDivElement | null>(null);
  const topHeaderRef = useRef<TopHeaderHandle | null>(null);
  const dragOffsetRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const gestureLockRef = useRef<'horizontal' | 'vertical' | null>(null);

  // Helper to smoothly apply transform to carousel track with GPU acceleration
  const applyCarouselTransform = useCallback((offset: number, animate: boolean) => {
    if (!carouselTrackRef.current) return;
    const currentIdx = TABS.indexOf(activeTab);
    carouselTrackRef.current.style.transition = animate
      ? 'transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1)'
      : 'none';
    carouselTrackRef.current.style.transform = `translate3d(calc(-${currentIdx * 100}% + ${offset}px), 0, 0)`;
  }, [activeTab]);

  // Handle touch and mouse dragging across tabs
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Disable horizontal tab swipe if fullscreen is active or if user clicked an interactive element
    if (
      (typeof document !== 'undefined' && document.fullscreenElement) ||
      (e.target as HTMLElement).closest('button, a, input, [role="button"], .interactive-control, [id^="video-player-"]')
    ) {
      return;
    }
    isDraggingRef.current = true;
    touchStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    gestureLockRef.current = null;
    dragOffsetRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      isDraggingRef.current = false;
      return;
    }
    if (!isDraggingRef.current || !touchStartRef.current) return;

    const deltaX = e.clientX - touchStartRef.current.x;
    const deltaY = e.clientY - touchStartRef.current.y;

    if (!gestureLockRef.current) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          gestureLockRef.current = 'horizontal';
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // pointer capture fallback
          }
        } else {
          gestureLockRef.current = 'vertical';
          isDraggingRef.current = false;
          return;
        }
      }
    }

    if (gestureLockRef.current === 'horizontal') {
      const currentIdx = TABS.indexOf(activeTab);
      let constrainedDeltaX = deltaX;

      if ((currentIdx === 0 && deltaX > 0) || (currentIdx === TABS.length - 1 && deltaX < 0)) {
        constrainedDeltaX = deltaX * 0.3;
      }

      dragOffsetRef.current = constrainedDeltaX;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        applyCarouselTransform(dragOffsetRef.current, false);
        topHeaderRef.current?.updateUnderline(dragOffsetRef.current, false);
      });
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !touchStartRef.current) {
      isDraggingRef.current = false;
      return;
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // release fallback
    }

    isDraggingRef.current = false;
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    if (gestureLockRef.current === 'horizontal') {
      const deltaX = e.clientX - touchStartRef.current.x;
      const deltaTime = Date.now() - touchStartRef.current.time;
      const velocity = deltaX / Math.max(deltaTime, 1);
      const containerWidth = carouselTrackRef.current?.clientWidth || window.innerWidth;
      const currentIdx = TABS.indexOf(activeTab);

      let targetIdx = currentIdx;

      if (Math.abs(velocity) > 0.35 || Math.abs(deltaX) > containerWidth * 0.22) {
        if (deltaX < 0 && currentIdx < TABS.length - 1) {
          targetIdx = currentIdx + 1;
        } else if (deltaX > 0 && currentIdx > 0) {
          targetIdx = currentIdx - 1;
        }
      }

      const newTab = TABS[targetIdx];
      
      if (newTab !== activeTab) {
        handleTabChange(newTab);
      } else {
        applyCarouselTransform(0, true);
        topHeaderRef.current?.updateUnderline(0, true);
      }
    } else {
      applyCarouselTransform(0, true);
      topHeaderRef.current?.updateUnderline(0, true);
    }

    touchStartRef.current = null;
    gestureLockRef.current = null;
    dragOffsetRef.current = 0;
  };

  // Scroll container refs per tab
  const feedContainerRefs = useRef<Record<TabType, HTMLDivElement | null>>({
    following: null,
    foryou: null,
    latest: null,
    reels: null,
  });

  const serverRef = useRef<ServerType>(server);
  serverRef.current = server;

  const epMapRef = useRef<Record<number, number>>(epMap);
  epMapRef.current = epMap;

  const savedLikedItemsRef = useRef(savedLikedItems);
  savedLikedItemsRef.current = savedLikedItems;

  const tabFeedsRef = useRef(tabFeeds);
  tabFeedsRef.current = tabFeeds;

  // Random page helper
  const pickRandomPage = useCallback((totalPages: number, visitedPages: Set<number>): number => {
    if (totalPages <= 1) return 1;
    const unvisited: number[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (!visitedPages.has(p)) unvisited.push(p);
    }
    if (unvisited.length === 0) {
      visitedPages.clear();
      return Math.floor(Math.random() * totalPages) + 1;
    }
    const randomIndex = Math.floor(Math.random() * unvisited.length);
    const chosen = unvisited[randomIndex];
    visitedPages.add(chosen);
    return chosen;
  }, []);

  // Update default episodes map when new items load
  const registerAnimeMetadata = useCallback((items: AnimeItem[]) => {
    setEpMap((prev) => {
      let changed = false;
      const nextMap = { ...prev };
      items.forEach((a) => {
        if (!nextMap[a.id]) {
          const maxAvailable = getLatestEpisode(a);
          // Pick a random episode based on available sub/dub uploaded count instead of raw total count
          const randomEp = Math.floor(Math.random() * maxAvailable) + 1;
          nextMap[a.id] = randomEp;
          changed = true;
        }
      });
      return changed ? nextMap : prev;
    });
  }, []);

  // Keep following feed items perfectly synced with hearted/liked anime items
  useEffect(() => {
    const followingList = Object.values(savedLikedItems).sort((a: any, b: any) => (b.likedAt || 0) - (a.likedAt || 0));
    setTabFeeds((prev) => {
      const currentActive = Math.min(prev.following.activeIndex, Math.max(0, followingList.length - 1));
      return {
        ...prev,
        following: {
          ...prev.following,
          items: followingList,
          activeIndex: currentActive,
          loading: false,
          error: null,
          totalPages: 1,
        },
      };
    });
    if (followingList.length > 0) {
      registerAnimeMetadata(followingList);
    }
  }, [savedLikedItems, registerAnimeMetadata]);

  // Load feed for a specific tab
  const loadTabFeed = useCallback(async (tab: TabType) => {
    if (tab === 'following') {
      const followingList = Object.values(savedLikedItemsRef.current).sort((a: any, b: any) => (b.likedAt || 0) - (a.likedAt || 0));
      setTabFeeds((prev) => ({
        ...prev,
        following: {
          ...prev.following,
          items: followingList,
          loading: false,
          error: null,
          page: 1,
          totalPages: 1,
        },
      }));
      if (followingList.length > 0) {
        registerAnimeMetadata(followingList);
        prefetchAnimeStreams(followingList, serverRef.current, epMapRef.current, false, 0, 3);
      }
      return;
    }

    // Do NOT re-fetch if tab already has loaded items
    if (tabFeedsRef.current[tab]?.items.length > 0) {
      return;
    }

    setTabFeeds((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], loading: true, error: null },
    }));

    try {
      if (tab === 'latest') {
        const res = await fetchRecentAnime(1, 10);
        const pagesCount = res.pagination?.total_pages || 1;
        setTabFeeds((prev) => ({
          ...prev,
          latest: {
            ...prev.latest,
            items: res.data,
            page: 1,
            totalPages: pagesCount,
            loading: false,
            error: null,
          },
        }));
        registerAnimeMetadata(res.data);
        prefetchAnimeStreams(res.data, serverRef.current, epMapRef.current, false, 0, 3);
      } else if (tab === 'foryou' || tab === 'reels') {
        const probeRes = await fetchRecentAnime(1, 10);
        const maxPages = probeRes.pagination?.total_pages || 1;
        const visited = new Set<number>();
        const initialRandomPage = pickRandomPage(maxPages, visited);

        let finalData = probeRes.data;
        if (initialRandomPage !== 1) {
          const randRes = await fetchRecentAnime(initialRandomPage, 10);
          if (randRes.data && randRes.data.length > 0) {
            finalData = randRes.data;
          }
        }

        setTabFeeds((prev) => ({
          ...prev,
          [tab]: {
            ...prev[tab],
            items: finalData,
            page: initialRandomPage,
            totalPages: maxPages,
            visitedPages: visited,
            loading: false,
            error: null,
          },
        }));
        registerAnimeMetadata(finalData);
        prefetchAnimeStreams(finalData, serverRef.current, epMapRef.current, false, 0, 3);
      }
    } catch (err: any) {
      setTabFeeds((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          loading: false,
          error: err?.message || 'Failed to fetch anime feed. Please check connection.',
        },
      }));
    }
  }, [pickRandomPage, registerAnimeMetadata]);

  // Track last prefetched index per tab to avoid redundant work
  const lastPrefetchedRef = useRef<Record<string, number>>({});

  // Continuous background stream prefetching - PRIORITY TO ACTIVE TAB
  const activeFeedIndex = tabFeeds[activeTab]?.activeIndex ?? 0;
  const activeFeedItemCount = tabFeeds[activeTab]?.items?.length ?? 0;

  useEffect(() => {
    const currentFeed = tabFeeds[activeTab];
    if (!currentFeed || currentFeed.items.length === 0) return;
    const activeIdx = currentFeed.activeIndex;
    if (lastPrefetchedRef.current[activeTab] === activeIdx) return;
    lastPrefetchedRef.current[activeTab] = activeIdx;

    prefetchAnimeStreams(currentFeed.items, serverRef.current, epMapRef.current, false, activeIdx, 4);
    if (activeIdx > 0) {
      prefetchAnimeStreams(currentFeed.items, serverRef.current, epMapRef.current, false, Math.max(0, activeIdx - 2), 2);
    }
  }, [activeTab, activeFeedIndex, activeFeedItemCount, server]);

  // Load initial tab feeds on mount, prioritizing the current active tab
  const hasLoadedInitialFeedsRef = useRef(false);
  useEffect(() => {
    if (hasLoadedInitialFeedsRef.current) return;
    hasLoadedInitialFeedsRef.current = true;

    // Load active tab first as highest priority
    loadTabFeed(activeTab).then(() => {
      // Then load background tabs asynchronously
      TABS.filter((t) => t !== activeTab).forEach((otherTab) => {
        loadTabFeed(otherTab);
      });
    });
  }, [loadTabFeed, activeTab]);

  // Prefetch next page for current tab
  const prefetchNextPageForTab = useCallback(async (tab: TabType) => {
    if (tab === 'following') return;
    const currentTabFeed = tabFeeds[tab];
    if (currentTabFeed.isPrefetching || currentTabFeed.loading) return;

    setTabFeeds((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], isPrefetching: true },
    }));

    try {
      if (tab === 'foryou' || tab === 'reels') {
        const maxP = currentTabFeed.totalPages || 1;
        const randomPage = pickRandomPage(maxP, currentTabFeed.visitedPages);
        const res = await fetchRecentAnime(randomPage, 10);

        setTabFeeds((prev) => {
          const existingIds = new Set(prev[tab].items.map((i) => i.id));
          const newItems = res.data.filter((i) => !existingIds.has(i.id));
          return {
            ...prev,
            [tab]: {
              ...prev[tab],
              items: [...prev[tab].items, ...newItems],
              page: randomPage,
              isPrefetching: false,
            },
          };
        });
        registerAnimeMetadata(res.data);
        prefetchAnimeStreams(res.data, serverRef.current, epMapRef.current, false, 0, 3);
      } else {
        const nextPage = currentTabFeed.page + 1;
        if (nextPage <= currentTabFeed.totalPages) {
          const res = await fetchRecentAnime(nextPage, 10);
          setTabFeeds((prev) => {
            const existingIds = new Set(prev[tab].items.map((i) => i.id));
            const newItems = res.data.filter((i) => !existingIds.has(i.id));
            return {
              ...prev,
              [tab]: {
                ...prev[tab],
                items: [...prev[tab].items, ...newItems],
                page: nextPage,
                isPrefetching: false,
              },
            };
          });
          registerAnimeMetadata(res.data);
          prefetchAnimeStreams(res.data, serverRef.current, epMapRef.current, false, 0, 3);
        } else {
          setTabFeeds((prev) => ({
            ...prev,
            [tab]: { ...prev[tab], isPrefetching: false },
          }));
        }
      }
    } catch (err) {
      console.warn(`Prefetch failed for tab ${tab}:`, err);
      setTabFeeds((prev) => ({
        ...prev,
        [tab]: { ...prev[tab], isPrefetching: false },
      }));
    }
  }, [tabFeeds, pickRandomPage, registerAnimeMetadata]);

  // Tab switch handler
  const activeAnimeId = tabFeeds[activeTab]?.items[tabFeeds[activeTab]?.activeIndex]?.id;
  useEffect(() => {
    setGlobalDub(false);
  }, [activeAnimeId, activeTab]);

  // Track video switches to prompt PWA install every 2 videos
  const isFirstVideoRenderRef = useRef(true);
  useEffect(() => {
    if (!activeAnimeId) return;
    if (isFirstVideoRenderRef.current) {
      isFirstVideoRenderRef.current = false;
      return;
    }
    videoViewCounterRef.current += 1;
    if (videoViewCounterRef.current > 0 && videoViewCounterRef.current % 2 === 0) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      if (!isStandalone) {
        setShowPwaModal(true);
      }
    }
  }, [activeAnimeId]);

  const handleTabChange = (newTab: TabType) => {
    if (newTab === 'following' && !isAuthenticated) {
      setIsAuthModalOpen(true);
      
      // Snap carousel back to current tab (in case they swiped to following)
      const currentIdx = TABS.indexOf(activeTab);
      if (carouselTrackRef.current) {
        carouselTrackRef.current.style.transition = 'transform 0.4s cubic-bezier(0.1, 0.9, 0.2, 1)';
        carouselTrackRef.current.style.transform = `translate3d(-${currentIdx * 100}%, 0, 0)`;
      }
      topHeaderRef.current?.updateUnderline(0, true);
      return;
    }
    
    if (newTab === activeTab) return;
    
    const targetIdx = TABS.indexOf(newTab);
    if (carouselTrackRef.current) {
      carouselTrackRef.current.style.transition = 'transform 0.4s cubic-bezier(0.1, 0.9, 0.2, 1)';
      carouselTrackRef.current.style.transform = `translate3d(-${targetIdx * 100}%, 0, 0)`;
    }
    topHeaderRef.current?.updateUnderline(0, true);

    setActiveTab(newTab);
    setActiveSubtitle('');
    setActiveProgressData(null);
    setActiveSkipState(null);
    if (tabFeeds[newTab].items.length === 0 && !tabFeeds[newTab].loading) {
      loadTabFeed(newTab);
    }
  };

  // Watch full episode handler
  const handleWatchFull = (targetAnime: AnimeItem) => {
    const targetTab: TabType = 'foryou';
    const feed = tabFeeds[targetTab];
    const index = feed.items.findIndex((item) => item.id === targetAnime.id);

    setCurrentNav('home');
    if (index !== -1) {
      setTabFeeds((prev) => ({
        ...prev,
        [targetTab]: { ...prev[targetTab], activeIndex: index },
      }));
      handleTabChange(targetTab);
      setTimeout(() => {
        const container = feedContainerRefs.current[targetTab];
        if (container) {
          container.scrollTo({
            top: index * container.clientHeight,
            behavior: 'smooth',
          });
        }
      }, 120);
    } else {
      setTabFeeds((prev) => {
        const newItems = [targetAnime, ...prev[targetTab].items];
        return {
          ...prev,
          [targetTab]: { ...prev[targetTab], items: newItems, activeIndex: 0 },
        };
      });
      handleTabChange(targetTab);
      setTimeout(() => {
        const container = feedContainerRefs.current[targetTab];
        if (container) {
          container.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }
      }, 120);
    }
  };

  // Resume playback from Historie with specific episode and timestamp
  const handleResumeFromHistory = (
    targetAnime: AnimeItem,
    episode = 1,
    startTime = 0,
    isDub = false,
    preferredServer?: ServerType
  ) => {
    if (preferredServer) {
      setServer(preferredServer);
    }
    setGlobalDub(isDub);
    setEpMap((prev) => ({ ...prev, [targetAnime.id]: episode }));
    if (startTime > 0) {
      setInitialStartTimeMap((prev) => ({ ...prev, [targetAnime.id]: startTime }));
    }

    const targetTab: TabType = 'foryou';
    const feed = tabFeeds[targetTab];
    const index = feed.items.findIndex((item) => item.id === targetAnime.id || item.slug === targetAnime.slug);

    setCurrentNav('home');
    if (index !== -1) {
      setTabFeeds((prev) => ({
        ...prev,
        [targetTab]: { ...prev[targetTab], activeIndex: index },
      }));
      handleTabChange(targetTab);
      setTimeout(() => {
        const container = feedContainerRefs.current[targetTab];
        if (container) {
          container.scrollTo({
            top: index * container.clientHeight,
            behavior: 'smooth',
          });
        }
      }, 120);
    } else {
      setTabFeeds((prev) => {
        const newItems = [targetAnime, ...prev[targetTab].items];
        return {
          ...prev,
          [targetTab]: { ...prev[targetTab], items: newItems, activeIndex: 0 },
        };
      });
      handleTabChange(targetTab);
      setTimeout(() => {
        const container = feedContainerRefs.current[targetTab];
        if (container) {
          container.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }
      }, 120);
    }
  };

  // Vertical Feed Scroll handler with RAF throttling
  const scrollRafRef = useRef<Record<string, number | null>>({});
  const isUnfullscreeningRef = useRef<boolean>(false);

  // Lock feed container position during fullscreen changes to prevent accidental nexting
  useEffect(() => {
    const handleFsChange = () => {
      isUnfullscreeningRef.current = true;

      TABS.forEach((t) => {
        const container = feedContainerRefs.current[t];
        const activeIdx = tabFeeds[t]?.activeIndex ?? 0;
        if (container && container.clientHeight > 0) {
          container.scrollTop = activeIdx * container.clientHeight;
        }
      });

      setTimeout(() => {
        isUnfullscreeningRef.current = false;
        TABS.forEach((t) => {
          const container = feedContainerRefs.current[t];
          const activeIdx = tabFeeds[t]?.activeIndex ?? 0;
          if (container && container.clientHeight > 0) {
            container.scrollTop = activeIdx * container.clientHeight;
          }
        });
      }, 500);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [tabFeeds]);

  const handleFeedScrollForTab = (tab: TabType) => {
    const isFs = typeof document !== 'undefined' && !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    if (isFs || isUnfullscreeningRef.current) return;

    const container = feedContainerRefs.current[tab];
    if (!container) return;

    if (scrollRafRef.current[tab]) {
      cancelAnimationFrame(scrollRafRef.current[tab]!);
    }

    scrollRafRef.current[tab] = requestAnimationFrame(() => {
      const isFsNow = typeof document !== 'undefined' && !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (isFsNow || isUnfullscreeningRef.current) return;

      const { scrollTop, clientHeight, scrollHeight } = container;
      if (clientHeight === 0) return;

      const newIndex = Math.round(scrollTop / clientHeight);
      const currentTabState = tabFeeds[tab];

      if (newIndex !== currentTabState.activeIndex && newIndex >= 0 && newIndex < currentTabState.items.length) {
        setTabFeeds((prev) => ({
          ...prev,
          [tab]: { ...prev[tab], activeIndex: newIndex },
        }));

        if (tab === activeTab) {
          setActiveSubtitle('');
          setActiveProgressData(null);
          setActiveSkipState(null);
        }
      }

      if (scrollHeight - (scrollTop + clientHeight) < clientHeight * 3.5) {
        prefetchNextPageForTab(tab);
      }
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommentsOpen || isShareOpen || isSearchOpen || isUploadOpen) return;

      const currentTabFeed = tabFeeds[activeTab];
      const container = feedContainerRefs.current[activeTab];
      if (!container) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIndex = Math.min(currentTabFeed.items.length - 1, currentTabFeed.activeIndex + 1);
        container.scrollTo({
          top: nextIndex * container.clientHeight,
          behavior: 'smooth',
        });
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIndex = Math.max(0, currentTabFeed.activeIndex - 1);
        container.scrollTo({
          top: prevIndex * container.clientHeight,
          behavior: 'smooth',
        });
      } else if (e.key === 'm') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, tabFeeds, isCommentsOpen, isShareOpen, isSearchOpen, isUploadOpen]);

  // Unified Heart / Like toggler with motif toaster and Following tab sync
  const handleToggleLike = useCallback((anime: AnimeItem) => {
    const isCurrentlyLiked = !!likedMap[anime.id];
    const newLikedState = !isCurrentlyLiked;

    setLikedMap((prev) => ({
      ...prev,
      [anime.id]: newLikedState,
    }));

    setLikeCountMap((prev) => ({
      ...prev,
      [anime.id]: (prev[anime.id] || 1500) + (newLikedState ? 1 : -1),
    }));

    setSavedLikedItems((prev) => {
      const next = { ...prev };
      if (newLikedState) {
        next[anime.id] = { ...anime, likedAt: Date.now() } as any;
      } else {
        delete next[anime.id];
      }
      return next;
    });

    const shortTitle = anime.title.length > 28 ? anime.title.substring(0, 28) + '...' : anime.title;
    if (newLikedState) {
      toast.success(`Liked "${shortTitle}"! Added to Liked list`, {
        id: `like-${anime.id}`,
        icon: <Heart className="w-4.5 h-4.5 fill-pink-500 text-pink-500 shrink-0" />,
        duration: 2500,
        style: {
          background: 'rgba(24, 24, 27, 0.95)',
          color: '#f4f4f5',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '600',
        },
      });
    } else {
      toast(`Removed "${shortTitle}" from Liked list`, {
        id: `unlike-${anime.id}`,
        icon: <Heart className="w-4.5 h-4.5 text-zinc-400 shrink-0" />,
        duration: 2000,
        style: {
          background: 'rgba(24, 24, 27, 0.95)',
          color: '#d4d4d8',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '600',
        },
      });
    }
  }, [likedMap]);

  // Unified Bookmark / Save toggler
  const handleToggleSave = useCallback((anime: AnimeItem) => {
    const isCurrentlySaved = !!savedMap[anime.id];
    const newSavedState = !isCurrentlySaved;

    setSavedMap((prev) => ({
      ...prev,
      [anime.id]: newSavedState,
    }));

    setSaveCountMap((prev) => ({
      ...prev,
      [anime.id]: (prev[anime.id] || 450) + (newSavedState ? 1 : -1),
    }));

    const shortTitle = anime.title.length > 28 ? anime.title.substring(0, 28) + '...' : anime.title;
    if (newSavedState) {
      toast.success(`Saved "${shortTitle}" to Bookmarks`, {
        id: `save-${anime.id}`,
        icon: <Bookmark className="w-4.5 h-4.5 fill-amber-400 text-amber-400 shrink-0" />,
        duration: 2500,
        style: {
          background: 'rgba(24, 24, 27, 0.95)',
          color: '#f4f4f5',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '600',
        },
      });
    } else {
      toast(`Removed "${shortTitle}" from Bookmarks`, {
        id: `unsave-${anime.id}`,
        icon: <Bookmark className="w-4.5 h-4.5 text-zinc-400 shrink-0" />,
        duration: 2000,
        style: {
          background: 'rgba(24, 24, 27, 0.95)',
          color: '#d4d4d8',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '600',
        },
      });
    }
  }, [savedMap]);

  // Double tap heart pop animation on video player
  const handleDoubleTapLike = (e: React.MouseEvent<HTMLDivElement>, anime: AnimeItem) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const heartId = Date.now() + Math.random();
    setFlyingHearts((prev) => [...prev, { id: heartId, x, y }]);

    setTimeout(() => {
      setFlyingHearts((prev) => prev.filter((h) => h.id !== heartId));
    }, 1000);

    if (!likedMap[anime.id]) {
      handleToggleLike(anime);
    }
  };

  const currentTabItems = tabFeeds[activeTab].items;
  const currentAnime = currentTabItems[tabFeeds[activeTab].activeIndex] || null;
  const currentEp = currentAnime ? epMap[currentAnime.id] || 1 : 1;

  // Aggregate all items across tabs for profile lists and search
  const allKnownItems = React.useMemo(() => {
    const seen = new Set<number>();
    const list: AnimeItem[] = [];
    Object.values(tabFeeds).forEach((f) => {
      f.items.forEach((item) => {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
        }
      });
    });
    return list;
  }, [tabFeeds]);

  const likedAnimeList = React.useMemo(() => {
    const map: Record<number, AnimeItem> = { ...savedLikedItems };
    allKnownItems.forEach((item) => {
      if (likedMap[item.id]) {
        map[item.id] = item;
      }
    });
    return Object.values(map);
  }, [savedLikedItems, allKnownItems, likedMap]);

  const savedAnimeList = allKnownItems.filter((item) => savedMap[item.id]);

  const activeTabIndex = TABS.indexOf(activeTab);

  return (
    <div className="w-screen h-[100dvh] bg-black text-white flex flex-col font-sans overflow-hidden select-none">
      {/* Main Container Layout */}
      <div className="flex-1 flex overflow-hidden relative w-full h-full">
        {/* Center Video Feed Stage */}
        <main className="w-full h-full flex items-center justify-center relative bg-black overflow-hidden">
          {/* Main Feed Container */}
          <div className="w-full h-full relative overflow-hidden flex flex-col bg-black">
            {/* Navigation views (Profile, Explore, or History) or Feed */}
            <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
              {currentNav === 'profile' ? (
                <ProfileView
                  likedAnimeList={likedAnimeList}
                  savedAnimeList={savedAnimeList}
                  onSelectAnime={handleWatchFull}
                  onBackToFeed={() => setCurrentNav('home')}
                  userProfile={userProfile}
                  onUpdateProfile={(updated) => {
                    setUserProfile(updated);
                    saveCachedUserProfile(updated);
                  }}
                />
              ) : currentNav === 'explore' ? (
                <SearchView
                  allAnime={allKnownItems}
                  isOpen={true}
                  onClose={() => {
                    setSearchInitialGenre(null);
                    setCurrentNav('home');
                  }}
                  onSelectAnime={handleWatchFull}
                  initialGenre={searchInitialGenre}
                  currentNav={currentNav}
                  onChangeNav={(nav) => {
                    if ((nav === 'profile' || nav === 'history') && !isAuthenticated) {
                      setIsAuthModalOpen(true);
                    } else {
                      setCurrentNav(nav);
                    }
                  }}
                  onOpenUpload={() => {
                    if (!isAuthenticated) {
                      setIsAuthModalOpen(true);
                    } else if (!userProfile) {
                      setIsProfileSetupOpen(true);
                    } else {
                      setIsAccountModalOpen(true);
                    }
                  }}
                  isAuthenticated={isAuthenticated}
                  userProfile={userProfile}
                />
              ) : currentNav === 'history' ? (
                <HistoryView
                  onSelectAnime={handleResumeFromHistory}
                  onBackToFeed={() => setCurrentNav('home')}
                />
              ) : (
                /* Home Video Feed */
                <>
                  {/* Fixed Top Bar */}
                  {!hideFeedUi && (
                    <TopHeader
                      ref={topHeaderRef}
                      activeTab={activeTab}
                      onChangeTab={handleTabChange}
                      onOpenSearch={() => setIsSearchOpen(true)}
                      server={server}
                      onChangeServer={setServer}
                    />
                  )}

                {/* 3-Tab Horizontal Drag Carousel Container */}
                <div
                  className="w-full h-full relative overflow-hidden flex-1 touch-pan-y"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUpOrCancel}
                  onPointerCancel={handlePointerUpOrCancel}
                >
                  {/* Sliding 3-Tab Track */}
                  <div
                    ref={carouselTrackRef}
                    className="w-full h-full flex select-none"
                    style={{
                      transform: `translate3d(calc(-${activeTabIndex * 100}%), 0, 0)`,
                      transition: 'transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1)',
                      willChange: 'transform',
                      touchAction: 'pan-y',
                    }}
                  >
                    {TABS.map((tab) => {
                      const feed = tabFeeds[tab];
                      const isCurrentTab = activeTab === tab;

                      return (
                        <div
                          key={tab}
                          className="w-full h-full shrink-0 relative overflow-hidden flex flex-col bg-black"
                        >
                          {feed.loading ? (
                            <LazyLoadSkeleton />
                          ) : feed.error ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
                              <p className="text-pink-400 font-bold text-sm mb-3">{feed.error}</p>
                              <button
                                onClick={() => loadTabFeed(tab)}
                                className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold text-xs flex items-center gap-2 shadow-lg"
                              >
                                <RefreshCw className="w-4 h-4" /> Retry Feed
                              </button>
                            </div>
                          ) : tab === 'following' && feed.items.length === 0 ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
                              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-pink-500 mb-4 shadow-lg animate-pulse">
                                <Heart className="w-8 h-8 fill-pink-500 text-pink-500" />
                              </div>
                              <h3 className="text-base font-bold text-zinc-100 mb-1.5">No Liked Anime Yet</h3>
                              <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed flex items-center justify-center flex-wrap gap-1">
                                <span>Tap the heart</span>
                                <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500 inline-block align-middle" />
                                <span>button on any anime in For You or Latest to add it to your Liked stream!</span>
                              </p>
                              <button
                                onClick={() => handleTabChange('foryou')}
                                className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 active:scale-95 text-white rounded-full font-bold text-xs shadow-md transition-all flex items-center gap-2"
                              >
                                <span>Explore For You</span>
                              </button>
                            </div>
                          ) : (
                            /* Vertical Snap Scroll Video Container for this tab */
                            <div
                              id="app-feed-container"
                              ref={(el) => {
                                feedContainerRefs.current[tab] = el;
                              }}
                              onScroll={() => handleFeedScrollForTab(tab)}
                              className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth overscroll-contain no-scrollbar relative"
                            >
                              {feed.items.map((anime, index) => {
                                const isTabActive = index === feed.activeIndex;
                                const distance = Math.abs(index - feed.activeIndex);
                                const shouldMount = isCurrentTab ? distance <= 4 : (isTabActive || distance <= 1);
                                const isAnyModalOpen =
                                  isAuthModalOpen ||
                                  isCommentsOpen ||
                                  isShareOpen ||
                                  isSearchOpen ||
                                  isUploadOpen ||
                                  isProfileSetupOpen ||
                                  isAccountModalOpen ||
                                  showPwaModal ||
                                  showUpdatesModal ||
                                  isSubSettingsOpen;
                                const isActive = isCurrentTab && isTabActive && currentNav === 'home' && !isAnyModalOpen;
                                const shouldPreload = isTabActive || (isCurrentTab && distance <= 4);

                                const isLiked = !!likedMap[anime.id];
                                const likeCount = likeCountMap[anime.id] || 1500;
                                const isSaved = !!savedMap[anime.id];
                                const saveCount = saveCountMap[anime.id] || 450;
                                const ep = epMap[anime.id] || getLatestEpisode(anime);

                                if (!shouldMount) {
                                  return (
                                    <div
                                      key={`${anime.id}_${index}`}
                                      id={`feed-slide-${anime.id}`}
                                      className="w-full h-full snap-start snap-always relative shrink-0 overflow-hidden flex items-center justify-center bg-black"
                                      style={{ contain: 'layout paint' }}
                                    >
                                      <img
                                        src={anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150'}
                                        alt=""
                                        className="w-full h-full object-cover opacity-20 blur-sm select-none pointer-events-none"
                                        loading="lazy"
                                      />
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={`${anime.id}_${index}`}
                                    id={`feed-slide-${anime.id}`}
                                    className="w-full h-full snap-start snap-always relative shrink-0 overflow-hidden flex items-center justify-center bg-black"
                                    style={{ contain: 'layout paint' }}
                                  >
                                    {/* HLS Video Player Component */}
                                    <VideoPlayer
                                      anime={anime}
                                      isActive={isActive}
                                      shouldPreload={shouldPreload}
                                      server={server}
                                      currentEp={ep}
                                      initialStartTime={initialStartTimeMap[anime.id] || 0}
                                      isMuted={isMuted}
                                      onToggleMute={() => setIsMuted(!isMuted)}
                                      onDoubleTapLike={(e) => handleDoubleTapLike(e, anime)}
                                      isReels={tab === 'reels'}
                                      isDub={globalDub}
                                      onDubFailed={() => {
                                        triggerToast(`No English Dub available for this episode`);
                                      }}
                                      subtitleSettings={subtitleSettings}
                                      subtitleOffset={subtitleSettings.syncOffset}
                                      subtitleSize={subtitleSettings.size <= 12 ? 'small' : subtitleSettings.size >= 18 ? 'large' : 'medium'}
                                      subtitleColor={subtitleSettings.color}
                                      subtitleVisible={subtitleSettings.visible}
                                       onSubtitlesLoaded={(hasSubs) => {
                                         setSubtitlesLoadedMap((prev) => {
                                           if (prev[anime.id] === hasSubs) return prev;
                                           return { ...prev, [anime.id]: hasSubs };
                                         });
                                       }}
                                      onVideoEnd={() => {
                                        const container = feedContainerRefs.current[tab];
                                        if (index < feed.items.length - 1 && container) {
                                          const nextIdx = index + 1;
                                          container.scrollTo({
                                            top: nextIdx * container.clientHeight,
                                            behavior: 'smooth',
                                          });
                                        }
                                      }}
                                      onNextVideo={() => {
                                        const container = feedContainerRefs.current[tab];
                                        if (container && index < feed.items.length - 1) {
                                          const nextIdx = index + 1;
                                          container.scrollTo({
                                            top: nextIdx * container.clientHeight,
                                            behavior: 'smooth',
                                          });
                                        }
                                      }}
                                      onPrevVideo={() => {
                                        const container = feedContainerRefs.current[tab];
                                        if (container && index > 0) {
                                          const prevIdx = index - 1;
                                          container.scrollTo({
                                            top: prevIdx * container.clientHeight,
                                            behavior: 'smooth',
                                          });
                                        }
                                      }}
                                      onProgressUpdate={(prog, cur, dur, seek) => {
                                        if (isActive) {
                                          setActiveProgressData({
                                            progress: prog,
                                            currentTime: cur,
                                            duration: dur,
                                            onSeek: seek,
                                          });
                                        }
                                      }}
                                      onSubtitleChange={(sub) => {
                                        if (isActive) {
                                          setActiveSubtitle(sub);
                                        }
                                      }}
                                      onSkipStateChange={(skipState) => {
                                        if (isActive) {
                                          setActiveSkipState(skipState);
                                        }
                                      }}
                                      onWatchFull={() => handleWatchFull(anime)}
                                      onOpenSettings={() => setIsShareOpen(true)}
                                      onNextEp={() =>
                                        setEpMap((prev) => {
                                          const maxEp = getLatestEpisode(anime);
                                          return {
                                            ...prev,
                                            [anime.id]: Math.min(maxEp, ep + 1),
                                          };
                                        })
                                      }
                                      onPrevEp={() =>
                                        setEpMap((prev) => ({
                                          ...prev,
                                          [anime.id]: Math.max(1, ep - 1),
                                        }))
                                      }
                                      onOpenEpisodesDrawer={() => setIsCommentsOpen(true)}
                                      hideFeedUi={hideFeedUi}
                                      onToggleHideFeedUi={() => setHideFeedUi(!hideFeedUi)}
                                    />

                                    {/* Video Info Overlay */}
                                    <VideoInfoOverlay
                                      anime={anime}
                                      currentEp={ep}
                                      totalEp={anime.episodes}
                                      server={server}
                                      onChangeEp={(newEp) =>
                                        setEpMap((prev) => ({ ...prev, [anime.id]: newEp }))
                                      }
                                      onChangeServer={setServer}
                                      hideFeedUi={hideFeedUi}
                                      onSelectGenre={(genre) => {
                                        setSearchInitialGenre(genre);
                                        setIsSearchOpen(true);
                                      }}
                                    />

                                    {/* Sidebar Right Actions */}
                                    <SidebarActions
                                      anime={anime}
                                      currentEp={ep}
                                      liked={isLiked}
                                      likeCount={likeCount}
                                      saved={isSaved}
                                      saveCount={saveCount}
                                      commentCount={Math.floor(likeCount / 12) + 18}
                                      skipState={isActive ? activeSkipState : null}
                                      isDub={globalDub}
                                      onToggleDub={handleToggleDub}
                                      onDubUnavailable={(title) => {
                                        triggerToast(`⚠️ No English Dub available for "${title}". Playing with Subtitles.`);
                                      }}
                                      onToggleLike={() => {
                                        if (!isAuthenticated) {
                                          setIsAuthModalOpen(true);
                                        } else {
                                          handleToggleLike(anime);
                                        }
                                      }}
                                      onToggleSave={() => {
                                        if (!isAuthenticated) {
                                          setIsAuthModalOpen(true);
                                        } else {
                                          handleToggleSave(anime);
                                        }
                                      }}
                                      onOpenComments={() => {
                                        if (!isAuthenticated) {
                                          setIsAuthModalOpen(true);
                                        } else {
                                          setIsCommentsOpen(true);
                                        }
                                      }}
                                      onOpenMore={() => setIsShareOpen(true)}
                                      hideFeedUi={hideFeedUi}
                                      hasSubtitles={subtitlesLoadedMap[anime.id] ?? (anime.is_sub !== undefined ? anime.is_sub > 0 : true)}
                                      onOpenSubtitleSettings={() => setIsSubSettingsOpen(true)}
                                    />

                                    {/* Flying double-tap heart animations */}
                                    {isActive &&
                                      flyingHearts.map((heart) => (
                                        <div
                                          key={heart.id}
                                          className="absolute pointer-events-none z-40 animate-heart-fly"
                                          style={{ left: heart.x - 24, top: heart.y - 24 }}
                                        >
                                          <Heart className="w-12 h-12 text-pink-500 fill-pink-500 drop-shadow-xl" />
                                        </div>
                                      ))}
                                  </div>
                                );
                              })}

                              {/* Prefetching indicator at bottom of scroll */}
                              {feed.isPrefetching && (
                                <div className="w-full h-16 bg-black flex items-center justify-center gap-2 text-xs text-zinc-400 font-semibold">
                                  <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                                  Loading more anime streams...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            </div>

            {/* Mobile Bottom Navigation Bar - Persistent on all views */}
            {!hideFeedUi && (
              <BottomNav
                currentNav={currentNav}
                onChangeNav={(nav) => {
                  if ((nav === 'profile' || nav === 'history') && !isAuthenticated) {
                    setIsAuthModalOpen(true);
                  } else {
                    setCurrentNav(nav);
                  }
                }}
                onOpenUpload={() => {
                  if (!isAuthenticated) {
                    setIsAuthModalOpen(true);
                  } else if (!userProfile) {
                    setIsProfileSetupOpen(true);
                  } else {
                    setIsAccountModalOpen(true);
                  }
                }}
                activeProgressData={currentNav === 'home' ? activeProgressData : null}
                isAuthenticated={isAuthenticated}
                userProfile={userProfile}
              />
            )}
          </div>
        </main>
      </div>

      {/* Slide Modals */}
      {currentAnime && (
        <>
          <EpisodesDrawer
            anime={currentAnime}
            currentEp={currentEp}
            isOpen={isCommentsOpen}
            onClose={() => setIsCommentsOpen(false)}
            onSelectEp={(selectedEp) => {
              setEpMap((prev) => ({ ...prev, [currentAnime.id]: selectedEp }));
            }}
          />

          <ShareDrawer
            anime={currentAnime}
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
            server={server}
            onServerChange={(newServer) => setServer(newServer)}
            subtitleSettings={subtitleSettings}
            onUpdateSubtitleSettings={handleUpdateSubtitleSettings}
            hasSubtitles={subtitlesLoadedMap[currentAnime.id] ?? (currentAnime.is_sub !== undefined ? currentAnime.is_sub > 0 : true)}
          />

          <SubtitleSettingsModal
            anime={currentAnime}
            isOpen={isSubSettingsOpen}
            onClose={() => setIsSubSettingsOpen(false)}
            subtitleSettings={subtitleSettings}
            onUpdateSubtitleSettings={handleUpdateSubtitleSettings}
            hasSubtitles={subtitlesLoadedMap[currentAnime.id] ?? (currentAnime.is_sub !== undefined ? currentAnime.is_sub > 0 : true)}
          />
        </>
      )}

      {/* Global Search & Explore Modal */}
      <SearchView
        allAnime={allKnownItems}
        isOpen={isSearchOpen}
        onClose={() => {
          setSearchInitialGenre(null);
          setIsSearchOpen(false);
        }}
        initialGenre={searchInitialGenre}
        currentNav={currentNav}
        onChangeNav={(nav) => {
          setIsSearchOpen(false);
          if ((nav === 'profile' || nav === 'history') && !isAuthenticated) {
            setIsAuthModalOpen(true);
          } else {
            setCurrentNav(nav);
          }
        }}
        onOpenUpload={() => {
          setIsSearchOpen(false);
          if (!isAuthenticated) {
            setIsAuthModalOpen(true);
          } else if (!userProfile) {
            setIsProfileSetupOpen(true);
          } else {
            setIsAccountModalOpen(true);
          }
        }}
        isAuthenticated={isAuthenticated}
        userProfile={userProfile}
        onSelectAnime={(anime, episode) => {
          registerAnimeMetadata([anime]);
          if (typeof episode === 'number') {
            setEpMap((prev) => ({ ...prev, [anime.id]: episode }));
          }
          
          let idx = tabFeeds[activeTab].items.findIndex((i) => i.id === anime.id || i.slug === anime.slug);
          if (idx === -1) {
            setTabFeeds((prev) => {
              const currentFeed = prev[activeTab];
              const updatedItems = [anime, ...currentFeed.items];
              return {
                ...prev,
                [activeTab]: {
                  ...currentFeed,
                  items: updatedItems,
                  activeIndex: 0
                }
              };
            });
            idx = 0;
          } else {
            setTabFeeds((prev) => ({
              ...prev,
              [activeTab]: { ...prev[activeTab], activeIndex: idx },
            }));
          }

          setTimeout(() => {
            feedContainerRefs.current[activeTab]?.scrollTo({
              top: idx * (feedContainerRefs.current[activeTab]?.clientHeight || 0),
            });
          }, 100);
        }}
      />

      {/* Upload Video Modal */}
      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Profile Setup Modal */}
      <ProfileSetupModal 
        isOpen={isProfileSetupOpen} 
        onComplete={(profile) => {
          setUserProfile(profile);
          setIsProfileSetupOpen(false);
        }} 
      />

      {/* Account Modal */}
      <AccountModal 
        isOpen={isAccountModalOpen} 
        onClose={() => setIsAccountModalOpen(false)} 
        userProfile={userProfile} 
      />

      {/* PWA Install Modal */}
      <InstallPWAModal
        isOpen={showPwaModal}
        onClose={() => setShowPwaModal(false)}
        deferredPrompt={deferredPrompt}
      />

      {/* GitHub Push Live Updates Modal */}
      {showUpdatesModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm select-none animate-fade-in font-mono">
          <div className="w-full max-w-md bg-black/85 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Terminal Top Window Title Bar */}
            <div className="px-4 py-3 bg-zinc-950/80 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>
              <span className="text-[11px] font-bold text-zinc-500 font-mono tracking-tight">
                bash - anitok_update.sh
              </span>
              <div className="w-12" /> {/* Spacer for balance */}
            </div>

            {/* Terminal Console Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs max-h-[50vh] text-emerald-400 font-mono">
              <div className="space-y-1">
                <div className="text-zinc-500">Last login: {new Date().toLocaleDateString()} on ttys002</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-pink-500">anitok@system:~$</span>
                  <span className="text-white">git log -n 5 --oneline --graph</span>
                </div>
              </div>

              {loadingCommits ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 border border-zinc-900 bg-zinc-950/50 rounded-lg">
                  <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                  <span className="text-[10px] text-zinc-500">fetch_origin: querying github api...</span>
                </div>
              ) : commits.length > 0 ? (
                <div className="space-y-3.5">
                  <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold border-b border-zinc-900 pb-1">
                    * branch main (beorgsh/Anitok-v1.0.2)
                  </div>
                  {commits.map((c, idx) => {
                    const message = c.commit?.message || "Code update";
                    const shaShort = c.sha ? c.sha.substring(0, 7) : "0000000";
                    const authorName = c.commit?.author?.name || "beorgsh";
                    const dateStr = c.commit?.author?.date
                      ? new Date(c.commit.author.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div key={c.sha || idx} className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg space-y-1.5 hover:border-zinc-800 transition-colors">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-pink-400 font-bold">
                            * commit {shaShort}
                          </span>
                          <span className="text-zinc-600 text-[10px]">
                            {dateStr}
                          </span>
                        </div>
                        <div className="text-zinc-400 pl-3 border-l border-zinc-850 py-0.5 text-xs">
                          <p className="text-zinc-300 break-words whitespace-pre-wrap font-sans">
                            {message}
                          </p>
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 pl-3">
                          <span>Author:</span>
                          <span className="text-emerald-500">{authorName}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg space-y-1">
                    <div className="text-pink-400 font-bold">* commit ee06bdf</div>
                    <p className="text-zinc-300 pl-3 border-l border-zinc-850 text-xs">
                      Improved Theatre Mode UI: Reduced eye icon transparency, auto-hid control components.
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-lg space-y-1">
                    <div className="text-pink-400 font-bold">* commit ad14c81</div>
                    <p className="text-zinc-300 pl-3 border-l border-zinc-850 text-xs">
                      Seek track highlights: Map skippable region boundaries on portrait tracks.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center gap-1 text-[11px] text-zinc-500">
                <span className="text-pink-500">anitok@system:~$</span>
                <span className="animate-pulse">_</span>
              </div>
            </div>

            {/* Terminal Action Footer */}
            <div className="p-4 border-t border-zinc-900 bg-zinc-950">
              <button
                onClick={handleDismissUpdatesModal}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-black font-extrabold rounded-lg transition-all text-center text-xs cursor-pointer shadow-lg shadow-emerald-500/5 uppercase tracking-wider"
              >
                [ Press Enter to Continue ]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* React Hot Toast Toaster */}
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        containerStyle={{
          top: 80,
        }}
      />
    </div>
  );
}
