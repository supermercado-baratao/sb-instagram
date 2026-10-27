'use client'

import { ImageOff } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/app/components/ui/shadcn/dialog'
import { getPhotoUrl } from '@/app/helpers/product-photo'
import type { Product } from '@/domain/product'

export type ProductChoice = {
  code: string
  products: Product[]
}

type ProductChoiceDialogProps = {
  open: boolean
  // Kept after closing, so the content stays during the closing animation
  choice: ProductChoice | undefined
  onOpenChange: (open: boolean) => void
  onChoose: (product: Product) => void
  getFocusAfterChoice?: () => HTMLElement | null
}

const getCodeSummary = ({ codes }: Product) =>
  codes.length === 1 ? 'Só este código' : `${codes.length} códigos`

// One code may be in a single product and in the groups that also have it (#55)
export const ProductChoiceDialog = ({
  open,
  choice,
  onOpenChange,
  onChoose,
  getFocusAfterChoice
}: ProductChoiceDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
      finalFocus={getFocusAfterChoice ? () => getFocusAfterChoice() : true}
    >
      {choice && (
        <>
          <DialogHeader>
            <DialogTitle>Escolha o produto</DialogTitle>
            <DialogDescription>
              O código{' '}
              <span className="font-mono text-foreground">{choice.code}</span>{' '}
              está em {choice.products.length} produtos.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
            {choice.products.map((product) => {
              const details = [product.brand, product.unit]
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChoose(product)
                      onOpenChange(false)
                    }}
                    className="flex w-full items-center gap-3 p-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {product.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- the photo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
                        <img
                          src={getPhotoUrl(product.id)}
                          alt=""
                          className="size-full object-contain"
                        />
                      ) : (
                        <ImageOff
                          aria-hidden
                          className="size-5 text-muted-foreground"
                        />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium wrap-break-word">
                        {product.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {[details, getCodeSummary(product)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </DialogContent>
  </Dialog>
)
