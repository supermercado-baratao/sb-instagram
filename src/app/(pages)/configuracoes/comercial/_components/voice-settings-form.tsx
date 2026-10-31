'use client'

import { cn } from 'cn'
import { CircleAlert, Plus, Save, Trash2 } from 'lucide-react'
import {
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
  useTransition
} from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/shadcn/button'
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
import {
  getPronunciationsError,
  type Pronunciation,
  type PronunciationError
} from '@/domain/pronunciation'
import type { RadioScriptTemplate } from '@/domain/radio-script'

import { saveVoiceSettingsAction } from '../actions'

type VoiceSettingsFormProps = {
  nav: ReactNode
  initialPronunciations: Pronunciation[]
  initialRadioScript: RadioScriptTemplate
}

type Status = {
  message: string
  error?: Pick<PronunciationError, 'index' | 'field'>
  // A new id remounts the message, so the same text twice in a row is announced again
  id: number
}

const STATUS_ID = 'voice-settings-status'

const RADIO_SCRIPT_FIELDS = [
  {
    field: 'opening',
    label: 'Abertura',
    description: 'Fala no começo do primeiro bloco.'
  },
  {
    field: 'beforeBlock',
    label: 'Antes de cada bloco',
    description:
      'Fala antes dos produtos de cada bloco, como a chamada da promoção.'
  },
  {
    field: 'afterBlock',
    label: 'Depois de cada bloco',
    description:
      'Fala depois dos produtos de cada bloco, como as formas de pagamento e o Instagram.'
  },
  {
    field: 'closing',
    label: 'Fechamento',
    description: 'Fala no fim do último bloco.'
  }
] as const

const getRowId = (key: number) => `pronunciation-${key}`

const getRowLabel = ({ term }: Pronunciation, index: number) =>
  term.trim() || `Novo termo ${index + 1}`

export const VoiceSettingsForm = ({
  nav,
  initialPronunciations,
  initialRadioScript
}: VoiceSettingsFormProps) => {
  const [pronunciations, setPronunciations] = useState(initialPronunciations)
  const [saved, setSaved] = useState(initialPronunciations)
  const [radioScript, setRadioScript] = useState(initialRadioScript)
  const [savedRadioScript, setSavedRadioScript] = useState(initialRadioScript)
  // New rows have no term yet, so each one gets a key that follows it
  const [keys, setKeys] = useState(() =>
    initialPronunciations.map((_, index) => index)
  )
  const [status, setStatus] = useState<Status>()
  const [saving, startSave] = useTransition()
  const addButton = useRef<HTMLButtonElement>(null)
  const statusCount = useRef(0)
  const dirty = pronunciations !== saved || radioScript !== savedRadioScript

  useUnsavedChangesWarning(dirty)

  const nextStatusId = () => {
    statusCount.current += 1
    return statusCount.current
  }

  const update = (next: Pronunciation[]) => {
    setPronunciations(next)
    setStatus(undefined)
  }

  const showError = (error: PronunciationError) => {
    flushSync(() =>
      setStatus({ message: error.message, error, id: nextStatusId() })
    )
    document
      .querySelector<HTMLElement>(
        `#${getRowId(keys[error.index])}-${error.field}`
      )
      ?.focus()
  }

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
    setStatus({
      message: `${label} removido.`,
      id: nextStatusId()
    })
    addButton.current?.focus()
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const error = getPronunciationsError(pronunciations)
    if (error) {
      showError(error)
      return
    }

    startSave(async () => {
      const result = await saveVoiceSettingsAction(
        JSON.stringify({ pronunciations, radioScript })
      )
      if (result.status === 'error') {
        const { index, field, message } = result
        if (index !== undefined && field !== undefined) {
          showError({ index, field, message })
        } else {
          setStatus(undefined)
          // An error stays until it is closed, so it isn't missed (WCAG 2.2.1)
          toast.error(message, { duration: Infinity })
        }
        return
      }
      setPronunciations(result.pronunciations)
      setSaved(result.pronunciations)
      setRadioScript(result.radioScript)
      setSavedRadioScript(result.radioScript)
      setStatus(undefined)
      toast.success('Configurações salvas.')
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      {nav}
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Comercial</h1>
        <p className="text-muted-foreground">
          O roteiro do comercial da rádio e como ele fala os produtos.
        </p>
      </header>

      <form noValidate onSubmit={save} className="flex flex-col gap-10">
        <section
          aria-labelledby="radio-script-heading"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <h2 id="radio-script-heading" className="text-lg font-semibold">
              Roteiro
            </h2>
            <p className="text-sm text-muted-foreground">
              Cada página da oferta vira um bloco do comercial, com os produtos
              e os preços por extenso. Os textos entram como escritos, com as
              marcações de tom da voz, como [animado].
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {RADIO_SCRIPT_FIELDS.map(({ field, label, description }) => (
              <Field key={field}>
                <FieldLabel htmlFor={`radio-script-${field}`}>
                  {label}
                </FieldLabel>
                <Textarea
                  id={`radio-script-${field}`}
                  aria-describedby={`radio-script-${field}-description`}
                  value={radioScript[field]}
                  onChange={(event) =>
                    setRadioScript({
                      ...radioScript,
                      [field]: event.target.value
                    })
                  }
                />
                <FieldDescription id={`radio-script-${field}-description`}>
                  {description}
                </FieldDescription>
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="radio-script-price-markers">
                Antes de cada preço
              </FieldLabel>
              <Textarea
                id="radio-script-price-markers"
                aria-describedby="radio-script-price-markers-description"
                value={radioScript.priceMarkers.join('\n')}
                onChange={(event) =>
                  setRadioScript({
                    ...radioScript,
                    priceMarkers: event.target.value.split('\n')
                  })
                }
              />
              <FieldDescription id="radio-script-price-markers-description">
                Um por linha, usados em ciclo a partir do primeiro em cada
                bloco, como por apenas, somente, somente.
              </FieldDescription>
            </Field>
          </div>
        </section>

        <section
          aria-labelledby="pronunciations-heading"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="pronunciations-heading" className="text-lg font-semibold">
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
                  status?.error?.index === index
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
                        <Input {...fieldProps('term')} />
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
                        <Input {...fieldProps('spoken')} />
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
    </main>
  )
}
