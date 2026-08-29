import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Rolling active viewers tracking (unique IPs in last 30s)
const activeViewers = new Map<string, number>(); // ip -> lastSeenTimestamp
const MAX_SIMULTANEOUS_VIEWERS = 5;
const ACTIVE_WINDOW_MS = 30000; // 30 seconds

async function handleProxy(req: express.Request, res: express.Response) {
  try {
    const targetUrl = req.query.url as string;
    const referer = (req.query.referer as string) || 'https://megaplay.buzz/';

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
      res.setHeader('Access-Control-Allow-Headers', '*');
      return res.status(200).end();
    }

    if (!targetUrl) {
      return res.status(400).send('Missing target url');
    }

    // IP-based concurrency limiter for video streaming playlist (.m3u8) requests
    const isM3u8Request = targetUrl.includes('.m3u8');
    if (isM3u8Request) {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'anonymous';
      const now = Date.now();

      // Prune inactive sessions older than window
      for (const [viewerIp, lastSeen] of activeViewers.entries()) {
        if (now - lastSeen > ACTIVE_WINDOW_MS) {
          activeViewers.delete(viewerIp);
        }
      }

      // Add or update current viewer
      activeViewers.set(ip, now);

      // Check threshold if client is a new streaming session
      if (activeViewers.size > MAX_SIMULTANEOUS_VIEWERS && !activeViewers.has(ip)) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(429).send(
          `⚠️ SIMULTANEOUS WATCHER LIMIT EXCEEDED\n\n` +
          `To prevent server bandwidth exhaustion and protect Coze/Anikoto API limits, this app is capped at ${MAX_SIMULTANEOUS_VIEWERS} concurrent video streams.\n\n` +
          `Active viewers right now: ${activeViewers.size} / ${MAX_SIMULTANEOUS_VIEWERS}.\n` +
          `Please wait a minute and refresh the page to watch!`
        );
      }
    }

    let origin = 'https://megaplay.buzz';
    try {
      if (referer) origin = new URL(referer).origin;
    } catch {}

    const headers: Record<string, string> = {
      'Referer': referer,
      'Origin': origin,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    const response = await fetch(targetUrl, { headers });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');

    const contentType = response.headers.get('content-type') || '';
    const finalUrl = response.url || targetUrl;

    if (response.headers.get('content-range')) {
      res.setHeader('Content-Range', response.headers.get('content-range')!);
    }
    if (response.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', response.headers.get('accept-ranges')!);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check if payload is an HLS playlist (either by URL, content-type, or #EXTM3U magic signature)
    const previewText = buffer.toString('utf-8', 0, Math.min(buffer.length, 50));
    const isM3u8 =
      targetUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      previewText.trim().startsWith('#EXTM3U');

    if (isM3u8) {
      const text = buffer.toString('utf-8');
      const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);

      const rewrittenLines = text.split('\n').map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Skip lines already pointing to proxy
        if (trimmed.startsWith('/api/proxy') || trimmed.includes('/api/proxy?url=')) {
          return line;
        }

        // Rewrite tags with URI="..." or URI=...
        if (trimmed.startsWith('#')) {
          return line.replace(/URI=(?:"([^"]+)"|([^\s,]+))/g, (_match, uri1, uri2) => {
            const uri = uri1 || uri2;
            let fullUri = uri;
            if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
              try {
                fullUri = new URL(uri, baseUrl).toString();
              } catch {
                fullUri = uri;
              }
            }
            return `URI="/api/proxy?url=${encodeURIComponent(fullUri)}&referer=${encodeURIComponent(referer)}"`;
          });
        }

        let fullUrl = trimmed;
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          try {
            fullUrl = new URL(trimmed, baseUrl).toString();
          } catch {
            fullUrl = trimmed;
          }
        }
        return `/api/proxy?url=${encodeURIComponent(fullUrl)}&referer=${encodeURIComponent(referer)}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.status(response.status).send(rewrittenLines.join('\n'));
    }

    // Subtitles (.vtt)
    if (targetUrl.includes('.vtt') || contentType.includes('vtt') || previewText.trim().startsWith('WEBVTT')) {
      res.setHeader('Content-Type', 'text/vtt');
      return res.status(response.status).send(buffer);
    }

    // Binary media segments (.ts, .m4s, .mp4, images, etc.)
    res.setHeader('Content-Type', contentType || 'video/MP2T');
    return res.status(response.status).send(buffer);
  } catch (err: any) {
    console.error('Proxy Error:', err);
    return res.status(500).send(err?.message || 'Proxy error');
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API CORS proxy route
  app.all('/api/proxy', handleProxy);

  // API Health route
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
