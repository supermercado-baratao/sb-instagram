// @vitest-environment node
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { expect, onTestFinished, test } from 'vitest'

import { isValidProductId } from '@/domain/product'
import { migrationsFolder } from '@/infra/database/file'

// Copies the migrations up to, but not including, the given one, to fill a database as it was
const copyMigrationsBefore = async (name: string) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'migrations-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))

  const folders = await readdir(migrationsFolder)
  // Folder names start with their timestamp, so they compare in the order they were created
  const target = folders.find((folder) => folder.endsWith(name)) ?? ''
  const before = folders.filter((folder) => folder < target)
  for (const folder of before) {
    await cp(
      path.join(migrationsFolder, folder),
      path.join(directory, folder),
      {
        recursive: true
      }
    )
  }
  return directory
}

test('products-by-id keeps each product, its codes and the offer items', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite })
  migrate(database, {
    migrationsFolder: await copyMigrationsBefore('_products-by-id')
  })

  sqlite.exec(`
    INSERT INTO products (code, codeType, name, brand, unit, photo) VALUES
      ('7891000100103', 'ean', 'Sabonete', 'Albany', '85 g', '7891000100103.png'),
      ('2001', 'internal', 'Picanha', NULL, 'Kg', NULL);
    INSERT INTO product_codes (code, productCode) VALUES
      ('7891000100110', '7891000100103');
    INSERT INTO offers (name, highlightTitle, highlightMessage, createdAt, updatedAt)
      VALUES ('Semana', '', '', 0, 0);
    INSERT INTO offer_pages (offerId, position, templateId, layout) VALUES (1, 0, 'mercado', 4);
    INSERT INTO offer_page_items (pageId, position, productCode, priceInCents) VALUES
      (1, 0, '2001', 4990),
      (1, 1, '7891000100103', 399);
  `)

  migrate(database, { migrationsFolder })

  const rows = sqlite
    .prepare(
      `SELECT products.id, products.name, products.brand, products.unit, products.photo,
         group_concat(product_codes.code, ',') AS codes
       FROM products JOIN product_codes ON product_codes.productId = products.id
       GROUP BY products.id ORDER BY products.name`
    )
    .all() as { id: string; codes: string }[]
  expect(rows).toEqual([
    {
      id: expect.any(String),
      name: 'Picanha',
      brand: null,
      unit: 'Kg',
      photo: null,
      codes: '2001'
    },
    {
      id: expect.any(String),
      name: 'Sabonete',
      brand: 'Albany',
      unit: '85 g',
      photo: '7891000100103.png',
      codes: '7891000100103,7891000100110'
    }
  ])
  const [picanha, sabonete] = rows
  expect(isValidProductId(picanha.id)).toBe(true)
  expect(isValidProductId(sabonete.id)).toBe(true)
  expect(picanha.id).not.toBe(sabonete.id)

  expect(
    sqlite
      .prepare(
        'SELECT position, productId, priceInCents FROM offer_page_items ORDER BY position'
      )
      .all()
  ).toEqual([
    { position: 0, productId: picanha.id, priceInCents: 4990 },
    { position: 1, productId: sabonete.id, priceInCents: 399 }
  ])
  expect(sqlite.pragma('foreign_key_check')).toEqual([])
  // The new tables point to products, not to the temporary name they were created with
  sqlite.prepare('DELETE FROM offer_page_items').run()
  sqlite.prepare('DELETE FROM products WHERE id = ?').run(sabonete.id)
  expect(sqlite.prepare('SELECT code FROM product_codes').all()).toEqual([
    { code: '2001' }
  ])
})

test('radio-script-blocks resets the saved template and drops the first script format', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite })
  migrate(database, {
    migrationsFolder: await copyMigrationsBefore('_radio-script-blocks')
  })

  sqlite.exec(`
    INSERT INTO radio_script_template (id, opening, beforeBlock, afterBlock, closing, priceMarkers)
      VALUES (1, 'Oi', '', '', 'Tchau', '["somente"]');
    INSERT INTO offers (name, highlightTitle, highlightMessage, createdAt, updatedAt)
      VALUES ('Semana', '', '', 0, 0);
    INSERT INTO offer_generations (offerId, number, offerExport, pageCount, radioScript, createdAt)
      VALUES
        (1, 1, '{}', 1, '{"version":1,"offerName":"Semana","blocks":[],"list":[]}', 0),
        (1, 2, '{}', 1, NULL, 0);
  `)

  migrate(database, { migrationsFolder })

  expect(
    sqlite
      .prepare('SELECT blocks, priceMarkers FROM radio_script_template')
      .get()
  ).toEqual({
    blocks: '[{"type":"products","pageCount":1}]',
    priceMarkers: '["somente"]'
  })
  expect(
    sqlite
      .prepare('SELECT radioScript FROM offer_generations ORDER BY number')
      .all()
  ).toEqual([{ radioScript: null }, { radioScript: null }])
})
