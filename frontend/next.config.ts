import type { NextConfig } from "next";

const isVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  output: isVercel ? undefined : 'export',
  images: {
    unoptimized: true,
  },
  ...(isVercel ? {
    async rewrites() {
      return [
        {
          source: '/api/gsi/client',
          destination: 'https://accounts.google.com/gsi/client',
        },
      ];
    },
  } : {}),
};

export default nextConfig;
