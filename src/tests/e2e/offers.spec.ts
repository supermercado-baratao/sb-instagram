import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'

import { POSTER_SIZE } from '@/domain/poster'

import { openEmptyOffer } from './offer-helpers'

test('fills an offer page, saves it, generates it and keeps the generation when a product changes', async ({
  page
}) => {
  // On a cold `next dev` this test compiles most routes and launches the poster renderer's
  // Chromium, which outlasts the default timeout on a loaded machine (#35)
  test.slow()

  // A reused e2e server keeps its data between runs, so each run uses a code it never saw
  const code = `E2E-OFFER-${Date.now()}`
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  const productCode = dialog.getByLabel('Código de barras ou código interno')

  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await productCode.fill(code)
  await productCode.press('Enter')
  await dialog.getByLabel('Nome').fill('Feijão carioca')
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText('Feijão carioca salvo')).toBeVisible()

  await openEmptyOffer(page)

  await page.getByLabel('Produto 1', { exact: true }).fill(code)
  await page.getByLabel('Produto 1', { exact: true }).press('Enter')
  const price = page.getByLabel('Preço de Feijão carioca (R$)')
  await expect(price).toBeFocused()
  // Only now: a product placed proves the page is hydrated, or the filled date would be lost
  await page.getByLabel('Válida até').fill('2026-11-12')

  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Falta o preço')).toBeVisible()

  await price.fill('7,89')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()

  await page.reload()
  await expect(price).toHaveValue('7,89')
  await expect(page.getByLabel('Válida até')).toHaveValue('2026-11-12')

  await page.getByRole('button', { name: 'Gerar' }).click()
  await expect(page.getByText(/Geração \d+ pronta\./)).toBeVisible()
  // Edits made after generating must still ask before the toast's link leaves the page
  await page.getByLabel('Título do destaque').fill('Editado depois de gerar')
  await page.getByRole('link', { name: 'Ver gerações' }).click()
  await page
    .getByRole('alertdialog', { name: 'Sair sem salvar?' })
    .getByRole('button', { name: 'Sair sem salvar' })
    .click()
  await expect(page).toHaveURL('/geracoes')
  // A reused e2e server keeps the generations of a previous run, so the newest one is picked
  const generation = page
    .getByRole('listitem')
    .filter({
      has: page.getByRole('heading', {
        name: /Geração \d+ · válida até 12\/11\/2026/
      })
    })
    .first()
  const heading = await generation.getByRole('heading').textContent()
  const number = /\d+/.exec(heading ?? '')?.[0]
  await expect(
    generation.getByRole('img', {
      name: new RegExp(`Página 1 da geração ${number}`)
    })
  ).toBeVisible()

  // The generation keeps what was generated, so a product changed later never reaches it
  await page.goto('/ofertas')
  await page.getByRole('button', { name: 'Editar Feijão carioca' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Editar produto' })
  await editDialog.getByLabel('Nome').fill('Feijão preto')
  await editDialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText('Feijão preto atualizado.')).toBeVisible()

  await page.goto('/geracoes')
  const downloadEvent = page.waitForEvent('download')
  await generation.getByRole('link', { name: 'Baixar páginas (PNG)' }).click()
  const download = await downloadEvent
  const zip = unzipSync(await readFile(await download.path()))

  expect(Object.keys(zip)).toEqual(['pagina-1.png'])
  const png = Buffer.from(zip['pagina-1.png'])
  // The IHDR chunk holds the width and height right after the 8-byte signature and its header
  expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual(
    POSTER_SIZE
  )

  // Headless Chromium downloads a PDF instead of showing it, so the popup never settles on its URL
  const pdfEvent = page
    .context()
    .waitForEvent('request', (request) =>
      request.url().endsWith('/paginas.pdf')
    )
  await generation.getByRole('link', { name: /Imprimir páginas/ }).click()
  const pdfRequest = await pdfEvent
  // A downloaded response has no body to read, so the PDF is fetched again
  const response = await page.request.get(pdfRequest.url())
  expect(response.headers()['content-type']).toBe('application/pdf')
  const body = await response.body()
  const pdf = body.toString('latin1')
  // One sheet per offer page; `/Type /Pages` is the page tree, not a sheet
  expect(pdf.match(/\/Type\s*\/Page\b/g)).toHaveLength(1)

  // The PDF popup may still deliver its own download, so the JSON one is picked by name
  const jsonEvent = page.waitForEvent('download', (download) =>
    download.suggestedFilename().endsWith('.json')
  )
  await generation
    .getByRole('link', { name: 'Exportar produtos (JSON)' })
    .click()
  const jsonDownload = await jsonEvent
  const json = JSON.parse(await readFile(await jsonDownload.path(), 'utf8'))
  expect(json.pages).toEqual([
    {
      number: 1,
      products: [
        {
          name: 'Feijão carioca',
          brand: null,
          unit: null,
          codes: [code],
          price: '7,89'
        }
      ]
    }
  ])

  await generation
    .getByRole('button', { name: `Roteiro do comercial da geração ${number}` })
    .click()
  const scriptDialog = page.getByRole('dialog', {
    name: `Roteiro do comercial da geração ${number}`
  })
  // A reused e2e server keeps the blocks of a previous run, so only the product line is fixed
  await expect(
    scriptDialog.getByRole('region', { name: 'Roteiro do comercial' })
  ).toContainText(/- Feijão carioca(, .+)?: sete e oitenta e nove/)
  await scriptDialog.press('Escape')

  await generation
    .getByRole('button', { name: `Excluir a geração ${number}` })
    .click()
  await page
    .getByRole('alertdialog', { name: `Excluir a geração ${number}?` })
    .getByRole('button', { name: 'Excluir' })
    .click()
  await expect(page.getByText(`Geração ${number} excluída.`)).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Gerações', level: 1 })
  ).toBeFocused()
})

test('registers a missing product from an offer slot', async ({ page }) => {
  const code = `E2E-SLOT-${Date.now()}`
  const slotCode = page.getByLabel('Produto 1', { exact: true })

  await openEmptyOffer(page)

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

test('places a product searched by name in an offer slot', async ({ page }) => {
  const stamp = Date.now()
  const code = `E2E-NAME-${stamp}`
  const name = `Sabão em pó ${stamp}`
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  const productCode = dialog.getByLabel('Código de barras ou código interno')

  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await productCode.fill(code)
  await productCode.press('Enter')
  await dialog.getByLabel('Nome').fill(name)
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText(`${name} salvo`)).toBeVisible()

  await openEmptyOffer(page)

  const slotCode = page.getByLabel('Produto 1', { exact: true })
  await slotCode.fill(`SABAO EM PO ${stamp}`)
  await expect(
    page.getByRole('option', { name: new RegExp(name) })
  ).toBeVisible()
  await slotCode.press('ArrowDown')
  await slotCode.press('Enter')

  await expect(page.getByLabel(`Preço de ${name} (R$)`)).toBeFocused()

  // With suggestions open but none highlighted, Enter still looks up the exact code, like a scan
  const secondSlot = page.getByLabel('Produto 2', { exact: true })
  await secondSlot.fill(code)
  await expect(
    page.getByRole('option', { name: new RegExp(name) })
  ).toBeVisible()
  await secondSlot.press('Enter')
  await expect(page.getByLabel(`Preço de ${name} (R$)`).nth(1)).toBeFocused()
})

test('edits a product placed in an offer slot', async ({ page }) => {
  const code = `E2E-EDIT-${Date.now()}`
  const createDialog = page.getByRole('dialog', {
    name: 'Cadastrar produto'
  })
  const productCode = createDialog.getByLabel(
    'Código de barras ou código interno'
  )

  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await productCode.fill(code)
  await productCode.press('Enter')
  await createDialog.getByLabel('Nome').fill('Café torrado')
  await createDialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText('Café torrado salvo')).toBeVisible()

  await openEmptyOffer(page)

  await page.getByLabel('Produto 1', { exact: true }).fill(code)
  await page.getByLabel('Produto 1', { exact: true }).press('Enter')
  await page.getByLabel('Preço de Café torrado (R$)').fill('15,90')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()

  await page.getByRole('button', { name: 'Editar Café torrado' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar produto' })
  await expect(dialog.getByLabel('Nome')).toBeFocused()
  await dialog.getByLabel('Nome').fill('Café extraforte')
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('Café extraforte atualizado.')).toBeVisible()
  await expect(page.getByLabel('Preço de Café extraforte (R$)')).toHaveValue(
    '15,90'
  )
  await expect(page.getByText('Tudo salvo')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Editar Café extraforte' })
  ).toBeFocused()
})

test('clears the prices or the products of the offer', async ({ page }) => {
  const code = `E2E-CLEAR-${Date.now()}`
  const productName = 'Óleo de soja'
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  const productCode = dialog.getByLabel('Código de barras ou código interno')

  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await productCode.fill(code)
  await productCode.press('Enter')
  await dialog.getByLabel('Nome').fill(productName)
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText(`${productName} salvo`)).toBeVisible()

  await openEmptyOffer(page)
  await page.getByLabel('Produto 1', { exact: true }).fill(code)
  await page.getByLabel('Produto 1', { exact: true }).press('Enter')
  const price = page.getByLabel(`Preço de ${productName} (R$)`)
  await price.fill('8,49')
  await page.getByLabel('Válida até').fill('2026-11-12')

  await page.getByRole('button', { name: 'Limpar preços' }).click()
  const pricesDialog = page.getByRole('alertdialog', {
    name: 'Limpar os preços da oferta?'
  })
  await expect(pricesDialog).toContainText('O produto continua nas páginas')
  await pricesDialog.getByRole('button', { name: 'Limpar preços' }).click()
  await expect(price).toHaveValue('')
  await expect(price).toBeFocused()
  await expect(page.getByLabel('Válida até')).toHaveValue('')

  await page.getByRole('button', { name: 'Limpar produtos' }).click()
  const productsDialog = page.getByRole('alertdialog', {
    name: 'Limpar os produtos da oferta?'
  })
  await expect(productsDialog).toContainText(
    'O produto sai de todas as páginas'
  )
  await productsDialog.getByRole('button', { name: 'Limpar produtos' }).click()
  await expect(price).toBeHidden()
  await expect(page.getByLabel('Produto 1', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Produto 1', { exact: true })).toBeFocused()
})

test('asks before leaving the offer editor with unsaved changes', async ({
  page
}) => {
  await openEmptyOffer(page)

  const highlight = page.getByLabel('Título do destaque')
  await highlight.fill('Oferta não salva')
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Produtos' })
    .click()

  const dialog = page.getByRole('alertdialog', { name: 'Sair sem salvar?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL('/ofertas')
  await expect(highlight).toHaveValue('Oferta não salva')

  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Produtos' })
    .click()
  await dialog.getByRole('button', { name: 'Sair sem salvar' }).click()
  await expect(page).toHaveURL('/produtos')
})
