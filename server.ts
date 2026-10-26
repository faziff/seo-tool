import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { apiRouter } from './src/backend/routes.js';
import { initDb } from './src/backend/db.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Global middleware. Avoid strict CSP here because Vite's development client
// and the SPA asset pipeline require their own script/style handling.
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use('/api', (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// In-process baseline rate limit. Long-running crawler work remains asynchronous,
// and a 429 response is always JSON for predictable client error handling.
const apiRateBuckets = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  const now = Date.now();
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket.remoteAddress || 'unknown';
  const key = `${ip}:${req.method}:${req.path.split('/').slice(0, 3).join('/')}`;
  let bucket = apiRateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + 60_000 };
    apiRateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > 90) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return res.status(429).json({ detail: 'Too many requests for this endpoint. Please wait a moment and try again.' });
  }
  if (apiRateBuckets.size > 5000) {
    for (const [entryKey, entry] of apiRateBuckets) if (entry.resetAt <= now) apiRateBuckets.delete(entryKey);
  }
  next();
});

// Mount the native TypeScript REST API on /api. Keep unmatched API URLs as JSON
// responses instead of letting the SPA return index.html for failed API requests.
app.use('/api', apiRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ detail: 'CROX API route not found. Ensure the current full-stack backend version is deployed.' });
});

async function startServer() {
  await initDb();
  if (!isProduction) {
    // Development mode: attach Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CROX Server] Full-Stack platform running on http://0.0.0.0:${PORT}`);
  });

  const cleanup = () => {
    console.log('[CROX Server] Shutting down cleanly...');
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startServer().catch((err) => {
  console.error('[CROX Server] Fatal startup error:', err);
  process.exit(1);
});
