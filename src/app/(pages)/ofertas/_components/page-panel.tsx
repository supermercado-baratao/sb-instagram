'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { flushSync } from 'react-dom'

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
import { moveSlot, type OfferPage, setSlot } from '@/domain/offer'
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
  // Each slot keeps its key when it moves, so a price being typed moves with its product
  const [slotKeys, setSlotKeys] = useState(() =>
    page.slots.map((_, position) => position)
  )
  const hiddenCount = page.slots
    .slice(page.layout)
    .filter((slot) => slot !== null).length

  const moveSlotTo = (from: number, to: number) => {
    const moved = moveSlot(page, from, to)
    if (moved === page) return
    // React moves the slot's node, which drops the focus, so it goes back to the same button
    flushSync(() => {
      onChange(moved)
      setSlotKeys(slotKeys.with(from, slotKeys[to]).with(to, slotKeys[from]))
    })
    const button = to < from ? 'move-before' : 'move-after'
    document.querySelector<HTMLElement>(`#${id}-slot-${to}-${button}`)?.focus()
  }

  return (
    <div className="@container flex flex-col gap-6">
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

      <ul className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
        {page.slots.slice(0, page.layout).map((slot, position) => (
          <li key={slotKeys[position]}>
            <SlotField
              id={`${id}-slot-${position}`}
              position={position}
              slot={slot}
              noEanImages={noEanImages}
              photoVersion={photoVersion}
              canMoveBefore={position > 0}
              canMoveAfter={position < page.layout - 1}
              onChange={(next) => onChange(setSlot(page, position, next))}
              onMove={(to) => moveSlotTo(position, to)}
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
