import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'

import { POSTER_SIZE } from '@/domain/poster'

test('fills an offer page, saves it and downloads its pages as PNG', async ({
  page
}) => {
  // On a cold `next dev` this test compiles most routes and launches the poster renderer's
  // Chromium, which outlasts the default timeout on a loaded machine (#35)
  test.slow()

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
  await page.getByRole('button', { name: 'Nova oferta', exact: true }).click()
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

test('registers a missing product from an offer slot', async ({ page }) => {
  const code = `E2E-SLOT-${Date.now()}`
  const slotCode = page.getByLabel('Produto 1', { exact: true })

  await page.goto('/ofertas')
  await page.getByRole('button', { name: 'Nova oferta', exact: true }).click()
  await expect(page).toHaveURL(/\/ofertas\/\d+$/)

  await slotCode.fill(code)
  await slotCode.press('Enter')
  await expect(page.getByText(`Código ${code} não cadastrado.`)).toBeVisible()
  await page
    .getByRole('button', { name: 'Cadastrar produto (Produto 1)', exact: true })
    .click()

  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  await expect(
    dialog.getByLabel('Código de barras ou código interno')
  ).toHaveValue(code)
  await expect(dialog.getByLabel('Nome')).toBeFocused()
  await dialog.getByLabel('Nome').fill('Arroz agulhinha')
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByLabel('Preço de Arroz agulhinha (R$)')).toBeFocused()
})

test('asks before leaving the offer editor with unsaved changes', async ({
  page
}) => {
  await page.goto('/ofertas')
  await page.getByRole('button', { name: 'Nova oferta', exact: true }).click()
  await expect(page).toHaveURL(/\/ofertas\/\d+$/)
  const editorUrl = page.url()

  const name = page.getByLabel('Nome da oferta')
  await name.fill('Oferta não salva')
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Produtos' })
    .click()

  const dialog = page.getByRole('alertdialog', { name: 'Sair sem salvar?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(editorUrl)
  await expect(name).toHaveValue('Oferta não salva')

  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Ofertas' })
    .click()
  await dialog.getByRole('button', { name: 'Sair sem salvar' }).click()
  await expect(page).toHaveURL(/\/ofertas$/)
})
