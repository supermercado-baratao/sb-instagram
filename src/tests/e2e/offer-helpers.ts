import { expect, type Page } from '@playwright/test'

// Every test shares the instance's single offer, so each one starts by emptying what it left
export const openEmptyOffer = async (page: Page) => {
  await page.goto('/')
  const clear = page.getByRole('button', { name: 'Limpar produtos' })
  await expect(page.getByLabel('Válida até')).toBeVisible()
  if (await clear.isDisabled()) return

  await clear.click()
  await page
    .getByRole('alertdialog', { name: 'Limpar os produtos da oferta?' })
    .getByRole('button', { name: 'Limpar produtos' })
    .click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Oferta salva.')).toBeVisible()
}
