'use client'

import { CircleAlert, Info } from 'lucide-react'
import {
  type KeyboardEvent,
  type RefObject,
  useId,
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
import { getCodeType, normalizeCode, type Product } from '@/domain/product'

import { lookupProduct, type LookupResult } from './actions'
import { AddCodeToProduct } from './add-code-to-product'
import type { ProductChoice } from './product-choice-dialog'
import { ProductForm } from './product-form'
import { getLookupMessage } from './product-lookup'

type SaveOutcome = 'saved' | 'unchanged'

type CreateProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  missingCode?: string
  noEanImages: string[]
  onSaved: (product: Product, outcome: SaveOutcome) => void
  getFocusAfterSave: () => HTMLElement | null
  // Takes the store's products that already have the typed code, instead of registering another
  onOpenExisting: (choice: ProductChoice) => void
  openExistingLabel: string
  getFocusAfterOpen: () => HTMLElement | null
}

type CreateProductContentProps = Pick<
  CreateProductDialogProps,
  'missingCode' | 'noEanImages' | 'onSaved' | 'openExistingLabel'
> & {
  onOpenExisting: (choice: ProductChoice) => void
  codeInput: RefObject<HTMLInputElement | null>
}

type DialogLookup = Exclude<LookupResult, { status: 'error' }>

// A scanner sends Enter after the code, which would submit the form before the lookup
const goToName = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== 'Enter') return
  event.preventDefault()
  const name = event.currentTarget.form?.elements.namedItem('name')
  if (name instanceof HTMLInputElement) name.focus()
}

const getLookedUpCode = (lookup: DialogLookup | undefined) => lookup?.code ?? ''

const getDescription = (lookup: DialogLookup | undefined) => {
  if (!lookup) return 'Bipe ou digite o código e preencha os dados do produto.'
  if (lookup.status !== 'found') return getLookupMessage({ ...lookup, id: 0 })

  const [first, ...others] = lookup.products
  return others.length === 0
    ? `Este código já está cadastrado em ${first.name}.`
    : `Este código já está cadastrado em ${others.length + 1} produtos.`
}

const CreateProductContent = ({
  missingCode,
  noEanImages,
  onSaved,
  onOpenExisting,
  openExistingLabel,
  codeInput
}: CreateProductContentProps) => {
  const [code, setCode] = useState(missingCode ?? '')
  const [lookup, setLookup] = useState<DialogLookup | undefined>(() =>
    missingCode
      ? { status: 'new', code: missingCode, codeType: getCodeType(missingCode) }
      : undefined
  )
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
      if (result.status === 'catalog') setFilledCount((count) => count + 1)
    })
  }

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
        focusName={filledCount > 0 || missingCode !== undefined}
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
              onKeyDown={goToName}
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
  missingCode,
  noEanImages,
  onSaved,
  getFocusAfterSave,
  onOpenExisting,
  openExistingLabel,
  getFocusAfterOpen
}: CreateProductDialogProps) => {
  const closedBy = useRef<'save' | 'open'>(undefined)
  const codeInput = useRef<HTMLInputElement>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) closedBy.current = undefined
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-2xl sm:p-6"
        // The photo input comes first in the form, so the code (or, when it is known, the name
        // the form focuses itself) has to be picked explicitly
        initialFocus={missingCode === undefined ? codeInput : false}
        finalFocus={() => {
          if (closedBy.current === 'save') return getFocusAfterSave()
          // A product choice that opens next takes the focus itself
          if (closedBy.current === 'open') return getFocusAfterOpen() ?? false
          return true
        }}
      >
        {/* The popup unmounts when closed, so every opening starts from an empty form */}
        <CreateProductContent
          missingCode={missingCode}
          noEanImages={noEanImages}
          codeInput={codeInput}
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
      </DialogContent>
    </Dialog>
  )
}
