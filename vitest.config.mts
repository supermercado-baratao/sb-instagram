import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Next.js resolves `server-only` internally; outside it the import has to be a no-op
      'server-only': 'next/dist/compiled/server-only/empty.js'
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['vitest.setup.ts']
  }
})
