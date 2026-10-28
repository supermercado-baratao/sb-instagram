'use client'

import { CircleAlert, Link2 } from 'lucide-react'
import { useId, useRef, useState, useTransition } from 'react'

import {
  Autocomplete,
  AutocompleteInput
} from '@/app/components/ui/custom/autocomplete'
import { Button } from '@/app/components/ui/shadcn/button'
import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { useProductSuggestions } from '@/app/hooks/use-product-suggestions'
import type { Product } from '@/domain/product'

import { addCodeToProduct } from './actions'
import { ProductSuggestions } from './product-suggestions'

type AddCodeToProductProps = {
  code: string
  onAdded: (product: Product) => void
}

// A new code is often one more variation of a product the store already has (#50)
export const AddCodeToProduct = ({ code, onAdded }: AddCodeToProductProps) => {
  // 'cancelled' gives the focus back to the button, which the search replaced
  const [state, setState] = useState<'closed' | 'searching' | 'cancelled'>(
    'closed'
  )
  const [error, setError] = useState<string>()
  const [adding, startAdd] = useTransition()
  const suggestions = useProductSuggestions()
  const input = useRef<HTMLInputElement>(null)
  const id = useId()

  if (state !== 'searching') {
    return (
      <Button
        variant="outline"
        className="self-start"
        autoFocus={state === 'cancelled'}
        onClick={() => setState('searching')}
      >
        <Link2 data-icon="inline-start" aria-hidden />
        Adicionar a um produto existente
      </Button>
    )
  }

  const errorId = `${id}-error`

  const add = (product: Product) => {
    suggestions.close()
    suggestions.setQuery(product.name)
    startAdd(async () => {
      const result = await addCodeToProduct(product.id, code)
      if (result.status === 'error') {
        setError(result.message)
        input.current?.select()
        return
      }
      onAdded(result.product)
    })
  }

  return (
    <Field
      data-invalid={error ? true : undefined}
      className="rounded-lg border border-border p-3"
    >
      <FieldLabel htmlFor={`${id}-search`}>
        Adicionar o código {code} ao produto
      </FieldLabel>
      <Autocomplete
        items={suggestions.suggestions}
        value={suggestions.query}
        onValueChange={(text, { reason }) => {
          if (reason !== 'item-press') {
            setError(undefined)
            suggestions.suggest(text)
            return
          }
          const product = suggestions.suggestions.find(({ id }) => id === text)
          if (product) add(product)
        }}
        open={suggestions.open}
        onOpenChange={suggestions.onOpenChange}
        itemToStringValue={(product: Product) => product.id}
        filter={null}
      >
        <AutocompleteInput
          ref={input}
          id={`${id}-search`}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="Nome do produto"
          // Disabling would drop the focus, which an error then selects the query in again
          readOnly={adding}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <ProductSuggestions
          suggestions={suggestions.suggestions}
          suggesting={suggestions.suggesting}
        />
      </Autocomplete>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={adding}
        onClick={() => {
          suggestions.close()
          setState('cancelled')
        }}
      >
        Cancelar
      </Button>
      <div aria-live="polite">
        {error && (
          <p
            id={errorId}
            className="flex items-start gap-2 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
    </Field>
  )
}
