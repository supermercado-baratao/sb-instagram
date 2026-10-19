import path from 'node:path'

const relativeFiles = (filenames) =>
  filenames.map((file) => path.relative(process.cwd(), file)).join(' ')

const prettier = (filenames) =>
  `pnpm exec prettier --write ${relativeFiles(filenames)}`

const eslint = (filenames) =>
  `pnpm exec eslint --fix ${relativeFiles(filenames)}`

const test = (filenames) =>
  `pnpm exec vitest related --passWithNoTests ${relativeFiles(filenames)}`

const optimizeCatalogImages = (filenames) =>
  `pnpm exec tsx src/infra/catalog/optimize-cli.ts ${relativeFiles(filenames)}`

export default {
  'catalog/**/*.png': [optimizeCatalogImages],
  '*.{js,jsx,ts,tsx,mjs,cjs}': [eslint, prettier, test],
  '*.{json,md}': [eslint, prettier],
  '*.{yml,yaml}': [prettier]
}
