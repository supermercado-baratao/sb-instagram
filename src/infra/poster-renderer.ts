import { type Browser, chromium } from 'playwright-core'

import { POSTER_SIZE } from '@/domain/poster'

// The browser renders a page of this same server, which listens on PORT inside the container.
// The request's own host may be a reverse proxy the container can't reach
const origin = `http://localhost:${process.env.PORT ?? 3000}`

// Launching Chromium takes about a second, so one browser is kept open and shared by every
// request (and across `next dev` hot reloads, which re-evaluate this module)
const globalForRenderer = globalThis as unknown as {
  browser?: Promise<Browser>
}

const launchBrowser = async () => {
  try {
    const browser = await chromium.launch()
    browser.on('disconnected', () => {
      globalForRenderer.browser = undefined
    })
    return browser
  } catch (error) {
    globalForRenderer.browser = undefined
    throw error
  }
}

const getBrowser = () => {
  globalForRenderer.browser ??= launchBrowser()
  return globalForRenderer.browser
}

const openPosterPage = async (browser: Browser, path: string) => {
  const page = await browser.newPage({ viewport: POSTER_SIZE })
  try {
    const response = await page.goto(new URL(path, origin).href, {
      waitUntil: 'load'
    })
    // Without this, an error page would only fail after the locator's 30s timeout
    if (!response?.ok()) {
      throw new Error(`Poster page ${path} answered ${response?.status()}`)
    }
    // `next dev` injects its indicator into every page, over the poster's bottom-left corner
    await page.addStyleTag({ content: 'nextjs-portal { display: none; }' })
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    return page
  } catch (error) {
    await page.close()
    throw error
  }
}

export const renderPosterPng = async (path: string) => {
  const page = await openPosterPage(await getBrowser(), path)
  try {
    return await page.locator('article').screenshot({ animations: 'disabled' })
  } finally {
    await page.close()
  }
}

// The sheet size and margins come from the page's `@page` rule, so they live next to its layout
export const renderPosterPdf = async (path: string) => {
  const page = await openPosterPage(await getBrowser(), path)
  try {
    return await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      tagged: true
    })
  } finally {
    await page.close()
  }
}
