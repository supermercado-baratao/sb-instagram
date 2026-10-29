'use client'

import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/app/components/ui/shadcn/dialog'
import type { OfferContent } from '@/domain/offer'
import type { Brand, PosterTemplate } from '@/domain/poster'

import { PosterStage } from './poster-stage'

type PosterFullViewProps = {
  content: OfferContent
  brand: Brand
  templates: PosterTemplate[]
  photoVersion?: number
  selectedIndex: number
}

export const PosterFullView = ({
  selectedIndex,
  ...stageProps
}: PosterFullViewProps) => {
  const [index, setIndex] = useState(selectedIndex)
  const pageCount = stageProps.content.pages.length

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (isOpen) setIndex(selectedIndex)
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Maximize2 aria-hidden />
        Ver em tela cheia
      </DialogTrigger>
      <DialogContent className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Pré-visualização da oferta</DialogTitle>
          <DialogDescription aria-live="polite">
            Página {index + 1} de {pageCount}
          </DialogDescription>
        </DialogHeader>
        <PosterStage {...stageProps} index={index} />
        {pageCount > 1 && (
          <DialogFooter className="flex-row justify-center sm:justify-center">
            <Button
              variant="outline"
              // Keeps the focus on the button when it reaches the first or last page
              focusableWhenDisabled
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              <ChevronLeft aria-hidden />
              Página anterior
            </Button>
            <Button
              variant="outline"
              focusableWhenDisabled
              disabled={index === pageCount - 1}
              onClick={() => setIndex(index + 1)}
            >
              Próxima página
              <ChevronRight aria-hidden />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
