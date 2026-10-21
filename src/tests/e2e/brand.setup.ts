import { expect, test as setup } from '@playwright/test'
import sharp from 'sharp'

setup('configures the brand and shows it on the poster', async ({ page }) => {
  // A reused e2e server keeps the brand from a previous run, so it skips the first-setup redirect
  await page.goto('/ofertas')
  const firstSetup = page.url().endsWith('/configuracoes')
  if (!firstSetup) await page.goto('/configuracoes')

  const name = `Mercado E2E ${Date.now()}`
  await page.getByRole('textbox', { name: 'Nome do mercado' }).fill(name)
  await page.getByLabel('Slogan').fill('Preço baixo todo dia')
  await page.getByLabel('@ do Instagram').fill('instagram.com/mercadoe2e')
  await page.getByLabel('Enviar logo').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: await sharp({
      create: { width: 400, height: 200, channels: 4, background: '#e01b22' }
    })
      .png()
      .toBuffer()
  })

  await page.getByRole('button', { name: 'Adicionar modelo' }).click()
  await page.getByLabel('Nome do modelo 4').fill('Padaria')

  const poster = page.getByRole('article', { name: `Ofertas de ${name}` })
  await expect(poster.getByText('Preço baixo todo dia')).toBeVisible()
  await expect(poster.getByText('@mercadoe2e')).toBeVisible()

  await page
    .getByRole('button', {
      name: firstSetup ? 'Salvar e continuar' : 'Salvar',
      exact: true
    })
    .click()
  if (firstSetup) await expect(page).toHaveURL(/\/ofertas$/)
  else await expect(page.getByText('Configurações salvas.')).toBeVisible()

  await page.goto('/configuracoes')
  await expect(
    page.getByRole('textbox', { name: 'Nome do mercado' })
  ).toHaveValue(name)
  await expect(page.getByLabel('@ do Instagram')).toHaveValue('@mercadoe2e')
  await expect(
    page.getByRole('img', { name: 'Logo do mercado' })
  ).toHaveAttribute('src', /^\/marca\/logo\?v=\d+$/)

  // Removed again, so a reused server keeps the same templates on every run
  await page.getByRole('button', { name: 'Remover Padaria' }).click()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByText('Configurações salvas.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Nome do modelo 3')).toBeVisible()
  await expect(page.getByLabel('Nome do modelo 4')).toHaveCount(0)
})
