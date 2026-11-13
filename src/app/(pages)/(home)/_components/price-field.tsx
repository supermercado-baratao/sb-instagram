'use client'

import { useRef, useState } from 'react'

import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { formatPrice, parsePrice } from '@/models/offer/offer'

type PriceFieldProps = {
  id: string
  productName: string
  priceInCents: number
  autoFocus: boolean
  // A price brought from another page is selected on the first focus, so typing replaces it
  selectOnFocus: boolean
  // A slot outside the poster isn't printed, so its empty price never holds a save or a generation
  required: boolean
  otherPages: number[]
  onChange: (priceInCents: number) => void
}

const describeOtherPages = (pages: number[]) => {
  const numbers = pages.map((page) => String(page + 1))
  if (numbers.length === 1) return `Produto repetido na arte ${numbers[0]}.`
  return `Produto repetido nas artes ${numbers.slice(0, -1).join(', ')} e ${numbers.at(-1)}.`
}

export const PRICE_MISSING_ATTRIBUTE = 'data-price-missing'

// Keeps what was typed, so a half-typed price ("12,") isn't reformatted under the cursor, and
// only flags it once the field is left
export const PriceField = ({
  id,
  productName,
  priceInCents,
  autoFocus,
  selectOnFocus,
  required,
  otherPages,
  onChange
}: PriceFieldProps) => {
  const [text, setText] = useState(
    priceInCents > 0 ? formatPrice(priceInCents) : ''
  )
  const [left, setLeft] = useState(false)
  const selectPending = useRef(selectOnFocus)
  const invalid = left && text !== '' && parsePrice(text) === null
  const errorId = `${id}-error`
  const sharedId = `${id}-shared`
  const describedBy = [
    invalid && errorId,
    otherPages.length > 0 && sharedId
  ].filter(Boolean)

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
        {...{
          [PRICE_MISSING_ATTRIBUTE]:
            required && priceInCents === 0 ? '' : undefined
        }}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={
          describedBy.length > 0 ? describedBy.join(' ') : undefined
        }
        onFocus={(event) => {
          if (!selectPending.current) return
          selectPending.current = false
          event.target.select()
        }}
        onChange={(event) => {
          setText(event.target.value)
          onChange(parsePrice(event.target.value) ?? 0)
        }}
        onBlur={() => setLeft(true)}
        className="font-mono"
      />
      {invalid && (
        <p id={errorId} className="text-sm text-destructive">
          Digite o preço como 12,90.
        </p>
      )}
      {otherPages.length > 0 && (
        <p id={sharedId} className="text-sm text-muted-foreground">
          {describeOtherPages(otherPages)}
        </p>
      )}
    </Field>
  )
}
