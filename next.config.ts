import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  serverExternalPackages: ["pdf-parse"],
  
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'fallyx-behaviours.up.railway.app',
          },
        ],
        destination: 'https://behaviours.ascenix.co/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'fallyx-behaviours-staging.up.railway.app',
          },
        ],
        destination: 'https://behaviours.ascenix.co/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
