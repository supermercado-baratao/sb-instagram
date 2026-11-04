import { expect, test } from '@playwright/test'

test('marks the current section in the header', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Principal' })
  await nav.getByRole('link', { name: 'Produtos' }).click()

  await expect(page).toHaveURL('/produtos')
  await expect(nav.getByRole('link', { name: 'Produtos' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(nav.getByRole('link', { name: 'Ofertas' })).not.toHaveAttribute(
    'aria-current'
  )
})

test('redirects the old routes to the tabs', async ({ page }) => {
  await page.goto('/ofertas')
  await expect(page).toHaveURL('/')
  await page.goto('/ofertas/1')
  await expect(page).toHaveURL('/')
  await page.goto('/configuracoes')
  await expect(page).toHaveURL('/?aba=marca')
  await page.goto('/configuracoes/comercial')
  await expect(page).toHaveURL('/?aba=comercial')
})

test('keeps the tab in the URL and warns before leaving unsaved changes', async ({
  page
}) => {
  test.slow()
  await page.goto('/')
  const tabs = page.getByRole('tablist', { name: 'Seções' })
  await tabs.getByRole('tab', { name: 'Marca' }).click()
  await expect(page).toHaveURL('/?aba=marca')
  await expect(tabs.getByRole('tab', { name: 'Marca' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page).toHaveTitle('Marca · SB Instagram')
  await expect(
    page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Ofertas' })
  ).toHaveAttribute('aria-current', 'true')

  const slogan = page.getByLabel('Slogan')
  await slogan.fill(`${await slogan.inputValue()} não salvo`)
  const dialog = page.getByRole('alertdialog', { name: 'Sair sem salvar?' })

  // The current tab goes nowhere, so it has nothing to warn about
  await tabs.getByRole('tab', { name: 'Marca' }).click()
  await expect(dialog).toBeHidden()

  await tabs.getByRole('tab', { name: 'Comercial' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(page).toHaveURL('/?aba=marca')
  await expect(slogan).toHaveValue(/não salvo$/)

  // Ends in `/`, the path this page is on, and still leaves the tab
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Ofertas' })
    .click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Sair sem salvar' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByLabel('Válida até')).toBeVisible()
})

test('shows what was saved when the browser goes back to a tab', async ({
  page
}) => {
  test.slow()
  await page.goto('/?aba=marca')
  const slogan = page.getByLabel('Slogan')
  await expect(slogan).toBeVisible()
  const text = `Slogan ${Date.now()}`
  await slogan.fill(text)
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()

  await page.getByRole('tab', { name: 'Comercial' }).click()
  await expect(
    page.getByRole('heading', { name: 'Comercial', level: 1 })
  ).toBeVisible()
  await page.goBack()
  await expect(slogan).toHaveValue(text)
})
