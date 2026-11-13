import { z } from 'zod'

import { isValidEan } from '@/models/product/ean'

const getTextError = (field: string) =>
  `O campo ${field} precisa ser um texto não vazio`

const nonEmptyText = (field: string) =>
  z
    .string({ error: getTextError(field) })
    .refine((value) => value.trim() !== '', getTextError(field))

const CODES_ERROR = 'O campo codes precisa ser uma lista não vazia de EANs'

// The file name is the product's EAN, so codes may not repeat it
const getCodesSchema = (ean: string) =>
  z
    .array(z.unknown(), { error: CODES_ERROR })
    .min(1, CODES_ERROR)
    .superRefine((codes, context) => {
      const seen = new Set<string>()
      for (const code of codes) {
        if (typeof code !== 'string' || !isValidEan(code)) {
          context.addIssue(
            `O código ${JSON.stringify(code)} em codes não é um EAN válido`
          )
        } else if (code === ean) {
          context.addIssue(`O EAN ${code} em codes já é o nome do arquivo`)
        } else if (seen.has(code)) {
          context.addIssue(`O EAN ${code} se repete em codes`)
        } else {
          seen.add(code)
        }
      }
    })
    .transform((codes) => codes as string[])

export const getCatalogProductSchema = (ean: string) =>
  z.strictObject(
    {
      // Name and brand as one text, like the store's products (#99)
      description: nonEmptyText('description'),
      unit: nonEmptyText('unit'),
      // The product's other EANs, for a photo that groups variations sold under different codes (#51)
      codes: getCodesSchema(ean).optional()
    },
    { error: 'O JSON precisa ser um objeto com description e unit' }
  )

export type CatalogProduct = z.output<
  ReturnType<typeof getCatalogProductSchema>
>

// One message per problem, so a contributor fixes every one of them at once
export const checkCatalogProduct = (data: unknown, ean: string): string[] => {
  const result = getCatalogProductSchema(ean).safeParse(data)
  return result.success
    ? []
    : result.error.issues.flatMap((issue) =>
        issue.code === 'unrecognized_keys'
          ? issue.keys.map((key) => `O campo ${key} não faz parte do esquema`)
          : [issue.message]
      )
}
