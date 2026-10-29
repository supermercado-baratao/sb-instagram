'use client'

import {
  CircleAlert,
  CircleCheck,
  Info,
  Merge,
  Plus,
  Search
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

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
import {
  ToggleGroup,
  ToggleGroupItem
} from '@/app/components/ui/shadcn/toggle-group'
import {
  type CatalogMatch,
  isValidCode,
  normalizeCode,
  type Product,
  type ProductListFilter,
  type ProductPage
} from '@/domain/product'

import { CatalogExportButton } from './catalog-export-button'
import { PRODUCTS_HEADING_ID } from './delete-product-button'
import { MergeProductsDialog } from './merge-products-dialog'
import { ProductList } from './product-list'
import { ProductPagination } from './product-pagination'
import { getProductsHref } from './products-href'

type ProductEditorProps = {
  noEanImages: string[]
  productPage: ProductPage
  query: string
  filter: ProductListFilter
}

const FILTERS: { value: ProductListFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'store', label: 'Da loja' },
  { value: 'catalog', label: 'Catálogo' }
]

const isProductListFilter = (value: unknown): value is ProductListFilter =>
  FILTERS.some((filter) => filter.value === value)

// A name may hold spaces, which a code never has, so only a single word is looked up as a code
const isCodeLike = (text: string) => !/\s/.test(text) && isValidCode(text)

const getListSummary = (
  { total }: ProductPage,
  query: string,
  filter: ProductListFilter
) => {
  if (total > 0) return total === 1 ? '1 produto' : `${total} produtos`
  if (query !== '') return `Nenhum produto encontrado para “${query}”.`
  return filter === 'catalog'
    ? 'O catálogo não tem produtos que a loja ainda não cadastrou.'
    : 'Nenhum produto ainda. Bipe um código acima para cadastrar.'
}

const getSelectionSummary = (count: number) => {
  if (count === 0) return ''
  return count === 1
    ? '1 produto selecionado. Selecione mais um para mesclar.'
    : `${count} produtos selecionados`
}

export const ProductEditor = ({
  noEanImages,
  productPage,
  query,
  filter
}: ProductEditorProps) => {
  const router = useRouter()
  const [value, setValue] = useState(query)
  const [syncedQuery, setSyncedQuery] = useState(query)
  const [lookup, setLookup] = useState<ProductLookup>()
  const [choice, setChoice] = useState<ProductChoice>()
  const [choosing, setChoosing] = useState(false)
  // Holds the code the dialog starts from, if any, while it is open
  const [creating, setCreating] = useState<{ missingCode?: string }>()
  const [error, setError] = useState<string>()
  const [deleted, setDeleted] = useState<Product>()
  const savedToast = useRef<string | number>(undefined)
  const [merged, setMerged] = useState<Product>()
  // Kept across searches and pages, so products that never show up together can be merged
  const [selected, setSelected] = useState<ReadonlyMap<string, Product>>(
    new Map()
  )
  const [merging, setMerging] = useState<{ products: Product[]; key: number }>()
  const [mergeOpen, setMergeOpen] = useState(false)
  const mergeButton = useRef<HTMLButtonElement>(null)
  const [searching, startSearch] = useTransition()
  const codeInput = useRef<HTMLInputElement>(null)
  const formArea = useRef<HTMLDivElement>(null)

  // Synced during render rather than remounted with a key, so a search keeps the focus in the field
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setValue(query)
  }

  const showList = (nextQuery: string, nextFilter = filter) =>
    router.push(getProductsHref({ query: nextQuery, filter: nextFilter }))

  const clearMessages = () => {
    setDeleted(undefined)
    setMerged(undefined)
    setError(undefined)
  }

  const select = (product: Product, checked: boolean) =>
    setSelected((current) => {
      const next = new Map(current)
      if (checked) next.set(product.id, product)
      else next.delete(product.id)
      return next
    })

  const unselect = (ids: string[]) =>
    setSelected((current) => {
      const next = new Map(current)
      for (const id of ids) next.delete(id)
      return next
    })

  const openProduct = (product: Product) => {
    clearMessages()
    setLookup({
      status: 'instance',
      product,
      id: Date.now()
    })
  }

  const openCatalogProduct = (product: CatalogMatch) => {
    clearMessages()
    setLookup({
      status: 'catalog',
      code: product.ean,
      product,
      id: Date.now()
    })
  }

  // Enter (what a scanner sends after the code) opens the product with that code, or registers
  // an unknown EAN; anything else, a name or an internal code no product has, filters the list
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = value.trim()
    clearMessages()
    if (!isCodeLike(text)) {
      startSearch(() => showList(text))
      return
    }

    startSearch(async () => {
      const result = await lookupProduct(text)
      if (result.status === 'error') {
        setError(result.message)
        setLookup(undefined)
        // A scanner types the next code where the cursor is, so the wrong one must be replaced
        codeInput.current?.select()
        return
      }
      if (result.status === 'new' && result.codeType === 'internal') {
        showList(text)
        return
      }
      // The next scan starts from an empty field, and the list goes back to every product
      setValue('')
      if (query !== '') showList('')
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

  // A scanner saves one product after another, so each notice replaces the last instead of piling
  // up. It gets a new toast rather than updating the last one, so the same text is announced again
  const showSaved = (product: Product, outcome: 'saved' | 'unchanged') => {
    if (savedToast.current !== undefined) toast.dismiss(savedToast.current)
    savedToast.current = toast.success(
      outcome === 'unchanged'
        ? `${product.name} já estava cadastrado, e nenhum dado mudou.`
        : `${product.name} salvo. Bipe o próximo código.`
    )
  }

  const handleSaved = (product: Product) => {
    clearMessages()
    showSaved(product, 'saved')
    setLookup(undefined)
    codeInput.current?.focus()
  }

  const handleCreated = (product: Product, outcome: 'saved' | 'unchanged') => {
    clearMessages()
    showSaved(product, outcome)
    // Only a form open for the same product is outdated; any other keeps its unsaved edits
    if (lookup?.status === 'instance' && lookup.product.id === product.id) {
      setLookup(undefined)
    }
  }

  const handleDeleted = (product: Product) => {
    clearMessages()
    setDeleted(product)
    unselect([product.id])
    if (lookup?.status === 'instance' && lookup.product.id === product.id) {
      setLookup(undefined)
    }
  }

  const getHeading = () =>
    document.querySelector<HTMLElement>(`#${PRODUCTS_HEADING_ID}`)

  const openMerge = () => {
    setMerging({ products: selected.values().toArray(), key: Date.now() })
    setMergeOpen(true)
  }

  // The selection bar goes away with the selection, taking the focused button with it
  const clearSelection = () => {
    setSelected(new Map())
    getHeading()?.focus()
  }

  const handleMerged = (product: Product, mergedIds: string[]) => {
    clearMessages()
    setMerged(product)
    setSelected(new Map())
    // A form open for any of the merged products shows codes or a product that changed
    if (
      lookup?.status === 'instance' &&
      [product.id, ...mergedIds].includes(lookup.product.id)
    ) {
      setLookup(undefined)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Bipe o código com o leitor, ou digite um código ou nome e aperte
            Enter.
          </p>
        </div>
        <Button onClick={() => setCreating({})}>
          <Plus data-icon="inline-start" />
          Cadastrar produto
        </Button>
      </header>
      <CreateProductDialog
        open={creating !== undefined}
        onOpenChange={(open) => {
          if (!open) setCreating(undefined)
        }}
        missingCode={creating?.missingCode}
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

      <form onSubmit={search} role="search" className="flex items-end gap-2">
        <Field className="flex-1" data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="code">Buscar produto</FieldLabel>
          <Input
            ref={codeInput}
            id="code"
            name="code"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            placeholder="Código ou nome"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'code-error' : undefined}
            className="h-12 font-mono text-xl tracking-wider placeholder:font-sans placeholder:tracking-normal md:text-xl"
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          className="h-12"
          disabled={searching}
          focusableWhenDisabled
        >
          <Search data-icon="inline-start" aria-hidden />
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
        {deleted && (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {deleted.name} excluído.
          </p>
        )}
        {merged && (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Produtos mesclados em {merged.name}.
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
            Lista de produtos
          </h2>
          <p className="text-sm text-muted-foreground">
            Clique num produto da loja para alterar os dados ou a foto, ou na
            lixeira para excluir. Um produto do catálogo da comunidade abre já
            preenchido, pronto para cadastrar. Para juntar produtos cadastrados
            separados por engano, selecione-os e clique em Mesclar.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            variant="outline"
            spacing={0}
            aria-label="Origem dos produtos"
            value={[filter]}
            onValueChange={([next]) => {
              if (next !== filter && isProductListFilter(next)) {
                startSearch(() => showList(query, next))
              }
            }}
          >
            {FILTERS.map(({ value: option, label }) => (
              <ToggleGroupItem key={option} value={option}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <CatalogExportButton onFinished={() => codeInput.current?.focus()} />
        </div>
        {/* Mounted before the first selection, so the first count is announced too */}
        <p aria-live="polite" className="sr-only">
          {getSelectionSummary(selected.size)}
        </p>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <p aria-hidden className="mr-auto text-sm">
              {getSelectionSummary(selected.size)}
            </p>
            <Button
              ref={mergeButton}
              variant="outline"
              size="sm"
              disabled={searching || selected.size < 2}
              focusableWhenDisabled
              onClick={openMerge}
            >
              <Merge data-icon="inline-start" aria-hidden />
              Mesclar
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Limpar seleção
            </Button>
          </div>
        )}
        {merging && (
          <MergeProductsDialog
            key={merging.key}
            open={mergeOpen}
            onOpenChange={setMergeOpen}
            products={merging.products}
            onMerged={handleMerged}
            // After a merge the selection is cleared and the button is gone
            getFinalFocus={() => mergeButton.current ?? getHeading()}
          />
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {getListSummary(productPage, query, filter)}
          </p>
          {productPage.total === 0 &&
            filter !== 'catalog' &&
            isCodeLike(query) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCreating({ missingCode: normalizeCode(query) })
                }
              >
                <Plus data-icon="inline-start" aria-hidden />
                Cadastrar produto com o código {query}
              </Button>
            )}
        </div>
        {productPage.items.length > 0 && (
          <ProductList
            items={productPage.items}
            busy={searching}
            selectedIds={new Set(selected.keys())}
            onSelect={select}
            onOpen={openProduct}
            onOpenCatalog={openCatalogProduct}
            onDeleted={handleDeleted}
          />
        )}
        {productPage.pageCount > 1 && (
          <ProductPagination
            query={query}
            filter={filter}
            page={productPage.page}
            pageCount={productPage.pageCount}
          />
        )}
      </section>
    </div>
  )
}
