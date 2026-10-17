import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import {
  brand,
  offer,
  products
} from '@/app/(pages)/preview/_components/fixtures'
import { getPreviewOptions } from '@/app/(pages)/preview/_components/preview-options'
import { Poster } from '@/app/components/blocks/poster'

export const metadata: Metadata = {
  title: 'Pôster',
  robots: { index: false }
}

// Captured by the PNG route at the poster's real size, so it has no zoom or controls around it
const PreviewRender = async ({
  searchParams
}: PageProps<'/preview/render'>) => {
  const { layout, template } = getPreviewOptions(await searchParams)
  if (!template) notFound()

  return (
    <Poster
      brand={brand}
      offer={offer}
      template={template}
      layout={layout}
      products={products}
    />
  )
}

export default PreviewRender
