'use client'

import { FileOutput, Plus } from 'lucide-react'
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/app/components/ui/shadcn/dropdown-menu'
import {
  canSwapSlots,
  findEmptySlot,
  formatPrice,
  getPageConflict,
  type OfferPage,
  type SlotLocation
} from '@/models/offer/offer'
import type { Product } from '@/models/product/product'

export type MoveTarget =
  { kind: 'new-page' } | { kind: 'slot'; to: SlotLocation }

type MoveProductButtonProps = {
  id: string
  product: Product
  pages: OfferPage[]
  from: SlotLocation
  onMove: (target: MoveTarget) => void
  onCopy: (target: MoveTarget) => void
}

export const MoveProductButton = ({
  id,
  product,
  pages,
  from,
  onMove,
  onCopy
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
              aria-label={`Mover ou copiar ${product.description} para outra arte`}
            />
          }
        >
          <FileOutput data-icon="inline-start" aria-hidden />
          Outra arte
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-auto"
          // Unmounting after its exit animation, the menu would take the focus from the open dialog
          finalFocus={() => !leaving.current && !dialogOpen}
        >
          {/* Screen readers seldom read a group's label while moving through a menu, so each item
              names its action too */}
          {pages.length > 1 && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                {pages.map((page, index) => {
                  if (index === from.page) return null
                  const hasProduct =
                    getPageConflict(page, product) === 'same-product'
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
                        move(
                          { kind: 'slot', to: { page: index, position } },
                          true
                        )
                      }}
                    >
                      <span className="sr-only">Mover para </span>
                      Arte {index + 1}
                      {hasProduct && ' (já tem este produto)'}
                      {!hasProduct && full && ' (cheia)'}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Copiar para</DropdownMenuLabel>
            {pages.map((page, index) => {
              if (index === from.page) return null
              const hasProduct =
                getPageConflict(page, product) === 'same-product'
              const position = findEmptySlot(page)
              const full = position === -1
              return (
                <DropdownMenuItem
                  key={index}
                  // A copy keeps the product where it is, so a full page has no trade to offer
                  disabled={hasProduct || full}
                  onClick={() =>
                    onCopy({ kind: 'slot', to: { page: index, position } })
                  }
                >
                  <span className="sr-only">Copiar para </span>
                  Arte {index + 1}
                  {hasProduct && ' (já tem este produto)'}
                  {!hasProduct && full && ' (cheia)'}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuItem onClick={() => onCopy({ kind: 'new-page' })}>
              <span className="sr-only">Copiar para </span>
              Arte nova
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          finalFocus={() => (leaving.current ? false : trigger.current)}
        >
          <DialogHeader>
            <DialogTitle>
              A arte {(opened?.page ?? 0) + 1} está cheia
            </DialogTitle>
            <DialogDescription>
              Crie uma arte nova com {opened?.product.description} ou troque por
              um produto da arte {(opened?.page ?? 0) + 1}. A mudança só vale
              depois de salvar a oferta.
            </DialogDescription>
          </DialogHeader>
          <Button
            className="self-start"
            onClick={() => moveFromDialog({ kind: 'new-page' }, true)}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Criar arte nova
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
                            {!canSwap && ` (já está na arte ${from.page + 1})`}
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
