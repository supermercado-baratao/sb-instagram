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
  const codeField = page.getByLabel('Código de barras ou código interno')

  await page.goto('/produtos')
  await codeField.fill(code)
  await codeField.press('Enter')

  await expect(page.getByText('Código interno novo')).toBeVisible()
  await page.getByLabel('Nome').fill('Picanha bovina')
  await page.getByLabel('Unidade').fill('1 kg')
  await page.getByLabel('Enviar foto').setInputFiles({
    name: 'picanha.png',
    mimeType: 'image/png',
    buffer: PHOTO
  })
  await page.getByRole('button', { name: 'Salvar produto' }).click()

  await expect(page.getByText('Picanha bovina salvo')).toBeVisible()
  await expect(codeField).toBeFocused()

  await codeField.fill(code)
  await codeField.press('Enter')

  await expect(page.getByText('Produto já cadastrado')).toBeVisible()
  await expect(page.getByLabel('Nome')).toHaveValue('Picanha bovina')
  await expect(page.getByLabel('Unidade')).toHaveValue('1 kg')
  await expect(page.getByAltText(`Foto do produto ${code}`)).toHaveJSProperty(
    'naturalWidth',
    1
  )
})

test('finds a saved product by name and opens it from the list', async ({
  page
}) => {
  const code = `E2E-${Date.now()}`
  const name = `Alcatra ${code}`
  const codeField = page.getByLabel('Código de barras ou código interno')

  await page.goto('/produtos')
  await codeField.fill(code)
  await codeField.press('Enter')
  await page.getByLabel('Nome').fill(name)
  await page.getByRole('button', { name: 'Salvar produto' }).click()
  await expect(page.getByText(`${name} salvo`)).toBeVisible()

  const searchField = page.getByLabel('Pesquisar produtos')
  await searchField.fill(name.toUpperCase())
  await searchField.press('Enter')

  await expect(page).toHaveURL(/\?q=/)
  await expect(page.getByText('1 produto', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click()

  await expect(page.getByText('Produto já cadastrado')).toBeVisible()
  await expect(page.getByLabel('Nome')).toHaveValue(name)
  await expect(page.getByLabel('Nome')).toBeFocused()
})
