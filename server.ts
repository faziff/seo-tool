import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { apiRouter } from './src/backend/routes.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Global middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount the native TypeScript REST API on /api. Keep unmatched API URLs as JSON
// responses instead of letting the SPA return index.html for failed API requests.
app.use('/api', apiRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ detail: 'CROX API route not found. Ensure the current full-stack backend version is deployed.' });
});

async function startServer() {
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
