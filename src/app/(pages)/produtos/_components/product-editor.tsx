'use client'

import { CircleAlert, CircleCheck, Info, ScanBarcode } from 'lucide-react'
import { type FormEvent, useRef, useState, useTransition } from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import type { Product } from '@/domain/product'

import { lookupProduct, type LookupResult } from '../actions'
import { ProductForm } from './product-form'

type ProductEditorProps = {
  noEanImages: string[]
}

type Lookup = Exclude<LookupResult, { status: 'error' }> & { id: number }

const getLookupMessage = (lookup: Lookup) => {
  if (lookup.status === 'new') {
    return lookup.codeType === 'ean'
      ? 'Produto novo. Preencha os dados para cadastrar.'
      : 'Código interno novo. Preencha os dados e escolha uma imagem do catálogo ou envie uma foto.'
  }
  return lookup.source === 'instance'
    ? 'Produto já cadastrado. Altere o que precisar e salve.'
    : 'Produto encontrado no catálogo da comunidade. Confira os dados e salve para usar.'
}

export const ProductEditor = ({ noEanImages }: ProductEditorProps) => {
  const [lookup, setLookup] = useState<Lookup>()
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState<Product>()
  const [searching, startSearch] = useTransition()
  const codeInput = useRef<HTMLInputElement>(null)

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const code = String(new FormData(form).get('code') ?? '')

    startSearch(async () => {
      const result = await lookupProduct(code)
      setSaved(undefined)
      if (result.status === 'error') {
        setError(result.message)
        setLookup(undefined)
        // A scanner types the next code where the cursor is, so the wrong one must be replaced
        codeInput.current?.select()
        return
      }
      setError(undefined)
      setLookup({ ...result, id: Date.now() })
      form.reset()
    })
  }

  const handleSaved = (product: Product) => {
    setSaved(product)
    setLookup(undefined)
    codeInput.current?.focus()
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={search} className="flex items-end gap-2">
        <Field className="flex-1" data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="code">
            Código de barras ou código interno
          </FieldLabel>
          <Input
            ref={codeInput}
            id="code"
            name="code"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'code-error' : undefined}
            className="h-12 font-mono text-xl tracking-wider md:text-xl"
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          className="h-12"
          disabled={searching}
          focusableWhenDisabled
        >
          <ScanBarcode data-icon="inline-start" />
          Buscar
        </Button>
      </form>

      <div aria-live="polite" className="min-h-5">
        {error && (
          <p
            id="code-error"
            className="flex items-center gap-2 text-sm text-destructive"
          >
            <CircleAlert className="size-4 shrink-0" />
            {error}
          </p>
        )}
        {saved && (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {saved.name} salvo. Bipe o próximo código.
          </p>
        )}
        {lookup && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" />
            {getLookupMessage(lookup)}
          </p>
        )}
      </div>

      {lookup && (
        <ProductForm
          key={lookup.id}
          code={lookup.status === 'new' ? lookup.code : lookup.product.code}
          product={lookup.status === 'found' ? lookup.product : undefined}
          hasPhoto={
            lookup.status === 'found' &&
            (lookup.source === 'catalog' || lookup.product.photo !== null)
          }
          photoVersion={lookup.id}
          noEanImages={noEanImages}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
