import { expect, test } from '@playwright/test'

test('redirects the home page to the offers', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/ofertas')
})

test('marks the current section in the header', async ({ page }) => {
  await page.goto('/ofertas')
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
