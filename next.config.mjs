const dev = process.env.NODE_ENV !== 'production';

/*
 * Content Security Policy: the browser only runs scripts and loads files from this site, so injected
 * content can't pull in code from elsewhere. Pictures and videos may also come from https links
 * (the slider and categories accept pasted links). Next.js needs inline scripts for page data.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? ' ws:' : ''}`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Content-Security-Policy', value: csp },
          // Browsers only obey this over https: after the first visit they never use plain http for the site.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
        ],
      },
      {
        // Photos shipped with the store: browsers and CDNs keep them for a week, then check for a newer copy.
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
      {
        // The admin panel and its data are never stored by browsers' or proxies' caches.
        source: '/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
