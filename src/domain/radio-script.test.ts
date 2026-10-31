import { describe, expect, test } from 'vitest'

import {
  createOfferContent,
  createOfferPage,
  type OfferItem,
  setSlot
} from '@/domain/offer'
import {
  getRadioListMarkdown,
  getRadioScript,
  getRadioScriptMarkdown,
  getRadioScriptTemplateError,
  getRadioScriptWarning,
  normalizeRadioScriptTemplate,
  type RadioScriptBlock,
  type RadioScriptTemplate
} from '@/domain/radio-script'

const item = (
  name: string,
  priceInCents: number,
  voiceText: string | null = name
): OfferItem => ({
  product: {
    id: '0b6f3c1e-5d2a-4f8b-9c1d-2e3f4a5b6c7d',
    codes: ['1234'],
    name,
    brand: null,
    unit: null,
    voiceText,
    photo: null
  },
  priceInCents
})

type Entry = Parameters<typeof item>

const page = (...entries: Entry[]) => {
  let current = createOfferPage('mercado')
  for (const [index, entry] of entries.entries()) {
    current = setSlot(current, index, item(...entry))
  }
  return current
}

const offer = (...pages: ReturnType<typeof page>[]) => ({
  ...createOfferContent('mercado'),
  pages
})

const text = (value: string): RadioScriptBlock => ({
  type: 'text',
  text: value
})

const products = (pageCount = 1): RadioScriptBlock => ({
  type: 'products',
  pageCount
})

const sequence = (...blocks: RadioScriptBlock[]): RadioScriptTemplate => ({
  blocks,
  priceMarkers: ['por apenas', 'somente']
})

describe('getRadioScript', () => {
  test('writes the text blocks as they are, around the products of each page', () => {
    const script = getRadioScript(
      offer(page(['Arroz', 2990]), page(['Café', 1075])),
      sequence(
        text('[animado] Atenção!'),
        products(),
        text('Confira:'),
        products(),
        text('Até lá!')
      ),
      []
    )

    expect(script.script).toBe(
      '[animado] Atenção!\n\n- Arroz, por apenas: vinte e nove e noventa\n\nConfira:\n\n- Café, por apenas: dez e setenta e cinco\n\nAté lá!'
    )
  })

  test('cycles the price markers and restarts them in each products block', () => {
    const script = getRadioScript(
      offer(page(['A', 100], ['B', 200], ['C', 300]), page(['D', 400])),
      sequence(products(), products()),
      []
    )

    expect(script.script).toBe(
      '- A, por apenas: um real\n- B, somente: dois reais\n- C, por apenas: três reais\n\n- D, por apenas: quatro reais'
    )
  })

  test('joins the pages of a block with more than one, keeping the marker cycle', () => {
    const script = getRadioScript(
      offer(page(['A', 100]), page(['B', 200]), page(['C', 300])),
      sequence(products(2), text('Pausa.'), products()),
      []
    )

    expect(script.script).toBe(
      '- A, por apenas: um real\n- B, somente: dois reais\n\nPausa.\n\n- C, por apenas: três reais'
    )
  })

  test('says only the price when there are no markers', () => {
    const script = getRadioScript(
      offer(page(['Arroz', 2990])),
      { blocks: [products()], priceMarkers: [' '] },
      []
    )

    expect(script.script).toBe('- Arroz: vinte e nove e noventa')
  })

  test('numbers the list across blocks and skips pages without products', () => {
    const script = getRadioScript(
      offer(
        page(['Arroz', 2990], ['Feijão', 899]),
        page(),
        page(['Café', 1075])
      ),
      sequence(products(), products()),
      []
    )

    expect(script.list).toEqual([
      { number: 1, text: 'Arroz', price: '29,90' },
      { number: 2, text: 'Feijão', price: '8,99' },
      { number: 3, text: 'Café', price: '10,75' }
    ])
    expect(script.unusedPages).toEqual([])
    expect(script.missingPageCount).toBe(0)
  })

  test('reports the pages no block took, by their number in the offer', () => {
    const script = getRadioScript(
      offer(page(['A', 100]), page(), page(['B', 200]), page(['C', 300])),
      sequence(products()),
      []
    )

    expect(script.unusedPages).toEqual([3, 4])
    expect(script.list.map(({ text }) => text)).toEqual(['A'])
  })

  test('leaves out the products blocks past the last page and counts the missing pages', () => {
    const script = getRadioScript(
      offer(page(['A', 100])),
      sequence(products(2), text('Meio.'), products(), text('Fim.')),
      []
    )

    expect(script.script).toBe('- A, por apenas: um real\n\nMeio.\n\nFim.')
    expect(script.missingPageCount).toBe(2)
  })

  test('leaves out the slots past the layout', () => {
    const fourProducts = page(['A', 100], ['B', 200], ['C', 300], ['D', 400])
    const content = offer({ ...fourProducts, layout: 3 })
    const { list } = getRadioScript(content, sequence(products()), [])

    expect(list.map(({ text }) => text)).toEqual(['A', 'B', 'C'])
  })

  test('suggests the voice text of a product without one, with the dictionary', () => {
    const script = getRadioScript(
      offer(page(['Biscoito', 450, null])),
      sequence(products()),
      [{ term: 'Biscoito', spoken: 'Biscoitu' }]
    )

    expect(script.list[0].text).toBe('Biscoitu')
  })
})

describe('getRadioScriptWarning', () => {
  test('says nothing when every page has a block', () => {
    expect(
      getRadioScriptWarning({ unusedPages: [], missingPageCount: 0 })
    ).toBeUndefined()
  })

  test('names the pages left out and the missing pages', () => {
    expect(
      getRadioScriptWarning({ unusedPages: [4, 5, 6], missingPageCount: 1 })
    ).toBe(
      'As páginas 4, 5 e 6 ficaram fora do comercial. Faltou 1 página para os blocos de produtos do comercial. Ajuste os blocos em Configurações › Comercial.'
    )
    expect(
      getRadioScriptWarning({ unusedPages: [2], missingPageCount: 0 })
    ).toBe(
      'A página 2 ficou fora do comercial. Ajuste os blocos em Configurações › Comercial.'
    )
  })
})

describe('getRadioScriptTemplateError', () => {
  test('points to a products block with an invalid page count', () => {
    const zeroPages = sequence(text('Oi'), products(0))
    const fractionalPages = sequence(products(1.5))

    expect(getRadioScriptTemplateError(zeroPages)).toEqual({
      message: 'Informe de 1 a 20 páginas.',
      index: 1
    })
    expect(getRadioScriptTemplateError(fractionalPages)?.index).toBe(0)
  })

  test('asks for at least one products block', () => {
    const onlyText = sequence(text('Oi'))
    const withProducts = sequence(products())

    expect(getRadioScriptTemplateError(onlyText)).toEqual({
      message: 'Adicione ao menos um bloco de produtos.'
    })
    expect(getRadioScriptTemplateError(withProducts)).toBeUndefined()
  })
})

describe('normalizeRadioScriptTemplate', () => {
  test('trims the texts and drops blank text blocks and markers', () => {
    const blocks = [text(' Oi '), text('\n'), products(2), text('Tchau\n')]

    expect(
      normalizeRadioScriptTemplate({
        blocks,
        priceMarkers: [' por   apenas ', '', 'somente']
      })
    ).toEqual({
      blocks: [text('Oi'), products(2), text('Tchau')],
      priceMarkers: ['por apenas', 'somente']
    })
  })
})

describe('markdown', () => {
  const script = getRadioScript(
    offer(page(['Arroz', 2990]), page(['Café', 1075])),
    sequence(text('Confira:'), products(), products()),
    []
  )

  test('writes the script with no headings', () => {
    expect(getRadioScriptMarkdown(script)).toBe(
      'Confira:\n\n- Arroz, por apenas: vinte e nove e noventa\n\n- Café, por apenas: dez e setenta e cinco\n'
    )
  })

  test('numbers the list across blocks, with the price in digits', () => {
    expect(getRadioListMarkdown(script)).toBe(
      '1. Arroz: R$ 29,90\n2. Café: R$ 10,75\n'
    )
  })
})
