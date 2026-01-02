import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // This allows the build to finish even if there are linting errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // This allows the build to finish even if there are TypeScript type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
