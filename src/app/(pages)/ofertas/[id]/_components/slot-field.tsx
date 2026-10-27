'use client'

import { CircleAlert, ImageOff, Plus, Search, X } from 'lucide-react'
import { type FormEvent, useRef, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'

import { CreateProductDialog } from '@/app/components/blocks/product/create-product-dialog'
import { Button } from '@/app/components/ui/shadcn/button'
import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { getPhotoUrl } from '@/app/helpers/offer-poster'
import type { OfferSlot } from '@/domain/offer'
import type { Product } from '@/domain/product'

import { lookupSlotProduct } from '../actions'
import { PriceField } from './price-field'

type SlotFieldProps = {
  id: string
  position: number
  slot: OfferSlot
  noEanImages: string[]
  onChange: (slot: OfferSlot) => void
  onNotice: (message: string) => void
}

type LookupError =
  { kind: 'message'; message: string } | { kind: 'missing'; code: string }

export const SlotField = ({
  id,
  position,
  slot,
  noEanImages,
  onChange,
  onNotice
}: SlotFieldProps) => {
  const [error, setError] = useState<LookupError>()
  const [focusPrice, setFocusPrice] = useState(false)
  const [searching, startSearch] = useTransition()
  // Holds the code the dialog starts from, if any, while it is open
  const [creating, setCreating] = useState<{ missingCode?: string }>()
  const codeInput = useRef<HTMLInputElement>(null)
  const label = `Produto ${position + 1}`
  const labelId = `${id}-label`
  const priceId = `${id}-price`

  const placeProduct = (product: Product) => {
    setError(undefined)
    onChange({ product, priceInCents: 0 })
  }

  const dialog = (
    <CreateProductDialog
      open={creating !== undefined}
      onOpenChange={(open) => {
        if (!open) setCreating(undefined)
      }}
      missingCode={creating?.missingCode}
      noEanImages={noEanImages}
      onSaved={(product, outcome) => {
        // The dialog moves the focus to the price once it closes
        setFocusPrice(false)
        placeProduct(product)
        if (outcome === 'unchanged') {
          onNotice(`${product.name} já estava cadastrado, e nenhum dado mudou.`)
        }
      }}
      getFocusAfterSave={() =>
        document.querySelector<HTMLElement>(`#${CSS.escape(priceId)}`)
      }
    />
  )

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code') ?? '')

    startSearch(async () => {
      const result = await lookupSlotProduct(code)
      if (result.status === 'found') {
        // A scan fills the slot and the price is the next thing to type
        setFocusPrice(true)
        placeProduct(result.product)
        return
      }
      setError(
        result.status === 'missing'
          ? { kind: 'missing', code: result.code }
          : { kind: 'message', message: result.message }
      )
      // A scanner types the next code where the cursor is, so the wrong one must be replaced
      codeInput.current?.select()
    })
  }

  if (!slot) {
    const errorId = `${id}-error`
    return (
      <>
        <form
          onSubmit={search}
          className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3"
        >
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={`${id}-code`}>{label}</FieldLabel>
            <div className="flex gap-2">
              <Input
                ref={codeInput}
                id={`${id}-code`}
                name="code"
                autoComplete="off"
                spellCheck={false}
                placeholder="Código"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="font-mono"
              />
              <Button
                type="submit"
                variant="outline"
                size="icon"
                disabled={searching}
                focusableWhenDisabled
                aria-label={`Buscar ${label.toLowerCase()}`}
              >
                <Search aria-hidden />
              </Button>
            </div>
          </Field>
          <div aria-live="polite">
            {error && (
              <p
                id={errorId}
                className="flex items-start gap-1.5 text-sm text-destructive"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error.kind === 'message' ? (
                  error.message
                ) : (
                  <span>
                    Código {error.code} não cadastrado.{' '}
                    <Button
                      variant="link"
                      className="h-auto p-0 text-destructive"
                      onClick={() => setCreating({ missingCode: error.code })}
                    >
                      Cadastrar produto
                      <span className="sr-only"> ({label})</span>
                    </Button>
                  </span>
                )}
              </p>
            )}
          </div>
          {error?.kind !== 'missing' && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setCreating({})}
            >
              <Plus data-icon="inline-start" aria-hidden />
              Cadastrar produto
              <span className="sr-only"> ({label})</span>
            </Button>
          )}
        </form>
        {dialog}
      </>
    )
  }

  const { product, priceInCents } = slot
  const details = [product.brand, product.unit].filter(Boolean).join(' · ')

  return (
    <>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {product.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- the photo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
              <img
                src={getPhotoUrl(product.code)}
                alt=""
                className="size-full object-contain"
              />
            ) : (
              <ImageOff className="size-5 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p id={labelId} className="text-xs text-muted-foreground">
              {label}
            </p>
            <p className="font-medium wrap-break-word">{product.name}</p>
            {details && (
              <p className="text-sm text-muted-foreground">{details}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Tirar ${product.name} da página`}
            onClick={() => {
              // The button goes away with the product, so focus moves to the slot's code field
              flushSync(() => onChange(null))
              codeInput.current?.focus()
            }}
          >
            <X aria-hidden />
          </Button>
        </div>
        <PriceField
          // A new product in the slot starts its own price
          key={product.code}
          id={priceId}
          productName={product.name}
          priceInCents={priceInCents}
          autoFocus={focusPrice}
          onChange={(cents) => onChange({ product, priceInCents: cents })}
        />
      </div>
      {dialog}
    </>
  )
}
