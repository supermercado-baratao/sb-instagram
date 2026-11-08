import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'

test('downloads a backup and restores it', async ({ page }) => {
  test.slow()
  await page.goto('/?aba=backup')

  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Baixar backup' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toMatch(
    /^sb-instagram-backup-\d{4}-\d{2}-\d{2}\.zip$/
  )
  const file = await download.path()
  const entries = Object.keys(unzipSync(await readFile(file)))
  expect(entries).toEqual(
    expect.arrayContaining(['backup.json', 'database.sqlite'])
  )

  const restore = page
    .getByRole('tabpanel', { name: 'Backup' })
    .getByRole('button', { name: 'Restaurar backup' })
  await page.getByLabel('Arquivo do backup').setInputFiles(file)
  await restore.click()

  const dialog = page.getByRole('alertdialog', {
    name: 'Restaurar este backup?'
  })
  await expect(dialog.getByRole('rowheader', { name: 'Marca' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Restaurar backup' }).click()
  await expect(page.getByText('Backup restaurado.')).toBeVisible()
  await expect(restore).toBeFocused()
})

test('refuses a file that is not a backup', async ({ page }) => {
  await page.goto('/?aba=backup')
  const field = page.getByLabel('Arquivo do backup')
  await field.setInputFiles({
    name: 'fotos.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not a zip')
  })
  await page.getByRole('button', { name: 'Restaurar backup' }).click()
  await expect(field).toHaveAccessibleDescription(/não é um backup do app/)
  await expect(field).toBeFocused()
})
