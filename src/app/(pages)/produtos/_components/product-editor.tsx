'use client'

import { CircleAlert, CircleCheck, Info, ScanBarcode } from 'lucide-react'
import { type FormEvent, useRef, useState, useTransition } from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import type { Product, ProductPage } from '@/domain/product'

import { lookupProduct, type LookupResult } from '../actions'
import { PRODUCTS_HEADING_ID } from './delete-product-button'
import { ProductForm } from './product-form'
import { ProductList } from './product-list'
import { ProductPagination } from './product-pagination'
import { ProductSearch } from './product-search'

type ProductEditorProps = {
  noEanImages: string[]
  productPage: ProductPage
  query: string
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

const getListSummary = ({ total }: ProductPage, query: string) => {
  if (total === 0) {
    return query === ''
      ? 'Nenhum produto cadastrado ainda. Bipe um código acima para cadastrar.'
      : `Nenhum produto encontrado para “${query}”.`
  }
  return total === 1 ? '1 produto' : `${total} produtos`
}

export const ProductEditor = ({
  noEanImages,
  productPage,
  query
}: ProductEditorProps) => {
  const [lookup, setLookup] = useState<Lookup>()
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState<Product>()
  const [deleted, setDeleted] = useState<Product>()
  const [searching, startSearch] = useTransition()
  const codeInput = useRef<HTMLInputElement>(null)

  const openProduct = (code: string, onFound?: () => void) => {
    startSearch(async () => {
      const result = await lookupProduct(code)
      setSaved(undefined)
      setDeleted(undefined)
      if (result.status === 'error') {
        setError(result.message)
        setLookup(undefined)
        // A scanner types the next code where the cursor is, so the wrong one must be replaced
        codeInput.current?.select()
        return
      }
      setError(undefined)
      setLookup({ ...result, id: Date.now() })
      onFound?.()
    })
  }

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const code = String(new FormData(form).get('code') ?? '')
    openProduct(code, () => form.reset())
  }

  const handleSaved = (product: Product) => {
    setSaved(product)
    setDeleted(undefined)
    setLookup(undefined)
    codeInput.current?.focus()
  }

  const handleDeleted = (product: Product) => {
    setDeleted(product)
    setSaved(undefined)
    setError(undefined)
    if (lookup?.status === 'found' && lookup.product.code === product.code) {
      setLookup(undefined)
    }
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
        {deleted && (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {deleted.name} excluído.
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

      <section
        aria-labelledby={PRODUCTS_HEADING_ID}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h2
            id={PRODUCTS_HEADING_ID}
            tabIndex={-1}
            className="text-lg font-semibold outline-none"
          >
            Produtos cadastrados
          </h2>
          <p className="text-sm text-muted-foreground">
            Clique num produto para alterar os dados ou a foto, ou na lixeira
            para excluir.
          </p>
        </div>
        <ProductSearch query={query} />
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {getListSummary(productPage, query)}
        </p>
        {productPage.products.length > 0 && (
          <ProductList
            products={productPage.products}
            busy={searching}
            onOpen={openProduct}
            onDeleted={handleDeleted}
          />
        )}
        {productPage.pageCount > 1 && (
          <ProductPagination
            query={query}
            page={productPage.page}
            pageCount={productPage.pageCount}
          />
        )}
      </section>
    </div>
  )
}
