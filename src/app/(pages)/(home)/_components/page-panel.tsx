'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { ArrowLeft, ArrowRight, Eraser } from 'lucide-react'
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
import {
  clearPageProducts,
  getSlotMoveTarget,
  moveSlot,
  type OfferPage,
  type OfferSlot,
  setSlot
} from '@/domain/offer'
import {
  getPageTemplate,
  isPosterLayout,
  posterLayouts,
  type PosterTemplate
} from '@/domain/poster'
import type { Product } from '@/domain/product'

import { CLEAR_NOTE, ClearOfferButton } from './clear-offer-button'
import type { MoveTarget } from './move-product-button'
import { RemovePageButton } from './remove-page-button'
import { SlotField } from './slot-field'

const SLOT_GRID_CLASS_NAME = 'grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3'

// Counts the slots outside the poster too, which clearing also empties, so the number matches what leaves
const describeCleared = (productCount: number, outsideCount: number) => {
  const removed =
    productCount === 1
      ? 'O produto desta arte sai, com o preço'
      : `Os ${productCount} produtos desta arte saem, com os preços`
  if (outsideCount === 0) return `${removed}.`
  return outsideCount === 1
    ? `${removed}, incluindo o que está fora da arte.`
    : `${removed}, incluindo os ${outsideCount} que estão fora da arte.`
}

type PagePanelProps = {
  index: number
  pages: OfferPage[]
  templates: PosterTemplate[]
  noEanImages: string[]
  photoVersion?: number
  onChange: (page: OfferPage) => void
  onPriceChange: (productId: string, priceInCents: number) => void
  onProductSaved: (product: Product) => void
  onNotice: (message: string) => void
  onMove: (to: number) => void
  onMoveProduct: (position: number, target: MoveTarget) => void
  onCopyProduct: (position: number, target: MoveTarget) => void
  onRemove: () => void
}

export const PagePanel = ({
  index,
  pages,
  templates,
  noEanImages,
  photoVersion,
  onChange,
  onPriceChange,
  onProductSaved,
  onNotice,
  onMove,
  onMoveProduct,
  onCopyProduct,
  onRemove
}: PagePanelProps) => {
  const id = `page-${index}`
  const page = pages[index]
  const pageCount = pages.length
  const template = getPageTemplate(templates, page.templateId)
  // Each slot keeps its key when it moves, so a price being typed moves with its product
  const [slotKeys, setSlotKeys] = useState(() =>
    page.slots.map((_, position) => position)
  )
  const productCount = page.slots.filter((slot) => slot !== null).length
  const outsideCount = page.slots
    .slice(page.layout)
    .filter((slot) => slot !== null).length

  const renderSlot = (slot: OfferSlot, position: number) => (
    <li key={slotKeys[position]}>
      <SlotField
        id={`${id}-slot-${position}`}
        position={position}
        slot={slot}
        pages={pages}
        pageIndex={index}
        noEanImages={noEanImages}
        photoVersion={photoVersion}
        outside={position >= page.layout}
        canMoveBefore={getSlotMoveTarget(page, position, 'before') !== null}
        canMoveAfter={getSlotMoveTarget(page, position, 'after') !== null}
        onChange={(next) => onChange(setSlot(page, position, next))}
        onPriceChange={onPriceChange}
        onMove={(direction) => {
          const to = getSlotMoveTarget(page, position, direction)
          if (to !== null) moveSlotTo(position, to)
        }}
        onEmptied={() => focusNearEmptiedSlot(position)}
        onMoveToPage={(target) => onMoveProduct(position, target)}
        onCopyToPage={(target) => onCopyProduct(position, target)}
        onProductSaved={onProductSaved}
        onNotice={onNotice}
      />
    </li>
  )

  const moveSlotTo = (from: number, to: number) => {
    const moved = moveSlot(page, from, to)
    if (moved === page) return
    // React moves the slot's node, or remounts it across the poster's edge, which drops the focus,
    // so it goes back to the same button
    flushSync(() => {
      onChange(moved)
      setSlotKeys(slotKeys.with(from, slotKeys[to]).with(to, slotKeys[from]))
    })
    const button = to < from ? 'move-before' : 'move-after'
    document.querySelector<HTMLElement>(`#${id}-slot-${to}-${button}`)?.focus()
  }

  // An emptied slot past the layout leaves the screen with its own fields, so the focus goes to the
  // nearest product still out of the poster, or back to the poster's last slot (#121)
  const focusNearEmptiedSlot = (position: number) => {
    const outside = page.slots
      .map((slot, other) => (slot ? other : -1))
      .filter((other) => other >= page.layout && other !== position)
    const near = outside.find((other) => other > position) ?? outside.at(-1)
    const last = `${id}-slot-${page.layout - 1}`
    const target =
      near === undefined
        ? (document.querySelector<HTMLElement>(`#${last}-code`) ??
          document.querySelector<HTMLElement>(`#${last}-move-after`))
        : document.querySelector<HTMLElement>(`#${id}-slot-${near}-move-before`)
    target?.focus()
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
              Modelo
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
            Produtos na arte
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
          <ClearOfferButton
            label="Limpar produtos da arte"
            size="sm"
            icon={Eraser}
            title={`Limpar os produtos da arte ${index + 1}?`}
            description={`${describeCleared(productCount, outsideCount)} As outras artes, a validade e os textos do destaque continuam. ${CLEAR_NOTE}`}
            disabled={productCount === 0}
            getNextField={() =>
              document.querySelector<HTMLElement>(`#${id}-slot-0-code`)
            }
            onConfirm={() => {
              onChange(clearPageProducts(page))
              onNotice(
                `Produtos da arte ${index + 1} limpos. Coloque os novos produtos e salve.`
              )
            }}
          />
          <RemovePageButton
            pageNumber={index + 1}
            productCount={productCount}
            disabled={pageCount === 1}
            onRemove={onRemove}
          />
        </div>
      </div>

      <ul className={SLOT_GRID_CLASS_NAME}>
        {page.slots
          .slice(0, page.layout)
          .map((slot, position) => renderSlot(slot, position))}
      </ul>

      {/* Products past the layout stay on screen, so the store sees what the poster leaves out and can
          bring it back (#117). Empty slots there stay hidden, so a page that never held more products
          shows only its layout (#121) */}
      {outsideCount > 0 && (
        <section
          aria-labelledby={`${id}-outside`}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <h3 id={`${id}-outside`} className="font-semibold">
              Fora da arte
            </h3>
            <p className="text-sm text-muted-foreground">
              Estes produtos não aparecem na arte. Use Antes para trazer um
              produto para ela, ou escolha mais produtos na arte.
            </p>
          </div>
          <ul className={SLOT_GRID_CLASS_NAME}>
            {page.slots
              .slice(page.layout)
              .map((slot, offset) =>
                slot ? renderSlot(slot, page.layout + offset) : null
              )}
          </ul>
        </section>
      )}
    </div>
  )
}
