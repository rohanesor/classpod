import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@classpod/shared'],
};

export default nextConfig;
