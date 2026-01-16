/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@trendsinusa/shared', '@trendsinusa/db'],
  images: {
    // Retailer-provided images come from various hosts (Amazon CDN, etc). We allow HTTPS remote images.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;

