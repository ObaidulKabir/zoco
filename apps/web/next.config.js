const path = require('node:path');

/**
 * Standalone output traces the server and its dependencies into
 * .next/standalone, which is what the runtime image ships. It is opt-in
 * because the tracing step symlinks into the pnpm store, and Windows refuses
 * that without Developer Mode — an ordinary `pnpm build` on a Windows
 * workstation would fail for a mode only the Docker build uses.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  transpilePackages: ['@zoqo/ui'],
  eslint: { ignoreDuringBuilds: true },
  ...(process.env.NEXT_OUTPUT === 'standalone'
    ? {
        output: 'standalone',
        // Must be the repo root or the workspace symlinks are missed.
        experimental: { outputFileTracingRoot: path.join(__dirname, '../..') },
      }
    : {}),
};

module.exports = nextConfig;
