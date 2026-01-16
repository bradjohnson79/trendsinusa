import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are compiled to `dist/` by their `dev` scripts (tsc --watch),
  // so Next can treat them like normal dependencies (no TS/relative-import edge cases).
  serverExternalPackages: ['@trendsinusa/db', '@trendsinusa/shared'],
  images: {
    // Retailer-provided images come from various hosts (Amazon CDN, etc). We allow HTTPS remote images.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;

