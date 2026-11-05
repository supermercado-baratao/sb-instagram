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
  const viewGenerations = page.getByRole('link', { name: 'Ver gerações' })
  const leaveDialog = page.getByRole('alertdialog', {
    name: 'Sair sem salvar?'
  })
  const keepEditing = leaveDialog.getByRole('button', {
    name: 'Continuar editando'
  })
  await viewGenerations.click()
  await expect(keepEditing).toBeFocused()
  // Staying on the page keeps the toast, which may hold a warning that stays until closed
  await keepEditing.click()
  await expect(leaveDialog).toBeHidden()
  await expect(viewGenerations).toBeVisible()
  await expect(page.getByLabel('Título do destaque')).toBeFocused()
  await viewGenerations.click()
  await leaveDialog.getByRole('button', { name: 'Sair sem salvar' }).click()
  await expect(page).toHaveURL('/geracoes')
  await expect(viewGenerations).toBeHidden()
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
  await page.goto('/')
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
  await page.getByRole('button', { name: `Tirar ${name} da página` }).click()
  await slotCode.fill(code)
  await expect(
    page.getByRole('option', { name: new RegExp(name) })
  ).toBeVisible()
  await slotCode.press('Enter')
  await expect(page.getByLabel(`Preço de ${name} (R$)`)).toBeFocused()

  // The same product doesn't go in twice on a page
  const secondSlot = page.getByLabel('Produto 2', { exact: true })
  await secondSlot.fill(code)
  await secondSlot.press('Enter')
  await expect(page.getByText(`${name} já está nesta página.`)).toBeVisible()
  await expect(page.getByLabel(`Preço de ${name} (R$)`)).toHaveCount(1)
})

test('moves products between the pages of the offer', async ({ page }) => {
  test.slow()
  const stamp = Date.now()
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  const productCode = dialog.getByLabel('Código de barras ou código interno')
  const names = ['Arroz', 'Feijão', 'Macarrão', 'Açúcar'].map(
    (name) => `${name} ${stamp}`
  )
  const [rice, beans, pasta] = names

  await page.goto('/produtos')
  for (const [index, name] of names.entries()) {
    await page.getByRole('button', { name: 'Cadastrar produto' }).click()
    await productCode.fill(`E2E-MOVE-${stamp}-${index}`)
    await productCode.press('Enter')
    await dialog.getByLabel('Nome').fill(name)
    await dialog.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText(`${name} salvo`)).toBeVisible()
  }

  const place = async (position: number, index: number, price: string) => {
    const slot = page.getByLabel(`Produto ${position}`, { exact: true })
    await slot.fill(`E2E-MOVE-${stamp}-${index}`)
    await slot.press('Enter')
    await page.getByLabel(`Preço de ${names[index]} (R$)`).fill(price)
  }
  const openMoveMenu = (name: string) =>
    page
      .getByRole('button', { name: `Mover ${name} para outra página` })
      .click()

  await openEmptyOffer(page)
  await place(1, 0, '10,00')
  await place(2, 1, '20,00')

  await page.getByRole('button', { name: 'Adicionar página' }).click()
  const layout = page.getByRole('group', { name: 'Produtos na página' })
  await layout.getByRole('button', { name: '3' }).click()
  await place(1, 2, '30,00')
  await place(2, 3, '40,00')

  await page.getByRole('tab', { name: 'Página 1' }).click()

  // Goes with its price to the first empty slot of the page, and the editor stays on this page
  await openMoveMenu(rice)
  await page.getByRole('menuitem', { name: 'Página 2' }).click()
  await expect(page.getByRole('tab', { name: 'Página 1' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByText(`${rice} movido para a página 2.`)).toBeVisible()
  await expect(page.getByLabel('Produto 1', { exact: true })).toBeFocused()

  // The full page asks: first a trade, which keeps both prices
  await openMoveMenu(beans)
  await page.getByRole('menuitem', { name: 'Página 2 (cheia)' }).click()
  const full = page.getByRole('dialog', { name: 'A página 2 está cheia' })
  // The menu returns the focus when it unmounts, after its exit animation, so this waits for that
  await expect(page.locator('[data-slot="dropdown-menu-content"]')).toHaveCount(
    0
  )
  await expect(full.locator(':focus')).toHaveCount(1)
  await full.getByRole('button', { name: new RegExp(pasta) }).click()
  await expect(page.getByLabel(`Preço de ${pasta} (R$)`)).toHaveValue('30,00')
  await expect(
    page.getByRole('button', { name: `Mover ${pasta} para outra página` })
  ).toBeFocused()

  // Then a new page, past the last one
  await openMoveMenu(pasta)
  await page.getByRole('menuitem', { name: 'Página 2 (cheia)' }).click()
  await full.getByRole('button', { name: 'Criar página nova' }).click()
  await expect(page.getByRole('tab', { name: 'Página 3' })).toBeVisible()
  await expect(page.getByLabel('Produto 2', { exact: true })).toBeFocused()

  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()

  await page.reload()
  await page.getByRole('tab', { name: 'Página 2' }).click()
  await expect(page.getByLabel(`Preço de ${rice} (R$)`)).toHaveValue('10,00')
  await expect(page.getByLabel(`Preço de ${beans} (R$)`)).toHaveValue('20,00')
  await page.getByRole('tab', { name: 'Página 3' }).click()
  await expect(page.getByLabel(`Preço de ${pasta} (R$)`)).toHaveValue('30,00')
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

test('clears the prices or the products of the offer or of one page', async ({
  page
}) => {
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

  await page
    .getByRole('button', { name: 'Limpar preços de todas as páginas' })
    .click()
  const pricesDialog = page.getByRole('alertdialog', {
    name: 'Limpar os preços de todas as páginas?'
  })
  await expect(pricesDialog).toContainText('O produto continua na página')
  await pricesDialog
    .getByRole('button', { name: 'Limpar preços de todas as páginas' })
    .click()
  await expect(price).toHaveValue('')
  await expect(price).toBeFocused()
  await expect(page.getByLabel('Válida até')).toHaveValue('')

  await page
    .getByRole('button', { name: 'Limpar produtos de todas as páginas' })
    .click()
  const productsDialog = page.getByRole('alertdialog', {
    name: 'Limpar os produtos de todas as páginas?'
  })
  await expect(productsDialog).toContainText('O produto sai da página')
  await productsDialog
    .getByRole('button', { name: 'Limpar produtos de todas as páginas' })
    .click()
  await expect(price).toBeHidden()
  await expect(page.getByLabel('Produto 1', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Produto 1', { exact: true })).toBeFocused()

  await page.getByLabel('Produto 1', { exact: true }).fill(code)
  await page.getByLabel('Produto 1', { exact: true }).press('Enter')
  await page.getByLabel('Válida até').fill('2026-11-12')
  await page.getByRole('button', { name: 'Limpar produtos da página' }).click()
  const pageDialog = page.getByRole('alertdialog', {
    name: 'Limpar os produtos da página 1?'
  })
  await expect(pageDialog).toContainText('O produto desta página sai')
  await pageDialog
    .getByRole('button', { name: 'Limpar produtos da página' })
    .click()
  await expect(price).toBeHidden()
  await expect(page.getByLabel('Produto 1', { exact: true })).toBeFocused()
  await expect(page.getByLabel('Válida até')).toHaveValue('2026-11-12')
})

test('restores the offer saved before a mistaken save, and restoring again undoes it', async ({
  page
}) => {
  const code = `E2E-RESTORE-${Date.now()}`
  const productName = `Arroz restaurado ${code}`
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
  await price.fill('5,99')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()

  await openEmptyOffer(page)
  await expect(price).toBeHidden()

  const restore = page.getByRole('button', {
    name: 'Restaurar oferta anterior'
  })
  await restore.click()
  const restoreDialog = page.getByRole('alertdialog', {
    name: 'Restaurar a oferta anterior?'
  })
  await expect(restoreDialog).toContainText(' e 1 produto, com os preços')
  await restoreDialog
    .getByRole('button', { name: 'Restaurar oferta anterior' })
    .click()
  await expect(page.getByText('Oferta anterior restaurada.')).toBeVisible()
  await expect(price).toHaveValue('5,99')
  await expect(page.getByText('Tudo salvo')).toBeVisible()

  await page.reload()
  await expect(price).toHaveValue('5,99')

  await restore.click()
  await expect(restoreDialog).toContainText(' e 0 produtos, com os preços')
  await restoreDialog
    .getByRole('button', { name: 'Restaurar oferta anterior' })
    .click()
  await expect(price).toBeHidden()
  await expect(page.getByLabel('Produto 1', { exact: true })).toHaveValue('')
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
  await expect(page).toHaveURL('/')
  await expect(highlight).toHaveValue('Oferta não salva')

  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Produtos' })
    .click()
  await dialog.getByRole('button', { name: 'Sair sem salvar' }).click()
  await expect(page).toHaveURL('/produtos')
})
