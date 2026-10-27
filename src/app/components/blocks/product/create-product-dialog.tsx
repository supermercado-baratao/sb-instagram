'use client'

import { CircleAlert } from 'lucide-react'
import {
  type KeyboardEvent,
  type RefObject,
  useId,
  useRef,
  useState,
  useTransition
} from 'react'

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
}

type CreateProductContentProps = Pick<
  CreateProductDialogProps,
  'missingCode' | 'noEanImages' | 'onSaved'
> & {
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

const getLookedUpCode = (lookup: DialogLookup | undefined) => {
  if (!lookup) return ''
  return lookup.status === 'catalog' ? lookup.product.code : lookup.code
}

const getDescription = (lookup: DialogLookup | undefined) => {
  if (!lookup) return 'Bipe ou digite o código e preencha os dados do produto.'
  if (lookup.status !== 'found') return getLookupMessage({ ...lookup, id: 0 })

  // A code may be in several products, so a new one is registered unless every code matches (#55)
  const [first] = lookup.products
  const where =
    lookup.products.length === 1
      ? `Este código já está em ${first.name}.`
      : `Este código já está em ${lookup.products.length} produtos.`
  return `${where} Com outros códigos junto, o app cadastra um produto novo; com os mesmos códigos de um produto, mostra o que muda antes de substituir.`
}

const CreateProductContent = ({
  missingCode,
  noEanImages,
  onSaved,
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
      <ProductForm
        key={filledCount}
        codes={[]}
        product={catalogProduct}
        photoUrl={catalogProduct && getCatalogPhotoUrl(catalogProduct.code)}
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
  getFocusAfterSave
}: CreateProductDialogProps) => {
  const saved = useRef(false)
  const codeInput = useRef<HTMLInputElement>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) saved.current = false
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-2xl sm:p-6"
        // The photo input comes first in the form, so the code (or, when it is known, the name
        // the form focuses itself) has to be picked explicitly
        initialFocus={missingCode === undefined ? codeInput : false}
        finalFocus={() => (saved.current ? getFocusAfterSave() : true)}
      >
        {/* The popup unmounts when closed, so every opening starts from an empty form */}
        <CreateProductContent
          missingCode={missingCode}
          noEanImages={noEanImages}
          codeInput={codeInput}
          onSaved={(product, outcome) => {
            saved.current = true
            onSaved(product, outcome)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
