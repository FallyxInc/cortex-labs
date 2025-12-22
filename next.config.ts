import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  serverExternalPackages: ["pdf-parse"],
  
  // Increase body size limit for file uploads (default is 10MB)
  experimental: {
    proxyClientMaxBodySize: '50mb'
  },
};

export default nextConfig;
