'use client'

import { cn } from 'cn'
import { CircleAlert, ImageOff, Save } from 'lucide-react'
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

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import {
  getCodeType,
  PHOTO_MAX_MEGABYTES,
  type Product,
  type ProductDetails
} from '@/domain/product'

import { saveProductForm } from './actions'
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
  product?: ProductDetails
  photoUrl?: string
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
  const [catalogImage, setCatalogImage] = useState('')
  const [error, setError] = useState<string>()
  const [photoError, setPhotoError] = useState<string>()
  const [saving, startSave] = useTransition()
  const [replaceRequest, setReplaceRequest] = useState<ReplaceRequest>()
  const [replaceOpen, setReplaceOpen] = useState(false)
  const pendingForm = useRef<FormData>(undefined)
  const nameInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  // The dialog can open over the form on /produtos, so ids must not repeat
  const id = useId()
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
        onSubmit={save}
        aria-labelledby={`${id}-title`}
        className={cn('flex flex-col gap-6', className)}
      >
        {productId && <input type="hidden" name="id" value={productId} />}
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
            <Save data-icon="inline-start" />
            Salvar produto
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
