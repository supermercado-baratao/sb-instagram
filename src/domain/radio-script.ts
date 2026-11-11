import { formatPrice, type OfferContent, type OfferItem } from '@/domain/offer'
import type { Pronunciation } from '@/domain/pronunciation'
import { spellPrice, suggestVoiceText } from '@/domain/spoken-text'

// The texts between the products vary from block to block (a full, a short and a final closing),
// so the store writes the whole sequence instead of filling fixed slots (#76). Tone marks
// ("[animado]") are written into the texts as the voice expects them, so nothing here knows about
// a specific voice service
// Text blocks with the same `id` are one block shown in several places, so changing the text in one
// changes it in all of them (#111). A block without `id` stands alone, as every block saved before
// it did
export type RadioScriptTextBlock = { type: 'text'; text: string; id?: number }

// `id` names the block a product was moved to (#111). Blocks saved before it have none, and get one
// in order when read (`withProductsBlockIds`)
export type RadioScriptProductsBlock = {
  type: 'products'
  pageCount: number
  id?: number
}

export type RadioScriptBlock = RadioScriptTextBlock | RadioScriptProductsBlock

// A product the store moved to a products block, kept across offers, so a group such as cleaning or
// meat stays together every week (#111)
export type RadioScriptProductBlock = { productId: string; blockId: number }

export type RadioScriptTemplate = {
  blocks: RadioScriptBlock[]
  priceMarkers: string[]
  // A product shown on more than one page is spoken only on the first one
  speakRepeatedOnce: boolean
  // The products blocks share the offer's products evenly instead of taking pages
  splitEvenly: boolean
  productBlocks: RadioScriptProductBlock[]
}

export type RadioListItem = { number: number; text: string; price: string }

export type RadioScript = {
  version: 2
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
  blocks: [{ type: 'products', pageCount: 1, id: 1 }],
  priceMarkers: ['por apenas', 'somente', 'somente'],
  speakRepeatedOnce: true,
  splitEvenly: false,
  productBlocks: []
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isBlockId = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1

const isOptionalBlockId = (value: unknown) =>
  value === undefined || isBlockId(value)

const isRadioScriptBlock = (value: unknown): value is RadioScriptBlock =>
  isRecord(value) &&
  ((value.type === 'text' &&
    typeof value.text === 'string' &&
    isOptionalBlockId(value.id)) ||
    (value.type === 'products' &&
      typeof value.pageCount === 'number' &&
      isOptionalBlockId(value.id)))

const isRadioScriptProductBlock = (
  value: unknown
): value is RadioScriptProductBlock =>
  isRecord(value) &&
  typeof value.productId === 'string' &&
  isBlockId(value.blockId)

export const isRadioScriptTemplate = (
  value: unknown
): value is RadioScriptTemplate =>
  isRecord(value) &&
  Array.isArray(value.blocks) &&
  value.blocks.every(isRadioScriptBlock) &&
  Array.isArray(value.priceMarkers) &&
  value.priceMarkers.every((marker: unknown) => typeof marker === 'string') &&
  typeof value.speakRepeatedOnce === 'boolean' &&
  typeof value.splitEvenly === 'boolean' &&
  Array.isArray(value.productBlocks) &&
  value.productBlocks.every(isRadioScriptProductBlock)

const isRadioListItem = (value: unknown): value is RadioListItem =>
  isRecord(value) &&
  typeof value.number === 'number' &&
  typeof value.text === 'string' &&
  typeof value.price === 'string'

const isPageNumber = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1

export const isRadioScript = (value: unknown): value is RadioScript =>
  isRecord(value) &&
  value.version === 2 &&
  typeof value.script === 'string' &&
  Array.isArray(value.list) &&
  value.list.every(isRadioListItem) &&
  Array.isArray(value.unusedPages) &&
  value.unusedPages.every((page) => isPageNumber(page)) &&
  typeof value.missingPageCount === 'number' &&
  Number.isSafeInteger(value.missingPageCount) &&
  value.missingPageCount >= 0

export const isValidBlockPageCount = (pageCount: number) =>
  Number.isSafeInteger(pageCount) &&
  pageCount >= 1 &&
  pageCount <= MAX_BLOCK_PAGE_COUNT

export const getRadioScriptTemplateError = ({
  blocks,
  splitEvenly
}: Pick<RadioScriptTemplate, 'blocks' | 'splitEvenly'>):
  RadioScriptTemplateError | undefined => {
  // Split evenly, the page count field is hidden and ignored
  const index = splitEvenly
    ? -1
    : blocks.findIndex(
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

export const getNextTextBlockId = (blocks: RadioScriptBlock[]) =>
  Math.max(
    0,
    ...blocks.map((block) => (block.type === 'text' ? (block.id ?? 0) : 0))
  ) + 1

export const getNextProductsBlockId = (blocks: RadioScriptBlock[]) =>
  Math.max(
    0,
    ...blocks.map((block) => (block.type === 'products' ? (block.id ?? 0) : 0))
  ) + 1

// Never numbers a block again, since a moved product points to it; a block with no id yet (saved
// before #111) takes the next one, in order, so every read of the same JSON gives the same ids
export const withProductsBlockIds = (
  blocks: RadioScriptBlock[]
): RadioScriptBlock[] => {
  let nextId = getNextProductsBlockId(blocks)
  return blocks.map((block) => {
    if (block.type !== 'products' || block.id !== undefined) return block
    const id = nextId
    nextId += 1
    return { ...block, id }
  })
}

// The other places of the same text block, so each one can name them
export const getLinkedBlockIndexes = (
  blocks: RadioScriptBlock[],
  index: number
) => {
  const block = blocks[index]
  if (block.type !== 'text' || block.id === undefined) return []
  return blocks.flatMap((other, otherIndex) =>
    otherIndex !== index && other.type === 'text' && other.id === block.id
      ? [otherIndex]
      : []
  )
}

export const setTextBlockText = (
  blocks: RadioScriptBlock[],
  index: number,
  text: string
): RadioScriptBlock[] => {
  const block = blocks[index]
  if (block.type !== 'text') return blocks
  return blocks.map((other, otherIndex) =>
    otherIndex === index ||
    (block.id !== undefined && other.type === 'text' && other.id === block.id)
      ? { ...other, text }
      : other
  )
}

// A text block's copy is the same block; a products block's copy takes pages of its own, and never
// the products moved to the original
export const duplicateBlock = (
  blocks: RadioScriptBlock[],
  index: number
): RadioScriptBlock[] => {
  const block = blocks[index]
  if (block.type === 'products') {
    return blocks.toSpliced(index + 1, 0, {
      ...block,
      id: getNextProductsBlockId(blocks)
    })
  }
  const linked = { ...block, id: block.id ?? getNextTextBlockId(blocks) }
  return blocks.with(index, linked).toSpliced(index + 1, 0, linked)
}

export const separateBlock = (
  blocks: RadioScriptBlock[],
  index: number
): RadioScriptBlock[] => {
  const block = blocks[index]
  if (block.type !== 'text') return blocks
  return blocks.with(index, { type: 'text', text: block.text })
}

// Ids are numbered again in order, and dropped from a block left alone, so the saved JSON only
// holds the links that still exist. Every place takes the first one's text, so a JSON written by
// hand never makes one block say two things
const normalizeTextBlockIds = (blocks: RadioScriptBlock[]) => {
  const counts = new Map<number, number>()
  for (const block of blocks) {
    if (block.type === 'text' && block.id !== undefined) {
      counts.set(block.id, (counts.get(block.id) ?? 0) + 1)
    }
  }
  const linked = new Map<number, { id: number; text: string }>()
  return blocks.map((block): RadioScriptBlock => {
    if (block.type !== 'text') return block
    if (block.id === undefined || counts.get(block.id) === 1) {
      return { type: 'text', text: block.text }
    }
    const current = linked.get(block.id) ?? {
      id: linked.size + 1,
      text: block.text
    }
    linked.set(block.id, current)
    return { type: 'text', text: current.text, id: current.id }
  })
}

// A move to a block that is gone is dropped, and a product keeps a single block
const normalizeProductBlocks = (
  blocks: RadioScriptBlock[],
  productBlocks: RadioScriptProductBlock[]
) => {
  const ids = new Set(
    blocks.flatMap((block) => (block.type === 'products' ? [block.id] : []))
  )
  const byProduct = new Map(
    productBlocks
      .filter(({ blockId }) => ids.has(blockId))
      .map(({ productId, blockId }) => [productId, blockId])
  )
  return [...byProduct].map(([productId, blockId]) => ({ productId, blockId }))
}

export const normalizeRadioScriptTemplate = ({
  blocks,
  priceMarkers,
  speakRepeatedOnce,
  splitEvenly,
  productBlocks
}: RadioScriptTemplate): RadioScriptTemplate => {
  const normalizedBlocks = withProductsBlockIds(
    normalizeTextBlockIds(
      blocks
        .map((block): RadioScriptBlock => {
          if (block.type === 'text')
            return { ...block, text: block.text.trim() }
          // A count left invalid while split evenly would not survive the JSON (NaN)
          const pageCount =
            splitEvenly && !isValidBlockPageCount(block.pageCount)
              ? 1
              : block.pageCount
          return block.id === undefined
            ? { type: 'products', pageCount }
            : { type: 'products', pageCount, id: block.id }
        })
        .filter((block) => block.type === 'products' || block.text !== '')
    )
  )
  return {
    blocks: normalizedBlocks,
    priceMarkers: priceMarkers
      .map((marker) => marker.trim().replaceAll(/\s+/g, ' '))
      .filter((marker) => marker !== ''),
    speakRepeatedOnce,
    splitEvenly,
    productBlocks: normalizeProductBlocks(normalizedBlocks, productBlocks)
  }
}

// An item as the script takes it, with the page it came from and whether the store moved its
// product to the block that took it
export type RadioScriptItem = OfferItem & { pageNumber: number; moved: boolean }

export type RadioScriptBlockItems = {
  // Pages this block took, only when the blocks take pages
  pageNumbers: number[]
  items: RadioScriptItem[]
  // Pages this block asked for beyond the ones the offer has left
  missingPageCount: number
}

export type RadioScriptAssignment = {
  // One entry per block, in the same order, `undefined` for a text block
  blocks: (RadioScriptBlockItems | undefined)[]
  unusedPages: number[]
  missingPageCount: number
}

// Pages without products take no block, and a product already spoken on an earlier page is left
// out when the store asks for it (#111)
const getOfferItems = (
  content: OfferContent,
  speakRepeatedOnce: boolean
): RadioScriptItem[] => {
  const seen = new Set<string>()
  return content.pages.flatMap((page, index) =>
    page.slots
      .slice(0, page.layout)
      .filter((slot) => slot !== null)
      .filter(({ product }) => {
        if (!speakRepeatedOnce) return true
        if (seen.has(product.id)) return false
        seen.add(product.id)
        return true
      })
      .map((item) => ({ ...item, pageNumber: index + 1, moved: false }))
  )
}

const groupByPage = (items: RadioScriptItem[]) => {
  const pages: { number: number; items: RadioScriptItem[] }[] = []
  for (const item of items) {
    const last = pages.at(-1)
    if (last?.number === item.pageNumber) last.items.push(item)
    else pages.push({ number: item.pageNumber, items: [item] })
  }
  return pages
}

// How many of the remaining products each block takes so the blocks end up as even as possible,
// counting the products moved to each one; the earlier block takes the extra one
const getEvenCounts = (fixed: number[], remaining: number) => {
  const counts = fixed.map(() => 0)
  for (let unit = 0; unit < remaining; unit += 1) {
    let smallest = 0
    for (const index of counts.keys()) {
      if (fixed[index] + counts[index] < fixed[smallest] + counts[smallest]) {
        smallest = index
      }
    }
    counts[smallest] += 1
  }
  return counts
}

// By pages, each products block takes the next pages in order, so reordering the offer pages never
// needs the sequence to change; a count still being typed takes no page, so the blocks after it
// show what they would take once it is fixed. Split evenly, the blocks share the products in
// order. Either way a moved product goes to its block, in the offer's order
export const assignBlockItems = (
  content: OfferContent,
  {
    blocks: rawBlocks,
    speakRepeatedOnce,
    splitEvenly,
    productBlocks
  }: Omit<RadioScriptTemplate, 'priceMarkers'>
): RadioScriptAssignment => {
  const blocks = withProductsBlockIds(rawBlocks)
  const items = getOfferItems(content, speakRepeatedOnce)
  const blockIds = new Set(
    blocks.flatMap((block) => (block.type === 'products' ? [block.id] : []))
  )
  const targets = new Map(
    productBlocks
      .filter(({ blockId }) => blockIds.has(blockId))
      .map(({ productId, blockId }) => [productId, blockId])
  )
  const isMoved = (item: RadioScriptItem) => targets.has(item.product.id)
  const countMovedTo = (id: number | undefined) =>
    items.filter((item) => targets.get(item.product.id) === id).length

  const productsIndexes = blocks.flatMap((block, index) =>
    block.type === 'products' ? [index] : []
  )
  const base = new Map<number, RadioScriptBlockItems>()
  let unusedPages: number[] = []
  let missingPageCount = 0

  if (splitEvenly) {
    const remaining = items.filter((item) => !isMoved(item))
    const counts = getEvenCounts(
      productsIndexes.map((index) => countMovedTo(blocks[index].id)),
      remaining.length
    )
    let next = 0
    for (const [position, index] of productsIndexes.entries()) {
      base.set(index, {
        pageNumbers: [],
        items: remaining.slice(next, next + counts[position]),
        missingPageCount: 0
      })
      next += counts[position]
    }
  } else {
    const pages = groupByPage(items)
    let nextPage = 0
    for (const index of productsIndexes) {
      const block = blocks[index]
      const pageCount =
        block.type === 'products' && isValidBlockPageCount(block.pageCount)
          ? block.pageCount
          : 0
      const taken = pages.slice(nextPage, nextPage + pageCount)
      nextPage += taken.length
      const missing = pageCount - taken.length
      missingPageCount += missing
      base.set(index, {
        pageNumbers: taken.map(({ number }) => number),
        items: taken
          .flatMap((page) => page.items)
          .filter((item) => !isMoved(item)),
        missingPageCount: missing
      })
    }
    // A page whose every product was moved is spoken anyway, so it is never reported unused
    unusedPages = pages
      .slice(nextPage)
      .filter((page) => page.items.some((item) => !isMoved(item)))
      .map(({ number }) => number)
  }

  return {
    blocks: blocks.map((block, index) => {
      const assigned = base.get(index)
      if (!assigned) return
      const taken = new Set(assigned.items)
      // Filtering the offer's items keeps the offer's order for the moved ones too
      const blockItems = items.flatMap((item) => {
        if (taken.has(item)) return [item]
        if (targets.get(item.product.id) === block.id) {
          return [{ ...item, moved: true }]
        }
        return []
      })
      return { ...assigned, items: blockItems }
    }),
    unusedPages,
    missingPageCount
  }
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
  | { type: 'products'; blockId: number; lines: RadioScriptLine[] }

export type RadioScriptParts = Pick<
  RadioScript,
  'unusedPages' | 'missingPageCount'
> & { parts: RadioScriptPart[] }

export const getProductVoiceText = (
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

// The script in parts, so the Comercial tab can show each product's line next to a way of changing
// what it speaks (#111). The marker cycle restarts in each products block. A products block that
// takes no page is left out
export const getRadioScriptParts = (
  content: OfferContent,
  template: RadioScriptTemplate,
  pronunciations: Pronunciation[]
): RadioScriptParts => {
  const normalized = normalizeRadioScriptTemplate(template)
  const assignment = assignBlockItems(content, normalized)
  const parts = normalized.blocks.flatMap(
    (block, blockIndex): RadioScriptPart[] => {
      if (block.type === 'text') return [{ type: 'text', text: block.text }]
      const lines = (assignment.blocks[blockIndex]?.items ?? []).map(
        (item, index) => {
          const voiceText = getProductVoiceText(item.product, pronunciations)
          const { priceMarkers } = normalized
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
        }
      )
      return lines.length > 0 && block.id !== undefined
        ? [{ type: 'products', blockId: block.id, lines }]
        : []
    }
  )
  return {
    parts,
    unusedPages: assignment.unusedPages,
    missingPageCount: assignment.missingPageCount
  }
}

// The list numbers the products across the whole offer
export const getRadioScript = (
  content: OfferContent,
  template: RadioScriptTemplate,
  pronunciations: Pronunciation[]
): RadioScript => {
  const { parts, unusedPages, missingPageCount } = getRadioScriptParts(
    content,
    template,
    pronunciations
  )
  const lines = parts.flatMap((part) =>
    part.type === 'products' ? part.lines : []
  )
  return {
    version: 2,
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
    })),
    unusedPages,
    missingPageCount
  }
}

export const joinNumbers = (numbers: number[]) =>
  numbers.length === 1
    ? String(numbers[0])
    : `${numbers.slice(0, -1).join(', ')} e ${numbers.at(-1)}`

export const getRadioScriptWarning = ({
  unusedPages,
  missingPageCount
}: Pick<RadioScript, 'unusedPages' | 'missingPageCount'>) => {
  const problems = []
  if (unusedPages.length === 1) {
    problems.push(
      `o roteiro e a lista de produtos ficaram sem a página ${unusedPages[0]}`
    )
  } else if (unusedPages.length > 1) {
    problems.push(
      `o roteiro e a lista de produtos ficaram sem as páginas ${joinNumbers(unusedPages)}`
    )
  }
  if (missingPageCount === 1) {
    problems.push('faltou 1 página para os blocos de produtos do comercial')
  } else if (missingPageCount > 1) {
    problems.push(
      `faltaram ${missingPageCount} páginas para os blocos de produtos do comercial`
    )
  }
  if (problems.length === 0) return
  // A store read the old warning as if the page itself hadn't been generated (#94)
  return `As imagens e o PDF estão completos, mas ${problems.join(' e ')}. Ajuste os blocos de produtos na aba Comercial e gere de novo.`
}

// Plain text with no headings, so it is pasted as it is into the voice service or sent to whoever
// records the ad
export const getRadioScriptMarkdown = ({ script }: RadioScript) => `${script}\n`

export const getRadioListMarkdown = ({ list }: RadioScript) =>
  `${list.map(({ number, text, price }) => `${number}. ${text}: R$ ${price}`).join('\n')}\n`
