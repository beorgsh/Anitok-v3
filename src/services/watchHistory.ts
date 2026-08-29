import { AnimeItem, ServerType, WatchHistoryItem } from '../types/anime';
import { syncHistoryToFirebase } from '../lib/firebaseStore';

const STORAGE_KEY = 'anime_watch_history';

// Debounce helper for Firebase sync
let syncTimeout: any = null;
const debouncedSyncToFirebase = (history: WatchHistoryItem[]) => {
  if (syncTimeout) clearTimeout(syncTimeout);
  // Wait 10 seconds before syncing to Firebase to batch rapid progress updates
  syncTimeout = setTimeout(() => {
    syncHistoryToFirebase(history);
  }, 10000);
};

export function getWatchHistory(): WatchHistoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return [];
  } catch (err) {
    console.warn('Failed to load watch history:', err);
    return [];
  }
}

export function setWatchHistory(history: WatchHistoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    debouncedSyncToFirebase(history);
  } catch (err) {
    console.warn('Failed to set watch history:', err);
  }
}

export function getSavedTimestamp(slug: string, episode: number): number {
  try {
    const list = getWatchHistory();
    const item = list.find((h) => h.anime.slug === slug && h.episode === episode);
    if (item && typeof item.currentTime === 'number' && item.currentTime > 0) {
      return item.currentTime;
    }
    // If not found by exact episode, check if there's any recent timestamp for this anime
    const anyItem = list.find((h) => h.anime.slug === slug);
    if (anyItem && typeof anyItem.currentTime === 'number' && anyItem.currentTime > 0) {
      return anyItem.currentTime;
    }
  } catch (err) {
    console.warn('Failed to get saved timestamp:', err);
  }
  return 0;
}

export function saveWatchProgress(
  anime: AnimeItem,
  episode: number,
  currentTime: number,
  duration: number,
  isDub: boolean = false,
  server: ServerType = 'hd-2'
): void {
  if (!anime || !anime.slug || currentTime <= 0) return;

  try {
    const list = getWatchHistory();
    const id = `${anime.slug}_ep_${episode}`;
    const existingIndex = list.findIndex((h) => h.id === id || (h.anime.slug === anime.slug && h.episode === episode));

    const item: WatchHistoryItem = {
      id,
      anime,
      episode,
      currentTime: Math.floor(currentTime * 10) / 10,
      duration: Math.floor((duration || 0) * 10) / 10,
      isDub,
      server,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.unshift(item);
    }

    // Keep max 100 history entries
    const trimmed = list.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    debouncedSyncToFirebase(trimmed);
  } catch (err) {
    console.warn('Failed to save watch progress:', err);
  }
}

export function removeWatchHistoryItem(id: string): void {
  try {
    const list = getWatchHistory().filter((h) => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    debouncedSyncToFirebase(list);
  } catch (err) {
    console.warn('Failed to remove history item:', err);
  }
}

export function clearWatchHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    debouncedSyncToFirebase([]);
  } catch (err) {
    console.warn('Failed to clear watch history:', err);
  }
}
