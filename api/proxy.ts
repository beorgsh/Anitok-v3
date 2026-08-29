import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS Headers for all requests including preflight OPTIONS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD, PUT, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Range, Authorization, Referer, Origin');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = req.query.url as string;
  const referer = (req.query.referer as string) || 'https://megaplay.buzz/';

  if (!targetUrl) {
    return res.status(400).send('Missing target url parameter');
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

  try {
    const response = await fetch(targetUrl, { headers });

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

        if (trimmed.startsWith('/api/proxy') || trimmed.includes('/api/proxy?url=')) {
          return line;
        }

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
    console.error('Vercel Proxy Error:', err);
    return res.status(500).send(err?.message || 'Proxy error');
  }
}
