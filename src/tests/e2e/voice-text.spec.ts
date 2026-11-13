import { expect, type Page, test } from '@playwright/test'

import { openEmptyOffer } from './offer-helpers'

// A reused e2e server keeps the dictionary and the closings of a previous run. A closing in the
// order can't be removed, so the order goes first, which enables its button
const resetRadioAd = async (page: Page) => {
  const removeButtons = page.getByRole('button', {
    name: /^Remover /,
    disabled: false
  })
  while ((await removeButtons.count()) > 0) await removeButtons.first().click()
  await page.getByLabel('Abertura').fill('')
  await expect(page.getByRole('button', { name: /^Remover / })).toHaveCount(0)
}

test('saves the radio ad settings and suggests the voice text through the dictionary', async ({
  page
}) => {
  test.slow()
  await page.goto('/comercial')
  await resetRadioAd(page)
  await page.getByRole('button', { name: 'Adicionar termo' }).click()
  await page.getByLabel('Termo', { exact: true }).fill('cream cracker')
  await page.getByLabel('Como falar').fill('kreme cráquer')
  await page.getByLabel('Abertura').fill('[animado] Atenção!')

  await page
    .getByRole('button', { name: 'Adicionar fechamento', exact: true })
    .click()
  const closingText = page.getByRole('textbox', { name: 'Texto' })
  await expect(closingText).toBeFocused()
  await closingText.fill('Até já!')
  const closingName = page.getByRole('textbox', { name: 'Nome' })
  await expect(closingName).toHaveValue('Fechamento 1')
  await closingName.fill(' ')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Dê um nome ao fechamento.')).toBeVisible()
  await expect(closingName).toBeFocused()
  await closingName.fill('Final')

  await page
    .getByRole('button', { name: 'Adicionar fechamento ao fim' })
    .click()
  await expect(
    page.getByRole('combobox', { name: 'Fechamento 1º do fim' })
  ).toBeFocused()
  await expect(
    page.getByRole('row', { name: /^1( \(oferta salva\))? Final$/ })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Remover Final', exact: true })
  ).toHaveAccessibleDescription(
    'Em uso na ordem dos fechamentos. Tire-o de lá para remover.'
  )

  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Abertura')).toHaveValue('[animado] Atenção!')
  await expect(page.getByRole('textbox', { name: 'Nome' })).toHaveValue('Final')
  await expect(page.getByRole('textbox', { name: 'Texto' })).toHaveValue(
    'Até já!'
  )
  await expect(
    page.getByRole('combobox', { name: 'Fechamento 1º do fim' })
  ).toContainText('Final')

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

test('previews the radio ad of the saved offer before saving', async ({
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

  await page.goto('/comercial')
  await resetRadioAd(page)
  await page.getByLabel('Antes de cada preço').fill('por apenas')
  await expect(
    page.getByRole('row', { name: /^1 \(oferta salva\) sem fechamento$/ })
  ).toBeVisible()

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
  // Leaving with changes asks first, and staying keeps what was typed
  await voiceDialog.getByRole('button', { name: 'Cancelar' }).click()
  const leave = page.getByRole('alertdialog', { name: 'Sair sem salvar?' })
  await leave.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(voiceText).toHaveValue('Arroz tipo um')
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
    page
      .getByRole('dialog', { name: 'Editar produto' })
      .getByRole('textbox', { name: 'Texto da locução' })
  ).toHaveValue('Arroz tipo um')
})

test('speaks repeated products once and closes each round by its position', async ({
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
  if ((await page.getByRole('tab', { name: 'Arte 2' }).count()) === 0) {
    await page.getByRole('button', { name: 'Adicionar arte' }).click()
  }
  await page.getByRole('tab', { name: 'Arte 2' }).click()
  await fill(1, 'Batata', '')
  await fill(2, 'Cebola', '3,00')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()

  await page.goto('/comercial')
  await resetRadioAd(page)
  await page.getByLabel('Antes de cada preço').fill('')
  const repeated = page.getByRole('checkbox', {
    name: 'Falar uma vez só os produtos repetidos'
  })
  await expect(repeated).toBeChecked()

  const addClosing = page.getByRole('button', {
    name: 'Adicionar fechamento',
    exact: true
  })
  await addClosing.click()
  await page.getByRole('textbox', { name: 'Nome' }).fill('Curto')
  await page.getByRole('textbox', { name: 'Texto' }).fill('Tchau.')
  await addClosing.click()
  await page.getByRole('textbox', { name: 'Nome' }).nth(1).fill('Final')
  await page.getByRole('textbox', { name: 'Texto' }).nth(1).fill('Fim.')
  await page
    .getByRole('button', { name: 'Adicionar fechamento ao meio' })
    .click()
  await page
    .getByRole('button', { name: 'Adicionar fechamento ao fim' })
    .click()
  await page.getByRole('combobox', { name: 'Fechamento 1º do fim' }).click()
  await page.getByRole('option', { name: 'Final' }).click()
  await expect(
    page.getByRole('row', { name: /^3 Curto, Curto, Final$/ })
  ).toBeVisible()

  const script = page.getByRole('tabpanel', { name: 'Roteiro' })
  await expect(script).toHaveText(
    '- alho: um real- batata: dois reaisTchau.- cebola: três reaisFim.'
  )
  await repeated.click()
  await expect(script).toHaveText(
    '- alho: um real- batata: dois reaisTchau.- batata: dois reais- cebola: três reaisFim.'
  )
  await repeated.click()

  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()
  await page.reload()
  await expect(script).toHaveText(
    '- alho: um real- batata: dois reaisTchau.- cebola: três reaisFim.'
  )
})
