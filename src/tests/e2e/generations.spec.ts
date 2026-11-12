import { expect, test } from '@playwright/test'

import { openEmptyOffer } from './offer-helpers'

test('downloads a whole generation and imports it back as a new one', async ({
  page
}) => {
  // Generating renders the pages with the poster renderer's Chromium on a cold `next dev` (#35)
  test.slow()

  await openEmptyOffer(page)
  await page.getByRole('button', { name: 'Gerar oferta' }).click()
  const ready = page.getByText(/Oferta \d+ gerada\./)
  await expect(ready).toBeVisible()
  const number = /\d+/.exec((await ready.textContent()) ?? '')?.[0]

  await page.goto('/historico')
  const downloadEvent = page.waitForEvent('download')
  await page
    .getByRole('link', { name: `Baixar tudo (ZIP) da oferta ${number}` })
    .click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe(`oferta-${number}-completa.zip`)

  const importButton = page
    .getByRole('main')
    .getByRole('button', { name: 'Importar para o histórico' })
  await page.locator('input[type="file"]').setInputFiles(await download.path())
  const dialog = page.getByRole('alertdialog', {
    name: 'Importar esta oferta?'
  })
  await expect(dialog.getByText(number ?? '', { exact: true })).toBeVisible()
  const next = await dialog.getByText(/^Oferta \d+$/).textContent()
  await dialog.getByRole('button', { name: 'Importar oferta' }).click()

  await expect(
    page.getByText(`Oferta importada como ${next?.toLowerCase()}.`)
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: next ?? '' })).toBeVisible()
  await expect(importButton).toBeFocused()
})

test('refuses a file that is not a generation', async ({ page }) => {
  await page.goto('/historico')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'fotos.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not a zip')
  })
  await expect(
    page.getByText(/não é uma oferta do histórico do app/)
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Importar para o histórico' })
  ).toBeFocused()
})

test('copies the chosen pages of a generation to the end of the offer', async ({
  page
}) => {
  // Generating renders the pages with the poster renderer's Chromium on a cold `next dev` (#35)
  test.slow()

  await openEmptyOffer(page)
  await page.getByRole('button', { name: 'Gerar oferta' }).click()
  const ready = page.getByText(/Oferta \d+ gerada\./)
  await expect(ready).toBeVisible()
  const number = /\d+/.exec((await ready.textContent()) ?? '')?.[0]

  await page.goto('/historico')
  const trigger = page.getByRole('button', {
    name: `Copiar artes da oferta ${number} para a oferta atual`
  })
  await trigger.click()
  const dialog = page.getByRole('dialog', {
    name: `Copiar artes da oferta ${number}`
  })
  const copy = dialog.getByRole('button', { name: /^Copiar (\d+ )?artes?$/ })
  await expect(copy).toBeDisabled()
  await dialog.getByRole('checkbox', { name: 'Arte 1' }).check()
  await copy.click()

  await expect(
    page.getByText('1 arte copiada para o fim da oferta.')
  ).toBeVisible()
  await expect(trigger).toBeFocused()
  await page.getByRole('link', { name: 'Abrir oferta' }).click()
  const copied = page.getByRole('tab', { name: 'Arte 2' })
  await expect(copied).toBeVisible()

  // The other tests share the offer and expect a single page
  await copied.click()
  await page.getByRole('button', { name: 'Remover arte' }).click()
  await page
    .getByRole('alertdialog', { name: 'Remover a arte 2?' })
    .getByRole('button', { name: 'Remover' })
    .click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()
})
