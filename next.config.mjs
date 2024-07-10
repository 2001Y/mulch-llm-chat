/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/manifest.json',
        destination: '/manifest.json.js'
      }
    ];
  }
};

export default nextConfig;