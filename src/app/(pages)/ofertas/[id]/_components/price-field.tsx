'use client'

import { useState } from 'react'

import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { formatPrice, parsePrice } from '@/domain/offer'

type PriceFieldProps = {
  id: string
  productName: string
  priceInCents: number
  autoFocus: boolean
  onChange: (priceInCents: number) => void
}

export const PRICE_MISSING_ATTRIBUTE = 'data-price-missing'

// Keeps what was typed, so a half-typed price ("12,") isn't reformatted under the cursor, and
// only flags it once the field is left
export const PriceField = ({
  id,
  productName,
  priceInCents,
  autoFocus,
  onChange
}: PriceFieldProps) => {
  const [text, setText] = useState(
    priceInCents > 0 ? formatPrice(priceInCents) : ''
  )
  const [left, setLeft] = useState(false)
  const invalid = left && text !== '' && parsePrice(text) === null

  return (
    <Field data-invalid={invalid ? true : undefined}>
      <FieldLabel htmlFor={id}>
        Preço<span className="sr-only"> de {productName}</span> (R$)
      </FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="0,00"
        value={text}
        {...{ [PRICE_MISSING_ATTRIBUTE]: priceInCents === 0 ? '' : undefined }}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => {
          setText(event.target.value)
          onChange(parsePrice(event.target.value) ?? 0)
        }}
        onBlur={() => setLeft(true)}
        className="font-mono"
      />
      {invalid && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          Digite o preço como 12,90.
        </p>
      )}
    </Field>
  )
}
