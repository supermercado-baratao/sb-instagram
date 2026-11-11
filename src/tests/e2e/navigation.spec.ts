import { expect, test } from '@playwright/test'

test('marks the current section in the header', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Principal' })
  await expect(nav.getByRole('link', { name: 'Oferta' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await nav.getByRole('link', { name: 'Comercial' }).click()

  await expect(page).toHaveURL('/comercial')
  await expect(page).toHaveTitle('Comercial · SB Instagram')
  await expect(nav.getByRole('link', { name: 'Comercial' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(nav.getByRole('link', { name: 'Oferta' })).not.toHaveAttribute(
    'aria-current'
  )
})

test('redirects the old routes and tabs to their pages', async ({ page }) => {
  await page.goto('/ofertas')
  await expect(page).toHaveURL('/')
  await page.goto('/ofertas/1')
  await expect(page).toHaveURL('/')
  await page.goto('/configuracoes/comercial')
  await expect(page).toHaveURL('/comercial')
  await page.goto('/?aba=marca')
  await expect(page).toHaveURL('/configuracoes')
  await page.goto('/?aba=comercial')
  await expect(page).toHaveURL('/comercial')
  await page.goto('/?aba=backup')
  await expect(page).toHaveURL('/configuracoes/backup')
  await page.goto('/geracoes')
  await expect(page).toHaveURL('/historico')
})

test('keeps the settings tab in the URL and warns before leaving unsaved changes', async ({
  page
}) => {
  test.slow()
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Principal' })
  await nav.getByRole('link', { name: 'Configurações' }).click()
  await expect(page).toHaveURL('/configuracoes')

  const tabs = page.getByRole('tablist', { name: 'Configurações' })
  await expect(tabs.getByRole('tab', { name: 'Marca' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page).toHaveTitle('Marca · SB Instagram')

  const slogan = page.getByLabel('Slogan')
  await slogan.fill(`${await slogan.inputValue()} não salvo`)
  const dialog = page.getByRole('alertdialog', { name: 'Sair sem salvar?' })

  // The current tab goes nowhere, so it has nothing to warn about
  await tabs.getByRole('tab', { name: 'Marca' }).click()
  await expect(dialog).toBeHidden()

  await tabs.getByRole('tab', { name: 'Backup' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(page).toHaveURL('/configuracoes')
  await expect(slogan).toHaveValue(/não salvo$/)

  await tabs.getByRole('tab', { name: 'Backup' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Sair sem salvar' }).click()
  await expect(page).toHaveURL('/configuracoes/backup')
  await expect(page).toHaveTitle('Backup · SB Instagram')
  // A nested page still marks its section, but isn't the section page itself
  await expect(
    nav.getByRole('link', { name: 'Configurações' })
  ).toHaveAttribute('aria-current', 'true')
})

test('shows what was saved when the browser goes back to a page', async ({
  page
}) => {
  test.slow()
  await page.goto('/configuracoes')
  const slogan = page.getByLabel('Slogan')
  await expect(slogan).toBeVisible()
  const text = `Slogan ${Date.now()}`
  await slogan.fill(text)
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()

  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: 'Comercial' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Comercial', level: 1 })
  ).toBeVisible()
  await page.goBack()
  await expect(slogan).toHaveValue(text)
})
