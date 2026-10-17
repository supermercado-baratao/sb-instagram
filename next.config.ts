import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: true,
  outputFileTracingIncludes: {
    // playwright-core reads the browser revision from this file at runtime, so tracing misses it
    '/*': ['./node_modules/playwright-core/browsers.json']
  }
}

export default nextConfig
