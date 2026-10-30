// @vitest-environment node
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { expect, test } from 'vitest'

import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'

import { listPronunciations, savePronunciations } from './pronunciation'

const setup = () => {
  const database = drizzle({ client: new Database(':memory:'), relations })
  migrate(database, { migrationsFolder })
  return database
}

test('keeps the order of the saved list and replaces it on the next save', () => {
  const database = setup()
  savePronunciations(database, [
    { term: 'Veludo', spoken: 'Velude' },
    { term: 'Átila', spoken: 'Átila' }
  ])
  savePronunciations(database, [
    { term: 'cream cracker', spoken: 'kreme cráquer' },
    { term: 'Veludo', spoken: 'Velude' }
  ])

  expect(listPronunciations(database)).toEqual([
    { term: 'cream cracker', spoken: 'kreme cráquer' },
    { term: 'Veludo', spoken: 'Velude' }
  ])
})

test('saves an empty dictionary', () => {
  const database = setup()
  savePronunciations(database, [{ term: 'Veludo', spoken: 'Velude' }])
  savePronunciations(database, [])

  expect(listPronunciations(database)).toEqual([])
})
