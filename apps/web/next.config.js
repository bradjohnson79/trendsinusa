import path from 'path';
import { fileURLToPath } from 'url';

// ESM-safe __dirname (Next loads this file as ESM due to `export default`).
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  transpilePackages: ['@trendsinusa/shared', '@trendsinusa/db'],
  images: {
    // Retailer-provided images come from various hosts (Amazon CDN, etc). We allow HTTPS remote images.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // NOTE: our workspace packages author ESM with `.js` specifiers (for Node compatibility),
      // so we must alias to compiled output rather than `src/`.
      '@trendsinusa/shared': path.resolve(__dirname, '../../packages/shared/dist'),
      '@trendsinusa/db': path.resolve(__dirname, '../../packages/db/dist'),
    };
    return config;
  },
};

