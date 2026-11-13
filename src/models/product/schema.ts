import { z } from 'zod'

import {
  INVALID_CODE_MESSAGE,
  isValidCode,
  normalizeCode,
  normalizeCodes,
  PHOTO_MAX_MEGABYTES
} from './product'

export const MISSING_PRODUCT_MESSAGE = 'Este produto não existe mais.'

export const productIdSchema = z.uuid()

export const isProductId = (value: unknown): value is string =>
  productIdSchema.safeParse(value).success

export const codeSchema = z
  .string()
  .transform((code) => normalizeCode(code))
  .pipe(
    z
      .string()
      .min(1, 'Informe o código.')
      .refine((code) => isValidCode(code), INVALID_CODE_MESSAGE)
  )

// A code read back from stored JSON, never normalized
export const storedCodeSchema = z
  .string()
  .refine((code) => isValidCode(code), INVALID_CODE_MESSAGE)

export const productSchema = z.object({
  id: productIdSchema,
  codes: z.array(storedCodeSchema),
  description: z.string(),
  unit: z.string().nullable(),
  voiceText: z.string().nullable(),
  photo: z.string().nullable()
})

const formText = z
  .unknown()
  .transform((value) => (typeof value === 'string' ? value.trim() : ''))

const formOptionalText = formText.transform((value) => value || null)

const PHOTO_MAX_BYTES = PHOTO_MAX_MEGABYTES * 1024 * 1024

// The keys follow the order the form reports its errors in, since the first issue is shown
export const productFormSchema = z.object({
  codes: z
    .array(z.unknown())
    .transform((values) =>
      normalizeCodes(values.filter((value) => typeof value === 'string'))
    )
    .pipe(z.array(storedCodeSchema).min(1, 'Informe pelo menos um código.')),
  description: formText.pipe(
    z.string().min(1, 'Informe a descrição do produto.')
  ),
  photo: z
    .unknown()
    .transform((value) =>
      value instanceof File && value.size > 0 ? value : undefined
    )
    .refine(
      (file) => file === undefined || file.size <= PHOTO_MAX_BYTES,
      `A foto precisa ter no máximo ${PHOTO_MAX_MEGABYTES} MB.`
    ),
  id: formText.refine(
    (id) => id === '' || isProductId(id),
    MISSING_PRODUCT_MESSAGE
  ),
  unit: formOptionalText,
  voiceText: formOptionalText,
  catalogImage: formText,
  catalogEan: formText,
  replace: formText.transform((value) =>
    value === 'ask' || value === 'confirmed' ? value : undefined
  )
})

export type ProductFormInput = z.input<typeof productFormSchema>

export const addCodeSchema = z.object({
  code: codeSchema,
  id: z.uuid({ error: MISSING_PRODUCT_MESSAGE })
})

export const voiceTextSchema = z.object({
  id: productIdSchema,
  voiceText: z.string()
})

export const mergeSchema = z
  .object({
    keepId: productIdSchema,
    mergedIds: z.array(productIdSchema).min(1)
  })
  .refine(
    ({ keepId, mergedIds }) =>
      new Set([keepId, ...mergedIds]).size === mergedIds.length + 1
  )

export type MergeInput = z.input<typeof mergeSchema>
