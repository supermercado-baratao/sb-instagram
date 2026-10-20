import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'

import { POSTER_SIZE } from '@/domain/poster'

test('fills an offer page, saves it and downloads its pages as PNG', async ({
  page
}) => {
  // A reused e2e server keeps its data between runs, so each run uses a code it never saw
  const code = `E2E-OFFER-${Date.now()}`
  const productCode = page.getByLabel('Código de barras ou código interno')

  await page.goto('/produtos')
  await productCode.fill(code)
  await productCode.press('Enter')
  await page.getByLabel('Nome').fill('Feijão carioca')
  await page.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText('Feijão carioca salvo')).toBeVisible()

  await page.goto('/ofertas')
  await page.getByRole('button', { name: 'Nova oferta' }).click()
  await expect(page).toHaveURL(/\/ofertas\/\d+$/)

  await page.getByLabel('Nome da oferta').fill(`Oferta ${code}`)
  await page.getByLabel('Produto 1', { exact: true }).fill(code)
  await page.getByLabel('Produto 1', { exact: true }).press('Enter')
  const price = page.getByLabel('Preço de Feijão carioca (R$)')
  await expect(price).toBeFocused()

  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Falta o preço')).toBeVisible()

  await price.fill('7,89')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()

  await page.reload()
  await expect(price).toHaveValue('7,89')

  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar páginas (PNG)' }).click()
  const download = await downloadEvent
  const zip = unzipSync(await readFile(await download.path()))

  expect(Object.keys(zip)).toEqual(['pagina-1.png'])
  const png = Buffer.from(zip['pagina-1.png'])
  // The IHDR chunk holds the width and height right after the 8-byte signature and its header
  expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual(
    POSTER_SIZE
  )
})
