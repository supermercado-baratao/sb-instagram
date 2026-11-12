import { isSameCodeSet } from '@/domain/product'

export type ProductFormValues = {
  description: string
  unit: string
  voiceText: string
  codes: string[]
  // A photo picked in the form, an upload or a catalog image
  newPhoto: boolean
}

export const hasProductFormChanges = (
  initial: ProductFormValues,
  current: ProductFormValues
) =>
  current.newPhoto ||
  initial.description.trim() !== current.description.trim() ||
  initial.unit.trim() !== current.unit.trim() ||
  initial.voiceText.trim() !== current.voiceText.trim() ||
  !isSameCodeSet(initial.codes, current.codes)
