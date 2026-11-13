// @vitest-environment node
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { expect, test } from 'vitest'

import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import { radioScriptTemplate } from '@/infra/database/schema'

import { radioAdModel } from './model'
import { INITIAL_PRONUNCIATIONS } from './pronunciation'
import {
  INITIAL_RADIO_SCRIPT_TEMPLATE,
  type RadioScriptTemplate
} from './radio-script'

const setup = () => {
  const database = drizzle({ client: new Database(':memory:'), relations })
  migrate(database, { migrationsFolder })
  return database
}

const TEMPLATE: RadioScriptTemplate = {
  opening: 'Oi',
  closings: [{ id: 1, name: 'Final', text: 'Tchau' }],
  sequence: { start: [], middle: [], end: [1] },
  priceMarkers: ['somente'],
  speakRepeatedOnce: false
}

const saveTemplate = (
  database: ReturnType<typeof setup>,
  radioScript: RadioScriptTemplate,
  pronunciations: { term: string; spoken: string }[] = []
) => radioAdModel.save(database, { pronunciations, radioScript })

test('starts from the initial template until the first save', () => {
  expect(radioAdModel.findTemplate(setup())).toEqual(
    INITIAL_RADIO_SCRIPT_TEMPLATE
  )
})

test('reads back the saved template', () => {
  const database = setup()
  saveTemplate(database, TEMPLATE)
  saveTemplate(database, { ...TEMPLATE, opening: 'Olá' })

  expect(radioAdModel.findTemplate(database)).toEqual({
    ...TEMPLATE,
    opening: 'Olá'
  })
})

test('converts the blocks saved before #123 and drops them on the next save', () => {
  const database = setup()
  database
    .insert(radioScriptTemplate)
    .values({
      id: 1,
      blocks: [
        { type: 'text', text: 'Oi' },
        { type: 'products', pageCount: 1 },
        { type: 'text', text: 'Tchau' }
      ],
      priceMarkers: ['somente'],
      speakRepeatedOnce: false
    })
    .run()

  const converted = radioAdModel.findTemplate(database)
  expect(converted).toEqual({
    opening: 'Oi',
    closings: [{ id: 1, name: 'Fechamento 1', text: 'Tchau' }],
    sequence: { start: [], middle: [], end: [1] },
    priceMarkers: ['somente'],
    speakRepeatedOnce: false
  })

  saveTemplate(database, converted)
  expect(
    database
      .select({ blocks: radioScriptTemplate.blocks })
      .from(radioScriptTemplate)
      .get()
  ).toEqual({ blocks: null })
})

test('keeps the order of the saved list and replaces it on the next save', () => {
  const database = setup()
  saveTemplate(database, INITIAL_RADIO_SCRIPT_TEMPLATE, [
    { term: 'Veludo', spoken: 'Velude' },
    { term: 'Átila', spoken: 'Átila' }
  ])
  saveTemplate(database, INITIAL_RADIO_SCRIPT_TEMPLATE, [
    { term: 'cream cracker', spoken: 'kreme cráquer' },
    { term: 'Veludo', spoken: 'Velude' }
  ])

  expect(radioAdModel.listPronunciations(database)).toEqual([
    { term: 'cream cracker', spoken: 'kreme cráquer' },
    { term: 'Veludo', spoken: 'Velude' }
  ])
})

test('starts from the initial dictionary until the Comercial page is saved', () => {
  expect(radioAdModel.listPronunciations(setup())).toEqual(
    INITIAL_PRONUNCIATIONS
  )
})

test('keeps an empty dictionary the store saved', () => {
  const database = setup()
  saveTemplate(database, INITIAL_RADIO_SCRIPT_TEMPLATE)

  expect(radioAdModel.listPronunciations(database)).toEqual([])
})

test('answers the closing to fix without saving', () => {
  const database = setup()

  expect(
    saveTemplate(database, {
      ...TEMPLATE,
      closings: [{ id: 1, name: ' ', text: 'Tchau' }]
    })
  ).toMatchObject({ status: 'invalid', closingIndex: 0, closingField: 'name' })
  expect(radioAdModel.findTemplate(database)).toEqual(
    INITIAL_RADIO_SCRIPT_TEMPLATE
  )
})

test("refuses settings that are not the form's", () => {
  expect(() =>
    radioAdModel.save(setup(), { pronunciations: [], radioScript: {} })
  ).toThrow()
})
