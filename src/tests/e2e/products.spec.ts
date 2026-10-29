import { expect, test } from '@playwright/test'

// A 1x1 red PNG, enough for the server to decode and resize
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64'
)

test('saves a scanned product and fills the form when it is scanned again', async ({
  page
}) => {
  // A reused e2e server keeps its data between runs, so each run uses a code it never saw
  const code = `E2E-${Date.now()}`
  const codeField = page.getByLabel('Buscar produto')
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })

  await page.goto('/produtos')
  await codeField.fill(code)
  await codeField.press('Enter')

  // No product has the internal code, so it may be a name: the list is filtered instead
  await expect(page).toHaveURL(/\?q=/)
  await page
    .getByRole('button', { name: `Cadastrar produto com o código ${code}` })
    .click()
  await expect(dialog.getByText('Código interno novo')).toBeVisible()
  await dialog.getByLabel('Nome').fill('Picanha bovina')
  await dialog.getByLabel('Unidade').fill('1 kg')
  await dialog.getByLabel('Enviar foto').setInputFiles({
    name: 'picanha.png',
    mimeType: 'image/png',
    buffer: PHOTO
  })
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()

  await expect(page.getByText('Picanha bovina salvo')).toBeVisible()
  await expect(codeField).toBeFocused()

  await codeField.fill(code)
  await codeField.press('Enter')

  await expect(page.getByText('Produto já cadastrado')).toBeVisible()
  await expect(page.getByLabel('Nome')).toHaveValue('Picanha bovina')
  await expect(page.getByLabel('Unidade')).toHaveValue('1 kg')
  await expect(
    page.getByAltText('Foto do produto Picanha bovina')
  ).toHaveJSProperty('naturalWidth', 1)
})

test('finds a saved product by name and opens it from the list', async ({
  page
}) => {
  const code = `E2E-${Date.now()}`
  const name = `Alcatra ${code}`
  const codeField = page.getByLabel('Buscar produto')
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })

  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await dialog.getByLabel('Código de barras ou código interno').fill(code)
  await dialog.getByLabel('Código de barras ou código interno').press('Enter')
  await dialog.getByLabel('Nome').fill(name)
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText(`${name} salvo`)).toBeVisible()

  await codeField.fill(name.toUpperCase())
  await codeField.press('Enter')

  await expect(page).toHaveURL(/\?q=/)
  await expect(page.getByText('1 produto', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()

  await expect(page.getByText('Produto já cadastrado')).toBeVisible()
  await expect(page.getByLabel('Nome')).toHaveValue(name)
  await expect(page.getByLabel('Nome')).toBeFocused()
})

test('registers a product from the create dialog', async ({ page }) => {
  const code = `E2E-NEW-${Date.now()}`
  const name = `Maminha ${code}`

  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()

  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  const codeField = dialog.getByLabel('Código de barras ou código interno')
  await expect(codeField).toBeFocused()
  await codeField.fill(code)
  await codeField.press('Enter')

  await expect(dialog.getByText('Código interno novo')).toBeVisible()
  await expect(dialog.getByLabel('Nome')).toBeFocused()
  await dialog.getByLabel('Nome').fill(name)
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText(`${name} salvo`)).toBeVisible()
  await expect(page.getByLabel('Buscar produto')).toBeFocused()
  await expect(
    page.getByRole('button', { name: new RegExp(`^${name}`) })
  ).toBeVisible()
})

test('asks before replacing a product registered again with other data', async ({
  page
}) => {
  const code = `E2E-AGAIN-${Date.now()}`
  const name = `Cupim ${code}`
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  const codeField = dialog.getByLabel('Código de barras ou código interno')

  const register = async (productName: string) => {
    await page.getByRole('button', { name: 'Cadastrar produto' }).click()
    await codeField.fill(code)
    await codeField.press('Enter')
    await dialog.getByLabel('Nome').fill(productName)
    await dialog.getByRole('button', { name: 'Salvar produto' }).click()
  }

  await page.goto('/produtos')
  await register(name)
  await expect(page.getByText(`${name} salvo`)).toBeVisible()

  await register(name)
  await expect(dialog).toBeHidden()
  await expect(
    page.getByText(`${name} já estava cadastrado, e nenhum dado mudou.`)
  ).toBeVisible()

  await register(`${name} especial`)
  const confirm = page.getByRole('alertdialog', {
    name: 'Substituir os dados do produto?'
  })
  await expect(confirm.getByRole('listitem')).toHaveText([
    `Nome:${name}passa a ser${name} especial`
  ])
  await confirm.getByRole('button', { name: 'Substituir' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText(`${name} especial salvo`)).toBeVisible()
})

test('chooses between a single product and a group with the same code', async ({
  page
}) => {
  test.slow()
  const stamp = Date.now()
  const lavender = `E2E-LAV-${stamp}`
  const fennel = `E2E-FEN-${stamp}`
  const single = `Sabonete lavanda ${stamp}`
  const group = `Sabonete fragrâncias ${stamp}`
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  const dialogCode = dialog.getByLabel('Código de barras ou código interno')

  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await dialogCode.fill(lavender)
  await dialogCode.press('Enter')
  await dialog.getByLabel('Nome').fill(single)
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(`${single} salvo`)).toBeVisible()

  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await dialogCode.fill(lavender)
  await dialogCode.press('Enter')
  await expect(
    dialog.getByText(`Este código já está em ${single}.`)
  ).toBeVisible()
  await dialog.getByLabel('Nome').fill(group)
  await dialog.getByLabel('Adicionar código').fill(fennel)
  await dialog.getByLabel('Adicionar código').press('Enter')
  await expect(
    dialog.getByRole('list', { name: 'Outros códigos' })
  ).toContainText(fennel)
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(`${group} salvo`)).toBeVisible()

  const codeField = page.getByLabel('Buscar produto')
  await codeField.fill(lavender)
  await codeField.press('Enter')
  const choice = page.getByRole('dialog', { name: 'Escolha o produto' })
  await expect(choice.getByRole('button')).toHaveText([
    new RegExp(`^${single}`),
    new RegExp(`^${group}`),
    'Fechar'
  ])
  await choice.getByRole('button', { name: new RegExp(`^${group}`) }).click()

  await expect(page.getByLabel('Nome')).toHaveValue(group)
  await expect(page.getByLabel('Nome')).toBeFocused()
  await expect(page.getByRole('list', { name: 'Códigos' })).toHaveText(
    new RegExp(`${fennel}.*${lavender}`)
  )

  await page.goto('/ofertas')
  await page.getByRole('button', { name: 'Nova oferta', exact: true }).click()
  await expect(page).toHaveURL(/\/ofertas\/\d+$/)
  const slotCode = page.getByLabel('Produto 1', { exact: true })
  await slotCode.fill(lavender)
  await slotCode.press('Enter')
  await choice.getByRole('button', { name: new RegExp(`^${single}`) }).click()

  await expect(page.getByLabel(`Preço de ${single} (R$)`)).toBeFocused()
})

test('merges two products and finds the kept one by the merged code', async ({
  page
}) => {
  test.slow()
  const stamp = Date.now()
  const lavender = `E2E-MLAV-${stamp}`
  const fennel = `E2E-MFEN-${stamp}`
  const kept = `Sabonete lavanda ${stamp}`
  const merged = `Sabonete erva-doce ${stamp}`
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  const dialogCode = dialog.getByLabel('Código de barras ou código interno')

  await page.goto('/produtos')
  for (const [code, name] of [
    [lavender, kept],
    [fennel, merged]
  ]) {
    await page.getByRole('button', { name: 'Cadastrar produto' }).click()
    await dialogCode.fill(code)
    await dialogCode.press('Enter')
    await dialog.getByLabel('Nome').fill(name)
    await dialog.getByRole('button', { name: 'Salvar produto' }).click()
    await expect(page.getByText(`${name} salvo`)).toBeVisible()
  }

  const codeField = page.getByLabel('Buscar produto')
  await codeField.fill(String(stamp))
  await codeField.press('Enter')
  await expect(page.getByText('2 produtos', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: `Selecionar ${kept}` }).click()
  await page.getByRole('checkbox', { name: `Selecionar ${merged}` }).click()
  await page.getByRole('button', { name: 'Mesclar' }).click()

  const confirm = page.getByRole('alertdialog', { name: 'Mesclar 2 produtos?' })
  await confirm.getByRole('radio', { name: new RegExp(kept) }).click()
  await expect(
    confirm.getByText(`Códigos que passam para ele: ${fennel}.`)
  ).toBeVisible()
  await confirm.getByRole('button', { name: 'Mesclar' }).click()
  await expect(page.getByText(`Produtos mesclados em ${kept}.`)).toBeVisible()
  await expect(page.getByText('1 produto', { exact: true })).toBeVisible()

  await codeField.fill(fennel)
  await codeField.press('Enter')
  await expect(page.getByLabel('Nome')).toHaveValue(kept)
  await expect(page.getByRole('list', { name: 'Códigos' })).toHaveText(
    new RegExp(`${fennel}.*${lavender}`)
  )
})

test('adds a new code to an existing product from the create dialog', async ({
  page
}) => {
  const stamp = Date.now()
  const code = `E2E-ADD-${stamp}`
  const variation = `E2E-VAR-${stamp}`
  const name = `Amaciante ${stamp}`
  const dialog = page.getByRole('dialog', { name: 'Cadastrar produto' })
  const dialogCode = dialog.getByLabel('Código de barras ou código interno')

  await page.goto('/produtos')
  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await dialogCode.fill(code)
  await dialogCode.press('Enter')
  await dialog.getByLabel('Nome').fill(name)
  await dialog.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText(`${name} salvo`)).toBeVisible()

  await page.getByRole('button', { name: 'Cadastrar produto' }).click()
  await dialogCode.fill(variation)
  await dialogCode.press('Enter')
  await dialog
    .getByRole('button', { name: 'Adicionar a um produto existente' })
    .click()
  await dialog
    .getByLabel(`Adicionar o código ${variation} ao produto`)
    .fill(name)
  await page.getByRole('option', { name: new RegExp(name) }).click()
  await expect(dialog).toBeHidden()
  // The previous notice for the same product is still fading out
  await expect(page.getByText(`${name} salvo`).last()).toBeVisible()

  const codeField = page.getByLabel('Buscar produto')
  await codeField.fill(variation)
  await codeField.press('Enter')
  await expect(page.getByLabel('Nome')).toHaveValue(name)
})
