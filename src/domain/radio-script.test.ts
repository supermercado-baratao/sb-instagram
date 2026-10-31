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
  INITIAL_RADIO_SCRIPT_TEMPLATE,
  normalizeRadioScriptTemplate,
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

const template: RadioScriptTemplate = {
  opening: '[animado] Atenção!',
  beforeBlock: 'Confira:',
  afterBlock: 'Aceitamos cartões.',
  closing: 'Até lá!',
  priceMarkers: ['por apenas', 'somente']
}

describe('getRadioScript', () => {
  test('writes one block per page, with the opening first and the closing last', () => {
    const script = getRadioScript(
      offer(page(['Arroz', 2990]), page(['Café', 1075])),
      template,
      []
    )

    expect(script.blocks).toEqual([
      '[animado] Atenção!\n\nConfira:\n\nArroz, por apenas vinte e nove e noventa.\n\nAceitamos cartões.',
      'Confira:\n\nCafé, por apenas dez e setenta e cinco.\n\nAceitamos cartões.\n\nAté lá!'
    ])
  })

  test('cycles the price markers and restarts them in each block', () => {
    const script = getRadioScript(
      offer(page(['A', 100], ['B', 200], ['C', 300]), page(['D', 400])),
      {
        ...template,
        opening: '',
        beforeBlock: '',
        afterBlock: '',
        closing: ''
      },
      []
    )

    expect(script.blocks).toEqual([
      'A, por apenas um real.\nB, somente dois reais.\nC, por apenas três reais.',
      'D, por apenas quatro reais.'
    ])
  })

  test('says only the price when there are no markers', () => {
    const script = getRadioScript(
      offer(page(['Arroz', 2990])),
      { ...INITIAL_RADIO_SCRIPT_TEMPLATE, priceMarkers: [' '] },
      []
    )

    expect(script.blocks).toEqual(['Arroz, vinte e nove e noventa.'])
  })

  test('numbers the list across blocks and skips pages without products', () => {
    const script = getRadioScript(
      offer(
        page(['Arroz', 2990], ['Feijão', 899]),
        page(),
        page(['Café', 1075])
      ),
      template,
      []
    )

    expect(script.list).toEqual([
      [
        { number: 1, text: 'Arroz', price: '29,90' },
        { number: 2, text: 'Feijão', price: '8,99' }
      ],
      [{ number: 3, text: 'Café', price: '10,75' }]
    ])
    expect(script.blocks).toHaveLength(2)
  })

  test('leaves out the slots past the layout', () => {
    const fourProducts = page(['A', 100], ['B', 200], ['C', 300], ['D', 400])
    const content = offer({ ...fourProducts, layout: 3 })
    const [items] = getRadioScript(content, template, []).list

    expect(items.map(({ text }) => text)).toEqual(['A', 'B', 'C'])
  })

  test('suggests the voice text of a product without one, with the dictionary', () => {
    const script = getRadioScript(
      offer(page(['Biscoito', 450, null])),
      template,
      [{ term: 'Biscoito', spoken: 'Biscoitu' }]
    )

    expect(script.list[0][0].text).toBe('Biscoitu')
  })
})

describe('normalizeRadioScriptTemplate', () => {
  test('trims the texts and drops blank markers', () => {
    expect(
      normalizeRadioScriptTemplate({
        opening: ' Oi ',
        beforeBlock: '',
        afterBlock: '\n',
        closing: 'Tchau\n',
        priceMarkers: [' por   apenas ', '', 'somente']
      })
    ).toEqual({
      opening: 'Oi',
      beforeBlock: '',
      afterBlock: '',
      closing: 'Tchau',
      priceMarkers: ['por apenas', 'somente']
    })
  })
})

describe('markdown', () => {
  const script = getRadioScript(
    offer(page(['Arroz', 2990]), page(['Café', 1075])),
    { ...template, opening: '', afterBlock: '', closing: '' },
    []
  )

  test('heads each block of the script', () => {
    expect(getRadioScriptMarkdown({ ...script, offerName: 'Semana' })).toBe(
      '# Roteiro do comercial: Semana\n\n## Bloco 1\n\nConfira:\n\nArroz, por apenas vinte e nove e noventa.\n\n## Bloco 2\n\nConfira:\n\nCafé, por apenas dez e setenta e cinco.\n'
    )
  })

  test('keeps the list numbering across blocks', () => {
    expect(getRadioListMarkdown({ ...script, offerName: 'Semana' })).toBe(
      '# Lista da rádio: Semana\n\n## Bloco 1\n\n1. Arroz: R$ 29,90\n\n## Bloco 2\n\n2. Café: R$ 10,75\n'
    )
  })
})
