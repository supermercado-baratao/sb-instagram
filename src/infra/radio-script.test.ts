// @vitest-environment node
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { expect, test } from 'vitest'

import {
  INITIAL_RADIO_SCRIPT_TEMPLATE,
  type RadioScriptTemplate
} from '@/domain/radio-script'
import { migrationsFolder } from '@/infra/database/file'
import { relations } from '@/infra/database/relations'
import { radioScriptTemplate } from '@/infra/database/schema'

import {
  findRadioScriptTemplate,
  saveRadioScriptTemplate
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

test('starts from the initial template until the first save', () => {
  expect(findRadioScriptTemplate(setup())).toEqual(
    INITIAL_RADIO_SCRIPT_TEMPLATE
  )
})

test('reads back the saved template', () => {
  const database = setup()
  saveRadioScriptTemplate(database, TEMPLATE)
  saveRadioScriptTemplate(database, { ...TEMPLATE, opening: 'Olá' })

  expect(findRadioScriptTemplate(database)).toEqual({
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

  const converted = findRadioScriptTemplate(database)
  expect(converted).toEqual({
    opening: 'Oi',
    closings: [{ id: 1, name: 'Fechamento 1', text: 'Tchau' }],
    sequence: { start: [], middle: [], end: [1] },
    priceMarkers: ['somente'],
    speakRepeatedOnce: false
  })

  saveRadioScriptTemplate(database, converted)
  expect(
    database
      .select({ blocks: radioScriptTemplate.blocks })
      .from(radioScriptTemplate)
      .get()
  ).toEqual({ blocks: null })
})
