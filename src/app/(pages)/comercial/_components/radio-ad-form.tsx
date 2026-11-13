'use client'

import { cn } from 'cn'
import { CircleAlert, Plus, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useRef, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/shadcn/button'
import { Checkbox } from '@/app/components/ui/shadcn/checkbox'
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import { Textarea } from '@/app/components/ui/shadcn/textarea'
import { useUnsavedChangesWarning } from '@/app/hooks/use-unsaved-changes-warning'
import { type OfferContent, replaceProduct } from '@/models/offer/offer'
import {
  getPronunciationsError,
  INITIAL_PRONUNCIATIONS,
  normalizePronunciations,
  type Pronunciation,
  type PronunciationError
} from '@/models/radio-ad/pronunciation'
import {
  getRadioScript,
  getRadioScriptParts,
  getRadioScriptRounds,
  getRadioScriptTemplateError,
  type RadioScriptClosingField,
  type RadioScriptTemplate
} from '@/models/radio-ad/radio-script'

import { saveRadioAdAction } from './actions'
import { ClosingSequenceField } from './closing-sequence-field'
import { ClosingsField, getClosingInputId } from './closings-field'
import { RadioScriptPreview } from './radio-script-preview'

type RadioAdFormProps = {
  // The saved offer, `undefined` until the store saves one
  offer: OfferContent | undefined
  initialPronunciations: Pronunciation[]
  initialRadioScript: RadioScriptTemplate
}

type StatusError =
  | ({ source: 'pronunciations' } & Pick<PronunciationError, 'index' | 'field'>)
  | { source: 'closings'; index: number; field: RadioScriptClosingField }

type Status = {
  message: string
  error?: StatusError
  // A new id remounts the message, so the same text twice in a row is announced again
  id: number
}

const STATUS_ID = 'radio-ad-status'

const OPENING_ID = 'radio-script-opening'

const getRowId = (key: number) => `pronunciation-${key}`

const getRowLabel = ({ term }: Pronunciation, index: number) =>
  term.trim() || `Novo termo ${index + 1}`

// A row still being filled would match every position of the text
const getCompletePronunciations = (pronunciations: Pronunciation[]) =>
  normalizePronunciations(pronunciations).filter(
    ({ term, spoken }) => term !== '' && spoken !== ''
  )

export const RadioAdForm = ({
  offer: initialOffer,
  initialPronunciations,
  initialRadioScript
}: RadioAdFormProps) => {
  const [pronunciations, setPronunciations] = useState(initialPronunciations)
  const [saved, setSaved] = useState(initialPronunciations)
  const [template, setTemplate] = useState(initialRadioScript)
  const [savedTemplate, setSavedTemplate] = useState(template)
  // New rows have no term yet, so each one gets a key that follows it
  const [keys, setKeys] = useState(() =>
    initialPronunciations.map((_, index) => index)
  )
  const [status, setStatus] = useState<Status>()
  // A voice text saved from the preview changes the product, not this page's settings
  const [offer, setOffer] = useState(initialOffer)
  const [saving, startSave] = useTransition()
  const addButton = useRef<HTMLButtonElement>(null)
  const statusCount = useRef(0)
  const dirty = pronunciations !== saved || template !== savedTemplate

  useUnsavedChangesWarning(dirty)

  const completePronunciations = getCompletePronunciations(pronunciations)
  const preview =
    offer && getRadioScript(offer, template, completePronunciations)
  const previewParts = offer
    ? getRadioScriptParts(offer, template, completePronunciations)
    : []
  const roundCount = offer
    ? getRadioScriptRounds(offer, template.speakRepeatedOnce).length
    : undefined

  const nextStatusId = () => {
    statusCount.current += 1
    return statusCount.current
  }

  const update = (next: Pronunciation[]) => {
    setPronunciations(next)
    setStatus(undefined)
  }

  const updateTemplate = (changes: Partial<RadioScriptTemplate>) => {
    setTemplate((current) => ({ ...current, ...changes }))
    setStatus(undefined)
  }

  const showError = (error: PronunciationError) => {
    flushSync(() =>
      setStatus({
        message: error.message,
        error: { source: 'pronunciations', ...error },
        id: nextStatusId()
      })
    )
    document
      .querySelector<HTMLElement>(
        `#${getRowId(keys[error.index])}-${error.field}`
      )
      ?.focus()
  }

  const showClosingError = (
    message: string,
    index: number,
    field: RadioScriptClosingField
  ) => {
    flushSync(() =>
      setStatus({
        message,
        error: { source: 'closings', index, field },
        id: nextStatusId()
      })
    )
    document
      .querySelector<HTMLElement>(
        `#${getClosingInputId(template.closings[index].id, field)}`
      )
      ?.focus()
  }

  const announce = (message: string) =>
    setStatus({ message, id: nextStatusId() })

  const add = () => {
    const key = Math.max(-1, ...keys) + 1
    flushSync(() => {
      update([...pronunciations, { term: '', spoken: '' }])
      setKeys([...keys, key])
    })
    document.querySelector<HTMLElement>(`#${getRowId(key)}-term`)?.focus()
  }

  const remove = (index: number) => {
    const label = getRowLabel(pronunciations[index], index)
    // The row goes away with the button that had focus, so it moves to the add button
    flushSync(() => {
      update(pronunciations.toSpliced(index, 1))
      setKeys(keys.toSpliced(index, 1))
    })
    announce(`${label} removido.`)
    addButton.current?.focus()
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const radioScript = template
    const radioScriptError = getRadioScriptTemplateError(radioScript)
    if (
      radioScriptError?.index !== undefined &&
      radioScriptError.field !== undefined
    ) {
      showClosingError(
        radioScriptError.message,
        radioScriptError.index,
        radioScriptError.field
      )
      return
    }
    const error = getPronunciationsError(pronunciations)
    if (error) {
      showError(error)
      return
    }

    startSave(async () => {
      const result = await saveRadioAdAction(
        JSON.stringify({ pronunciations, radioScript })
      )
      if (result.status === 'error') {
        const { index, field, message } = result
        if (index !== undefined && field !== undefined) {
          showError({ index, field, message })
        } else if (
          result.closingIndex !== undefined &&
          result.closingField !== undefined
        ) {
          showClosingError(message, result.closingIndex, result.closingField)
        } else {
          setStatus(undefined)
          // An error stays until it is closed, so it isn't missed (WCAG 2.2.1)
          toast.error(message, { duration: Infinity })
        }
        return
      }
      setPronunciations(result.pronunciations)
      setSaved(result.pronunciations)
      setTemplate(result.radioScript)
      setSavedTemplate(result.radioScript)
      setStatus(undefined)
      toast.success('Configurações salvas.')
    })
  }

  return (
    <div className="flex w-full max-w-7xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Comercial</h1>
        <p className="text-muted-foreground">
          O roteiro do comercial e como ele fala os produtos.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <form noValidate onSubmit={save} className="flex flex-col gap-10">
          <section
            aria-labelledby="radio-script-heading"
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col gap-1">
              <h2 id="radio-script-heading" className="text-lg font-semibold">
                Roteiro
              </h2>
              <p className="text-sm text-muted-foreground">
                Cada arte da oferta com produtos vira uma rodada do comercial,
                na ordem das artes: a abertura, os produtos da arte com o preço
                por extenso e um fechamento. Os textos entram como escritos, com
                as marcações de tom da voz, como [animado].
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={template.speakRepeatedOnce}
                onCheckedChange={(checked) =>
                  updateTemplate({ speakRepeatedOnce: checked })
                }
                className="mt-0.5"
                aria-labelledby="radio-script-repeated"
                aria-describedby="radio-script-repeated-description"
              />
              <span className="flex flex-col gap-0.5">
                <span id="radio-script-repeated" className="font-medium">
                  Falar uma vez só os produtos repetidos
                </span>
                <span
                  id="radio-script-repeated-description"
                  className="text-muted-foreground"
                >
                  Um produto que aparece em mais de uma arte entra só na
                  primeira, no roteiro e na lista de produtos. Uma arte que fica
                  sem produtos não tem rodada.
                </span>
              </span>
            </label>
            <Field>
              <FieldLabel htmlFor={OPENING_ID}>Abertura</FieldLabel>
              <Textarea
                id={OPENING_ID}
                aria-describedby={`${OPENING_ID}-description`}
                value={template.opening}
                onChange={(event) =>
                  updateTemplate({ opening: event.target.value })
                }
              />
              <FieldDescription id={`${OPENING_ID}-description`}>
                Entra no começo de cada rodada, antes dos produtos.
              </FieldDescription>
            </Field>
            <ClosingsField
              closings={template.closings}
              sequence={template.sequence}
              invalid={
                status?.error?.source === 'closings' ? status.error : undefined
              }
              errorId={STATUS_ID}
              onChange={(closings) => updateTemplate({ closings })}
              onAnnounce={announce}
            />
            <ClosingSequenceField
              closings={template.closings}
              sequence={template.sequence}
              roundCount={roundCount}
              onChange={(sequence) => updateTemplate({ sequence })}
              onAnnounce={announce}
            />
            <Field className="max-w-md">
              <FieldLabel htmlFor="radio-script-price-markers">
                Antes de cada preço
              </FieldLabel>
              <Textarea
                id="radio-script-price-markers"
                aria-describedby="radio-script-price-markers-description"
                value={template.priceMarkers.join('\n')}
                onChange={(event) =>
                  updateTemplate({
                    priceMarkers: event.target.value.split('\n')
                  })
                }
              />
              <FieldDescription id="radio-script-price-markers-description">
                Um por linha, usados em ciclo a partir do primeiro em cada
                rodada, como por apenas, somente, somente.
              </FieldDescription>
            </Field>
          </section>

          <section
            aria-labelledby="pronunciations-heading"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2
                  id="pronunciations-heading"
                  className="text-lg font-semibold"
                >
                  Dicionário de pronúncia
                </h2>
                <p className="text-sm text-muted-foreground">
                  Termos que a voz lê errado e como escrevê-los para soar certo,
                  como Veludo → Velude. Vale para a sugestão do texto da locução
                  de cada produto, depois dos números por extenso.
                </p>
              </div>
              <Button
                ref={addButton}
                type="button"
                variant="outline"
                onClick={add}
              >
                <Plus data-icon="inline-start" aria-hidden />
                Adicionar termo
              </Button>
            </div>
            {pronunciations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum termo no dicionário.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pronunciations.map((pronunciation, index) => {
                  const id = getRowId(keys[index])
                  const label = getRowLabel(pronunciation, index)
                  const invalidField =
                    status?.error?.source === 'pronunciations' &&
                    status.error.index === index
                      ? status.error.field
                      : undefined
                  const fieldProps = (field: keyof Pronunciation) => ({
                    id: `${id}-${field}`,
                    autoComplete: 'off',
                    'aria-invalid': invalidField === field ? true : undefined,
                    'aria-describedby':
                      invalidField === field ? STATUS_ID : undefined,
                    value: pronunciation[field],
                    onChange: (event: { target: { value: string } }) =>
                      update(
                        pronunciations.with(index, {
                          ...pronunciation,
                          [field]: event.target.value
                        })
                      )
                  })

                  return (
                    <li
                      key={keys[index]}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      {/* Every row repeats the labels, so the legend tells which term they belong to */}
                      <FieldSet className="flex-row flex-wrap items-end gap-4">
                        <FieldLegend className="sr-only">{label}</FieldLegend>
                        <Field
                          className="min-w-40 flex-1"
                          data-invalid={
                            invalidField === 'term' ? true : undefined
                          }
                        >
                          <FieldLabel htmlFor={`${id}-term`}>Termo</FieldLabel>
                          <Input
                            {...fieldProps('term')}
                            placeholder={INITIAL_PRONUNCIATIONS[0].term}
                          />
                        </Field>
                        <Field
                          className="min-w-40 flex-1"
                          data-invalid={
                            invalidField === 'spoken' ? true : undefined
                          }
                        >
                          <FieldLabel htmlFor={`${id}-spoken`}>
                            Como falar
                          </FieldLabel>
                          <Input
                            {...fieldProps('spoken')}
                            placeholder={INITIAL_PRONUNCIATIONS[0].spoken}
                          />
                        </Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${label}`}
                          onClick={() => remove(index)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </FieldSet>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite" className="min-h-5">
              {status && (
                <p
                  key={status.id}
                  id={STATUS_ID}
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    status.error ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {status.error && (
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
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
        <RadioScriptPreview
          script={preview}
          parts={previewParts}
          pronunciations={completePronunciations}
          onProductSaved={(product) =>
            setOffer(
              (current) =>
                current && {
                  ...current,
                  pages: replaceProduct(current.pages, product)
                }
            )
          }
        />
      </div>
    </div>
  )
}
