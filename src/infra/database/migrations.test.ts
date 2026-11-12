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

  migrate(database, {
    migrationsFolder: await copyMigrationsBefore('_merge-name-and-brand')
  })

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
    sqlite.prepare('SELECT radioScript FROM generations ORDER BY number').all()
  ).toEqual([{ radioScript: null }, { radioScript: null }])
})

test('single-offer keeps the latest offer and every generation of the others', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite })
  migrate(database, {
    migrationsFolder: await copyMigrationsBefore('_single-offer')
  })

  const product = '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d'
  sqlite.exec(`
    INSERT INTO products (id, name) VALUES ('${product}', 'Leite');
    INSERT INTO offers (id, name, validUntil, highlightTitle, highlightMessage, createdAt, updatedAt) VALUES
      (5, 'Antiga', '2026-10-01', 'Velho', '', 0, 100),
      (7, 'Atual', '2026-11-12', 'Feirão', 'Só hoje', 0, 200);
    INSERT INTO offer_pages (id, offerId, position, templateId, layout) VALUES
      (10, 5, 0, 'mercado', 9),
      (20, 7, 0, 'mercado', 4),
      (21, 7, 1, 'acougue', 3);
    INSERT INTO offer_page_items (pageId, position, productId, priceInCents) VALUES
      (10, 0, '${product}', 100),
      (21, 2, '${product}', 799);
    INSERT INTO offer_generations (id, offerId, number, offerExport, pageCount, createdAt) VALUES
      (1, 7, 1, '{"validUntil":"2026-11-12"}', 2, 300),
      (2, 5, 1, '{"validUntil":"2026-10-01"}', 1, 100),
      (3, 5, 2, '{"validUntil":"2026-10-01"}', 1, 200),
      (4, 7, 2, '{}', 2, 400);
    DELETE FROM offer_generations WHERE id = 4;
  `)

  migrate(database, {
    migrationsFolder: await copyMigrationsBefore('_independent-generations')
  })

  expect(sqlite.prepare('SELECT * FROM offers').all()).toEqual([
    {
      id: 1,
      validUntil: '2026-11-12',
      highlightTitle: 'Feirão',
      highlightMessage: 'Só hoje'
    }
  ])
  expect(
    sqlite.prepare('SELECT * FROM offer_pages ORDER BY position').all()
  ).toEqual([
    { id: 20, position: 0, templateId: 'mercado', layout: 4 },
    { id: 21, position: 1, templateId: 'acougue', layout: 3 }
  ])
  expect(sqlite.prepare('SELECT * FROM offer_page_items').all()).toEqual([
    { pageId: 21, position: 2, productId: product, priceInCents: 799 }
  ])
  // The ids name the folders of the files, so they stay, and the numbers follow the dates
  expect(
    sqlite
      .prepare(
        'SELECT id, offerId, number, createdAt FROM offer_generations ORDER BY number'
      )
      .all()
  ).toEqual([
    { id: 2, offerId: 1, number: 1, createdAt: 100 },
    { id: 3, offerId: 1, number: 2, createdAt: 200 },
    { id: 1, offerId: 1, number: 3, createdAt: 300 }
  ])
  expect(sqlite.pragma('foreign_key_check')).toEqual([])
  expect(() =>
    sqlite.exec(
      "INSERT INTO offers (id, highlightTitle, highlightMessage) VALUES (2, '', '')"
    )
  ).toThrow()

  // The id of the deleted generation must not come back
  const { lastInsertRowid } = sqlite
    .prepare(
      "INSERT INTO offer_generations (offerId, number, offerExport, pageCount, createdAt) VALUES (1, 4, '{}', 1, 500)"
    )
    .run()
  expect(lastInsertRowid).toBe(5)
})

test('independent-generations keeps every generation and its id sequence', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite })
  migrate(database, {
    migrationsFolder: await copyMigrationsBefore('_independent-generations')
  })

  sqlite.exec(`
    INSERT INTO offers (id, highlightTitle, highlightMessage) VALUES (1, '', '');
    INSERT INTO offer_generations (id, offerId, number, offerExport, pageCount, radioScript, createdAt) VALUES
      (2, 1, 1, '{"validUntil":"2026-10-01"}', 1, NULL, 100),
      (5, 1, 2, '{"validUntil":"2026-11-12"}', 2, '{"version":2}', 200),
      (6, 1, 3, '{}', 1, NULL, 300);
    DELETE FROM offer_generations WHERE id = 6;
  `)

  migrate(database, { migrationsFolder })

  expect(sqlite.prepare('SELECT * FROM generations ORDER BY id').all()).toEqual(
    [
      {
        id: 2,
        number: 1,
        offerExport: '{"validUntil":"2026-10-01"}',
        pageCount: 1,
        radioScript: null,
        pages: null,
        createdAt: 100
      },
      {
        id: 5,
        number: 2,
        offerExport: '{"validUntil":"2026-11-12"}',
        pageCount: 2,
        radioScript: '{"version":2}',
        pages: null,
        createdAt: 200
      }
    ]
  )

  // The generations no longer depend on the offer, and the deleted id must not come back
  sqlite.exec('DELETE FROM offers')
  expect(sqlite.prepare('SELECT id FROM generations').all()).toHaveLength(2)
  const { lastInsertRowid } = sqlite
    .prepare(
      "INSERT INTO generations (number, offerExport, pageCount, createdAt) VALUES (3, '{}', 1, 500)"
    )
    .run()
  expect(lastInsertRowid).toBe(7)
})

test('move-brand-into-placeholder-name moves the description out of the brand', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite })
  migrate(database, {
    migrationsFolder: await copyMigrationsBefore(
      '_move-brand-into-placeholder-name'
    )
  })

  sqlite.exec(`
    INSERT INTO products (id, name, brand) VALUES
      ('a', '-', ' Presunto Fatiado '),
      ('b', ' . ', 'Óleo'),
      ('c', 'Arroz', 'Tio João'),
      ('d', '-', NULL),
      ('e', '-', '-'),
      ('f', 'Água', 'Crystal');
  `)

  migrate(database, {
    migrationsFolder: await copyMigrationsBefore('_merge-name-and-brand')
  })

  const rows = sqlite
    .prepare('SELECT id, name, brand FROM products ORDER BY id')
    .all()
  expect(rows).toEqual([
    { id: 'a', name: 'Presunto Fatiado', brand: null },
    { id: 'b', name: 'Óleo', brand: null },
    { id: 'c', name: 'Arroz', brand: 'Tio João' },
    { id: 'd', name: '-', brand: null },
    { id: 'e', name: '-', brand: '-' },
    { id: 'f', name: 'Água', brand: 'Crystal' }
  ])
})

test('merge-name-and-brand joins name and brand into the description', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite })
  migrate(database, {
    migrationsFolder: await copyMigrationsBefore('_merge-name-and-brand')
  })

  sqlite.exec(`
    INSERT INTO products (id, name, brand, unit) VALUES
      ('a', 'Arroz', ' Tio João ', '5 kg'),
      ('b', 'Café Pilão', 'pilão', '500 g'),
      ('c', 'Presunto Fatiado', NULL, 'Kg'),
      ('d', 'Farinha', '-', NULL),
      ('e', ' - ', NULL, NULL),
      ('f', 'Sabão Ypê', 'YPÊ', NULL);
    INSERT INTO product_codes (productId, code) VALUES ('a', '7896006716112');
  `)

  migrate(database, { migrationsFolder })

  expect(
    sqlite
      .prepare('SELECT id, description, unit FROM products ORDER BY id')
      .all()
  ).toEqual([
    { id: 'a', description: 'Arroz Tio João', unit: '5 kg' },
    { id: 'b', description: 'Café Pilão', unit: '500 g' },
    { id: 'c', description: 'Presunto Fatiado', unit: 'Kg' },
    { id: 'd', description: 'Farinha', unit: null },
    { id: 'e', description: '-', unit: null },
    // lower() folds only ASCII, so the brand in another case with an accent is appended
    { id: 'f', description: 'Sabão Ypê YPÊ', unit: null }
  ])
  expect(sqlite.prepare('SELECT * FROM product_codes').all()).toEqual([
    { productId: 'a', code: '7896006716112' }
  ])
})

test('lowercase-voice-texts writes the saved voice texts in lowercase, accents included', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const database = drizzle({ client: sqlite })
  migrate(database, {
    migrationsFolder: await copyMigrationsBefore('_lowercase-voice-texts')
  })

  sqlite.exec(`
    INSERT INTO products (id, description, voiceText) VALUES
      ('a', 'LEITE EM PÓ', 'LEITE EM PÓ INTEGRAL AÇÚCAR ÃÉÍÕÜÑ um quilo'),
      ('b', 'ARROZ', NULL),
      ('c', 'Café', 'Café Pilão');
  `)

  migrate(database, { migrationsFolder })

  expect(
    sqlite
      .prepare('SELECT id, description, voiceText FROM products ORDER BY id')
      .all()
  ).toEqual([
    {
      id: 'a',
      description: 'LEITE EM PÓ',
      voiceText: 'leite em pó integral açúcar ãéíõüñ um quilo'
    },
    { id: 'b', description: 'ARROZ', voiceText: null },
    { id: 'c', description: 'Café', voiceText: 'café pilão' }
  ])
})
