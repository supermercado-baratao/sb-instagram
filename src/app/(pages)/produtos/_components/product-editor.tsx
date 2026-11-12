'use client'

import { CircleAlert, CircleCheck, Merge, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { lookupProduct } from '@/app/components/blocks/product/actions'
import {
  CreateProductDialog,
  type CreateProductStart
} from '@/app/components/blocks/product/create-product-dialog'
import { EditProductDialog } from '@/app/components/blocks/product/edit-product-dialog'
import {
  type ProductChoice,
  ProductChoiceDialog
} from '@/app/components/blocks/product/product-choice-dialog'
import { getLookupMessage } from '@/app/components/blocks/product/product-lookup'
import { Button } from '@/app/components/ui/shadcn/button'
import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import {
  ToggleGroup,
  ToggleGroupItem
} from '@/app/components/ui/shadcn/toggle-group'
import type { CatalogStatus } from '@/domain/catalog-export'
import {
  getCodeType,
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
  catalogStatuses: Record<string, CatalogStatus>
}

const FILTERS: { value: ProductListFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'store', label: 'Da loja' },
  { value: 'catalog', label: 'Catálogo' },
  { value: 'outside-catalog', label: 'Enviar ao catálogo' }
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
  if (filter === 'catalog') {
    return 'O catálogo não tem produtos que a loja ainda não cadastrou.'
  }
  if (filter === 'outside-catalog') {
    return 'Não há produtos da loja para enviar: todos já estão no catálogo ou foram exportados.'
  }
  return 'Nenhum produto ainda. Bipe um código acima para cadastrar.'
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
  filter,
  catalogStatuses
}: ProductEditorProps) => {
  const router = useRouter()
  const [value, setValue] = useState(query)
  const [syncedQuery, setSyncedQuery] = useState(query)
  // Kept after closing, so the dialog keeps its content during the closing animation
  const [editing, setEditing] = useState<{
    product: Product
    photoVersion: number
  }>()
  const [editOpen, setEditOpen] = useState(false)
  const [choice, setChoice] = useState<ProductChoice>()
  const [choosing, setChoosing] = useState(false)
  const choseProduct = useRef(false)
  // Holds what the dialog starts from, if anything, while it is open
  const [creating, setCreating] = useState<{
    initialLookup?: CreateProductStart
  }>()
  // The button that opened the dialog, or none for a scan
  const openedFrom = useRef<HTMLElement>(undefined)
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

  const openProduct = (product: Product, row?: HTMLElement) => {
    clearMessages()
    openedFrom.current = row
    // The photo keeps its URL after an upload, so each opening asks for it again
    setEditing({ product, photoVersion: Date.now() })
    setEditOpen(true)
  }

  // Taken from the create dialog, the product keeps the button or row that opened that dialog,
  // so closing returns the focus there (#115); a scan passes none and goes back to the field
  const openExisting = (
    { code, products }: ProductChoice,
    from?: HTMLElement
  ) => {
    if (products.length === 1) {
      openProduct(products[0], from)
      return
    }
    openedFrom.current = from
    choseProduct.current = false
    setChoice({ code, products })
    setChoosing(true)
  }

  const openCreate = (
    initialLookup?: CreateProductStart,
    row?: HTMLElement
  ) => {
    clearMessages()
    openedFrom.current = row
    setCreating({ initialLookup })
  }

  const getFocusAfterClose = () =>
    openedFrom.current?.isConnected ? openedFrom.current : codeInput.current

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
      if (result.status === 'found') openExisting(result)
      else openCreate(result)
    })
  }

  // A scanner saves one product after another, so each notice replaces the last instead of piling
  // up. It gets a new toast rather than updating the last one, so the same text is announced again
  const showSaved = (product: Product, outcome: 'saved' | 'unchanged') => {
    if (savedToast.current !== undefined) toast.dismiss(savedToast.current)
    savedToast.current = toast.success(
      outcome === 'unchanged'
        ? `${product.description} já estava cadastrado, e nenhum dado mudou.`
        : `${product.description} salvo. Bipe o próximo código.`
    )
  }

  const handleSaved = (product: Product, outcome: 'saved' | 'unchanged') => {
    clearMessages()
    showSaved(product, outcome)
  }

  const handleDeleted = (product: Product) => {
    clearMessages()
    setDeleted(product)
    unselect([product.id])
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

  const handleMerged = (product: Product) => {
    clearMessages()
    setMerged(product)
    setSelected(new Map())
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Bipe o código com o leitor, ou digite um código ou descrição e
            aperte Enter.
          </p>
        </div>
        <Button onClick={(event) => openCreate(undefined, event.currentTarget)}>
          <Plus data-icon="inline-start" />
          Cadastrar produto
        </Button>
      </header>
      <CreateProductDialog
        open={creating !== undefined}
        onOpenChange={(open) => {
          if (!open) setCreating(undefined)
        }}
        initialLookup={creating?.initialLookup}
        noEanImages={noEanImages}
        onSaved={handleSaved}
        getFocusAfterSave={() => codeInput.current}
        onOpenExisting={(choice) => openExisting(choice, openedFrom.current)}
        openExistingLabel="Abrir produto cadastrado"
        // The product's dialog or the choice that opens next takes the focus
        getFocusAfterOpen={() => null}
        getFocusAfterClose={getFocusAfterClose}
      />
      <ProductChoiceDialog
        open={choosing}
        choice={choice}
        onOpenChange={setChoosing}
        onChoose={(product) => {
          choseProduct.current = true
          openProduct(product, openedFrom.current)
        }}
        getFocusAfterChoice={() =>
          !choseProduct.current && getFocusAfterClose()
        }
      />
      {editing && (
        <EditProductDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          product={editing.product}
          photoVersion={editing.photoVersion}
          description={getLookupMessage({
            status: 'instance',
            product: editing.product
          })}
          noEanImages={noEanImages}
          onSaved={(product) => handleSaved(product, 'saved')}
          getFocusAfterSave={() => codeInput.current}
          getFocusAfterClose={getFocusAfterClose}
        />
      )}

      <form onSubmit={search} role="search" className="flex items-end gap-2">
        <Field className="flex-1" data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="code">Buscar produto</FieldLabel>
          <Input
            ref={codeInput}
            id="code"
            name="code"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            placeholder="Código ou descrição"
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
            {deleted.description} excluído.
          </p>
        )}
        {merged && (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Produtos mesclados em {merged.description}.
          </p>
        )}
      </div>

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
            separados por engano, selecione-os e clique em Mesclar. Cada produto
            da loja mostra se já está no catálogo da comunidade ou o que falta
            para entrar.
          </p>
        </div>
        <CatalogExportButton onFinished={() => codeInput.current?.focus()} />
        <div className="max-w-full overflow-x-auto">
          <ToggleGroup
            variant="outline"
            spacing={0}
            aria-label="Filtrar produtos"
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
                onClick={(event) => {
                  const code = normalizeCode(query)
                  openCreate(
                    { status: 'new', code, codeType: getCodeType(code) },
                    event.currentTarget
                  )
                }}
              >
                <Plus data-icon="inline-start" aria-hidden />
                Cadastrar produto com o código {query}
              </Button>
            )}
        </div>
        {productPage.items.length > 0 && (
          <ProductList
            items={productPage.items}
            catalogStatuses={catalogStatuses}
            busy={searching}
            selectedIds={new Set(selected.keys())}
            onSelect={select}
            onOpen={openProduct}
            onOpenCatalog={(product, row) =>
              openCreate({ status: 'catalog', code: product.ean, product }, row)
            }
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
