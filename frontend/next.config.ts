import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  transpilePackages: ['three'],
};

export default nextConfig;
