'use client'

import { cn } from 'cn'
import { CircleAlert, ImageOff, Save, Sparkles } from 'lucide-react'
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition
} from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import {
  getCodeType,
  isSameCodeSet,
  PHOTO_MAX_MEGABYTES,
  type Product,
  type ProductDetails
} from '@/domain/product'

import { saveProductForm, suggestProductVoiceText } from './actions'
import { CatalogImagePicker } from './catalog-image-picker'
import { CodesField } from './codes-field'
import {
  ReplaceProductDialog,
  type ReplaceRequest
} from './replace-product-dialog'

type ProductFormProps = {
  // Left out for a new product
  productId?: string
  codes: string[]
  // A catalog product has no voice text yet
  product?: ProductDetails & Partial<Pick<Product, 'voiceText'>>
  photoUrl?: string
  // The catalog image photoUrl shows, copied when a new product is saved
  catalogEan?: string
  noEanImages: string[]
  onSaved: (product: Product, outcome: 'saved' | 'unchanged') => void
  askBeforeReplacing?: boolean
  // Takes the first code in the dialog, which looks it up, so the codes field lists the others
  codeField?: ReactNode
  // The value of codeField, which decides like the other codes whether the picker shows
  typedCode?: string
  focusName?: boolean
  className?: string
}

export const ProductForm = ({
  productId,
  codes: initialCodes,
  product,
  photoUrl,
  catalogEan,
  noEanImages,
  onSaved,
  askBeforeReplacing = false,
  codeField,
  typedCode = '',
  focusName = true,
  className
}: ProductFormProps) => {
  const [uploadPreview, setUploadPreview] = useState<string>()
  const [codes, setCodes] = useState(initialCodes)
  const [seededCodes, setSeededCodes] = useState(initialCodes)
  const [catalogImage, setCatalogImage] = useState('')
  const [error, setError] = useState<string>()
  const [photoError, setPhotoError] = useState<string>()
  const [saving, startSave] = useTransition()
  const [voiceText, setVoiceText] = useState(product?.voiceText ?? '')
  const [suggesting, startSuggest] = useTransition()
  const [replaceRequest, setReplaceRequest] = useState<ReplaceRequest>()
  const [replaceOpen, setReplaceOpen] = useState(false)
  const pendingForm = useRef<FormData>(undefined)
  const form = useRef<HTMLFormElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const voiceInput = useRef<HTMLInputElement>(null)
  const suggestButton = useRef<HTMLButtonElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  // The dialog can open over the form on /produtos, so ids must not repeat
  const id = useId()
  // A later lookup in the dialog takes back the codes a catalog product brought, keeping the typed ones
  if (!isSameCodeSet(seededCodes, initialCodes)) {
    setSeededCodes(initialCodes)
    setCodes([
      ...new Set([
        ...codes.filter((code) => !seededCodes.includes(code)),
        ...initialCodes
      ])
    ])
  }
  const allCodes = typedCode === '' ? codes : [typedCode, ...codes]
  // The catalog has its own images for EANs, so the no-EAN ones are only for the other products
  const showPicker =
    allCodes.length > 0 &&
    allCodes.every((code) => getCodeType(code) === 'internal')

  useEffect(() => {
    if (focusName) nameInput.current?.focus()
  }, [focusName])

  useEffect(
    () => () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    },
    [uploadPreview]
  )

  // An EAN added after picking hides the picker, and the server ignores the picked image
  const catalogPreview =
    showPicker && catalogImage ? `/catalogo/sem-ean/${catalogImage}` : undefined
  const preview = uploadPreview ?? catalogPreview ?? photoUrl

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file && file.size > PHOTO_MAX_MEGABYTES * 1024 * 1024) {
      setPhotoError(`A foto precisa ter no máximo ${PHOTO_MAX_MEGABYTES} MB.`)
      event.currentTarget.value = ''
      setUploadPreview(undefined)
      return
    }
    setPhotoError(undefined)
    setCatalogImage('')
    setUploadPreview(file ? URL.createObjectURL(file) : undefined)
  }

  const chooseCatalogImage = (name: string) => {
    setCatalogImage(name)
    setUploadPreview(undefined)
    if (photoInput.current) photoInput.current.value = ''
  }

  const suggestVoiceText = () => {
    if (!form.current) return
    const formData = new FormData(form.current)
    const read = (name: string) => {
      const value = formData.get(name)
      return typeof value === 'string' ? value : ''
    }
    startSuggest(async () => {
      try {
        setVoiceText(
          await suggestProductVoiceText({
            name: read('name'),
            brand: read('brand'),
            unit: read('unit')
          })
        )
      } catch {
        // A suggestion is optional, so failing it must not cost the form what was typed
        toast.error('Não foi possível sugerir o texto. Tente de novo.', {
          duration: Infinity
        })
        return
      }
      // Someone who moved on while it loaded keeps the focus where they went
      if (document.activeElement === suggestButton.current) {
        voiceInput.current?.focus()
      }
    })
  }

  const send = (formData: FormData) => {
    startSave(async () => {
      const result = await saveProductForm(formData)
      if (result.status === 'error') {
        setError(result.message)
        return
      }
      setError(undefined)
      if (result.status === 'confirm') {
        pendingForm.current = formData
        setReplaceRequest(result)
        setReplaceOpen(true)
        return
      }
      onSaved(result.product, result.status)
    })
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    send(new FormData(event.currentTarget))
  }

  const confirmReplace = () => {
    setReplaceOpen(false)
    const formData = pendingForm.current
    if (!formData) return
    formData.set('replace', 'confirmed')
    send(formData)
  }

  const codesField = (
    <CodesField
      codes={codes}
      onChange={setCodes}
      others={codeField !== undefined}
      codeFieldValue={typedCode}
    />
  )

  return (
    <>
      <form
        ref={form}
        onSubmit={save}
        aria-labelledby={`${id}-title`}
        className={cn('flex flex-col gap-6', className)}
      >
        {productId && <input type="hidden" name="id" value={productId} />}
        {catalogEan && (
          <input type="hidden" name="catalogEan" value={catalogEan} />
        )}
        {askBeforeReplacing && (
          <input type="hidden" name="replace" value="ask" />
        )}
        <h2 id={`${id}-title`} className="sr-only">
          Dados do produto
        </h2>

        <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
          <div className="flex flex-col gap-3">
            <div className="flex aspect-square w-full max-w-48 items-center justify-center self-center overflow-hidden rounded-lg bg-muted sm:max-w-none">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- the photo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
                <img
                  src={preview}
                  alt={
                    product?.name
                      ? `Foto do produto ${product.name}`
                      : 'Foto do produto'
                  }
                  className="size-full object-contain"
                />
              ) : (
                <ImageOff
                  role="img"
                  aria-label="Sem foto"
                  className="size-10 text-muted-foreground"
                />
              )}
            </div>
            <Field data-invalid={photoError ? true : undefined}>
              <FieldLabel htmlFor={`${id}-photo`}>Enviar foto</FieldLabel>
              <Input
                ref={photoInput}
                id={`${id}-photo`}
                name="photo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={choosePhoto}
                aria-invalid={photoError ? true : undefined}
                aria-describedby={`${id}-photo-description`}
              />
              <FieldDescription
                id={`${id}-photo-description`}
                aria-live="polite"
              >
                {photoError ??
                  `JPG, PNG ou WebP de até ${PHOTO_MAX_MEGABYTES} MB.`}
              </FieldDescription>
            </Field>
          </div>

          <FieldGroup>
            {codeField ?? codesField}
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Nome</FieldLabel>
              <Input
                ref={nameInput}
                id={`${id}-name`}
                name="name"
                required
                autoComplete="off"
                defaultValue={product?.name}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-brand`}>Marca</FieldLabel>
                <Input
                  id={`${id}-brand`}
                  name="brand"
                  autoComplete="off"
                  defaultValue={product?.brand ?? ''}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-unit`}>Unidade</FieldLabel>
                <Input
                  id={`${id}-unit`}
                  name="unit"
                  autoComplete="off"
                  placeholder="Ex.: 1 kg, 395 g, 2 L"
                  defaultValue={product?.unit ?? ''}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`${id}-voice-text`}>
                Texto da locução
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  ref={voiceInput}
                  id={`${id}-voice-text`}
                  name="voiceText"
                  autoComplete="off"
                  aria-describedby={`${id}-voice-text-description`}
                  value={voiceText}
                  onChange={(event) => setVoiceText(event.target.value)}
                />
                <Button
                  ref={suggestButton}
                  type="button"
                  variant="outline"
                  aria-label={
                    suggesting
                      ? 'Sugerindo texto da locução…'
                      : 'Sugerir texto da locução'
                  }
                  disabled={suggesting}
                  focusableWhenDisabled
                  onClick={suggestVoiceText}
                >
                  {suggesting ? (
                    <Spinner data-icon="inline-start" aria-hidden />
                  ) : (
                    <Sparkles data-icon="inline-start" aria-hidden />
                  )}
                  {suggesting ? 'Sugerindo…' : 'Sugerir'}
                </Button>
              </div>
              <FieldDescription id={`${id}-voice-text-description`}>
                Como o produto é falado no comercial da rádio, com números e
                medidas por extenso. Vazio, o comercial usa a sugestão. Sugerir
                troca o texto do campo.
              </FieldDescription>
            </Field>
            {codeField && codesField}
          </FieldGroup>
        </div>

        {showPicker && (
          <CatalogImagePicker
            images={noEanImages}
            value={catalogImage}
            onChange={chooseCatalogImage}
          />
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            aria-live="polite"
            className="flex min-h-5 items-center gap-2 text-sm text-destructive"
          >
            {error && (
              <>
                <CircleAlert className="size-4 shrink-0" />
                {error}
              </>
            )}
          </p>
          <Button
            type="submit"
            size="lg"
            disabled={saving}
            focusableWhenDisabled
            className="sm:ml-auto"
          >
            {saving ? (
              <Spinner data-icon="inline-start" aria-hidden />
            ) : (
              <Save data-icon="inline-start" aria-hidden />
            )}
            {saving ? 'Salvando…' : 'Salvar produto'}
          </Button>
        </div>
      </form>
      <ReplaceProductDialog
        open={replaceOpen}
        request={replaceRequest}
        onCancel={() => setReplaceOpen(false)}
        onConfirm={confirmReplace}
      />
    </>
  )
}
