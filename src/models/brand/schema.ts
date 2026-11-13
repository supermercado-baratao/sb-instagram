import { z } from 'zod'

const templateDraftSchema = z.object({
  // A template added in the settings form has no id until the server assigns one
  id: z.string().nullable(),
  name: z.string(),
  colors: z.object({ primary: z.string(), accent: z.string() })
})

// Only the shape: the rules the form also shows by the fields are getBrandContentError's
export const brandContentSchema = z.object({
  name: z.string(),
  slogan: z.string(),
  instagram: z.string(),
  templates: z.array(templateDraftSchema)
})

export type BrandContentInput = z.input<typeof brandContentSchema>
