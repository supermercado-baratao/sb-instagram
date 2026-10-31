import { normalizeSearchText, type ProductDetails } from '@/domain/product'
import { applyPronunciations, type Pronunciation } from '@/domain/pronunciation'

const ONES = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove'
]

const TENS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa'
]

const HUNDREDS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos'
]

type Gender = 'masculine' | 'feminine'

const FEMININE_ONES: Record<string, string> = { um: 'uma', dois: 'duas' }

const spellOnes = (number: number, gender: Gender) => {
  const word = ONES[number]
  return gender === 'feminine' ? (FEMININE_ONES[word] ?? word) : word
}

const spellBelowThousand = (number: number, gender: Gender) => {
  if (number === 100) return 'cem'
  const hundreds = Math.trunc(number / 100)
  const rest = number % 100
  const parts: string[] = []
  if (hundreds > 0) {
    const word = HUNDREDS[hundreds]
    parts.push(gender === 'feminine' ? word.replace(/os$/, 'as') : word)
  }
  if (rest >= 20) {
    parts.push(TENS[Math.trunc(rest / 10)])
    if (rest % 10 > 0) parts.push(spellOnes(rest % 10, gender))
  } else if (rest > 0) {
    parts.push(spellOnes(rest, gender))
  }
  return parts.join(' e ')
}

// "mil e quinhentos" but "mil duzentos e trinta": the "e" only joins a round hundred or less
const joinGroups = (head: string, rest: number, gender: Gender) => {
  if (rest === 0) return head
  const separator = rest < 100 || rest % 100 === 0 ? ' e ' : ' '
  return `${head}${separator}${spellBelowThousand(rest, gender)}`
}

const spellBelowMillion = (number: number, gender: Gender) => {
  const thousands = Math.trunc(number / 1000)
  const rest = number % 1000
  if (thousands === 0) return spellBelowThousand(rest, gender)
  const head =
    thousands === 1 ? 'mil' : `${spellBelowThousand(thousands, gender)} mil`
  return joinGroups(head, rest, gender)
}

export const spellNumber = (
  number: number,
  gender: Gender = 'masculine'
): string => {
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new RangeError(`Cannot spell ${number}`)
  }
  if (number === 0) return ONES[0]
  const millions = Math.trunc(number / 1_000_000)
  const rest = number % 1_000_000
  if (millions === 0) return spellBelowMillion(rest, gender)
  // A million is a masculine noun, whatever the gender of what is counted
  const head =
    millions === 1
      ? 'um milhão'
      : `${spellBelowMillion(millions, 'masculine')} milhões`
  if (rest === 0) return head
  const separator = rest < 100 || rest % 100 === 0 ? ' e ' : ' '
  return `${head}${separator}${spellBelowMillion(rest, gender)}`
}

// Radio ads drop "reais" when the price has cents ("dez e setenta e cinco"), which only reads well
// from ten cents up: "dez e cinco" would sound like 10,50
export const spellPrice = (priceInCents: number) => {
  const reais = Math.trunc(priceInCents / 100)
  const cents = priceInCents % 100
  const reaisText = reais === 1 ? 'um real' : `${spellNumber(reais)} reais`
  const centsText =
    cents === 1 ? 'um centavo' : `${spellNumber(cents)} centavos`
  if (cents === 0) return reaisText
  if (reais === 0) return centsText
  if (cents < 10) return `${reaisText} e ${centsText}`
  return `${spellNumber(reais)} e ${spellNumber(cents)}`
}

type SpokenUnit = { singular: string; plural: string; gender: Gender }

const unit = (singular: string, plural: string, gender: Gender = 'masculine') =>
  ({ singular, plural, gender }) satisfies SpokenUnit

const UNITS: Record<string, SpokenUnit> = {
  kg: unit('quilo', 'quilos'),
  g: unit('grama', 'gramas'),
  mg: unit('miligrama', 'miligramas'),
  l: unit('litro', 'litros'),
  lt: unit('litro', 'litros'),
  lts: unit('litro', 'litros'),
  ml: unit('mililitro', 'mililitros'),
  m: unit('metro', 'metros'),
  cm: unit('centímetro', 'centímetros'),
  mm: unit('milímetro', 'milímetros'),
  un: unit('unidade', 'unidades', 'feminine'),
  und: unit('unidade', 'unidades', 'feminine'),
  unid: unit('unidade', 'unidades', 'feminine')
}

type ParsedNumber = { integer: number; fraction: string }

// A comma is always the decimal separator; a dot is one only when it isn't followed by exactly
// three digits, as in "1.000"
const parseNumber = (text: string): ParsedNumber => {
  const [integer, fraction = ''] = text
    .replaceAll(/\.(?=\d{3}(?!\d))/g, '')
    .split(/[.,]/, 2)
  return { integer: Number(integer), fraction: fraction.replace(/0+$/, '') }
}

const spellFraction = (fraction: string) =>
  fraction.startsWith('0')
    ? [...fraction].map((digit) => ONES[Number(digit)]).join(' ')
    : spellNumber(Number(fraction))

const spellParsed = ({ integer, fraction }: ParsedNumber, gender: Gender) =>
  fraction === ''
    ? spellNumber(integer, gender)
    : `${spellNumber(integer, gender)} vírgula ${spellFraction(fraction)}`

const spellMeasure = (number: ParsedNumber, spoken: SpokenUnit) => {
  const { integer, fraction } = number
  if (fraction === '5') {
    if (integer === 0) return `meio ${spoken.singular}`
    const name = integer === 1 ? spoken.singular : spoken.plural
    return `${spellNumber(integer, spoken.gender)} ${name} e meio`
  }
  const name =
    integer === 1 && fraction === '' ? spoken.singular : spoken.plural
  return `${spellParsed(number, spoken.gender)} ${name}`
}

const NUMBER = String.raw`\d+(?:[.,]\d+)*`
const UNIT_NAMES = Object.keys(UNITS)
  .toSorted((a, b) => b.length - a.length)
  .join('|')
const MEASURE_PATTERN = new RegExp(
  String.raw`(${NUMBER})\s*(${UNIT_NAMES})(?![\p{L}\p{N}])`,
  'giu'
)
const NUMBER_PATTERN = new RegExp(NUMBER, 'g')

export const spellNumbers = (text: string) =>
  text
    .replaceAll(MEASURE_PATTERN, (_, number: string, unitName: string) =>
      spellMeasure(parseNumber(number), UNITS[unitName.toLowerCase()])
    )
    .replaceAll(NUMBER_PATTERN, (number) =>
      spellParsed(parseNumber(number), 'masculine')
    )

// A store may fill the name or the brand with a placeholder ("-") when the other one says it all,
// which the voice would read out
const hasSpokenText = (text: string | null): text is string =>
  text !== null && /[\p{L}\p{N}]/u.test(text)

// The brand often repeats inside the name ("Café Pilão"), and saying it twice sounds like a mistake
export const suggestVoiceText = (
  { name, brand, unit }: ProductDetails,
  pronunciations: Pronunciation[]
) => {
  const words = hasSpokenText(name) ? [name] : []
  if (
    hasSpokenText(brand) &&
    !normalizeSearchText(name).includes(normalizeSearchText(brand))
  ) {
    words.push(brand)
  }
  if (unit) words.push(unit)
  // Numbers first, so the dictionary can change how a unit sounds ("mililitros" → "eme éli")
  return applyPronunciations(spellNumbers(words.join(' ')), pronunciations)
    .replaceAll(/\s+/g, ' ')
    .trim()
}
