import { describe, expect, test } from 'vitest'

import {
  createOfferContent,
  createOfferPage,
  type OfferItem,
  setSlot
} from '@/domain/offer'
import {
  assignBlockItems,
  duplicateBlock,
  getEditedVoiceText,
  getLinkedBlockIndexes,
  getRadioListMarkdown,
  getRadioScript,
  getRadioScriptMarkdown,
  getRadioScriptParts,
  getRadioScriptTemplateError,
  getRadioScriptWarning,
  isRadioScriptTemplate,
  normalizeRadioScriptTemplate,
  type RadioScriptBlock,
  type RadioScriptProductBlock,
  type RadioScriptTemplate,
  separateBlock,
  setTextBlockText
} from '@/domain/radio-script'

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

const text = (value: string, id?: number): RadioScriptBlock =>
  id === undefined
    ? { type: 'text', text: value }
    : { type: 'text', text: value, id }

const products = (pageCount = 1, id?: number): RadioScriptBlock =>
  id === undefined
    ? { type: 'products', pageCount }
    : { type: 'products', pageCount, id }

const OPTIONS = {
  speakRepeatedOnce: true,
  splitEvenly: false,
  productBlocks: [] as RadioScriptProductBlock[]
}

const sequence = (...blocks: RadioScriptBlock[]): RadioScriptTemplate => ({
  blocks,
  priceMarkers: ['por apenas', 'somente'],
  ...OPTIONS
})

const assign = (
  content: ReturnType<typeof offer>,
  blocks: RadioScriptBlock[],
  options: Partial<typeof OPTIONS> = {}
) => assignBlockItems(content, { blocks, ...OPTIONS, ...options })

const descriptions = (assignment: ReturnType<typeof assignBlockItems>) =>
  assignment.blocks.map((block) =>
    block?.items.map(({ product }) => product.description)
  )

const pageNumbers = (assignment: ReturnType<typeof assignBlockItems>) =>
  assignment.blocks.map((block) => block?.pageNumbers)

describe('assignBlockItems', () => {
  test('gives each products block the next pages, by their number in the offer', () => {
    const assignment = assign(
      offer(page(['A', 100]), page(), page(['B', 200]), page(['C', 300])),
      [text('Oi'), products(2), text('Pausa'), products()]
    )

    expect(pageNumbers(assignment)).toEqual([undefined, [1, 3], undefined, [4]])
    expect(descriptions(assignment)).toEqual([
      undefined,
      ['A', 'B'],
      undefined,
      ['C']
    ])
    expect(assignment.unusedPages).toEqual([])
    expect(assignment.missingPageCount).toBe(0)
  })

  test('keeps the products of each page the layout shows', () => {
    const fourProducts = page(['A', 100], ['B', 200], ['C', 300], ['D', 400])
    const assignment = assign(offer({ ...fourProducts, layout: 3 }), [
      products()
    ])

    expect(descriptions(assignment)).toEqual([['A', 'B', 'C']])
  })

  test('counts the pages a block lacks and the pages no block took', () => {
    const missing = assign(offer(page(['A', 100])), [products(2), products()])

    expect(missing.blocks.map((block) => block?.missingPageCount)).toEqual([
      1, 1
    ])
    expect(missing.missingPageCount).toBe(2)

    const unused = assign(
      offer(page(['A', 100]), page(['B', 200]), page(['C', 300])),
      [products()]
    )

    expect(unused.unusedPages).toEqual([2, 3])
  })

  test('gives no page to a count still being typed', () => {
    const assignment = assign(offer(page(['A', 100]), page(['B', 200])), [
      products(NaN),
      products()
    ])

    expect(pageNumbers(assignment)).toEqual([[], [1]])
    expect(assignment.blocks[0]?.missingPageCount).toBe(0)
    expect(assignment.unusedPages).toEqual([2])
  })

  test('gives no page to a block of an offer without products', () => {
    const assignment = assign(offer(page()), [products()])

    expect(pageNumbers(assignment)).toEqual([[]])
    expect(assignment.missingPageCount).toBe(1)
    expect(assignment.unusedPages).toEqual([])
  })

  test('speaks a product shown on more than one page only on the first, unless asked', () => {
    const content = offer(
      page(['A', 100], ['B', 200]),
      page(['B', 200], ['C', 300]),
      page(['A', 100])
    )

    const once = assign(content, [products(), products(2)])
    expect(descriptions(once)).toEqual([['A', 'B'], ['C']])
    // A page left with repeated products only takes no block, like an empty one
    expect(pageNumbers(once)).toEqual([[1], [2]])
    expect(once.missingPageCount).toBe(1)

    const every = assign(content, [products(), products(2)], {
      speakRepeatedOnce: false
    })
    expect(descriptions(every)).toEqual([
      ['A', 'B'],
      ['B', 'C', 'A']
    ])
  })

  test('splits the products evenly, in order, the earlier block taking the extra one', () => {
    const assignment = assign(
      offer(
        page(['A', 100], ['B', 200], ['C', 300]),
        page(['D', 400], ['E', 500])
      ),
      [products(1, 1), text('Pausa'), products(1, 2)],
      { splitEvenly: true }
    )

    expect(descriptions(assignment)).toEqual([
      ['A', 'B', 'C'],
      undefined,
      ['D', 'E']
    ])
    expect(pageNumbers(assignment)).toEqual([[], undefined, []])
    expect(assignment.unusedPages).toEqual([])
    expect(assignment.missingPageCount).toBe(0)
  })

  test('moves a product to its block in the offer order, counting it when split evenly', () => {
    const content = offer(
      page(['A', 100], ['B', 200], ['C', 300]),
      page(['D', 400], ['E', 500], ['F', 600])
    )
    const productBlocks = [
      { productId: 'F', blockId: 1 },
      { productId: 'B', blockId: 2 }
    ]

    const byPages = assign(content, [products(1, 1), products(1, 2)], {
      productBlocks
    })
    expect(descriptions(byPages)).toEqual([
      ['A', 'C', 'F'],
      ['B', 'D', 'E']
    ])
    expect(byPages.blocks[0]?.items.map(({ moved }) => moved)).toEqual([
      false,
      false,
      true
    ])

    const evenly = assign(
      content,
      [products(1, 1), products(1, 2), products(1, 3)],
      {
        splitEvenly: true,
        productBlocks: [
          { productId: 'F', blockId: 3 },
          { productId: 'E', blockId: 3 }
        ]
      }
    )
    expect(descriptions(evenly)).toEqual([
      ['A', 'B'],
      ['C', 'D'],
      ['E', 'F']
    ])
  })

  test('ignores a move to a block that is gone and never reports a page whose products all moved', () => {
    const assignment = assign(
      offer(page(['A', 100]), page(['B', 200])),
      [products(1, 1)],
      {
        productBlocks: [
          { productId: 'B', blockId: 1 },
          { productId: 'A', blockId: 9 }
        ]
      }
    )

    expect(descriptions(assignment)).toEqual([['A', 'B']])
    expect(assignment.unusedPages).toEqual([])
  })
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
      { blocks: [products()], priceMarkers: [' '], ...OPTIONS },
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

describe('getRadioScriptParts', () => {
  test('keeps each product line with its item and what it speaks', () => {
    const content = offer(page(['Arroz', 2990], ['Biscoito', 450, null]))
    const { parts } = getRadioScriptParts(
      content,
      sequence(text('Oi'), products(), products()),
      [{ term: 'Biscoito', spoken: 'Biscoitu' }]
    )

    expect(parts).toEqual([
      { type: 'text', text: 'Oi' },
      {
        type: 'products',
        blockId: 1,
        lines: [
          {
            item: { ...content.pages[0].slots[0], pageNumber: 1, moved: false },
            voiceText: 'Arroz',
            line: '- Arroz, por apenas: vinte e nove e noventa'
          },
          {
            item: { ...content.pages[0].slots[1], pageNumber: 1, moved: false },
            voiceText: 'Biscoitu',
            line: '- Biscoitu, somente: quatro e cinquenta'
          }
        ]
      }
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
  test('says nothing when every page has a block', () => {
    expect(
      getRadioScriptWarning({ unusedPages: [], missingPageCount: 0 })
    ).toBeUndefined()
  })

  test('names the pages left out of the script and the list', () => {
    expect(
      getRadioScriptWarning({ unusedPages: [2], missingPageCount: 0 })
    ).toBe(
      'As artes e o PDF estão completos, mas o roteiro e a lista de produtos ficaram sem a arte 2. Ajuste os blocos de produtos em Comercial e gere de novo.'
    )
    expect(
      getRadioScriptWarning({ unusedPages: [4, 5, 6], missingPageCount: 0 })
    ).toBe(
      'As artes e o PDF estão completos, mas o roteiro e a lista de produtos ficaram sem as artes 4, 5 e 6. Ajuste os blocos de produtos em Comercial e gere de novo.'
    )
  })

  test('counts the pages the blocks lacked without calling them left out', () => {
    expect(
      getRadioScriptWarning({ unusedPages: [], missingPageCount: 1 })
    ).toBe(
      'As artes e o PDF estão completos, mas faltou 1 arte para os blocos de produtos do comercial. Ajuste os blocos de produtos em Comercial e gere de novo.'
    )
    expect(
      getRadioScriptWarning({ unusedPages: [], missingPageCount: 2 })
    ).toBe(
      'As artes e o PDF estão completos, mas faltaram 2 artes para os blocos de produtos do comercial. Ajuste os blocos de produtos em Comercial e gere de novo.'
    )
  })
})

describe('getRadioScriptTemplateError', () => {
  test('points to a products block with an invalid page count', () => {
    const zeroPages = sequence(text('Oi'), products(0))
    const fractionalPages = sequence(products(1.5))

    expect(getRadioScriptTemplateError(zeroPages)).toEqual({
      message: 'Informe de 1 a 20 artes.',
      index: 1
    })
    expect(getRadioScriptTemplateError(fractionalPages)?.index).toBe(0)
  })

  test('ignores the page counts when the products are split evenly', () => {
    const template = { ...sequence(products(0)), splitEvenly: true }

    expect(getRadioScriptTemplateError(template)).toBeUndefined()
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
        priceMarkers: [' por   apenas ', '', 'somente'],
        ...OPTIONS
      })
    ).toEqual({
      blocks: [text('Oi'), products(2, 1), text('Tchau')],
      priceMarkers: ['por apenas', 'somente'],
      ...OPTIONS
    })
  })

  test('numbers only the products blocks without an id and drops moves to blocks that are gone', () => {
    expect(
      normalizeRadioScriptTemplate({
        blocks: [products(1, 4), products(), products(NaN, 2)],
        priceMarkers: [],
        speakRepeatedOnce: false,
        splitEvenly: true,
        productBlocks: [
          { productId: 'A', blockId: 9 },
          { productId: 'B', blockId: 2 },
          { productId: 'B', blockId: 5 },
          { productId: 'C', blockId: 4 }
        ]
      })
    ).toEqual({
      // Split evenly, a count left invalid is kept as 1, since NaN can't be saved as JSON
      blocks: [products(1, 4), products(1, 5), products(1, 2)],
      priceMarkers: [],
      speakRepeatedOnce: false,
      splitEvenly: true,
      productBlocks: [
        { productId: 'B', blockId: 5 },
        { productId: 'C', blockId: 4 }
      ]
    })
  })
  test('numbers the linked blocks again and drops the links left alone', () => {
    const { blocks } = normalizeRadioScriptTemplate({
      blocks: [text('Sozinho', 7), text('Oi', 4), products(), text('Oi', 4)],
      priceMarkers: [],
      ...OPTIONS
    })

    expect(blocks).toEqual([
      text('Sozinho'),
      text('Oi', 1),
      products(1, 1),
      text('Oi', 1)
    ])
  })

  test('gives every place of a linked block the first one’s text', () => {
    const { blocks } = normalizeRadioScriptTemplate({
      blocks: [text('Oi', 2), text('Olá', 2)],
      priceMarkers: [],
      ...OPTIONS
    })

    expect(blocks).toEqual([text('Oi', 1), text('Oi', 1)])
  })
})

describe('linked text blocks', () => {
  test('duplicates a text block as the same block', () => {
    const blocks = duplicateBlock([text('Oi', 1), text('Tchau')], 1)

    expect(blocks).toEqual([text('Oi', 1), text('Tchau', 2), text('Tchau', 2)])
    expect(getLinkedBlockIndexes(blocks, 2)).toEqual([1])
    expect(getLinkedBlockIndexes(blocks, 0)).toEqual([])
  })

  test('duplicates a products block as a block of its own', () => {
    expect(duplicateBlock([products(2, 3), products(1, 1)], 0)).toEqual([
      products(2, 3),
      products(2, 4),
      products(1, 1)
    ])
  })

  test('changes the text in every place of the block', () => {
    const blocks = [text('Oi', 1), text('Tchau'), text('Oi', 1)]

    expect(setTextBlockText(blocks, 2, 'Olá')).toEqual([
      text('Olá', 1),
      text('Tchau'),
      text('Olá', 1)
    ])
    expect(setTextBlockText(blocks, 1, 'Até')).toEqual([
      text('Oi', 1),
      text('Até'),
      text('Oi', 1)
    ])
  })

  test('separates a place into a block of its own with the same text', () => {
    const blocks = separateBlock([text('Oi', 1), text('Oi', 1)], 1)

    expect(blocks).toEqual([text('Oi', 1), text('Oi')])
    expect(setTextBlockText(blocks, 0, 'Olá')).toEqual([
      text('Olá', 1),
      text('Oi')
    ])
  })

  test('reads a template whose text blocks have ids, or none', () => {
    expect(
      isRadioScriptTemplate({
        blocks: [text('Oi', 1), text('Oi'), products(1, 1), products()],
        priceMarkers: [],
        ...OPTIONS
      })
    ).toBe(true)
    expect(
      isRadioScriptTemplate({
        blocks: [{ type: 'text', text: 'Oi', id: 0 }],
        priceMarkers: [],
        ...OPTIONS
      })
    ).toBe(false)
    expect(
      isRadioScriptTemplate({ blocks: [products()], priceMarkers: [] })
    ).toBe(false)
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
