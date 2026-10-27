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
import { getCodeType, normalizeCode, type Product } from '@/domain/product'

import { lookupProduct } from './actions'
import { ProductForm } from './product-form'
import {
  getLookupMessage,
  getProductFormProps,
  type ProductLookup
} from './product-lookup'

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

// A scanner sends Enter after the code, which would submit the form before the lookup
const goToName = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== 'Enter') return
  event.preventDefault()
  const name = event.currentTarget.form?.elements.namedItem('name')
  if (name instanceof HTMLInputElement) name.focus()
}

const getDescription = (lookup: ProductLookup | undefined) => {
  if (!lookup) return 'Bipe ou digite o código e preencha os dados do produto.'
  if (lookup.status !== 'found' || lookup.source !== 'instance') {
    return getLookupMessage(lookup)
  }
  return lookup.matchedCode === lookup.product.code
    ? `Este código já está cadastrado como ${lookup.product.name}. Ao salvar, o app mostra o que muda antes de substituir.`
    : `O código ${lookup.matchedCode} é um dos outros códigos de ${lookup.product.name}, que tem o código ${lookup.product.code}. Ao salvar, o app mostra o que muda antes de substituir.`
}

const CreateProductContent = ({
  missingCode,
  noEanImages,
  onSaved,
  codeInput
}: CreateProductContentProps) => {
  const [code, setCode] = useState(missingCode ?? '')
  const [lookup, setLookup] = useState<ProductLookup | undefined>(() =>
    missingCode
      ? {
          status: 'new',
          code: missingCode,
          codeType: getCodeType(missingCode),
          id: 0
        }
      : undefined
  )
  // Only a catalog product refills the form: a new code keeps what was typed, and a code the
  // store already has keeps it too, so saving can show what would change before replacing it
  const [filledCount, setFilledCount] = useState(0)
  const [error, setError] = useState<string>()
  const [searching, startSearch] = useTransition()
  const id = useId()
  const errorId = `${id}-error`
  const lookedUpCode = lookup ? getProductFormProps(lookup).code : ''
  // A product the store already has stays out of the form, which only prefills from the catalog
  const catalogProduct =
    lookup?.status === 'found' && lookup.source === 'catalog'
      ? lookup.product
      : undefined

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
      setLookup({ ...result, id: Date.now() })
      if (result.status === 'new') {
        setCode(result.code)
        return
      }
      setCode(result.product.code)
      if (result.source === 'catalog') setFilledCount((count) => count + 1)
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
        {...(lookup
          ? getProductFormProps(lookup)
          : { code: '', hasPhoto: false, photoVersion: 0 })}
        product={catalogProduct}
        noEanImages={noEanImages}
        onSaved={onSaved}
        askBeforeReplacing
        focusName={filledCount > 0 || missingCode !== undefined}
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
