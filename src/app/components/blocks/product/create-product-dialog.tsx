'use client'

import { CircleAlert, Info } from 'lucide-react'
import {
  type KeyboardEvent,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition
} from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/app/components/ui/shadcn/dialog'
import { Field, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { getCatalogPhotoUrl } from '@/app/helpers/product-photo'
import { useGuardedDialog } from '@/app/hooks/use-guarded-dialog'
import { normalizeCode, type Product } from '@/models/product/product'

import { lookupProduct, type LookupResult } from './actions'
import { AddCodeToProduct } from './add-code-to-product'
import type { ProductChoice } from './product-choice-dialog'
import { ProductForm } from './product-form'
import { getLookupMessage } from './product-lookup'

type SaveOutcome = 'saved' | 'unchanged'

type DialogLookup = Exclude<LookupResult, { status: 'error' }>

// What the dialog can start from: a code no product has, or a catalog product to register
export type CreateProductStart = Extract<
  DialogLookup,
  { status: 'new' | 'catalog' }
>

type CreateProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLookup?: CreateProductStart
  noEanImages: string[]
  onSaved: (product: Product, outcome: SaveOutcome) => void
  getFocusAfterSave: () => HTMLElement | null
  // Takes the store's products that already have the typed code, instead of registering another
  onOpenExisting: (choice: ProductChoice) => void
  openExistingLabel: string
  getFocusAfterOpen: () => HTMLElement | null
  getFocusAfterClose?: () => HTMLElement | null
}

type CreateProductContentProps = Pick<
  CreateProductDialogProps,
  'initialLookup' | 'noEanImages' | 'onSaved' | 'openExistingLabel'
> & {
  onOpenExisting: (choice: ProductChoice) => void
  onDirtyChange: (dirty: boolean) => void
  codeInput: RefObject<HTMLInputElement | null>
}

// A scanner sends Enter after the code, which would submit the form before the lookup
const goToDescription = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== 'Enter') return
  event.preventDefault()
  const description =
    event.currentTarget.form?.elements.namedItem('description')
  if (description instanceof HTMLInputElement) description.focus()
}

const getLookedUpCode = (lookup: DialogLookup | undefined) => lookup?.code ?? ''

const getDescription = (lookup: DialogLookup | undefined) => {
  if (!lookup) return 'Bipe ou digite o código e preencha os dados do produto.'
  if (lookup.status !== 'found') return getLookupMessage(lookup)

  const [first, ...others] = lookup.products
  return others.length === 0
    ? `Este código já está cadastrado em ${first.description}.`
    : `Este código já está cadastrado em ${others.length + 1} produtos.`
}

const CreateProductContent = ({
  initialLookup,
  noEanImages,
  onSaved,
  onOpenExisting,
  onDirtyChange,
  openExistingLabel,
  codeInput
}: CreateProductContentProps) => {
  const [code, setCode] = useState(initialLookup?.code ?? '')
  const [lookup, setLookup] = useState<DialogLookup | undefined>(initialLookup)
  // A catalog product fills the form, so what changed is told from what it brought
  const [filledCode, setFilledCode] = useState(initialLookup?.code ?? '')
  const [formDirty, setFormDirty] = useState(false)
  const dirty = formDirty || normalizeCode(code) !== filledCode
  // Only a catalog product refills the form: a new code keeps what was typed, and a code the
  // store already has keeps it too, so saving can show what would change before replacing it
  const [filledCount, setFilledCount] = useState(0)
  const [error, setError] = useState<string>()
  const [searching, startSearch] = useTransition()
  const id = useId()
  const errorId = `${id}-error`
  const lookedUpCode = getLookedUpCode(lookup)
  const catalogProduct =
    lookup?.status === 'catalog' ? lookup.product : undefined

  const search = () => {
    const value = normalizeCode(code)
    if (value === '' || value === lookedUpCode) return

    startSearch(async () => {
      const result = await lookupProduct(value)
      if (result.status === 'error') {
        setError(result.message)
        // A scanner types the next code where the cursor is, so the wrong one must be replaced
        codeInput.current?.select()
        return
      }
      setError(undefined)
      setLookup(result)
      setCode(getLookedUpCode(result))
      if (result.status === 'catalog') {
        setFilledCount((count) => count + 1)
        setFilledCode(result.code)
      }
    })
  }

  // A layout effect, like `ProductForm`'s, so an Esc right after typing still asks
  useLayoutEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cadastrar produto</DialogTitle>
        <DialogDescription aria-live="polite">
          {getDescription(lookup)}
        </DialogDescription>
      </DialogHeader>
      {lookup?.status === 'new' && (
        <AddCodeToProduct
          // A new code starts a new search
          key={lookup.code}
          code={lookup.code}
          onAdded={(product) => onSaved(product, 'saved')}
        />
      )}
      <ProductForm
        key={filledCount}
        codes={
          catalogProduct?.codes.filter((other) => other !== lookedUpCode) ?? []
        }
        product={catalogProduct}
        photoUrl={catalogProduct && getCatalogPhotoUrl(catalogProduct.ean)}
        catalogEan={catalogProduct?.ean}
        noEanImages={noEanImages}
        onSaved={onSaved}
        askBeforeReplacing
        focusDescription={filledCount > 0 || initialLookup !== undefined}
        onDirtyChange={setFormDirty}
        // The looked-up code, so the picker doesn't come and go on every keystroke
        typedCode={lookedUpCode}
        codeField={
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={`${id}-code`}>
              Código de barras ou código interno
            </FieldLabel>
            <Input
              ref={codeInput}
              id={`${id}-code`}
              name="code"
              required
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(event) => setCode(event.currentTarget.value)}
              onKeyDown={goToDescription}
              onBlur={search}
              aria-busy={searching || undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="font-mono"
            />
            {error && (
              <p
                id={errorId}
                className="flex items-center gap-2 text-sm text-destructive"
              >
                <CircleAlert className="size-4 shrink-0" />
                {error}
              </p>
            )}
            {lookup?.status === 'found' && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted px-3 py-2 text-sm">
                <p className="flex items-center gap-2">
                  <Info className="size-4 shrink-0" aria-hidden />
                  {/* A code may be in several products, so a new one is registered unless every
                      code matches (#55) */}
                  Use o que já existe ou, para cadastrar outro produto com este
                  código, junte outros códigos.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onOpenExisting({
                      code: lookup.code,
                      products: lookup.products
                    })
                  }
                >
                  {openExistingLabel}
                </Button>
              </div>
            )}
          </Field>
        }
      />
    </>
  )
}

export const CreateProductDialog = ({
  open,
  onOpenChange,
  initialLookup,
  noEanImages,
  onSaved,
  getFocusAfterSave,
  onOpenExisting,
  openExistingLabel,
  getFocusAfterOpen,
  getFocusAfterClose
}: CreateProductDialogProps) => {
  const closedBy = useRef<'save' | 'open'>(undefined)
  const codeInput = useRef<HTMLInputElement>(null)
  const [dirty, setDirty] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  const guard = useGuardedDialog({ open, dirty, onOpenChange })

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDirty(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={guard.onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) closedBy.current = undefined
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-2xl sm:p-6"
        // The photo input comes first in the form, so the code (or, when it is known, the description
        // the form focuses itself) has to be picked explicitly
        initialFocus={initialLookup === undefined ? codeInput : false}
        finalFocus={() => {
          if (closedBy.current === 'save') return getFocusAfterSave()
          // A product choice that opens next takes the focus itself
          if (closedBy.current === 'open') return getFocusAfterOpen() ?? false
          return getFocusAfterClose?.() ?? true
        }}
      >
        {/* The popup unmounts when closed, so every opening starts from what it is given */}
        <CreateProductContent
          initialLookup={initialLookup}
          noEanImages={noEanImages}
          codeInput={codeInput}
          onDirtyChange={setDirty}
          onSaved={(product, outcome) => {
            closedBy.current = 'save'
            onSaved(product, outcome)
            onOpenChange(false)
          }}
          onOpenExisting={(choice) => {
            closedBy.current = 'open'
            onOpenExisting(choice)
            onOpenChange(false)
          }}
          openExistingLabel={openExistingLabel}
        />
        {guard.leaveDialog}
      </DialogContent>
    </Dialog>
  )
}
