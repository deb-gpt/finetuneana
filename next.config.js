/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Can be increased for AWS (up to 50mb for containers)
    },
  },
  // Uncomment for Docker/container deployment:
  // output: 'standalone',
}

module.exports = nextConfig

