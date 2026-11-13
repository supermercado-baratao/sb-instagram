import {
  formatPrice,
  type OfferContent,
  type OfferItem
} from '@/models/offer/offer'

import type { Pronunciation } from './pronunciation'
import { spellPrice, suggestVoiceText } from './spoken-text'

// Each offer page with products is a round of the ad: the opening, the page's products and a
// closing chosen by the round's position (#123). Tone marks ("[animado]") are written into the
// texts as the voice expects them, so nothing here knows about a specific voice service
export type RadioScriptClosing = { id: number; name: string; text: string }

// Closing ids. The end always comes in, the start takes the rounds left and the middle repeats
// through the rest, so one template fits an offer of any size
export type RadioScriptClosingSequence = {
  start: number[]
  middle: number[]
  end: number[]
}

export type RadioScriptTemplate = {
  opening: string
  closings: RadioScriptClosing[]
  sequence: RadioScriptClosingSequence
  priceMarkers: string[]
  // A product shown on more than one page is spoken only on the first one
  speakRepeatedOnce: boolean
}

// The fixed sequence of blocks saved before #123, read only to convert it
export type LegacyRadioScriptBlock =
  | { type: 'text'; text: string; id?: number }
  | { type: 'products'; pageCount: number; id?: number }

export type RadioListItem = { number: number; text: string; price: string }

export type RadioScript = {
  // Version 2 was generated from the fixed blocks, which could leave pages out or ask for pages
  // the offer didn't have; version 3 always takes every page
  version: 2 | 3
  script: string
  list: RadioListItem[]
  // Only in version 2: offer page numbers (1-based) that no products block took
  unusedPages?: number[]
  // Only in version 2: pages the products blocks asked for beyond the ones the offer had
  missingPageCount?: number
}

export type RadioScriptClosingField = 'name' | 'text'

export type RadioScriptTemplateError = {
  message: string
  // The closing the error is about, with its field
  index?: number
  field?: RadioScriptClosingField
}

export const INITIAL_RADIO_SCRIPT_TEMPLATE: RadioScriptTemplate = {
  opening: '',
  closings: [],
  sequence: { start: [], middle: [], end: [] },
  priceMarkers: ['por apenas', 'somente', 'somente'],
  speakRepeatedOnce: true
}

export const SEQUENCE_PARTS = ['start', 'middle', 'end'] as const

export type RadioScriptSequencePart = (typeof SEQUENCE_PARTS)[number]

const foldName = (name: string) => name.trim().toLocaleLowerCase('pt-BR')

// Closings are picked by name, so a blank or repeated one couldn't be told apart. An empty text is
// fine: it ends the round with nothing
export const getRadioScriptTemplateError = ({
  closings
}: Pick<RadioScriptTemplate, 'closings'>):
  RadioScriptTemplateError | undefined => {
  const seen = new Set<string>()
  for (const [index, { name }] of closings.entries()) {
    const folded = foldName(name)
    if (folded === '') {
      return { message: 'Dê um nome ao fechamento.', index, field: 'name' }
    }
    if (seen.has(folded)) {
      return {
        message: 'Já existe um fechamento com este nome.',
        index,
        field: 'name'
      }
    }
    seen.add(folded)
  }
}

export const getNextClosingId = (closings: RadioScriptClosing[]) =>
  Math.max(0, ...closings.map(({ id }) => id)) + 1

export const isClosingInSequence = (
  sequence: RadioScriptClosingSequence,
  id: number
) => SEQUENCE_PARTS.some((part) => sequence[part].includes(id))

// A sequence keeps only the closings that still exist, so the saved JSON never points to a removed
// one
export const normalizeRadioScriptTemplate = ({
  opening,
  closings,
  sequence,
  priceMarkers,
  speakRepeatedOnce
}: RadioScriptTemplate): RadioScriptTemplate => {
  const ids = new Set(closings.map(({ id }) => id))
  return {
    opening: opening.trim(),
    closings: closings.map(({ id, name, text }) => ({
      id,
      name: name.trim(),
      text: text.trim()
    })),
    sequence: {
      start: sequence.start.filter((id) => ids.has(id)),
      middle: sequence.middle.filter((id) => ids.has(id)),
      end: sequence.end.filter((id) => ids.has(id))
    },
    priceMarkers: priceMarkers
      .map((marker) => marker.trim().replaceAll(/\s+/g, ' '))
      .filter((marker) => marker !== ''),
    speakRepeatedOnce
  }
}

// The closing of each of `count` rounds, `undefined` for a round in the middle when the middle is
// empty. An end longer than the offer keeps its last closings, so the final one always comes in
export const getClosingSequence = (
  { start, middle, end }: RadioScriptClosingSequence,
  count: number
): (number | undefined)[] => {
  if (count <= 0) return []
  const tail = end.slice(Math.max(0, end.length - count))
  const head = start.slice(0, count - tail.length)
  const middleCount = count - tail.length - head.length
  const filler = Array.from({ length: middleCount }, (_, index) =>
    middle.length > 0 ? middle[index % middle.length] : undefined
  )
  return [...head, ...filler, ...tail]
}

// The texts between two products blocks held the closing of one round and the opening of the next,
// so the opening is taken off their end. Equal texts become one closing. With the closings c1…cn in
// order, the end takes the last two, the start the first (from 3 rounds on) and the middle the
// rest, so the template gives the same script as before for as many pages as it had blocks
export const convertLegacyBlocks = (
  blocks: LegacyRadioScriptBlock[]
): Pick<RadioScriptTemplate, 'opening' | 'closings' | 'sequence'> => {
  const segments: string[][] = [[]]
  for (const block of blocks) {
    if (block.type === 'products') segments.push([])
    else if (block.text.trim() !== '') segments.at(-1)?.push(block.text.trim())
  }
  const [before, ...after] = segments.map((texts) => texts.join('\n\n'))
  const opening = before
  const texts = after.map((text) =>
    opening !== '' && text.endsWith(opening)
      ? text.slice(0, -opening.length).trim()
      : text
  )
  if (texts.every((text) => text === '')) {
    return {
      opening,
      closings: [],
      sequence: { start: [], middle: [], end: [] }
    }
  }
  const closings: RadioScriptClosing[] = []
  const ids = texts.map((text) => {
    const existing = closings.find((closing) => closing.text === text)
    if (existing) return existing.id
    const id = closings.length + 1
    closings.push({ id, name: `Fechamento ${id}`, text })
    return id
  })
  const end = ids.slice(-2)
  const rest = ids.slice(0, -2)
  return {
    opening,
    closings,
    sequence: { start: rest.slice(0, 1), middle: rest.slice(1), end }
  }
}

// An item as the script takes it, with the page it came from
export type RadioScriptItem = OfferItem & { pageNumber: number }

export type RadioScriptRound = { pageNumber: number; items: RadioScriptItem[] }

// One round per page with products, in the offer's order; a product already spoken on an earlier
// page is left out when the store asks for it (#111), and a page left with none takes no round
export const getRadioScriptRounds = (
  content: OfferContent,
  speakRepeatedOnce: boolean
): RadioScriptRound[] => {
  const seen = new Set<string>()
  return content.pages.flatMap((page, index) => {
    const items = page.slots
      .slice(0, page.layout)
      .filter((slot) => slot !== null)
      .filter(({ product }) => {
        if (!speakRepeatedOnce) return true
        if (seen.has(product.id)) return false
        seen.add(product.id)
        return true
      })
      .map((item) => ({ ...item, pageNumber: index + 1 }))
    return items.length > 0 ? [{ pageNumber: index + 1, items }] : []
  })
}

export type RadioScriptLine = {
  item: RadioScriptItem
  // What the product speaks: its voice text, or the suggestion when it has none
  voiceText: string
  // The line as the script writes it, with the marker and the spelled price
  line: string
}

export type RadioScriptPart =
  | { type: 'text'; text: string }
  | { type: 'products'; pageNumber: number; lines: RadioScriptLine[] }

const getProductVoiceText = (
  product: OfferItem['product'],
  pronunciations: Pronunciation[]
) => product.voiceText?.trim() || suggestVoiceText(product, pronunciations)

// The editor opens with the suggestion for a product without a voice text of its own, and saving
// it unchanged would freeze it, so the product would stop following later dictionary changes
export const getEditedVoiceText = (
  saved: string | null,
  value: string,
  suggestion: string
) => (saved === null && value.trim() === suggestion.trim() ? '' : value)

// The script in parts, so the Comercial page can show each product's line next to a way of
// changing what it speaks (#111). The marker cycle restarts in each round
export const getRadioScriptParts = (
  content: OfferContent,
  template: RadioScriptTemplate,
  pronunciations: Pronunciation[]
): RadioScriptPart[] => {
  const { opening, closings, sequence, priceMarkers, speakRepeatedOnce } =
    normalizeRadioScriptTemplate(template)
  const rounds = getRadioScriptRounds(content, speakRepeatedOnce)
  const closingIds = getClosingSequence(sequence, rounds.length)
  return rounds.flatMap(({ pageNumber, items }, roundIndex) => {
    const lines = items.map((item, index) => {
      const voiceText = getProductVoiceText(item.product, pronunciations)
      const marker =
        priceMarkers.length > 0
          ? priceMarkers[index % priceMarkers.length]
          : undefined
      const spoken = marker ? `${voiceText}, ${marker}` : voiceText
      return {
        item,
        voiceText,
        line: `- ${spoken}: ${spellPrice(item.priceInCents)}`
      }
    })
    const closing = closings.find(({ id }) => id === closingIds[roundIndex])
    return [
      ...(opening === '' ? [] : [{ type: 'text' as const, text: opening }]),
      { type: 'products' as const, pageNumber, lines },
      ...(closing && closing.text !== ''
        ? [{ type: 'text' as const, text: closing.text }]
        : [])
    ]
  })
}

// The list numbers the products across the whole offer
export const getRadioScript = (
  content: OfferContent,
  template: RadioScriptTemplate,
  pronunciations: Pronunciation[]
): RadioScript => {
  const parts = getRadioScriptParts(content, template, pronunciations)
  const lines = parts.flatMap((part) =>
    part.type === 'products' ? part.lines : []
  )
  return {
    version: 3,
    script: parts
      .map((part) =>
        part.type === 'text'
          ? part.text
          : part.lines.map(({ line }) => line).join('\n')
      )
      .join('\n\n'),
    list: lines.map(({ item, voiceText }, index) => ({
      number: index + 1,
      text: voiceText,
      price: formatPrice(item.priceInCents)
    }))
  }
}

const joinNumbers = (numbers: number[]) =>
  numbers.length === 1
    ? String(numbers[0])
    : `${numbers.slice(0, -1).join(', ')} e ${numbers.at(-1)}`

// Only a version 2 script can have left pages out, so a generation recorded before #123 keeps the
// warning that is true for it
export const getRadioScriptWarning = ({
  unusedPages = [],
  missingPageCount = 0
}: Pick<RadioScript, 'unusedPages' | 'missingPageCount'>) => {
  const problems = []
  if (unusedPages.length === 1) {
    problems.push(
      `o roteiro e a lista de produtos ficaram sem a arte ${unusedPages[0]}`
    )
  } else if (unusedPages.length > 1) {
    problems.push(
      `o roteiro e a lista de produtos ficaram sem as artes ${joinNumbers(unusedPages)}`
    )
  }
  if (missingPageCount === 1) {
    problems.push('faltou 1 arte para os blocos de produtos do comercial')
  } else if (missingPageCount > 1) {
    problems.push(
      `faltaram ${missingPageCount} artes para os blocos de produtos do comercial`
    )
  }
  if (problems.length === 0) return
  // A store read the old warning as if the page itself hadn't been generated (#94)
  return `As artes e o PDF estão completos, mas ${problems.join(' e ')}. Gere a oferta de novo para refazer o comercial.`
}

// Plain text with no headings, so it is pasted as it is into the voice service or sent to whoever
// records the ad
export const getRadioScriptMarkdown = ({ script }: RadioScript) => `${script}\n`

export const getRadioListMarkdown = ({ list }: RadioScript) =>
  `${list.map(({ number, text, price }) => `${number}. ${text}: R$ ${price}`).join('\n')}\n`
