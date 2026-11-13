import { catalogModel } from '@/models/catalog/model'

const errors = await catalogModel.check()

if (errors.length === 0) {
  console.log('Catálogo válido')
} else {
  for (const { file, message } of errors) {
    console.error(`${file}: ${message}`)
  }
  console.error(`\n${errors.length} erro(s) no catálogo`)
  process.exitCode = 1
}
