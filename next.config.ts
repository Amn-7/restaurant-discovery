import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const csp = [
  "default-src 'self'",
  // Allow inline scripts for Next.js hydration in production; keep 'unsafe-eval' only in dev.
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  // Allow inline styles for CSS-in-JS/Tailwind runtime style tags
  `style-src 'self' 'unsafe-inline'`,
  "img-src 'self' data: blob: https://images.unsplash.com https://source.unsplash.com https://loremflickr.com https://images.pexels.com https://cdn.pixabay.com https://res.cloudinary.com",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), accelerometer=(), gyroscope=()'
  }
];

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'source.unsplash.com' },
      { protocol: 'https', hostname: 'loremflickr.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'cdn.pixabay.com' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' }
    ]
  },
  async rewrites() {
    const target = process.env.API_PROXY_ORIGIN;
    if (!target) return [];
    // Proxy API calls to a separate backend origin while keeping same-origin URLs in the browser
    return [
      { source: '/api/:path*', destination: `${target}/api/:path*` },
      { source: '/sse/:path*', destination: `${target}/sse/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
