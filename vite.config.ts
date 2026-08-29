import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function hlsProxyPlugin(): Plugin {
  return {
    name: 'hls-proxy-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/proxy')) {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const targetUrl = urlObj.searchParams.get('url');
            const referer = urlObj.searchParams.get('referer') || 'https://megaplay.buzz/';

            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
              res.setHeader('Access-Control-Allow-Headers', '*');
              res.statusCode = 200;
              res.end();
              return;
            }

            if (!targetUrl) {
              res.statusCode = 400;
              res.end('Missing target url');
              return;
            }

            const reqHeaders: Record<string, string> = {
              'Referer': referer,
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            };

            if (req.headers.range) {
              reqHeaders['Range'] = req.headers.range as string;
            }

            const response = await fetch(targetUrl, { headers: reqHeaders });

            const contentType = response.headers.get('content-type') || '';
            const finalUrl = response.url || targetUrl;

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');

            if (response.headers.get('content-range')) {
              res.setHeader('Content-Range', response.headers.get('content-range')!);
            }
            if (response.headers.get('accept-ranges')) {
              res.setHeader('Accept-Ranges', response.headers.get('accept-ranges')!);
            }

            // Playlist files
            if (targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u8')) {
              const text = await response.text();
              const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);

              const rewrittenLines = text.split('\n').map((line) => {
                const trimmed = line.trim();
                if (!trimmed) return line;

                if (trimmed.startsWith('#')) {
                  return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
                    let fullUri = uri;
                    if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
                      fullUri = new URL(uri, baseUrl).toString();
                    }
                    return `URI="/api/proxy?url=${encodeURIComponent(fullUri)}&referer=${encodeURIComponent(referer)}"`;
                  });
                }

                let fullUrl = trimmed;
                if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                  fullUrl = new URL(trimmed, baseUrl).toString();
                }
                return `/api/proxy?url=${encodeURIComponent(fullUrl)}&referer=${encodeURIComponent(referer)}`;
              });

              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
              res.statusCode = response.status;
              res.end(rewrittenLines.join('\n'));
              return;
            }

            // Subtitles or binary media segments
            if (targetUrl.includes('.vtt') || contentType.includes('vtt')) {
              res.setHeader('Content-Type', 'text/vtt');
            } else {
              res.setHeader('Content-Type', contentType || 'video/MP2T');
            }

            res.statusCode = response.status;
            const arrayBuffer = await response.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
          } catch (err: any) {
            console.error('HLS Proxy error:', err);
            res.statusCode = 500;
            res.end(err?.message || 'Proxy error');
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), hlsProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
