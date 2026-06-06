import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },
  async headers() {
    return [
      {
        source: '/api/admin/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://timesheet.kingsleyhill.com.au' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,x-admin-key' },
        ],
      },
    ]
  },
};

export default nextConfig;
