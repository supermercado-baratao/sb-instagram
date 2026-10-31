import { formatPrice, type OfferContent } from '@/domain/offer'
import type { Pronunciation } from '@/domain/pronunciation'
import { spellPrice, suggestVoiceText } from '@/domain/spoken-text'

// The texts between the products vary from block to block (a full, a short and a final closing),
// so the store writes the whole sequence instead of filling fixed slots (#76). Tone marks
// ("[animado]") are written into the texts as the voice expects them, so nothing here knows about
// a specific voice service
export type RadioScriptTextBlock = { type: 'text'; text: string }

export type RadioScriptProductsBlock = { type: 'products'; pageCount: number }

export type RadioScriptBlock = RadioScriptTextBlock | RadioScriptProductsBlock

export type RadioScriptTemplate = {
  blocks: RadioScriptBlock[]
  priceMarkers: string[]
}

export type RadioListItem = { number: number; text: string; price: string }

export type RadioScript = {
  version: 2
  offerName: string
  script: string
  list: RadioListItem[]
  // Offer page numbers (1-based) that no products block took
  unusedPages: number[]
  // Pages the products blocks asked for beyond the ones the offer has
  missingPageCount: number
}

export type RadioScriptTemplateError = {
  message: string
  index?: number
}

export const MAX_BLOCK_PAGE_COUNT = 20

export const INITIAL_RADIO_SCRIPT_TEMPLATE: RadioScriptTemplate = {
  blocks: [{ type: 'products', pageCount: 1 }],
  priceMarkers: ['por apenas', 'somente', 'somente']
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isRadioScriptBlock = (value: unknown): value is RadioScriptBlock =>
  isRecord(value) &&
  ((value.type === 'text' && typeof value.text === 'string') ||
    (value.type === 'products' && typeof value.pageCount === 'number'))

export const isRadioScriptTemplate = (
  value: unknown
): value is RadioScriptTemplate =>
  isRecord(value) &&
  Array.isArray(value.blocks) &&
  value.blocks.every(isRadioScriptBlock) &&
  Array.isArray(value.priceMarkers) &&
  value.priceMarkers.every((marker: unknown) => typeof marker === 'string')

export const isValidBlockPageCount = (pageCount: number) =>
  Number.isSafeInteger(pageCount) &&
  pageCount >= 1 &&
  pageCount <= MAX_BLOCK_PAGE_COUNT

export const getRadioScriptTemplateError = ({
  blocks
}: RadioScriptTemplate): RadioScriptTemplateError | undefined => {
  const index = blocks.findIndex(
    (block) =>
      block.type === 'products' && !isValidBlockPageCount(block.pageCount)
  )
  if (index !== -1) {
    return {
      message: `Informe de 1 a ${MAX_BLOCK_PAGE_COUNT} páginas.`,
      index
    }
  }
  if (blocks.every((block) => block.type !== 'products')) {
    return { message: 'Adicione ao menos um bloco de produtos.' }
  }
}

export const normalizeRadioScriptTemplate = ({
  blocks,
  priceMarkers
}: RadioScriptTemplate): RadioScriptTemplate => ({
  blocks: blocks
    .map((block): RadioScriptBlock =>
      block.type === 'text'
        ? { type: 'text', text: block.text.trim() }
        : { type: 'products', pageCount: block.pageCount }
    )
    .filter((block) => block.type === 'products' || block.text !== ''),
  priceMarkers: priceMarkers
    .map((marker) => marker.trim().replaceAll(/\s+/g, ' '))
    .filter((marker) => marker !== '')
})

const getPageItems = (content: OfferContent) =>
  content.pages
    .map((page, index) => ({
      number: index + 1,
      items: page.slots.slice(0, page.layout).filter((slot) => slot !== null)
    }))
    .filter(({ items }) => items.length > 0)

// Each products block takes the next pages in order, so reordering the offer pages never needs the
// sequence to change; the marker cycle restarts in each products block, while the list numbers
// products across the whole offer. Pages without products take no block
export const getRadioScript = (
  content: OfferContent,
  template: RadioScriptTemplate,
  pronunciations: Pronunciation[]
): RadioScript => {
  const { blocks, priceMarkers } = normalizeRadioScriptTemplate(template)
  const pages = getPageItems(content)
  const list: RadioListItem[] = []
  const parts: string[] = []
  let nextPage = 0
  let missingPageCount = 0

  for (const block of blocks) {
    if (block.type === 'text') {
      parts.push(block.text)
      continue
    }
    const taken = pages.slice(nextPage, nextPage + block.pageCount)
    nextPage += taken.length
    missingPageCount += block.pageCount - taken.length
    const lines = taken
      .flatMap(({ items }) => items)
      .map(({ product, priceInCents }, index) => {
        const text =
          product.voiceText?.trim() || suggestVoiceText(product, pronunciations)
        list.push({
          number: list.length + 1,
          text,
          price: formatPrice(priceInCents)
        })
        const marker =
          priceMarkers.length > 0
            ? priceMarkers[index % priceMarkers.length]
            : undefined
        const spoken = marker ? `${text}, ${marker}` : text
        return `- ${spoken}: ${spellPrice(priceInCents)}`
      })
    if (lines.length > 0) parts.push(lines.join('\n'))
  }

  return {
    version: 2,
    offerName: content.name,
    script: parts.join('\n\n'),
    list,
    unusedPages: pages.slice(nextPage).map(({ number }) => number),
    missingPageCount
  }
}

const joinNumbers = (numbers: number[]) =>
  numbers.length === 1
    ? String(numbers[0])
    : `${numbers.slice(0, -1).join(', ')} e ${numbers.at(-1)}`

export const getRadioScriptWarning = ({
  unusedPages,
  missingPageCount
}: Pick<RadioScript, 'unusedPages' | 'missingPageCount'>) => {
  const warnings = []
  if (unusedPages.length === 1) {
    warnings.push(`A página ${unusedPages[0]} ficou fora do comercial.`)
  } else if (unusedPages.length > 1) {
    warnings.push(
      `As páginas ${joinNumbers(unusedPages)} ficaram fora do comercial.`
    )
  }
  if (missingPageCount === 1) {
    warnings.push('Faltou 1 página para os blocos de produtos do comercial.')
  } else if (missingPageCount > 1) {
    warnings.push(
      `Faltaram ${missingPageCount} páginas para os blocos de produtos do comercial.`
    )
  }
  if (warnings.length === 0) return
  return [...warnings, 'Ajuste os blocos em Configurações › Comercial.'].join(
    ' '
  )
}

// Plain text with no headings, so it is pasted as it is into the voice service and sent to the
// radio station
export const getRadioScriptMarkdown = ({ script }: RadioScript) => `${script}\n`

export const getRadioListMarkdown = ({ list }: RadioScript) =>
  `${list.map(({ number, text, price }) => `${number}. ${text}: R$ ${price}`).join('\n')}\n`
