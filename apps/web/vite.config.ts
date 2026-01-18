import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// No SSR, no server-only plugins. Keep Vite boring and deterministic.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    // Hard-fail if the frontend ever tries to import backend/prisma/worker code.
    alias: [
      { find: '@trendsinusa/db', replacement: '/__forbidden__/@trendsinusa-db' },
      { find: '@trendsinusa/worker', replacement: '/__forbidden__/@trendsinusa-worker' },
      { find: '@prisma/client', replacement: '/__forbidden__/@prisma-client' },
    ],
  },
  server: {
    // Backend/API runs on 3005. Keep Vite on a different port and proxy /api.
    port: 3006,
    strictPort: true,
    proxy: {
      '/api': {
        // Use 127.0.0.1 to avoid IPv6/localhost resolution edge-cases.
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: 'http://127.0.0.1:3005',
        changeOrigin: true,
      },
    },
    fs: {
      // Allow importing repo-level site configs (e.g. /sites/usa/config.ts) without duplicating code.
      // IMPORTANT: this list must include the app root too, otherwise Vite can't serve index.html.
      allow: [path.resolve(__dirname), path.resolve(__dirname, '../../sites')],
    },
  },
});

