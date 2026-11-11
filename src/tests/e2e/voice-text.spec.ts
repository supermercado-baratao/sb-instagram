import { expect, test } from '@playwright/test'

import { openEmptyOffer } from './offer-helpers'

test('saves the radio ad settings and suggests the voice text through the dictionary', async ({
  page
}) => {
  test.slow()
  await page.goto('/?aba=comercial')
  // A reused e2e server keeps the dictionary and the blocks of a previous run
  const removeButtons = page.getByRole('button', { name: /^Remover / })
  while ((await removeButtons.count()) > 0) await removeButtons.first().click()
  await page.getByRole('button', { name: 'Adicionar termo' }).click()
  await page.getByLabel('Termo', { exact: true }).fill('cream cracker')
  await page.getByLabel('Como falar').fill('kreme cráquer')
  await page.getByRole('button', { name: 'Adicionar texto' }).click()
  await page
    .getByRole('textbox', { name: 'Bloco 1, texto' })
    .fill('[animado] Atenção!')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(
    page.getByText('Adicione ao menos um bloco de produtos.')
  ).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar produtos' }).click()
  await page
    .getByRole('button', { name: 'Mover Bloco 2, produtos para antes' })
    .click()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('spinbutton', { name: 'Bloco 1, produtos' })
  ).toHaveValue('1')
  await expect(
    page.getByRole('textbox', { name: 'Bloco 2, texto' })
  ).toHaveValue('[animado] Atenção!')

  // A duplicated text block is the same block in two places, until it is separated
  await page.getByRole('button', { name: 'Duplicar Bloco 2, texto' }).click()
  const copy = page.getByRole('textbox', {
    name: 'Bloco 3, texto, igual ao bloco 2'
  })
  await expect(copy).toBeFocused()
  await copy.fill('Até já!')
  const original = page.getByRole('textbox', {
    name: 'Bloco 2, texto, igual ao bloco 3'
  })
  await expect(original).toHaveValue('Até já!')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()
  await page.reload()
  await expect(copy).toHaveValue('Até já!')
  await page
    .getByRole('button', { name: 'Separar Bloco 3, texto, igual ao bloco 2' })
    .click()
  const separated = page.getByRole('textbox', {
    name: 'Bloco 3, texto',
    exact: true
  })
  await expect(separated).toBeFocused()
  await separated.fill('Tchau!')
  await expect(
    page.getByRole('textbox', { name: 'Bloco 2, texto', exact: true })
  ).toHaveValue('Até já!')

  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await dialog
    .getByLabel('Código de barras ou código interno')
    .fill(`E2E-${Date.now()}`)
  await dialog.getByLabel('Descrição').fill('Biscoito Cream Cracker Vitarella')
  await dialog.getByLabel('Unidade').fill('400g')
  await dialog.getByRole('button', { name: 'Sugerir' }).click()

  await expect(
    dialog.getByRole('textbox', { name: 'Texto da locução' })
  ).toHaveValue('biscoito kreme cráquer vitarella, quatrocentos gramas')
})

test('previews the pages of each block and the radio ad before saving', async ({
  page
}) => {
  test.slow()
  // A reused e2e server keeps its data between runs, so each run uses a code it never saw
  const code = `E2E-RADIO-${Date.now()}`
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await dialog.getByLabel('Código de barras ou código interno').fill(code)
  await dialog.getByLabel('Descrição').fill('Arroz agulhinha')
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText('Arroz agulhinha salvo')).toBeVisible()

  await openEmptyOffer(page)
  await page.getByLabel('Produto 1', { exact: true }).fill(code)
  await page.getByLabel('Produto 1', { exact: true }).press('Enter')
  await page.getByLabel('Preço de Arroz agulhinha (R$)').fill('3,50')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()

  await page.goto('/?aba=comercial')
  // A reused e2e server keeps the dictionary and the blocks of a previous run
  const removeButtons = page.getByRole('button', { name: /^Remover / })
  while ((await removeButtons.count()) > 0) await removeButtons.first().click()
  await page.getByLabel('Antes de cada preço').fill('por apenas')
  await page.getByRole('button', { name: 'Adicionar produtos' }).click()

  const pageCount = page.getByRole('spinbutton', {
    name: 'Bloco 1, produtos, página 1'
  })
  await expect(pageCount).toHaveAccessibleDescription(
    /Recebe a página 1: Arroz agulhinha\./
  )
  const script = page.getByRole('tabpanel', { name: 'Roteiro' })
  await expect(script).toHaveText(
    '- arroz agulhinha, por apenas: três e cinquenta'
  )

  await page.getByRole('button', { name: 'Adicionar termo' }).click()
  await page.getByLabel('Termo', { exact: true }).fill('agulhinha')
  await page.getByLabel('Como falar').fill('agulhínha')
  await expect(script).toHaveText(
    '- arroz agulhínha, por apenas: três e cinquenta'
  )

  await pageCount.fill('2')
  await expect(
    page.getByText('Bloco 1: Falta 1 página com produtos na oferta salva.')
  ).toBeVisible()

  await page.getByRole('tab', { name: 'Lista de produtos' }).click()
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copiar lista' }).click()
  await expect(page.getByText('Lista de produtos copiada.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '1. arroz agulhínha: R$ 3,50\n'
  )
  await expect(
    page.getByRole('tabpanel', { name: 'Lista de produtos' })
  ).toHaveText('1. arroz agulhínha: R$ 3,50')

  // The voice text is saved into the product at once, apart from the tab's own "Salvar"
  await page.getByRole('tab', { name: 'Roteiro' }).click()
  await page
    .getByRole('button', { name: 'Editar locução de Arroz agulhinha' })
    .click()
  const voiceDialog = page.getByRole('dialog', {
    name: 'Editar locução de Arroz agulhinha'
  })
  const voiceText = voiceDialog.getByRole('textbox', {
    name: 'Texto da locução'
  })
  await expect(voiceText).toHaveValue('arroz agulhínha')
  await voiceText.fill('Arroz tipo um')
  await voiceDialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(
    page.getByText('Locução de Arroz agulhinha salva.')
  ).toBeVisible()
  await expect(page.getByRole('tabpanel', { name: 'Roteiro' })).toHaveText(
    '- Arroz tipo um, por apenas: três e cinquenta'
  )

  await page.getByRole('button', { name: 'Copiar roteiro' }).click()
  await expect(page.getByText('Roteiro do comercial copiado.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '- Arroz tipo um, por apenas: três e cinquenta'
  )

  await page.goto('/produtos')
  await page.getByLabel('Buscar produto').fill(code)
  await page.getByLabel('Buscar produto').press('Enter')
  await expect(
    page.getByRole('textbox', { name: 'Texto da locução' })
  ).toHaveValue('Arroz tipo um')
})

test('speaks repeated products once, splits them evenly and moves one to another block', async ({
  page
}) => {
  test.slow()
  // A reused e2e server keeps its data between runs, so each run uses codes it never saw
  const run = Date.now()
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  await page.goto('/produtos')
  for (const name of ['Alho', 'Batata', 'Cebola']) {
    await page.getByRole('button', { name: 'Cadastrar produto' }).click()
    await dialog
      .getByLabel('Código de barras ou código interno')
      .fill(`E2E-${name.toUpperCase()}-${run}`)
    await dialog.getByLabel('Descrição').fill(name)
    await dialog.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText(`${name} salvo`)).toBeVisible()
  }

  await openEmptyOffer(page)
  // Page 1 holds Alho and Batata, page 2 Batata again and Cebola
  const fill = async (slot: number, name: string, price: string) => {
    const field = page.getByLabel(`Produto ${slot}`, { exact: true })
    await field.fill(`E2E-${name.toUpperCase()}-${run}`)
    await field.press('Enter')
    const priceField = page.getByLabel(`Preço de ${name} (R$)`)
    await expect(priceField).toBeFocused()
    if (price) await priceField.fill(price)
  }
  await fill(1, 'Alho', '1,00')
  await fill(2, 'Batata', '2,00')
  if ((await page.getByRole('tab', { name: 'Página 2' }).count()) === 0) {
    await page.getByRole('button', { name: 'Adicionar página' }).click()
  }
  await page.getByRole('tab', { name: 'Página 2' }).click()
  await fill(1, 'Batata', '')
  await fill(2, 'Cebola', '3,00')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()

  await page.goto('/?aba=comercial')
  const removeButtons = page.getByRole('button', { name: /^Remover / })
  while ((await removeButtons.count()) > 0) await removeButtons.first().click()
  await page.getByLabel('Antes de cada preço').fill('')
  await page.getByRole('radio', { name: 'Por páginas' }).click()
  const repeated = page.getByRole('checkbox', {
    name: 'Falar uma vez só os produtos repetidos'
  })
  await expect(repeated).toBeChecked()
  await page.getByRole('button', { name: 'Adicionar produtos' }).click()
  await page.getByRole('button', { name: 'Adicionar produtos' }).click()

  await expect(
    page.getByRole('spinbutton', { name: 'Bloco 2, produtos, página 2' })
  ).toHaveAccessibleDescription(/Recebe a página 2: Cebola\./)
  await repeated.click()
  await expect(
    page.getByRole('spinbutton', { name: 'Bloco 2, produtos, página 2' })
  ).toHaveAccessibleDescription(/Recebe a página 2: Batata, Cebola\./)
  await repeated.click()

  await page.getByRole('radio', { name: 'Por igual' }).click()
  const script = page.getByRole('tabpanel', { name: 'Roteiro' })
  await expect(script).toHaveText(
    '- alho: um real- batata: dois reais- cebola: três reais'
  )
  await expect(page.getByText('Bloco 1, produtos, 2 produtos')).toBeVisible()

  await page
    .getByRole('button', { name: 'Mover Alho para outro bloco' })
    .click()
  await page.getByRole('menuitem', { name: 'Mover para Bloco 2' }).click()
  await expect(
    page.getByRole('button', { name: 'Mover Alho para outro bloco' })
  ).toBeFocused()
  await expect(script).toHaveText(
    '- batata: dois reais- cebola: três reais- alho: um real'
  )
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Bloco 2, produtos, 1 produto')).toBeVisible()
  await expect(script).toHaveText(
    '- batata: dois reais- cebola: três reais- alho: um real'
  )

  // The next tests expect the blocks to take pages again
  await page.getByRole('radio', { name: 'Por páginas' }).click()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()
})
