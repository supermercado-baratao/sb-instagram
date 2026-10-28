const listFormat = new Intl.ListFormat('pt-BR', {
  style: 'long',
  type: 'conjunction'
})

export const formatQuotedList = (names: string[]) =>
  listFormat.format(names.map((name) => `“${name}”`))
