// How the store's ad speaks a term the voice would read wrong, e.g. a brand ("Veludo" → "Velude")
export type Pronunciation = {
  term: string
  spoken: string
}

export type PronunciationError = {
  index: number
  field: keyof Pronunciation
  message: string
}

const getTermKey = (term: string) => term.trim().toLocaleLowerCase('pt-BR')

export const getPronunciationsError = (
  pronunciations: Pronunciation[]
): PronunciationError | undefined => {
  const terms = new Set<string>()
  for (const [index, { term, spoken }] of pronunciations.entries()) {
    if (term.trim() === '') {
      return { index, field: 'term', message: 'Informe o termo.' }
    }
    if (spoken.trim() === '') {
      return {
        index,
        field: 'spoken',
        message: `Informe como falar ${term.trim()}.`
      }
    }
    const key = getTermKey(term)
    if (terms.has(key)) {
      return {
        index,
        field: 'term',
        message: `O termo ${term.trim()} já está no dicionário.`
      }
    }
    terms.add(key)
  }
}

export const normalizePronunciations = (pronunciations: Pronunciation[]) =>
  pronunciations.map(({ term, spoken }) => ({
    term: term.trim().replaceAll(/\s+/g, ' '),
    spoken: spoken.trim()
  }))

export const isPronunciationList = (value: unknown): value is Pronunciation[] =>
  Array.isArray(value) &&
  value.every(
    (item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      'term' in item &&
      'spoken' in item &&
      typeof item.term === 'string' &&
      typeof item.spoken === 'string'
  )

const escapeRegExp = (text: string) =>
  text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`)

// Longer terms first, so "cream cracker" wins over "cream", and whole words only, so "Bom" never
// changes "Bombril"; spaces inside a term match any run of spaces
export const applyPronunciations = (
  text: string,
  pronunciations: Pronunciation[]
) => {
  const spoken = new Map(
    pronunciations.map(({ term, spoken }) => [
      getTermKey(term).replaceAll(/\s+/g, ' '),
      spoken
    ])
  )
  if (spoken.size === 0) return text
  const terms = spoken
    .keys()
    .toArray()
    .toSorted((a, b) => b.length - a.length)
    .map((term) => escapeRegExp(term).replaceAll(' ', String.raw`\s+`))
  const pattern = new RegExp(
    String.raw`(?<![\p{L}\p{N}])(?:${terms.join('|')})(?![\p{L}\p{N}])`,
    'giu'
  )
  return text.replaceAll(
    pattern,
    (match) => spoken.get(getTermKey(match).replaceAll(/\s+/g, ' ')) ?? match
  )
}
