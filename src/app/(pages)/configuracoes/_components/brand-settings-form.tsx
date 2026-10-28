'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { cn } from 'cn'
import { CircleAlert, ImageOff, Plus, Save, Trash2 } from 'lucide-react'
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition
} from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import { Poster } from '@/app/components/blocks/poster'
import { Button } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/shadcn/select'
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import { getPosterOffer, getPosterProducts } from '@/app/helpers/offer-poster'
import { useUnsavedChangesWarning } from '@/app/hooks/use-unsaved-changes-warning'
import {
  type BrandContent,
  type BrandContentError,
  getBrandContentError,
  INITIAL_TEMPLATES,
  normalizeInstagram
} from '@/domain/brand'
import { createOfferContent, createOfferPage } from '@/domain/offer'
import { DEFAULT_POSTER_LAYOUT } from '@/domain/poster'
import { PHOTO_MAX_MEGABYTES } from '@/domain/product'

import { saveBrandSettingsAction } from '../actions'
import { getTemplateLabel, TemplateFields } from './template-fields'

type BrandSettingsFormProps = {
  firstSetup: boolean
  initialContent: BrandContent
  initialLogoUrl: string | null
}

type Status = {
  kind: 'error' | 'info'
  message: string
  field?: BrandContentError['field'] | 'logo'
  // A new id remounts the message, so the same text twice in a row is announced again
  id: number
}

const FIELD_IDS: Record<NonNullable<Status['field']>, string> = {
  name: 'brand-name',
  instagram: 'brand-instagram',
  logo: 'brand-logo',
  templates: 'templates-heading'
}

const SAMPLE_OFFER = getPosterOffer(createOfferContent(''))
const SAMPLE_PRODUCTS = getPosterProducts(createOfferPage('').slots)

const getTemplateId = (key: number) => `template-${key}`

const STATUS_ID = 'brand-status'

export const BrandSettingsForm = ({
  firstSetup,
  initialContent,
  initialLogoUrl
}: BrandSettingsFormProps) => {
  const [content, setContent] = useState(initialContent)
  const [saved, setSaved] = useState(initialContent)
  // New templates have no id until they are saved, so each row gets a key that follows it
  const [templateKeys, setTemplateKeys] = useState(() =>
    initialContent.templates.map((_, index) => index)
  )
  const [previewKey, setPreviewKey] = useState(0)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [uploadPreview, setUploadPreview] = useState<string>()
  const [removeLogo, setRemoveLogo] = useState(false)
  const [status, setStatus] = useState<Status>()
  const [saving, startSave] = useTransition()
  const logoInput = useRef<HTMLInputElement>(null)
  const addTemplateButton = useRef<HTMLButtonElement>(null)
  const dirty = content !== saved || uploadPreview !== undefined || removeLogo
  const saveLabel = firstSetup ? 'Salvar e continuar' : 'Salvar'

  const previewIndex = Math.max(templateKeys.indexOf(previewKey), 0)
  const previewTemplate = content.templates[previewIndex]
  const currentLogo = uploadPreview ?? (removeLogo ? null : logoUrl)

  useUnsavedChangesWarning(dirty)

  useEffect(
    () => () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview)
    },
    [uploadPreview]
  )

  const update = (changes: Partial<BrandContent>) => {
    setContent((current) => ({ ...current, ...changes }))
    setStatus(undefined)
  }

  const show = (status: Omit<Status, 'id'>) => {
    flushSync(() => setStatus({ ...status, id: Date.now() }))
    if (!status.field) return
    const emptyName = content.templates.findIndex(
      (template) => template.name.trim() === ''
    )
    const fieldId =
      emptyName !== -1 && status.field === 'templates'
        ? `${getTemplateId(templateKeys[emptyName])}-name`
        : FIELD_IDS[status.field]
    document.querySelector<HTMLElement>(`#${fieldId}`)?.focus()
  }

  const chooseLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file && file.size > PHOTO_MAX_MEGABYTES * 1024 * 1024) {
      event.currentTarget.value = ''
      setUploadPreview(undefined)
      show({
        kind: 'error',
        field: 'logo',
        message: `O logo precisa ter no máximo ${PHOTO_MAX_MEGABYTES} MB.`
      })
      return
    }
    setStatus(undefined)
    setRemoveLogo(false)
    setUploadPreview(file ? URL.createObjectURL(file) : undefined)
  }

  const clearLogo = () => {
    if (logoInput.current) logoInput.current.value = ''
    setUploadPreview(undefined)
    setRemoveLogo(true)
    setStatus(undefined)
    logoInput.current?.focus()
  }

  const addTemplate = () => {
    const key = Math.max(-1, ...templateKeys) + 1
    const base = INITIAL_TEMPLATES[0].colors
    update({
      templates: [
        ...content.templates,
        { id: null, name: '', colors: { ...base } }
      ]
    })
    setTemplateKeys([...templateKeys, key])
    setPreviewKey(key)
  }

  const removeTemplate = (index: number) => {
    const label = getTemplateLabel(content.templates[index], index + 1)
    // The row goes away with the button that had focus, so it moves to the add button
    flushSync(() => {
      update({ templates: content.templates.toSpliced(index, 1) })
      setTemplateKeys(templateKeys.toSpliced(index, 1))
    })
    show({ kind: 'info', message: `${label} removido.` })
    addTemplateButton.current?.focus()
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const error = getBrandContentError(content)
    if (error) {
      show({ kind: 'error', ...error })
      return
    }

    const formData = new FormData(event.currentTarget)
    formData.set('content', JSON.stringify(content))
    formData.set('removeLogo', String(removeLogo))
    startSave(async () => {
      const result = await saveBrandSettingsAction(formData)
      if (result.status === 'error') {
        if (result.field) {
          show({ kind: 'error', field: result.field, message: result.message })
        } else {
          setStatus(undefined)
          // An error stays until it is closed, so it isn't missed (WCAG 2.2.1)
          toast.error(result.message, { duration: Infinity })
        }
        return
      }
      const savedContent = {
        ...content,
        instagram: normalizeInstagram(content.instagram),
        templates: result.templates
      }
      setContent(savedContent)
      setSaved(savedContent)
      setLogoUrl(result.logoUrl)
      setUploadPreview(undefined)
      setRemoveLogo(false)
      if (logoInput.current) logoInput.current.value = ''
      setStatus(undefined)
      toast.success('Configurações salvas.')
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstSetup ? 'Boas-vindas! Configure a sua marca' : 'Marca'}
        </h1>
        <p className="text-muted-foreground">
          {firstSetup
            ? 'Antes de montar as ofertas, conte como o mercado aparece nos pôsteres. Dá para mudar tudo depois.'
            : 'Como o mercado aparece em todos os pôsteres.'}
        </p>
      </header>

      <form
        noValidate
        onSubmit={save}
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="flex min-w-0 flex-col gap-10">
          <section
            aria-labelledby="identity-heading"
            className="flex flex-col gap-4"
          >
            <h2 id="identity-heading" className="text-lg font-semibold">
              Identidade
            </h2>
            <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
              <div className="flex flex-col gap-3">
                <div className="flex aspect-square w-full max-w-48 items-center justify-center self-center overflow-hidden rounded-lg bg-muted p-3 sm:max-w-none">
                  {currentLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the logo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
                    <img
                      src={currentLogo}
                      alt="Logo do mercado"
                      className="size-full object-contain"
                    />
                  ) : (
                    <ImageOff
                      role="img"
                      aria-label="Sem logo"
                      className="size-10 text-muted-foreground"
                    />
                  )}
                </div>
                <Field
                  data-invalid={status?.field === 'logo' ? true : undefined}
                >
                  <FieldLabel htmlFor="brand-logo">Enviar logo</FieldLabel>
                  <Input
                    ref={logoInput}
                    id="brand-logo"
                    name="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={chooseLogo}
                    aria-invalid={status?.field === 'logo' ? true : undefined}
                    aria-describedby={
                      status?.field === 'logo'
                        ? `brand-logo-description ${STATUS_ID}`
                        : 'brand-logo-description'
                    }
                  />
                  <FieldDescription id="brand-logo-description">
                    PNG com fundo transparente fica melhor. Sem logo, o pôster
                    mostra o nome.
                  </FieldDescription>
                </Field>
                {currentLogo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearLogo}
                  >
                    <Trash2 data-icon="inline-start" aria-hidden />
                    Remover logo
                  </Button>
                )}
              </div>

              <FieldGroup>
                <Field
                  data-invalid={status?.field === 'name' ? true : undefined}
                >
                  <FieldLabel htmlFor="brand-name">Nome do mercado</FieldLabel>
                  <Input
                    id="brand-name"
                    required
                    autoComplete="organization"
                    aria-invalid={status?.field === 'name' ? true : undefined}
                    aria-describedby={
                      status?.field === 'name' ? STATUS_ID : undefined
                    }
                    value={content.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="brand-slogan">Slogan</FieldLabel>
                  <Input
                    id="brand-slogan"
                    autoComplete="off"
                    placeholder="Ex.: O menor preço da cidade"
                    value={content.slogan}
                    onChange={(event) => update({ slogan: event.target.value })}
                  />
                </Field>
                <Field
                  data-invalid={
                    status?.field === 'instagram' ? true : undefined
                  }
                >
                  <FieldLabel htmlFor="brand-instagram">
                    @ do Instagram
                  </FieldLabel>
                  <Input
                    id="brand-instagram"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="@seumercado"
                    aria-invalid={
                      status?.field === 'instagram' ? true : undefined
                    }
                    aria-describedby={
                      status?.field === 'instagram'
                        ? `brand-instagram-description ${STATUS_ID}`
                        : 'brand-instagram-description'
                    }
                    value={content.instagram}
                    onChange={(event) =>
                      update({ instagram: event.target.value })
                    }
                  />
                  <FieldDescription id="brand-instagram-description">
                    Opcional. Sem ele, o pôster não mostra o Instagram.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </div>
          </section>

          <section
            aria-labelledby="templates-heading"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2
                  id="templates-heading"
                  tabIndex={-1}
                  className="text-lg font-semibold outline-none"
                >
                  Modelos de arte
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cada página de oferta usa um modelo. Páginas de um modelo
                  removido passam a usar o primeiro da lista.
                </p>
              </div>
              <Button
                ref={addTemplateButton}
                type="button"
                variant="outline"
                onClick={addTemplate}
              >
                <Plus data-icon="inline-start" aria-hidden />
                Adicionar modelo
              </Button>
            </div>
            <ul className="flex flex-col gap-3">
              {content.templates.map((template, index) => (
                <TemplateFields
                  key={templateKeys[index]}
                  id={getTemplateId(templateKeys[index])}
                  number={index + 1}
                  template={template}
                  invalid={status?.field === 'templates'}
                  errorId={STATUS_ID}
                  canRemove={content.templates.length > 1}
                  onChange={(changed) =>
                    update({
                      templates: content.templates.with(index, changed)
                    })
                  }
                  onRemove={() => removeTemplate(index)}
                />
              ))}
            </ul>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite" className="min-h-5">
              {status && (
                <p
                  key={status.id}
                  id={STATUS_ID}
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    status.kind === 'error' && 'text-destructive',
                    status.kind === 'info' && 'text-muted-foreground'
                  )}
                >
                  {status.kind === 'error' && (
                    <CircleAlert className="size-4 shrink-0" aria-hidden />
                  )}
                  {status.message}
                </p>
              )}
            </div>
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
              {saving ? 'Salvando…' : saveLabel}
            </Button>
          </div>
        </div>

        <aside
          aria-labelledby="brand-preview-heading"
          className="flex flex-col items-center gap-3 lg:sticky lg:top-6 lg:self-start"
        >
          <div className="flex w-full flex-wrap items-end justify-between gap-3">
            <h2 id="brand-preview-heading" className="text-lg font-semibold">
              Pré-visualização
            </h2>
            <Select
              items={content.templates.map((template, index) => ({
                value: templateKeys[index],
                label: getTemplateLabel(template, index + 1)
              }))}
              value={templateKeys[previewIndex]}
              onValueChange={(key) => {
                if (key !== null) setPreviewKey(key)
              }}
            >
              <div className="flex flex-col gap-2">
                <SelectPrimitive.Label className="w-fit text-sm font-medium">
                  Modelo
                </SelectPrimitive.Label>
                <SelectTrigger className="min-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {content.templates.map((template, index) => (
                    <SelectItem
                      key={templateKeys[index]}
                      value={templateKeys[index]}
                    >
                      {getTemplateLabel(template, index + 1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </div>
            </Select>
          </div>
          {previewTemplate && (
            <div className="zoom-[0.3] sm:zoom-[0.45] lg:zoom-[0.36] xl:zoom-[0.42]">
              <Poster
                brand={{
                  name: content.name.trim() || 'Nome do mercado',
                  slogan: content.slogan.trim(),
                  instagram: normalizeInstagram(content.instagram),
                  logo: currentLogo
                }}
                offer={SAMPLE_OFFER}
                template={{ ...previewTemplate, id: previewTemplate.id ?? '' }}
                layout={DEFAULT_POSTER_LAYOUT}
                products={SAMPLE_PRODUCTS}
              />
            </div>
          )}
        </aside>
      </form>
    </main>
  )
}
