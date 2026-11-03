import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite ships WASM and data files that must be loaded from node_modules at runtime.
  serverExternalPackages: ['@electric-sql/pglite', 'pglite-prisma-adapter', '@prisma/client', 'pg'],
  // Fonts read from disk by the OG image route.
  outputFileTracingIncludes: {
    '/api/card/[eventId]': ['./node_modules/@fontsource/*/files/*-latin-*.woff'],
  },
  typedRoutes: false,
};

export default nextConfig;
