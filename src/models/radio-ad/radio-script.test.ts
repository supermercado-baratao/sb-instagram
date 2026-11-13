import { describe, expect, test } from 'vitest'

import {
  createOfferContent,
  createOfferPage,
  type OfferItem,
  setSlot
} from '@/models/offer/offer'

import {
  convertLegacyBlocks,
  getClosingSequence,
  getEditedVoiceText,
  getRadioListMarkdown,
  getRadioScript,
  getRadioScriptMarkdown,
  getRadioScriptParts,
  getRadioScriptRounds,
  getRadioScriptTemplateError,
  getRadioScriptWarning,
  type LegacyRadioScriptBlock,
  normalizeRadioScriptTemplate,
  type RadioScriptClosingSequence,
  type RadioScriptTemplate
} from './radio-script'
import { radioScriptSchema, radioScriptTemplateSchema } from './schema'

const item = (
  description: string,
  priceInCents: number,
  voiceText: string | null = description
): OfferItem => ({
  product: {
    // Each description is a product of its own, so the repeated ones are the same product
    id: description,
    codes: ['1234'],
    description,
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

const LONG = 1
const SHORT = 2
const FINAL = 3

const template = (
  overrides: Partial<RadioScriptTemplate> = {}
): RadioScriptTemplate => ({
  opening: '',
  closings: [
    { id: LONG, name: 'Longo', text: 'Até já!' },
    { id: SHORT, name: 'Curto', text: 'Tchau.' },
    { id: FINAL, name: 'Final', text: 'Fim.' }
  ],
  sequence: { start: [], middle: [], end: [] },
  priceMarkers: ['por apenas', 'somente'],
  speakRepeatedOnce: true,
  ...overrides
})

const STORE_SEQUENCE: RadioScriptClosingSequence = {
  start: [LONG],
  middle: [SHORT],
  end: [LONG, FINAL]
}

describe('getClosingSequence', () => {
  test('keeps the start and the end fixed and repeats the middle', () => {
    const counts = [1, 2, 3, 4, 5, 8]
    expect(
      counts.map((count) => getClosingSequence(STORE_SEQUENCE, count))
    ).toEqual([
      [FINAL],
      [LONG, FINAL],
      [LONG, LONG, FINAL],
      [LONG, SHORT, LONG, FINAL],
      [LONG, SHORT, SHORT, LONG, FINAL],
      [LONG, SHORT, SHORT, SHORT, SHORT, SHORT, LONG, FINAL]
    ])
  })

  test('cycles a middle with more than one closing', () => {
    expect(
      getClosingSequence({ start: [], middle: [LONG, SHORT], end: [] }, 5)
    ).toEqual([LONG, SHORT, LONG, SHORT, LONG])
  })

  test('leaves a round with no closing when the middle is empty', () => {
    expect(
      getClosingSequence({ start: [LONG], middle: [], end: [FINAL] }, 4)
    ).toEqual([LONG, undefined, undefined, FINAL])
  })

  test('works with an empty start or end', () => {
    expect(
      getClosingSequence({ start: [], middle: [SHORT], end: [FINAL] }, 3)
    ).toEqual([SHORT, SHORT, FINAL])
    expect(
      getClosingSequence({ start: [LONG], middle: [SHORT], end: [] }, 3)
    ).toEqual([LONG, SHORT, SHORT])
  })

  test('keeps the last closings of an end longer than the offer', () => {
    expect(
      getClosingSequence({ start: [LONG], middle: [], end: [SHORT, FINAL] }, 1)
    ).toEqual([FINAL])
  })

  test('gives nothing to an offer without rounds', () => {
    expect(getClosingSequence(STORE_SEQUENCE, 0)).toEqual([])
  })
})

const roundPages = (rounds: ReturnType<typeof getRadioScriptRounds>) =>
  rounds.map(({ pageNumber, items }) => [
    pageNumber,
    items.map(({ product }) => product.description)
  ])

describe('getRadioScriptRounds', () => {
  test('takes one round per page with products, by its number in the offer', () => {
    const content = offer(
      page(['Arroz', 100]),
      page(),
      page(['Café', 200], ['Açúcar', 300])
    )

    expect(roundPages(getRadioScriptRounds(content, true))).toEqual([
      [1, ['Arroz']],
      [3, ['Café', 'Açúcar']]
    ])
  })

  test('speaks a repeated product only on its first page, unless asked, and skips a page left empty', () => {
    const content = offer(
      page(['Arroz', 100], ['Café', 200]),
      page(['Café', 200]),
      page(['Café', 200], ['Açúcar', 300])
    )

    expect(roundPages(getRadioScriptRounds(content, true))).toEqual([
      [1, ['Arroz', 'Café']],
      [3, ['Açúcar']]
    ])
    expect(roundPages(getRadioScriptRounds(content, false))).toEqual([
      [1, ['Arroz', 'Café']],
      [2, ['Café']],
      [3, ['Café', 'Açúcar']]
    ])
  })

  test('leaves out the slots past the layout', () => {
    const fourProducts = page(['A', 100], ['B', 200], ['C', 300], ['D', 400])
    const content = offer({ ...fourProducts, layout: 3 })

    expect(roundPages(getRadioScriptRounds(content, true))).toEqual([
      [1, ['A', 'B', 'C']]
    ])
  })
})

describe('getRadioScript', () => {
  test('writes each round with the opening, its products and its closing', () => {
    const script = getRadioScript(
      offer(page(['Arroz', 2990]), page(['Café', 1075])),
      template({
        opening: 'Confira:',
        sequence: { start: [], middle: [SHORT], end: [FINAL] }
      }),
      []
    )

    expect(script).toEqual({
      version: 3,
      script: [
        'Confira:',
        '- Arroz, por apenas: vinte e nove e noventa',
        'Tchau.',
        'Confira:',
        '- Café, por apenas: dez e setenta e cinco',
        'Fim.'
      ].join('\n\n'),
      list: [
        { number: 1, text: 'Arroz', price: '29,90' },
        { number: 2, text: 'Café', price: '10,75' }
      ]
    })
  })

  test('fits an offer of one page with the final closing alone', () => {
    const { script } = getRadioScript(
      offer(page(['Arroz', 2990])),
      template({ opening: 'Oi!', sequence: STORE_SEQUENCE }),
      []
    )

    expect(script).toBe(
      'Oi!\n\n- Arroz, por apenas: vinte e nove e noventa\n\nFim.'
    )
  })

  test('leaves out an empty opening and a round with no closing or an empty one', () => {
    const { script } = getRadioScript(
      offer(page(['Arroz', 100]), page(['Café', 200])),
      template({
        closings: [{ id: 1, name: 'Vazio', text: '' }],
        sequence: { start: [], middle: [], end: [1] }
      }),
      []
    )

    expect(script).toBe(
      '- Arroz, por apenas: um real\n\n- Café, por apenas: dois reais'
    )
  })

  test('cycles the price markers and restarts them in each round', () => {
    const { script } = getRadioScript(
      offer(page(['A', 100], ['B', 200], ['C', 300]), page(['D', 400])),
      template(),
      []
    )

    expect(script).toBe(
      '- A, por apenas: um real\n- B, somente: dois reais\n- C, por apenas: três reais\n\n- D, por apenas: quatro reais'
    )
  })

  test('says only the price when there are no markers', () => {
    const { script } = getRadioScript(
      offer(page(['Arroz', 100])),
      template({ priceMarkers: [] }),
      []
    )

    expect(script).toBe('- Arroz: um real')
  })

  test('suggests the voice text of a product without one, with the dictionary', () => {
    const script = getRadioScript(
      offer(page(['Biscoito', 450, null])),
      template(),
      [{ term: 'Biscoito', spoken: 'Biscoitu' }]
    )

    expect(script.list[0].text).toBe('Biscoitu')
  })

  test('writes an empty script for an offer without products', () => {
    const content = offer(page())
    expect(getRadioScript(content, template({ opening: 'Oi' }), [])).toEqual({
      version: 3,
      script: '',
      list: []
    })
  })
})

describe('getRadioScriptParts', () => {
  test('keeps each product line with its item, its page and what it speaks', () => {
    const content = offer(page(['Arroz', 2990], ['Biscoito', 450, null]))
    const parts = getRadioScriptParts(
      content,
      template({
        opening: 'Oi',
        sequence: { start: [], middle: [], end: [FINAL] }
      }),
      [{ term: 'Biscoito', spoken: 'Biscoitu' }]
    )

    expect(parts).toEqual([
      { type: 'text', text: 'Oi' },
      {
        type: 'products',
        pageNumber: 1,
        lines: [
          {
            item: { ...content.pages[0].slots[0], pageNumber: 1 },
            voiceText: 'Arroz',
            line: '- Arroz, por apenas: vinte e nove e noventa'
          },
          {
            item: { ...content.pages[0].slots[1], pageNumber: 1 },
            voiceText: 'Biscoitu',
            line: '- Biscoitu, somente: quatro e cinquenta'
          }
        ]
      },
      { type: 'text', text: 'Fim.' }
    ])
  })
})

describe('getEditedVoiceText', () => {
  test('keeps a product without a voice text following the suggestion when it is unchanged', () => {
    expect(getEditedVoiceText(null, ' Arroz um quilo ', 'Arroz um quilo')).toBe(
      ''
    )
    expect(
      getEditedVoiceText(null, 'Arroz de um quilo', 'Arroz um quilo')
    ).toBe('Arroz de um quilo')
  })

  test('keeps a voice text of its own even when it matches the suggestion', () => {
    expect(
      getEditedVoiceText('Arroz um quilo', 'Arroz um quilo', 'Arroz um quilo')
    ).toBe('Arroz um quilo')
  })
})

describe('getRadioScriptWarning', () => {
  test('says nothing for a script that took every page', () => {
    expect(
      getRadioScriptWarning({ unusedPages: [], missingPageCount: 0 })
    ).toBeUndefined()
    expect(getRadioScriptWarning({})).toBeUndefined()
  })

  test('names the pages a version 2 script left out and the pages it lacked', () => {
    expect(
      getRadioScriptWarning({ unusedPages: [4, 5, 6], missingPageCount: 0 })
    ).toBe(
      'As artes e o PDF estão completos, mas o roteiro e a lista de produtos ficaram sem as artes 4, 5 e 6. Gere a oferta de novo para refazer o comercial.'
    )
    expect(
      getRadioScriptWarning({ unusedPages: [2], missingPageCount: 2 })
    ).toBe(
      'As artes e o PDF estão completos, mas o roteiro e a lista de produtos ficaram sem a arte 2 e faltaram 2 artes para os blocos de produtos do comercial. Gere a oferta de novo para refazer o comercial.'
    )
  })
})

const isRadioScript = (value: unknown) =>
  radioScriptSchema.safeParse(value).success

const isRadioScriptTemplate = (value: unknown) =>
  radioScriptTemplateSchema.safeParse(value).success

describe('radioScriptSchema', () => {
  test('reads the scripts of both versions', () => {
    const list = [{ number: 1, text: 'Arroz', price: '1,00' }]
    expect(isRadioScript({ version: 3, script: 'x', list })).toBe(true)
    expect(
      isRadioScript({
        version: 2,
        script: 'x',
        list,
        unusedPages: [2],
        missingPageCount: 0
      })
    ).toBe(true)
    expect(isRadioScript({ version: 2, script: 'x', list })).toBe(false)
    expect(isRadioScript({ version: 4, script: 'x', list })).toBe(false)
  })
})

describe('getRadioScriptTemplateError', () => {
  test('asks for a name for each closing', () => {
    expect(
      getRadioScriptTemplateError({
        closings: [
          { id: 1, name: 'Longo', text: 'a' },
          { id: 2, name: ' ', text: 'b' }
        ]
      })
    ).toEqual({ message: 'Dê um nome ao fechamento.', index: 1, field: 'name' })
  })

  test('refuses a repeated name, ignoring case and accents in case', () => {
    expect(
      getRadioScriptTemplateError({
        closings: [
          { id: 1, name: 'Último', text: 'a' },
          { id: 2, name: 'ÚLTIMO ', text: 'b' }
        ]
      })
    ).toEqual({
      message: 'Já existe um fechamento com este nome.',
      index: 1,
      field: 'name'
    })
  })

  test('accepts a closing with an empty text and no closings at all', () => {
    expect(
      getRadioScriptTemplateError({
        closings: [{ id: 1, name: 'Nada', text: '' }]
      })
    ).toBeUndefined()
    expect(getRadioScriptTemplateError({ closings: [] })).toBeUndefined()
  })
})

describe('normalizeRadioScriptTemplate', () => {
  test('trims the texts, drops blank markers and the closings no longer saved', () => {
    expect(
      normalizeRadioScriptTemplate({
        opening: ' Oi \n',
        closings: [{ id: 2, name: ' Curto ', text: ' Tchau. ' }],
        sequence: { start: [1], middle: [2, 1], end: [2] },
        priceMarkers: [' por  apenas ', ' '],
        speakRepeatedOnce: false
      })
    ).toEqual({
      opening: 'Oi',
      closings: [{ id: 2, name: 'Curto', text: 'Tchau.' }],
      sequence: { start: [], middle: [2], end: [2] },
      priceMarkers: ['por apenas'],
      speakRepeatedOnce: false
    })
  })

  test('is checked by radioScriptTemplateSchema', () => {
    expect(isRadioScriptTemplate(template())).toBe(true)
    expect(
      isRadioScriptTemplate({
        ...template(),
        sequence: { start: [0], middle: [], end: [] }
      })
    ).toBe(false)
  })
})

const products = (): LegacyRadioScriptBlock => ({
  type: 'products',
  pageCount: 1
})

describe('convertLegacyBlocks', () => {
  const OPENING = '[tom animado] Supermercado. O nome já diz tudo!'
  const LONG_TEXT = '[entusiasmado] Promoção!'
  const SHORT_TEXT = '[carinhoso] Meu cantinho.'
  const FINAL_TEXT = '[calmo] Cartões. Meu cantinho.'
  const between = (closing: string) => `${closing}\n\n[pausa]\n\n${OPENING}`

  test('converts the fixed blocks of four pages into a template that gives the same script', () => {
    const blocks: LegacyRadioScriptBlock[] = [
      { type: 'text', text: OPENING },
      products(),
      { type: 'text', text: between(LONG_TEXT) },
      products(),
      { type: 'text', text: between(SHORT_TEXT), id: 1 },
      products(),
      { type: 'text', text: between(SHORT_TEXT), id: 1 },
      products(),
      { type: 'text', text: FINAL_TEXT }
    ]
    const converted = convertLegacyBlocks(blocks)

    expect(converted).toEqual({
      opening: OPENING,
      closings: [
        { id: 1, name: 'Fechamento 1', text: `${LONG_TEXT}\n\n[pausa]` },
        { id: 2, name: 'Fechamento 2', text: `${SHORT_TEXT}\n\n[pausa]` },
        { id: 3, name: 'Fechamento 3', text: FINAL_TEXT }
      ],
      sequence: { start: [1], middle: [2], end: [2, 3] }
    })

    const content = offer(
      page(['A', 100]),
      page(['B', 200]),
      page(['C', 300]),
      page(['D', 400])
    )
    const { script } = getRadioScript(
      content,
      { ...converted, priceMarkers: [], speakRepeatedOnce: true },
      []
    )
    expect(script).toBe(
      [
        OPENING,
        '- A: um real',
        between(LONG_TEXT),
        '- B: dois reais',
        between(SHORT_TEXT),
        '- C: três reais',
        between(SHORT_TEXT),
        '- D: quatro reais',
        FINAL_TEXT
      ].join('\n\n')
    )
  })

  test('joins text blocks next to each other and keeps a closing that does not end with the opening', () => {
    expect(
      convertLegacyBlocks([
        { type: 'text', text: 'Oi' },
        products(),
        { type: 'text', text: 'Mais' },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'Fim' }
      ])
    ).toEqual({
      opening: 'Oi',
      closings: [{ id: 1, name: 'Fechamento 1', text: 'Mais\n\nFim' }],
      sequence: { start: [], middle: [], end: [1] }
    })
  })

  test('keeps the place of an empty closing when another has text', () => {
    expect(
      convertLegacyBlocks([
        products(),
        products(),
        { type: 'text', text: 'Fim' }
      ])
    ).toEqual({
      opening: '',
      closings: [
        { id: 1, name: 'Fechamento 1', text: '' },
        { id: 2, name: 'Fechamento 2', text: 'Fim' }
      ],
      sequence: { start: [], middle: [], end: [1, 2] }
    })
  })

  test('gives a template with no closings to blocks without texts', () => {
    expect(convertLegacyBlocks([products()])).toEqual({
      opening: '',
      closings: [],
      sequence: { start: [], middle: [], end: [] }
    })
  })
})

describe('markdown', () => {
  const script = getRadioScript(
    offer(page(['Arroz', 2990]), page(['Café', 1075])),
    template({ opening: 'Confira:' }),
    []
  )

  test('writes the script with no headings', () => {
    expect(getRadioScriptMarkdown(script)).toBe(
      'Confira:\n\n- Arroz, por apenas: vinte e nove e noventa\n\nConfira:\n\n- Café, por apenas: dez e setenta e cinco\n'
    )
  })

  test('numbers the list across rounds, with the price in digits', () => {
    expect(getRadioListMarkdown(script)).toBe(
      '1. Arroz: R$ 29,90\n2. Café: R$ 10,75\n'
    )
  })
})
