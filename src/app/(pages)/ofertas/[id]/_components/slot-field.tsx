'use client'

import { CircleAlert, ImageOff, Search, X } from 'lucide-react'
import Link from 'next/link'
import { type FormEvent, useRef, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'

import { Button } from '@/app/components/ui/shadcn/button'
import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { getPhotoUrl } from '@/app/helpers/offer-poster'
import type { OfferSlot } from '@/domain/offer'

import { lookupSlotProduct } from '../actions'
import { PriceField } from './price-field'

type SlotFieldProps = {
  id: string
  position: number
  slot: OfferSlot
  onChange: (slot: OfferSlot) => void
}

type LookupError =
  { kind: 'message'; message: string } | { kind: 'missing'; code: string }

export const SlotField = ({ id, position, slot, onChange }: SlotFieldProps) => {
  const [error, setError] = useState<LookupError>()
  const [focusPrice, setFocusPrice] = useState(false)
  const [searching, startSearch] = useTransition()
  const codeInput = useRef<HTMLInputElement>(null)
  const label = `Produto ${position + 1}`
  const labelId = `${id}-label`

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code') ?? '')

    startSearch(async () => {
      const result = await lookupSlotProduct(code)
      if (result.status === 'found') {
        setError(undefined)
        // A scan fills the slot and the price is the next thing to type
        setFocusPrice(true)
        onChange({ product: result.product, priceInCents: 0 })
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
                  <Link
                    href="/produtos"
                    target="_blank"
                    className="underline underline-offset-4"
                  >
                    Cadastrar em Produtos
                    <span className="sr-only"> (abre em nova aba)</span>
                  </Link>
                </span>
              )}
            </p>
          )}
        </div>
      </form>
    )
  }

  const { product, priceInCents } = slot
  const details = [product.brand, product.unit].filter(Boolean).join(' · ')

  return (
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
        id={`${id}-price`}
        productName={product.name}
        priceInCents={priceInCents}
        autoFocus={focusPrice}
        onChange={(cents) => onChange({ product, priceInCents: cents })}
      />
    </div>
  )
}
