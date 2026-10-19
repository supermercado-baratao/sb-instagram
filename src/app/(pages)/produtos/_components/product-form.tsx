'use client'

import { CircleAlert, ImageOff, Save } from 'lucide-react'
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
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
  type Product
} from '@/domain/product'

import { saveProductForm } from '../actions'
import { CatalogImagePicker } from './catalog-image-picker'

type ProductFormProps = {
  code: string
  product: Product | undefined
  hasPhoto: boolean
  photoVersion: number
  noEanImages: string[]
  onSaved: (product: Product) => void
}

export const ProductForm = ({
  code,
  product,
  hasPhoto,
  photoVersion,
  noEanImages,
  onSaved
}: ProductFormProps) => {
  const [uploadPreview, setUploadPreview] = useState<string>()
  const [catalogImage, setCatalogImage] = useState('')
  const [error, setError] = useState<string>()
  const [photoError, setPhotoError] = useState<string>()
  const [saving, startSave] = useTransition()
  const nameInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const isInternal = getCodeType(code) === 'internal'

  useEffect(() => {
    nameInput.current?.focus()
  }, [])

  useEffect(
    () => () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    },
    [uploadPreview]
  )

  const savedPhoto = hasPhoto
    ? `/fotos/${encodeURIComponent(code)}?v=${photoVersion}`
    : undefined
  const catalogPreview = catalogImage
    ? `/catalogo/sem-ean/${catalogImage}`
    : undefined
  const preview = uploadPreview ?? catalogPreview ?? savedPhoto

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

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    startSave(async () => {
      const result = await saveProductForm(formData)
      if (result.status === 'error') {
        setError(result.message)
        return
      }
      onSaved(result.product)
    })
  }

  return (
    <form
      onSubmit={save}
      aria-labelledby="product-form-title"
      className="flex flex-col gap-6 rounded-xl border border-border p-4 sm:p-6"
    >
      <input type="hidden" name="code" value={code} />
      <h2 id="product-form-title" className="sr-only">
        Dados do produto
      </h2>

      <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex aspect-square w-full max-w-48 items-center justify-center self-center overflow-hidden rounded-lg bg-muted sm:max-w-none">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- the photo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
              <img
                src={preview}
                alt={`Foto do produto ${code}`}
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
            <FieldLabel htmlFor="photo">Enviar foto</FieldLabel>
            <Input
              ref={photoInput}
              id="photo"
              name="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={choosePhoto}
              aria-invalid={photoError ? true : undefined}
              aria-describedby="photo-description"
            />
            <FieldDescription id="photo-description" aria-live="polite">
              {photoError ??
                `JPG, PNG ou WebP de até ${PHOTO_MAX_MEGABYTES} MB.`}
            </FieldDescription>
          </Field>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="product-code">Código</FieldLabel>
            <Input
              id="product-code"
              value={code}
              readOnly
              className="font-mono"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input
              ref={nameInput}
              id="name"
              name="name"
              required
              autoComplete="off"
              defaultValue={product?.name}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="brand">Marca</FieldLabel>
              <Input
                id="brand"
                name="brand"
                autoComplete="off"
                defaultValue={product?.brand ?? ''}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="unit">Unidade</FieldLabel>
              <Input
                id="unit"
                name="unit"
                autoComplete="off"
                placeholder="Ex.: 1 kg, 395 g, 2 L"
                defaultValue={product?.unit ?? ''}
              />
            </Field>
          </div>
        </FieldGroup>
      </div>

      {isInternal && (
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
  )
}
