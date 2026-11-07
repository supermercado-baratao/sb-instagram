'use client'

import { Files, Plus } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/app/components/ui/shadcn/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/app/components/ui/shadcn/dropdown-menu'
import {
  canSwapSlots,
  findEmptySlot,
  formatPrice,
  getPageConflict,
  type OfferPage,
  type SlotLocation
} from '@/domain/offer'
import type { Product } from '@/domain/product'

export type MoveTarget =
  { kind: 'new-page' } | { kind: 'slot'; to: SlotLocation }

type MoveProductButtonProps = {
  id: string
  product: Product
  pages: OfferPage[]
  from: SlotLocation
  onMove: (target: MoveTarget) => void
}

export const MoveProductButton = ({
  id,
  product,
  pages,
  from,
  onMove
}: MoveProductButtonProps) => {
  // A copy from when the dialog opened, since a trade changes the pages while it animates out
  const [opened, setOpened] = useState<{
    page: number
    product: Product
    pages: OfferPage[]
  }>()
  const [dialogOpen, setDialogOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  // A move that empties the slot takes this button away, and the slot focuses its code field
  const leaving = useRef(false)

  const move = (target: MoveTarget, emptiesSlot: boolean) => {
    leaving.current = emptiesSlot
    setDialogOpen(false)
    onMove(target)
  }

  // The dialog takes clicks while it animates out, and a second one would undo a trade
  const moveFromDialog = (target: MoveTarget, emptiesSlot: boolean) => {
    if (dialogOpen) move(target, emptiesSlot)
  }

  const fullPage = opened ? opened.pages[opened.page] : undefined

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={trigger}
          render={
            <Button
              id={id}
              variant="outline"
              size="sm"
              disabled={pages.length === 1}
              focusableWhenDisabled
              aria-label={`Mover ${product.description} para outra página`}
            />
          }
        >
          <Files data-icon="inline-start" aria-hidden />
          Outra página
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-auto"
          // Unmounting after its exit animation, the menu would take the focus from the open dialog
          finalFocus={() => !leaving.current && !dialogOpen}
        >
          {pages.map((page, index) => {
            if (index === from.page) return null
            const hasProduct = getPageConflict(page, product) === 'same-product'
            const position = findEmptySlot(page)
            const full = position === -1
            return (
              <DropdownMenuItem
                key={index}
                disabled={hasProduct}
                onClick={() => {
                  if (full) {
                    setOpened({ page: index, product, pages })
                    setDialogOpen(true)
                    return
                  }
                  move({ kind: 'slot', to: { page: index, position } }, true)
                }}
              >
                Página {index + 1}
                {hasProduct && ' (já tem este produto)'}
                {!hasProduct && full && ' (cheia)'}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          finalFocus={() => (leaving.current ? false : trigger.current)}
        >
          <DialogHeader>
            <DialogTitle>
              A página {(opened?.page ?? 0) + 1} está cheia
            </DialogTitle>
            <DialogDescription>
              Crie uma página nova com {opened?.product.description} ou troque
              por um produto da página {(opened?.page ?? 0) + 1}. A mudança só
              vale depois de salvar a oferta.
            </DialogDescription>
          </DialogHeader>
          <Button
            className="self-start"
            onClick={() => moveFromDialog({ kind: 'new-page' }, true)}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Criar página nova
          </Button>
          <div className="flex flex-col gap-2">
            <h3 id={`${id}-swap`} className="text-sm font-medium">
              Trocar por
            </h3>
            <ul aria-labelledby={`${id}-swap`} className="flex flex-col gap-2">
              {fullPage?.slots
                .slice(0, fullPage.layout)
                .map((slot, position) => {
                  if (!slot || !opened) return null
                  const to = { page: opened.page, position }
                  const canSwap = canSwapSlots(opened.pages, from, to)
                  return (
                    <li key={position}>
                      <Button
                        variant="outline"
                        className="h-auto w-full justify-between gap-3 py-2 text-left whitespace-normal"
                        disabled={!canSwap}
                        focusableWhenDisabled
                        onClick={() =>
                          moveFromDialog({ kind: 'slot', to }, false)
                        }
                      >
                        <span className="flex min-w-0 flex-col wrap-break-word">
                          <span>
                            <span className="sr-only">Trocar por </span>
                            {slot.product.description}
                            {!canSwap &&
                              ` (já está na página ${from.page + 1})`}
                          </span>
                          {slot.product.unit && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {slot.product.unit}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono">
                          R$ {formatPrice(slot.priceInCents)}
                        </span>
                      </Button>
                    </li>
                  )
                })}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
