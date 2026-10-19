import { checkCatalog } from '@/infra/catalog/check'

const errors = await checkCatalog()

if (errors.length === 0) {
  console.log('Catálogo válido')
} else {
  for (const { file, message } of errors) {
    console.error(`${file}: ${message}`)
  }
  console.error(`\n${errors.length} erro(s) no catálogo`)
  process.exitCode = 1
}
