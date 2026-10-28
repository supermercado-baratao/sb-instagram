'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/shadcn/select'
import {
  ToggleGroup,
  ToggleGroupItem
} from '@/app/components/ui/shadcn/toggle-group'
import { type OfferPage, setSlot } from '@/domain/offer'
import {
  getPageTemplate,
  isPosterLayout,
  posterLayouts,
  type PosterTemplate
} from '@/domain/poster'
import type { Product } from '@/domain/product'

import { RemovePageButton } from './remove-page-button'
import { SlotField } from './slot-field'

type PagePanelProps = {
  index: number
  pageCount: number
  page: OfferPage
  templates: PosterTemplate[]
  noEanImages: string[]
  photoVersion?: number
  onChange: (page: OfferPage) => void
  onProductSaved: (product: Product) => void
  onNotice: (message: string) => void
  onMove: (to: number) => void
  onRemove: () => void
}

export const PagePanel = ({
  index,
  pageCount,
  page,
  templates,
  noEanImages,
  photoVersion,
  onChange,
  onProductSaved,
  onNotice,
  onMove,
  onRemove
}: PagePanelProps) => {
  const id = `page-${index}`
  const template = getPageTemplate(templates, page.templateId)
  const hiddenCount = page.slots
    .slice(page.layout)
    .filter((slot) => slot !== null).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Select
          items={templates.map(({ id: value, name }) => ({
            value,
            label: name
          }))}
          value={template?.id ?? null}
          onValueChange={(templateId) => {
            if (templateId) onChange({ ...page, templateId })
          }}
        >
          <div className="flex flex-col gap-2">
            <SelectPrimitive.Label className="w-fit text-sm font-medium">
              Modelo de arte
            </SelectPrimitive.Label>
            <SelectTrigger className="min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {templates.map(({ id: value, name }) => (
                <SelectItem key={value} value={value}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </div>
        </Select>

        <div className="flex flex-col gap-2">
          <p id={`${id}-layout`} className="text-sm font-medium">
            Produtos na página
          </p>
          <ToggleGroup
            variant="outline"
            spacing={0}
            aria-labelledby={`${id}-layout`}
            value={[String(page.layout)]}
            onValueChange={([value]) => {
              const layout = Number(value)
              if (isPosterLayout(layout)) onChange({ ...page, layout })
            }}
          >
            {posterLayouts.map(({ id: layout }) => (
              <ToggleGroupItem key={layout} value={String(layout)}>
                {layout}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={index === 0}
            focusableWhenDisabled
            onClick={() => onMove(index - 1)}
          >
            <ArrowLeft data-icon="inline-start" aria-hidden />
            Mover para antes
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={index === pageCount - 1}
            focusableWhenDisabled
            onClick={() => onMove(index + 1)}
          >
            Mover para depois
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
          <RemovePageButton
            pageNumber={index + 1}
            productCount={page.slots.filter((slot) => slot !== null).length}
            disabled={pageCount === 1}
            onRemove={onRemove}
          />
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {page.slots.slice(0, page.layout).map((slot, position) => (
          <li key={position}>
            <SlotField
              id={`${id}-slot-${position}`}
              position={position}
              slot={slot}
              noEanImages={noEanImages}
              photoVersion={photoVersion}
              onChange={(next) => onChange(setSlot(page, position, next))}
              onProductSaved={onProductSaved}
              onNotice={onNotice}
            />
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {hiddenCount === 1
            ? '1 produto fica guardado fora desta quantidade e volta se você escolher mais produtos.'
            : `${hiddenCount} produtos ficam guardados fora desta quantidade e voltam se você escolher mais produtos.`}
        </p>
      )}
    </div>
  )
}
