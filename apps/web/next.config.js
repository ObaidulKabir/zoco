/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@zoqo/ui'],
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
