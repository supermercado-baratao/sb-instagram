import { expect, test } from '@playwright/test'

test('suggests the voice text of a product through the saved dictionary', async ({
  page
}) => {
  test.slow()
  await page.goto('/configuracoes/comercial')
  // A reused e2e server keeps the dictionary of a previous run
  const removeButtons = page.getByRole('button', { name: /^Remover / })
  while ((await removeButtons.count()) > 0) await removeButtons.first().click()
  await page.getByRole('button', { name: 'Adicionar termo' }).click()
  await page.getByLabel('Termo', { exact: true }).fill('cream cracker')
  await page.getByLabel('Como falar').fill('kreme cráquer')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()

  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await dialog
    .getByLabel('Código de barras ou código interno')
    .fill(`E2E-${Date.now()}`)
  await dialog.getByLabel('Nome').fill('Biscoito Cream Cracker')
  await dialog.getByLabel('Marca').fill('Vitarella')
  await dialog.getByLabel('Unidade').fill('400g')
  await dialog.getByRole('button', { name: 'Sugerir' }).click()

  await expect(
    dialog.getByRole('textbox', { name: 'Texto da locução' })
  ).toHaveValue('Biscoito kreme cráquer Vitarella quatrocentos gramas')
})
