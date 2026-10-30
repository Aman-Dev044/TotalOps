import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  reactStrictMode: true,
  serverExternalPackages: ['mongoose', 'bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};

export default nextConfig;
