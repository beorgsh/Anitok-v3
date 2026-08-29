import { AnimeItem, AnimeServerItem, AnimeServersResponse, RecentAnimeResponse, ServerType, StreamData, StreamResponse, StreamSubtitle, AnimeEpisodeMetadata, AnimeMetadataResponse, getLatestEpisode } from '../types/anime';
import { FALLBACK_RESPONSE, FALLBACK_STREAM_DATA, FALLBACK_STREAMS_BY_SLUG } from '../data/fallbackAnime';

const FEED_BASE_URL = 'https://anikotoapi.site/recent-anime';
const STREAM_BASE_URL = 'https://anikoto-api.vercel.app/api/stream';
const SERVERS_BASE_URL = 'https://anikoto-api.vercel.app/api/servers';
const METADATA_EPISODES_BASE_URL = 'https://anime-metadata-api.vercel.app/api/episodes';

// In-memory caches to prevent redundant network fetches
const streamCache = new Map<string, StreamData>();
const pageCache = new Map<number, RecentAnimeResponse>();
const serversCache = new Map<string, AnimeServerItem[]>();
const dubAvailabilityCache = new Map<string, boolean>();
const metadataCache = new Map<string, AnimeEpisodeMetadata[]>();

/**
 * Fetches available servers and stream formats (sub / dub) for a given anime episode
 * Endpoint: https://anikoto-api.vercel.app/api/servers?id={slug}&ep={ep}
 */
export async function fetchAnimeServers(
  slug: string,
  ep: number = 1,
  signal?: AbortSignal
): Promise<AnimeServerItem[]> {
  const cacheKey = `${slug}_ep${ep}`;
  if (serversCache.has(cacheKey)) {
    return serversCache.get(cacheKey)!;
  }

  try {
    const targetUrl = `${SERVERS_BASE_URL}?id=${encodeURIComponent(slug)}&ep=${ep}`;
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`, { signal });
    if (!res.ok) return [];
    const json: AnimeServersResponse = await res.json();
    if (json && json.success && Array.isArray(json.data)) {
      serversCache.set(cacheKey, json.data);
      const hasDub = json.data.some((item) => item.type === 'dub');
      dubAvailabilityCache.set(cacheKey, hasDub);
      return json.data;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Checks if English Dub is available for the given anime slug & episode
 */
export async function checkDubAvailable(
  slug: string,
  ep: number = 1
): Promise<boolean> {
  const cacheKey = `${slug}_ep${ep}`;
  if (dubAvailabilityCache.has(cacheKey)) {
    return dubAvailabilityCache.get(cacheKey)!;
  }
  const servers = await fetchAnimeServers(slug, ep);
  const hasDub = servers.some((item) => item.type === 'dub');
  dubAvailabilityCache.set(cacheKey, hasDub);
  return hasDub;
}

/**
 * Returns cached dub availability if already resolved, or null if unknown
 */
export function getCachedDubAvailability(
  slug: string,
  ep: number = 1
): boolean | null {
  const cacheKey = `${slug}_ep${ep}`;
  if (dubAvailabilityCache.has(cacheKey)) {
    return dubAvailabilityCache.get(cacheKey)!;
  }
  return null;
}

export function getCachedStream(
  animeOrSlug: string | AnimeItem,
  server: ServerType = 'hd-2',
  ep: number = 1,
  type: 'sub' | 'dub' = 'sub'
): StreamData | null {
  const slug = typeof animeOrSlug === 'string' ? animeOrSlug : animeOrSlug.slug;
  const malId = typeof animeOrSlug === 'object' ? (animeOrSlug.mal_id || String(animeOrSlug.id)) : slug;
  const cacheKey = `${slug}_${malId}_${server}_ep${ep}_${type}`;
  return streamCache.get(cacheKey) || null;
}

export function getFallbackStreamForSlug(slug: string): StreamData | null {
  // Only return real anime fallback stream for the specific demo slug if present
  if (slug === 'perfect-world-movie-ninefold-the-burning-sky-cc618' && FALLBACK_STREAMS_BY_SLUG[slug]) {
    return FALLBACK_STREAMS_BY_SLUG[slug];
  }
  return null;
}

export async function fetchRecentAnime(page = 1, perPage = 10): Promise<RecentAnimeResponse> {
  if (pageCache.has(page)) {
    return pageCache.get(page)!;
  }

  try {
    const feedTargetUrl = `${FEED_BASE_URL}?page=${page}&per_page=${perPage}`;
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(feedTargetUrl)}`);
    if (!res.ok) {
      console.warn(`Feed HTTP ${res.status}, using fallback data`);
      return FALLBACK_RESPONSE;
    }
    const data: RecentAnimeResponse = await res.json();
    if (data && Array.isArray(data.data) && data.data.length > 0) {
      pageCache.set(page, data);
      return data;
    }
    return FALLBACK_RESPONSE;
  } catch (err) {
    console.warn(`Error fetching page ${page}, using fallback dataset:`, err);
    return FALLBACK_RESPONSE;
  }
}

function normalizeStreamResponse(json: any): StreamData | null {
  if (!json) return null;
  const d = json.data || json;

  let m3u8Url = d.m3u8 || d.url || d.stream || d.file;
  if (!m3u8Url && Array.isArray(d.sources) && d.sources.length > 0) {
    m3u8Url = d.sources[0].url || d.sources[0].file || d.sources[0].m3u8;
  }

  if (!m3u8Url || typeof m3u8Url !== 'string') {
    return null;
  }

  const rawSubs = d.subtitles || d.tracks || json.subtitles || json.tracks || [];
  const subtitles: StreamSubtitle[] = Array.isArray(rawSubs)
    ? rawSubs
        .map((s: any) => ({
          file: s.file || s.url || s.src || '',
          label: s.label || s.language || s.lang || 'English',
          kind: s.kind || 'subtitles',
          default: Boolean(s.default || s.isDefault),
        }))
        .filter((s: StreamSubtitle) => Boolean(s.file))
    : [];

  return {
    m3u8: m3u8Url,
    referer: d.referer || json.referer || 'https://megaplay.buzz/',
    intro: d.intro,
    outro: d.outro,
    subtitles,
  };
}

export async function fetchAnimeStream(
  animeOrSlug: string | AnimeItem,
  server: ServerType = 'hd-2',
  ep: number = 1,
  type: 'sub' | 'dub' = 'sub',
  signal?: AbortSignal
): Promise<StreamData | null> {
  const slug = typeof animeOrSlug === 'string' ? animeOrSlug : animeOrSlug.slug;
  const malId = typeof animeOrSlug === 'object' ? (animeOrSlug.mal_id || String(animeOrSlug.id)) : slug;

  const cacheKey = `${slug}_${malId}_${server}_ep${ep}_${type}`;
  if (streamCache.has(cacheKey)) {
    return streamCache.get(cacheKey)!;
  }

  if (signal?.aborted) return null;

  try {
    // If requesting DUB, first check if dub is actually available to avoid futile requests & timeouts
    if (type === 'dub') {
      const hasDub = await checkDubAvailable(slug, ep);
      if (!hasDub) {
        return null;
      }
    }

    const fetchServerStream = async (targetServer: ServerType): Promise<StreamData | null> => {
      const targetUrl = `${STREAM_BASE_URL}?id=${encodeURIComponent(slug)}&server=${targetServer}&ep=${ep}&type=${type}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9500);

      const onParentAbort = () => controller.abort();
      if (signal) signal.addEventListener('abort', onParentAbort);

      try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onParentAbort);
        if (!res.ok) return null;
        const json = await res.json();
        return normalizeStreamResponse(json);
      } catch {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onParentAbort);
        return null;
      }
    };

    // Attempt primary requested server
    let stream = await fetchServerStream(server);

    // Fallbacks if primary fails
    if (!stream) {
      const fallbackOrder: ServerType[] = (['hd-2', 'hd-1'] as ServerType[]).filter(
        (s) => s !== server
      );
      for (const fallbackSrv of fallbackOrder) {
        if (signal?.aborted) break;
        stream = await fetchServerStream(fallbackSrv);
        if (stream) break;
      }
    }

    if (stream && stream.m3u8) {
      streamCache.set(cacheKey, stream);
      return stream;
    }

    // High reliability fallback stream for uncatalogued titles
    const fallbackStream = getFallbackStreamForSlug(slug);
    if (fallbackStream && fallbackStream.m3u8) {
      streamCache.set(cacheKey, fallbackStream);
      return fallbackStream;
    }

    return null;
  } catch (err: any) {
    if (err.name === 'AbortError' || signal?.aborted) {
      return null;
    }
    const fallbackStream = getFallbackStreamForSlug(slug);
    if (fallbackStream && fallbackStream.m3u8) {
      streamCache.set(cacheKey, fallbackStream);
      return fallbackStream;
    }
    return null;
  }
}

/**
 * Prefetches the stream m3u8 and warming cache for a list of anime items (e.g. first 3 or upcoming 3)
 */
export function prefetchAnimeStreams(
  animeList: AnimeItem[],
  server: ServerType = 'hd-2',
  epMap: Record<number, number> = {},
  isDub = false,
  startIndex = 0,
  count = 3
) {
  if (!animeList || animeList.length === 0) return;
  const targetSlice = animeList.slice(startIndex, startIndex + count);

  targetSlice.forEach((anime, idx) => {
    if (!anime) return;
    const currentEp = epMap[anime.id] || getLatestEpisode(anime) || 1;
    // Stagger requests slightly by 60ms to prevent network congestion
    setTimeout(() => {
      fetchAnimeStream(anime, server, currentEp, isDub ? 'dub' : 'sub').catch(() => {});
    }, idx * 60);
  });
}

/**
 * Returns proxied m3u8 URL with Referer header if needed
 */
export function getProxiedM3u8Url(m3u8Url: string, referer = 'https://megaplay.buzz/'): string {
  if (!m3u8Url) return '';
  // Route through server proxy
  return `/api/proxy?url=${encodeURIComponent(m3u8Url)}&referer=${encodeURIComponent(referer)}`;
}

/**
 * Fetches the rich episode list metadata (thumbnails, title, description, rating, duration)
 * from https://anime-metadata-api.vercel.app/api/episodes/{ani_id}
 */
export async function fetchAnimeEpisodesMetadata(
  aniId: string | number,
  signal?: AbortSignal
): Promise<AnimeEpisodeMetadata[]> {
  if (!aniId) return [];
  const key = String(aniId).trim();
  if (!key || key === '0' || key === 'undefined' || key === 'null') return [];

  if (metadataCache.has(key)) {
    return metadataCache.get(key)!;
  }

  try {
    const directUrl = `${METADATA_EPISODES_BASE_URL}/${encodeURIComponent(key)}`;
    let response = await fetch(directUrl, { signal }).catch(() => null);

    if (!response || !response.ok) {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(directUrl)}`;
      response = await fetch(proxyUrl, { signal }).catch(() => null);
    }

    if (response && response.ok) {
      const json: AnimeMetadataResponse = await response.json();
      if (json && json.success && json.data && Array.isArray(json.data.episodes)) {
        metadataCache.set(key, json.data.episodes);
        return json.data.episodes;
      }
    }
  } catch (err) {
    console.warn(`[animeApi] Failed to fetch episodes metadata for ani_id ${key}:`, err);
  }

  return [];
}

function stringToUniqueId(str: string): number {
  let hash = 0;
  if (!str) return Math.floor(Math.random() * 1000000) + 1;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) || Math.floor(Math.random() * 1000000) + 1;
}

function mapSearchResultToAnimeItem(item: any): AnimeItem {
  const is_sub = item.sub ? parseInt(String(item.sub), 10) || 1 : 1;
  const is_dub = item.dub ? parseInt(String(item.dub), 10) || 0 : 0;
  const numId = stringToUniqueId(item.id || item.title);

  return {
    id: numId,
    title: item.title,
    slug: item.id, // item.id is the slug in this search API
    poster: item.image,
    is_sub,
    is_dub,
    episodes: item.episodes || String(is_sub),
    description: `Type: ${item.type || 'TV'}. Sub: ${item.sub || 'N/A'}, Dub: ${item.dub || 'N/A'}.`,
    rating: item.type || 'TV',
    score: '7.8',
  };
}

function mapGenreResultToAnimeItem(item: any): AnimeItem {
  let cleanSlug = item.slug || '';
  if (cleanSlug.includes('/')) {
    cleanSlug = cleanSlug.split('/')[0];
  }

  const is_sub = typeof item.sub === 'number' ? item.sub : (parseInt(String(item.sub), 10) || 1);
  const is_dub = typeof item.dub === 'number' ? item.dub : (parseInt(String(item.dub), 10) || 0);
  const numId = item.animeId ? (parseInt(String(item.animeId), 10) || stringToUniqueId(cleanSlug)) : stringToUniqueId(cleanSlug);

  return {
    id: numId,
    title: item.title,
    slug: cleanSlug,
    poster: item.poster,
    is_sub,
    is_dub,
    episodes: String(item.total || is_sub),
    description: item.japaneseTitle ? `Japanese Title: ${item.japaneseTitle}` : '',
    rating: item.type || 'TV',
    score: item.rating || '7.5',
  };
}

export async function searchAnimeOnApi(keyword: string): Promise<AnimeItem[]> {
  if (!keyword || keyword.trim().length < 1) return [];
  try {
    const targetUrl = `https://anikoto-api.vercel.app/api/search?keyword=${encodeURIComponent(keyword)}`;
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
    if (!res.ok) return [];
    const json = await res.json();
    if (json && json.success && Array.isArray(json.data)) {
      return json.data.map(mapSearchResultToAnimeItem);
    }
  } catch (err) {
    console.warn('[searchAnimeOnApi] error:', err);
  }
  return [];
}

export async function fetchAnimeByGenreOnApi(genre: string, page?: number): Promise<AnimeItem[]> {
  if (!genre) return [];
  try {
    const cleanGenre = genre.toLowerCase().trim().replace(/\s+/g, '-');
    const pageQuery = page ? `?page=${page}` : '';
    const targetUrl = `https://anikototvapi.vercel.app/api/genre/${cleanGenre}${pageQuery}`;
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`);
    if (!res.ok) return [];
    const json = await res.json();
    const dataList = json.results?.data || json.data || json.results || [];
    if (Array.isArray(dataList)) {
      return dataList.map(mapGenreResultToAnimeItem);
    }
  } catch (err) {
    console.warn('[fetchAnimeByGenreOnApi] error:', err);
  }
  return [];
}


