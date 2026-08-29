export interface AnimeTerms {
  genre?: string[];
  producers?: string[];
  studios?: string[];
  type?: string[];
}

export interface AnimeItem {
  id: number;
  title: string;
  alternative?: string;
  titles?: string;
  native?: string;
  slug: string;
  rating?: string;
  poster: string;
  is_dub?: number;
  is_sub?: number;
  description: string;
  aired?: string;
  season?: string;
  year?: number;
  duration?: string;
  status?: string;
  score?: string;
  mal_id?: string;
  episodes?: string;
  ani_id?: string;
  source?: string;
  s_id?: number;
  background_image?: string;
  updated_at?: string;
  next_air_schedule_time?: number;
  next_air_ep?: number;
  terms_by_type?: AnimeTerms;
}

export interface AnimeMetadataResponse {
  success: boolean;
  data?: {
    id?: string;
    malId?: number;
    tmdbId?: number;
    tmdbType?: string;
    title?: string;
    titleRomaji?: string;
    titleJa?: string;
    format?: string;
    year?: number;
    description?: string;
    episodes?: AnimeEpisodeMetadata[];
  };
}

export interface AnimeEpisodeMetadata {
  id?: string;
  number: number;
  title?: string;
  titleJa?: string;
  description?: string;
  image?: string;
  airDate?: string;
  duration?: number;
  isFiller?: boolean;
  rating?: string;
  hasAired?: boolean;
  source?: string;
  season?: number;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface RecentAnimeResponse {
  data: AnimeItem[];
  pagination: Pagination;
}

export type ServerType = 'hd-2' | 'hd-1';

export interface AnimeServerItem {
  type: 'sub' | 'dub' | 'raw' | 'hsub';
  serverName: string;
  originalName: string;
  linkId: string;
  serverId: string;
}

export interface AnimeServersResponse {
  success: boolean;
  data: AnimeServerItem[];
}

export interface StreamSubtitle {
  file: string;
  label: string;
  kind: string;
  default?: boolean;
}

export interface StreamData {
  m3u8: string;
  referer?: string;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  subtitles?: StreamSubtitle[];
}

export interface StreamResponse {
  success: boolean;
  data: StreamData;
}

export interface Comment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  time: string;
  likes: number;
  isLiked?: boolean;
}

export interface SubtitleSettings {
  visible: boolean;
  size: number; // Font size in px (e.g. 10 to 32)
  heightPosition: number; // Bottom height offset in px (e.g. 0 to 120)
  borderRadius: number; // Border radius in px (e.g. 0 to 24)
  backgroundColor: string; // e.g. '#000000', '#18181b', '#09090b', '#1e1b4b', '#1e293b'
  bgOpacity: number; // 0 to 100
  color: 'white' | 'yellow' | 'cyan';
  syncOffset: number; // in seconds (-5 to +5)
  showTerminalIcon?: boolean; // toggle in modals more for showing the terminal icon in player
}

export interface WatchHistoryItem {
  id: string;
  anime: AnimeItem;
  episode: number;
  currentTime: number;
  duration: number;
  isDub: boolean;
  server: ServerType;
  updatedAt: number;
}

/**
 * Calculates the latest available episode number from is_sub, is_dub, next_air_ep, or episodes
 */
export function getLatestEpisode(anime: AnimeItem): number {
  const sub = typeof anime.is_sub === 'number' && anime.is_sub > 0 ? anime.is_sub : 0;
  const dub = typeof anime.is_dub === 'number' && anime.is_dub > 0 ? anime.is_dub : 0;
  
  if (sub > 0 || dub > 0) {
    return Math.max(sub, dub);
  }

  const nextEp = typeof anime.next_air_ep === 'number' && anime.next_air_ep > 1 ? anime.next_air_ep - 1 : 0;
  const totalEp = anime.episodes ? parseInt(anime.episodes, 10) : 0;

  const latest = Math.max(nextEp, totalEp || 0, 1);
  return Number.isFinite(latest) && latest > 0 ? latest : 1;
}
