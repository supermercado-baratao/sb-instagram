import { describe, expect, test } from 'vitest'

import {
  type BackupSummary,
  createBackupManifest,
  getBackupChanges,
  getBackupFilePath
} from './backup'
import { backupManifestSchema } from './schema'

describe('getBackupFilePath', () => {
  test.each([
    ['files/photos/7891000100103.png', ['photos', '7891000100103.png']],
    ['files/generations/3/pagina-1.png', ['generations', '3', 'pagina-1.png']],
    ['files/logo.png', ['logo.png']]
  ])('accepts %s', (name, segments) => {
    expect(getBackupFilePath(name)).toEqual(segments)
  })

  test.each([
    'photos/a.png',
    'files/database.sqlite',
    'files/notas.txt',
    'files/logo.png/a.png',
    'files/photos/../../a.png',
    'files/photos//a.png',
    'files/generations/.tmp-1/pagina-1.png',
    String.raw`files/photos/a\..\b.png`,
    'files/photos'
  ])('refuses %s', (name) => {
    expect(getBackupFilePath(name)).toBeUndefined()
  })
})

const isBackupManifest = (value: unknown) =>
  backupManifestSchema.safeParse(value).success

test('backupManifestSchema checks the format and the date', () => {
  const manifest = createBackupManifest(new Date())
  expect(isBackupManifest(manifest)).toBe(true)
  expect(
    isBackupManifest({ format: 'other', version: 1, createdAt: '2026-11-07' })
  ).toBe(false)
  expect(
    isBackupManifest({
      format: 'sb-instagram-backup',
      version: 1,
      createdAt: 'ontem'
    })
  ).toBe(false)
})

test('getBackupChanges marks the rows that differ', () => {
  const current: BackupSummary = {
    brandName: 'Mercado',
    productCount: 1200,
    offerPageCount: 3,
    offerProductCount: 20,
    generationCount: 5,
    pronunciationCount: 2
  }
  const changes = getBackupChanges(current, {
    ...current,
    brandName: null,
    productCount: 1180
  })
  expect(changes.filter(({ changed }) => changed)).toEqual([
    { label: 'Marca', current: 'Mercado', backup: '—', changed: true },
    {
      label: 'Produtos',
      current: '1.200',
      backup: '1.180',
      changed: true
    }
  ])
  expect(changes).toHaveLength(6)
})
