/** @type {import('next').NextConfig} */
const nextConfig = {
  // Runs through server.js (see package.json "start"), which suits cPanel "Setup Node.js App", PM2 or a VPS.
  images: {
    // Keeps hosting simple: no image optimizer binary needed on shared hosting.
    unoptimized: true,
  },
  poweredByHeader: false,
  experimental: {
    // Product photo uploads from the admin panel (up to 4 MB each).
    serverActions: { bodySizeLimit: '5mb' },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
