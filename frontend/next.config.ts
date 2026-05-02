import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
