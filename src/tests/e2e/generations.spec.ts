import { expect, test } from '@playwright/test'

import { openEmptyOffer } from './offer-helpers'

test('downloads a whole generation and imports it back as a new one', async ({
  page
}) => {
  // Generating renders the pages with the poster renderer's Chromium on a cold `next dev` (#35)
  test.slow()

  await openEmptyOffer(page)
  await page.getByRole('button', { name: 'Gerar' }).click()
  const ready = page.getByText(/Geração \d+ pronta\./)
  await expect(ready).toBeVisible()
  const number = /\d+/.exec((await ready.textContent()) ?? '')?.[0]

  await page.goto('/geracoes')
  const downloadEvent = page.waitForEvent('download')
  await page
    .getByRole('link', { name: `Baixar geração completa (geração ${number})` })
    .click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe(`geracao-${number}-completa.zip`)

  const importButton = page
    .getByRole('main')
    .getByRole('button', { name: 'Importar geração' })
  await page.locator('input[type="file"]').setInputFiles(await download.path())
  const dialog = page.getByRole('alertdialog', {
    name: 'Importar esta geração?'
  })
  await expect(dialog.getByText(number ?? '', { exact: true })).toBeVisible()
  const next = await dialog.getByText(/^Geração \d+$/).textContent()
  await dialog.getByRole('button', { name: 'Importar geração' }).click()

  await expect(
    page.getByText(`Geração importada como ${next?.toLowerCase()}.`)
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: next ?? '' })).toBeVisible()
  await expect(importButton).toBeFocused()
})

test('refuses a file that is not a generation', async ({ page }) => {
  await page.goto('/geracoes')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'fotos.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not a zip')
  })
  await expect(page.getByText(/não é uma geração do app/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Importar geração' })
  ).toBeFocused()
})
