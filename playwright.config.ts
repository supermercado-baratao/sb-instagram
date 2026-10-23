import { defineConfig, devices } from '@playwright/test'

// Runs apart from the developer's `pnpm dev` (port 3000, data/), so tests never write store data
const PORT = 3100
const DIST_DIR = '.next/e2e'
const DATA_DIR = `${DIST_DIR}/data`

export default defineConfig({
  testDir: './src/tests/e2e',
  fullyParallel: false,
  // `next dev` compiles a route on its first visit, which outlasts the 5 s default on a loaded machine (#35)
  expect: { timeout: 15_000 },
  webServer: {
    command: `node -e "require('node:fs').rmSync('${DATA_DIR}', { recursive: true, force: true })" && pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      NEXT_DIST_DIR: DIST_DIR,
      DATA_DIR
    }
  },
  use: {
    baseURL: `http://localhost:${PORT}`
  },
  projects: [
    // Every page that uses the brand sends a new instance to the first setup, so it runs first
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
