import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Phone photos are often larger than the 1 MB default; leaves room above PHOTO_MAX_MEGABYTES
      // for the other form fields
      bodySizeLimit: '11mb'
    }
  },
  outputFileTracingIncludes: {
    // playwright-core reads the browser revision from this file at runtime, so tracing misses it
    '/*': ['./node_modules/playwright-core/browsers.json']
  }
}

export default nextConfig
