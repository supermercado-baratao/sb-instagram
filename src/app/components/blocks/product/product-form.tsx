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
  type Product
} from '@/domain/product'

import { saveProductForm } from './actions'
import { CatalogImagePicker } from './catalog-image-picker'
import { ExtraCodesField } from './extra-codes-field'
import {
  ReplaceProductDialog,
  type ReplaceRequest
} from './replace-product-dialog'

const NO_EXTRA_CODES: string[] = []

type ProductFormProps = {
  code: string
  product: Product | undefined
  extraCodes?: string[]
  hasPhoto: boolean
  photoVersion: number
  noEanImages: string[]
  onSaved: (product: Product, outcome: 'saved' | 'unchanged') => void
  askBeforeReplacing?: boolean
  // Replaces the read-only code, so the dialog can take the code in the form itself
  codeField?: ReactNode
  focusName?: boolean
  className?: string
}

export const ProductForm = ({
  code,
  product,
  extraCodes = NO_EXTRA_CODES,
  hasPhoto,
  photoVersion,
  noEanImages,
  onSaved,
  askBeforeReplacing = false,
  codeField,
  focusName = true,
  className
}: ProductFormProps) => {
  const [uploadPreview, setUploadPreview] = useState<string>()
  const [codes, setCodes] = useState(extraCodes)
  // The dialog finds the product after the form mounts, and keeps what was typed in the rest of it
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [loadedCodes, setLoadedCodes] = useState(extraCodes)
  if (loadedCodes !== extraCodes) {
    setLoadedCodes(extraCodes)
    setCodes(extraCodes)
  }
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
  const isInternal = code !== '' && getCodeType(code) === 'internal'

  useEffect(() => {
    if (focusName) nameInput.current?.focus()
  }, [focusName])

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

  return (
    <>
      <form
        onSubmit={save}
        aria-labelledby={`${id}-title`}
        className={cn('flex flex-col gap-6', className)}
      >
        {!codeField && <input type="hidden" name="code" value={code} />}
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
                  alt={code ? `Foto do produto ${code}` : 'Foto do produto'}
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
            {codeField ?? (
              <Field>
                <FieldLabel htmlFor={`${id}-code`}>Código</FieldLabel>
                <Input
                  id={`${id}-code`}
                  value={code}
                  readOnly
                  className="font-mono"
                />
              </Field>
            )}
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
            <ExtraCodesField
              productCode={code}
              codes={codes}
              onChange={setCodes}
            />
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
      <ReplaceProductDialog
        open={replaceOpen}
        request={replaceRequest}
        onCancel={() => setReplaceOpen(false)}
        onConfirm={confirmReplace}
      />
    </>
  )
}
