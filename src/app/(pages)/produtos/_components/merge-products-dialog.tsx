'use client'

import { CircleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState, useTransition } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/app/components/ui/shadcn/alert-dialog'
import {
  RadioGroup,
  RadioGroupItem
} from '@/app/components/ui/shadcn/radio-group'
import { formatQuotedList } from '@/app/helpers/list-format'
import type { Product } from '@/domain/product'

import {
  type MergePreviewResult,
  mergeProductsAction,
  previewMergeAction
} from '../actions'

type MergeProductsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // A snapshot taken on opening, so clearing the selection after merging leaves the closing dialog intact
  products: Product[]
  onMerged: (product: Product, mergedIds: string[]) => void
  getFinalFocus: () => HTMLElement | null
}

const getMergeInput = (products: Product[], keepId: string) => ({
  keepId,
  mergedIds: products.map(({ id }) => id).filter((id) => id !== keepId)
})

const getOffersMessage = (offers: string[]) => {
  if (offers.length === 0) return 'Nenhuma oferta muda.'
  const names = formatQuotedList(offers)
  return offers.length === 1
    ? `A oferta ${names} passa a usar o produto que fica.`
    : `As ofertas ${names} passam a usar o produto que fica.`
}

// Remounted (by key) on every opening, so each one starts from the first product
export const MergeProductsDialog = ({
  open,
  onOpenChange,
  products,
  onMerged,
  getFinalFocus
}: MergeProductsDialogProps) => {
  const [keepId, setKeepId] = useState(products[0]?.id)
  const [preview, setPreview] = useState<MergePreviewResult>()
  const [loading, startPreview] = useTransition()
  const [merging, startMerge] = useTransition()
  const [error, setError] = useState<string>()
  const request = useRef(0)
  const labelId = useId()

  const loadPreview = (id: string) => {
    const current = ++request.current
    startPreview(async () => {
      const result = await previewMergeAction(getMergeInput(products, id))
      // A slower answer for a product chosen before must not replace the current one
      if (current === request.current) setPreview(result)
    })
  }

  useEffect(() => {
    if (keepId !== undefined) loadPreview(keepId)
    // Only the first product on opening; a later choice loads its own preview
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (value: unknown) => {
    if (typeof value !== 'string') return
    setKeepId(value)
    setPreview(undefined)
    setError(undefined)
    loadPreview(value)
  }

  const confirm = () => {
    if (keepId === undefined) return
    const input = getMergeInput(products, keepId)
    startMerge(async () => {
      const result = await mergeProductsAction(input)
      if (result.status === 'error') {
        setError(result.message)
        return
      }
      onOpenChange(false)
      onMerged(result.product, input.mergedIds)
    })
  }

  const message =
    error ?? (preview?.status === 'error' ? preview.message : undefined)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-merge would suggest it was cancelled, while the products may still merge
        if (merging) return
        onOpenChange(next)
      }}
    >
      <AlertDialogContent className="sm:max-w-lg" finalFocus={getFinalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Mesclar {products.length} produtos?
          </AlertDialogTitle>
          <AlertDialogDescription>
            O produto que fica mantém nome, marca, unidade e foto e recebe os
            códigos dos outros, que serão excluídos junto com as fotos.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <p id={labelId} className="text-sm font-medium">
            Produto que fica
          </p>
          <RadioGroup
            aria-labelledby={labelId}
            value={keepId ?? null}
            onValueChange={choose}
            disabled={merging}
            className="max-h-64 gap-0 overflow-y-auto rounded-lg border border-border"
          >
            {products.map((product) => (
              <label
                key={product.id}
                className="flex cursor-pointer items-start gap-3 border-b border-border p-3 last:border-b-0 hover:bg-muted has-data-checked:bg-muted"
              >
                <RadioGroupItem value={product.id} className="mt-0.5" />
                <span className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="font-medium wrap-break-word">
                    {product.name}
                  </span>
                  {(product.brand || product.unit) && (
                    <span className="text-muted-foreground">
                      {[product.brand, product.unit]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                  <span className="font-mono text-xs break-all text-muted-foreground">
                    {product.codes.join(', ')}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div
          aria-live="polite"
          aria-busy={loading || undefined}
          className="flex min-h-10 flex-col gap-1 text-sm"
        >
          {message ? (
            <p className="flex items-start gap-2 text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {message}
            </p>
          ) : (
            preview?.status === 'ok' && (
              <>
                <p>
                  {preview.codes.length === 0
                    ? 'O produto que fica já tem todos os códigos.'
                    : `Códigos que passam para ele: ${preview.codes.join(', ')}.`}
                </p>
                <p className="text-muted-foreground">
                  {getOffersMessage(preview.offers)}
                </p>
              </>
            )
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={merging}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={
              merging ||
              loading ||
              preview?.status !== 'ok' ||
              error !== undefined
            }
            focusableWhenDisabled
            onClick={confirm}
          >
            Mesclar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
