'use client'

import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  ImageOff,
  Plus,
  Search,
  X
} from 'lucide-react'
import { type FormEvent, useRef, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import { CreateProductDialog } from '@/app/components/blocks/product/create-product-dialog'
import { EditProductDialog } from '@/app/components/blocks/product/edit-product-dialog'
import {
  type ProductChoice,
  ProductChoiceDialog
} from '@/app/components/blocks/product/product-choice-dialog'
import { ProductSuggestions } from '@/app/components/blocks/product/product-suggestions'
import {
  Autocomplete,
  AutocompleteInput
} from '@/app/components/ui/custom/autocomplete'
import { Button } from '@/app/components/ui/shadcn/button'
import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { getPhotoUrl } from '@/app/helpers/product-photo'
import { useProductSuggestions } from '@/app/hooks/use-product-suggestions'
import {
  findOtherPagesWithProduct,
  findProductPrice,
  getPageConflict,
  type OfferPage,
  type OfferSlot
} from '@/domain/offer'
import type { Product } from '@/domain/product'

import { lookupSlotProduct } from './actions'
import { MoveProductButton, type MoveTarget } from './move-product-button'
import { PriceField } from './price-field'

type SlotFieldProps = {
  id: string
  position: number
  slot: OfferSlot
  pages: OfferPage[]
  pageIndex: number
  noEanImages: string[]
  photoVersion?: number
  // How far the slot can move, given the slots the page layout shows
  canMoveBefore: boolean
  canMoveAfter: boolean
  onChange: (slot: OfferSlot) => void
  onPriceChange: (productId: string, priceInCents: number) => void
  onMove: (to: number) => void
  onMoveToPage: (target: MoveTarget) => void
  onCopyToPage: (target: MoveTarget) => void
  onProductSaved: (product: Product) => void
  onNotice: (message: string) => void
}

type LookupError =
  { kind: 'message'; message: string } | { kind: 'missing'; code: string }

export const SlotField = ({
  id,
  position,
  slot,
  pages,
  pageIndex,
  noEanImages,
  photoVersion,
  canMoveBefore,
  canMoveAfter,
  onChange,
  onPriceChange,
  onMove,
  onMoveToPage,
  onCopyToPage,
  onProductSaved,
  onNotice
}: SlotFieldProps) => {
  const [error, setError] = useState<LookupError>()
  const [focusPrice, setFocusPrice] = useState(false)
  const [priceBrought, setPriceBrought] = useState(false)
  const [searching, startSearch] = useTransition()
  // Holds the code the dialog starts from, if any, while it is open
  const [creating, setCreating] = useState<{ missingCode?: string }>()
  const [choice, setChoice] = useState<ProductChoice>()
  const [choosing, setChoosing] = useState(false)
  const codeInput = useRef<HTMLInputElement>(null)
  const suggestions = useProductSuggestions()
  const label = `Produto ${position + 1}`
  const labelId = `${id}-label`
  const priceId = `${id}-price`

  // Returns whether the product went in, since a product the page already has stays out
  const placeProduct = (product: Product) => {
    suggestions.close()
    suggestions.setQuery('')
    const conflict = getPageConflict(pages[pageIndex], product)
    if (conflict === 'same-product') {
      setError({
        kind: 'message',
        message: `${product.description} já está nesta página.`
      })
      return false
    }
    setError(undefined)
    // The product keeps one price across the offer (#93), so it comes with the price it has elsewhere
    const priceInCents = findProductPrice(pages, product.id)
    setPriceBrought(priceInCents > 0)
    onChange({ product, priceInCents })
    if (conflict === 'shared-code') {
      toast.dismiss()
      toast.warning(
        `A página ${pageIndex + 1} já tem outro produto com um código de ${product.description}.`,
        { duration: 10_000 }
      )
    }
    return true
  }

  // The price only exists once the product went in
  const getPriceInput = () =>
    document.querySelector<HTMLElement>(`#${CSS.escape(priceId)}`) ??
    codeInput.current

  const moveToPage = (target: MoveTarget) => {
    // The product that comes in a trade must not take the focus from a scan that is long gone
    setFocusPrice(false)
    setPriceBrought(false)
    const emptiesSlot =
      target.kind === 'new-page' ||
      pages[target.to.page].slots[target.to.position] === null
    flushSync(() => onMoveToPage(target))
    if (emptiesSlot) codeInput.current?.focus()
  }

  const dialog = (
    <>
      <ProductChoiceDialog
        open={choosing}
        choice={choice}
        onOpenChange={setChoosing}
        onChoose={(product) => {
          // The dialog moves the focus to the price once it closes
          setFocusPrice(false)
          placeProduct(product)
        }}
        getFocusAfterChoice={getPriceInput}
      />
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
          const placed = placeProduct(product)
          if (placed && outcome === 'unchanged') {
            onNotice(
              `${product.description} já estava cadastrado, e nenhum dado mudou.`
            )
          }
        }}
        getFocusAfterSave={getPriceInput}
        onOpenExisting={({ code, products }) => {
          if (products.length > 1) {
            setChoice({ code, products })
            setChoosing(true)
            return
          }
          // The dialog moves the focus to the price once it closes
          setFocusPrice(false)
          placeProduct(products[0])
        }}
        openExistingLabel="Usar produto cadastrado"
        getFocusAfterOpen={getPriceInput}
      />
    </>
  )

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = codeInput.current?.value ?? ''
    suggestions.close()

    startSearch(async () => {
      const result = await lookupSlotProduct(code)
      if (result.status === 'found') {
        // A scan fills the slot and the price is the next thing to type
        setFocusPrice(placeProduct(result.product))
        return
      }
      if (result.status === 'choose') {
        setError(undefined)
        // Closing without a choice must not leave the code for the next scan to append to
        suggestions.setQuery('')
        setChoice({ code: result.code, products: result.products })
        setChoosing(true)
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
              <Autocomplete
                items={suggestions.suggestions}
                value={suggestions.query}
                onValueChange={(text, { reason }) => {
                  // Covers a click, Enter on the highlighted item and a drag onto it, which fires no click
                  if (reason !== 'item-press') {
                    suggestions.suggest(text)
                    return
                  }
                  const product = suggestions.suggestions.find(
                    ({ id }) => id === text
                  )
                  if (!product) return
                  // Like a scan, the price is the next thing to type
                  setFocusPrice(placeProduct(product))
                }}
                open={suggestions.open}
                onOpenChange={suggestions.onOpenChange}
                itemToStringValue={(product: Product) => product.id}
                filter={null}
              >
                <AutocompleteInput
                  ref={codeInput}
                  id={`${id}-code`}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Código ou descrição"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="font-mono placeholder:font-sans"
                />
                <ProductSuggestions
                  suggestions={suggestions.suggestions}
                  suggesting={suggestions.suggesting}
                />
              </Autocomplete>
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
                src={getPhotoUrl(product.id, photoVersion)}
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
            <p className="font-medium wrap-break-word">{product.description}</p>
            {product.unit && (
              <p className="text-sm text-muted-foreground">{product.unit}</p>
            )}
          </div>
          <EditProductDialog
            product={product}
            photoVersion={photoVersion}
            noEanImages={noEanImages}
            onSaved={onProductSaved}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Tirar ${product.description} da página`}
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
          key={product.id}
          id={priceId}
          productName={product.description}
          priceInCents={priceInCents}
          autoFocus={focusPrice}
          selectOnFocus={priceBrought}
          otherPages={findOtherPagesWithProduct(pages, product.id, pageIndex)}
          onChange={(cents) => onPriceChange(product.id, cents)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            id={`${id}-move-before`}
            variant="outline"
            size="sm"
            disabled={!canMoveBefore}
            focusableWhenDisabled
            aria-label={`Mover ${product.description} para antes`}
            onClick={() => onMove(position - 1)}
          >
            <ArrowLeft data-icon="inline-start" aria-hidden />
            Antes
          </Button>
          <Button
            id={`${id}-move-after`}
            variant="outline"
            size="sm"
            disabled={!canMoveAfter}
            focusableWhenDisabled
            aria-label={`Mover ${product.description} para depois`}
            onClick={() => onMove(position + 1)}
          >
            Depois
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
          <MoveProductButton
            id={`${id}-move-page`}
            product={product}
            pages={pages}
            from={{ page: pageIndex, position }}
            onMove={moveToPage}
            onCopy={onCopyToPage}
          />
        </div>
      </div>
      {dialog}
    </>
  )
}
