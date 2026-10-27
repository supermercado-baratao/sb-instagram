'use client'

import { CircleAlert, CircleCheck, Info, Plus, ScanBarcode } from 'lucide-react'
import { type FormEvent, useRef, useState, useTransition } from 'react'

import { lookupProduct } from '@/app/components/blocks/product/actions'
import { CreateProductDialog } from '@/app/components/blocks/product/create-product-dialog'
import {
  type ProductChoice,
  ProductChoiceDialog
} from '@/app/components/blocks/product/product-choice-dialog'
import { ProductForm } from '@/app/components/blocks/product/product-form'
import {
  getLookupMessage,
  getProductFormProps,
  type ProductLookup
} from '@/app/components/blocks/product/product-lookup'
import { Button } from '@/app/components/ui/shadcn/button'
import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import type { Product, ProductPage } from '@/domain/product'

import { CatalogExportButton } from './catalog-export-button'
import { PRODUCTS_HEADING_ID } from './delete-product-button'
import { ProductList } from './product-list'
import { ProductPagination } from './product-pagination'
import { ProductSearch } from './product-search'

type ProductEditorProps = {
  noEanImages: string[]
  productPage: ProductPage
  query: string
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
  const [lookup, setLookup] = useState<ProductLookup>()
  const [choice, setChoice] = useState<ProductChoice>()
  const [choosing, setChoosing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string>()
  const [saved, setSaved] = useState<{
    product: Product
    unchanged: boolean
  }>()
  const [deleted, setDeleted] = useState<Product>()
  const [searching, startSearch] = useTransition()
  const codeInput = useRef<HTMLInputElement>(null)
  const formArea = useRef<HTMLDivElement>(null)

  const clearMessages = () => {
    setSaved(undefined)
    setDeleted(undefined)
    setError(undefined)
  }

  const openProduct = (product: Product) => {
    clearMessages()
    setLookup({
      status: 'instance',
      product,
      id: Date.now()
    })
  }

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const code = String(new FormData(form).get('code') ?? '')

    startSearch(async () => {
      const result = await lookupProduct(code)
      clearMessages()
      if (result.status === 'error') {
        setError(result.message)
        setLookup(undefined)
        // A scanner types the next code where the cursor is, so the wrong one must be replaced
        codeInput.current?.select()
        return
      }
      form.reset()
      if (result.status !== 'found') {
        setLookup({ ...result, id: Date.now() })
        return
      }
      if (result.products.length === 1) {
        openProduct(result.products[0])
        return
      }
      setLookup(undefined)
      setChoice({ code: result.code, products: result.products })
      setChoosing(true)
    })
  }

  const handleSaved = (product: Product) => {
    setSaved({ product, unchanged: false })
    setDeleted(undefined)
    setLookup(undefined)
    codeInput.current?.focus()
  }

  const handleCreated = (product: Product, outcome: 'saved' | 'unchanged') => {
    setSaved({ product, unchanged: outcome === 'unchanged' })
    setDeleted(undefined)
    setError(undefined)
    // Only a form open for the same product is outdated; any other keeps its unsaved edits
    if (lookup?.status === 'instance' && lookup.product.id === product.id) {
      setLookup(undefined)
    }
  }

  const handleDeleted = (product: Product) => {
    setDeleted(product)
    setSaved(undefined)
    setError(undefined)
    if (lookup?.status === 'instance' && lookup.product.id === product.id) {
      setLookup(undefined)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Bipe o código com o leitor ou digite e aperte Enter.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          Cadastrar produto
        </Button>
      </header>
      <CreateProductDialog
        open={creating}
        onOpenChange={setCreating}
        noEanImages={noEanImages}
        onSaved={handleCreated}
        getFocusAfterSave={() => codeInput.current}
      />
      <ProductChoiceDialog
        open={choosing}
        choice={choice}
        onOpenChange={setChoosing}
        onChoose={openProduct}
        getFocusAfterChoice={() =>
          formArea.current?.querySelector<HTMLElement>('[name="name"]') ??
          codeInput.current
        }
      />

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
            {saved.unchanged
              ? `${saved.product.name} já estava cadastrado, e nenhum dado mudou.`
              : `${saved.product.name} salvo. Bipe o próximo código.`}
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
        <div ref={formArea}>
          <ProductForm
            key={lookup.id}
            {...getProductFormProps(lookup)}
            noEanImages={noEanImages}
            onSaved={handleSaved}
            className="rounded-xl border border-border p-4 sm:p-6"
          />
        </div>
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
        <CatalogExportButton onFinished={() => codeInput.current?.focus()} />
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
