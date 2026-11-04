'use client'

import { cn } from 'cn'
import { useRef } from 'react'

import { Poster } from '@/app/components/blocks/poster'
import { getPosterOffer, getPosterProducts } from '@/app/helpers/offer-poster'
import { usePosterFitScale } from '@/app/hooks/use-poster-fit-scale'
import type { OfferContent } from '@/domain/offer'
import {
  type Brand,
  getPageTemplate,
  type PosterTemplate
} from '@/domain/poster'

export type PosterStageProps = {
  content: OfferContent
  brand: Brand
  templates: PosterTemplate[]
  photoVersion?: number
  index: number
  className?: string
}

export const PosterStage = ({
  content,
  brand,
  templates,
  photoVersion,
  index,
  className
}: PosterStageProps) => {
  const stage = useRef<HTMLDivElement>(null)
  const scale = usePosterFitScale(stage)
  const page = content.pages[index]
  const template = getPageTemplate(templates, page.templateId)

  return (
    <div
      ref={stage}
      className={cn(
        'flex min-h-0 items-center justify-center overflow-hidden',
        className
      )}
    >
      {template && scale > 0 && (
        <div style={{ zoom: scale }}>
          <Poster
            brand={brand}
            offer={getPosterOffer(content)}
            template={template}
            layout={page.layout}
            products={getPosterProducts(page.slots, photoVersion)}
          />
        </div>
      )}
    </div>
  )
}
