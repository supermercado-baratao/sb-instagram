import path from 'node:path'

const catalogDirectory = path.resolve('catalog')
export const eanDirectory = path.join(catalogDirectory, 'ean')
export const noEanDirectory = path.join(catalogDirectory, 'no-ean')
