import { formatPrice, type OfferContent } from '@/domain/offer'
import type { Pronunciation } from '@/domain/pronunciation'
import { spellPrice, suggestVoiceText } from '@/domain/spoken-text'

// Tone marks ("[animado]") are written into the texts as the voice expects them, so nothing here
// knows about a specific voice service
export type RadioScriptTemplate = {
  opening: string
  beforeBlock: string
  afterBlock: string
  closing: string
  priceMarkers: string[]
}

export type RadioListItem = { number: number; text: string; price: string }

export type RadioScript = {
  version: 1
  offerName: string
  blocks: string[]
  list: RadioListItem[][]
}

export const INITIAL_RADIO_SCRIPT_TEMPLATE: RadioScriptTemplate = {
  opening: '',
  beforeBlock: '',
  afterBlock: '',
  closing: '',
  priceMarkers: ['por apenas', 'somente', 'somente']
}

const TEMPLATE_TEXT_FIELDS = [
  'opening',
  'beforeBlock',
  'afterBlock',
  'closing'
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isRadioScriptTemplate = (
  value: unknown
): value is RadioScriptTemplate =>
  isRecord(value) &&
  TEMPLATE_TEXT_FIELDS.every((field) => typeof value[field] === 'string') &&
  Array.isArray(value.priceMarkers) &&
  value.priceMarkers.every((marker: unknown) => typeof marker === 'string')

export const normalizeRadioScriptTemplate = ({
  opening,
  beforeBlock,
  afterBlock,
  closing,
  priceMarkers
}: RadioScriptTemplate): RadioScriptTemplate => ({
  opening: opening.trim(),
  beforeBlock: beforeBlock.trim(),
  afterBlock: afterBlock.trim(),
  closing: closing.trim(),
  priceMarkers: priceMarkers
    .map((marker) => marker.trim().replaceAll(/\s+/g, ' '))
    .filter((marker) => marker !== '')
})

const joinParts = (parts: string[], separator: string) =>
  parts.filter((part) => part !== '').join(separator)

// One block per page, as the radio ad is split where the poster pages are; the marker cycle
// restarts in each block, while the list numbers products across the whole offer
export const getRadioScript = (
  content: OfferContent,
  template: RadioScriptTemplate,
  pronunciations: Pronunciation[]
): RadioScript => {
  const { opening, beforeBlock, afterBlock, closing, priceMarkers } =
    normalizeRadioScriptTemplate(template)
  const pages = content.pages
    .map((page) =>
      page.slots.slice(0, page.layout).filter((slot) => slot !== null)
    )
    .filter((items) => items.length > 0)

  let number = 0
  const list = pages.map((items) =>
    items.map(({ product, priceInCents }) => {
      number += 1
      return {
        number,
        text:
          product.voiceText?.trim() ||
          suggestVoiceText(product, pronunciations),
        price: formatPrice(priceInCents)
      }
    })
  )

  const blocks = pages.map((items, blockIndex) => {
    const lines = items.map(({ priceInCents }, index) => {
      const marker =
        priceMarkers.length > 0 ? priceMarkers[index % priceMarkers.length] : ''
      const price = joinParts([marker, spellPrice(priceInCents)], ' ')
      return `${list[blockIndex][index].text}, ${price}.`
    })
    return joinParts(
      [
        blockIndex === 0 ? opening : '',
        beforeBlock,
        lines.join('\n'),
        afterBlock,
        blockIndex === pages.length - 1 ? closing : ''
      ],
      '\n\n'
    )
  })

  return { version: 1, offerName: content.name, blocks, list }
}

export const getRadioScriptMarkdown = (script: RadioScript) =>
  [
    `# Roteiro do comercial: ${script.offerName}`,
    ...script.blocks.map((block, index) => `## Bloco ${index + 1}\n\n${block}`)
  ].join('\n\n') + '\n'

export const getRadioListMarkdown = (script: RadioScript) =>
  [
    `# Lista da rádio: ${script.offerName}`,
    ...script.list.map(
      (items, index) =>
        `## Bloco ${index + 1}\n\n${items
          .map(({ number, text, price }) => `${number}. ${text}: R$ ${price}`)
          .join('\n')}`
    )
  ].join('\n\n') + '\n'
