'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { flushSync } from 'react-dom'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { Textarea } from '@/app/components/ui/shadcn/textarea'
import {
  getNextClosingId,
  isClosingInSequence,
  type RadioScriptClosing,
  type RadioScriptClosingField,
  type RadioScriptClosingSequence
} from '@/domain/radio-script'

type ClosingsFieldProps = {
  closings: RadioScriptClosing[]
  sequence: RadioScriptClosingSequence
  invalid?: { index: number; field: RadioScriptClosingField }
  errorId: string
  onChange: (closings: RadioScriptClosing[]) => void
  onAnnounce: (message: string) => void
}

const DESCRIPTION_ID = 'radio-script-closings-description'

export const getClosingInputId = (id: number, field: RadioScriptClosingField) =>
  `radio-script-closing-${id}-${field}`

export const getClosingLabel = ({ name }: RadioScriptClosing) =>
  name.trim() || 'Fechamento sem nome'

const focus = (selector: string) =>
  document.querySelector<HTMLElement>(selector)?.focus()

// A new closing starts with a name of its own, since a blank or repeated one can't be saved
const getNewClosingName = (closings: RadioScriptClosing[]) => {
  const names = new Set(
    closings.map(({ name }) => name.trim().toLocaleLowerCase('pt-BR'))
  )
  let number = closings.length + 1
  while (names.has(`fechamento ${number}`)) number += 1
  return `Fechamento ${number}`
}

export const ClosingsField = ({
  closings,
  sequence,
  invalid,
  errorId,
  onChange,
  onAnnounce
}: ClosingsFieldProps) => {
  const addButton = useRef<HTMLButtonElement>(null)

  const add = () => {
    const id = getNextClosingId(closings)
    flushSync(() =>
      onChange([
        ...closings,
        { id, name: getNewClosingName(closings), text: '' }
      ])
    )
    focus(`#${getClosingInputId(id, 'text')}`)
  }

  const remove = (index: number) => {
    // The closing goes away with the button that had focus, so it moves to the add button
    flushSync(() => onChange(closings.toSpliced(index, 1)))
    onAnnounce(`${getClosingLabel(closings[index])} removido.`)
    addButton.current?.focus()
  }

  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label">Fechamentos</FieldLegend>
      <FieldDescription id={DESCRIPTION_ID}>
        Os textos que encerram as rodadas. A ordem abaixo diz qual entra em cada
        rodada.
      </FieldDescription>
      {closings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum fechamento. As rodadas terminam nos produtos.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {closings.map((closing, index) => {
            const label = getClosingLabel(closing)
            const nameId = getClosingInputId(closing.id, 'name')
            const textId = getClosingInputId(closing.id, 'text')
            const invalidField =
              invalid?.index === index ? invalid.field : undefined
            const used = isClosingInSequence(sequence, closing.id)
            const usedId = `${nameId}-used`
            return (
              <li
                key={closing.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                {/* Every closing repeats the labels, so the legend tells which one they belong to */}
                <FieldSet className="gap-3">
                  <FieldLegend className="sr-only">{label}</FieldLegend>
                  <Field
                    className="max-w-xs"
                    data-invalid={invalidField === 'name' ? true : undefined}
                  >
                    <FieldLabel htmlFor={nameId}>Nome</FieldLabel>
                    <Input
                      id={nameId}
                      autoComplete="off"
                      aria-invalid={invalidField === 'name' ? true : undefined}
                      aria-describedby={
                        invalidField === 'name' ? errorId : undefined
                      }
                      value={closing.name}
                      onChange={(event) =>
                        onChange(
                          closings.with(index, {
                            ...closing,
                            name: event.target.value
                          })
                        )
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={textId}>Texto</FieldLabel>
                    <Textarea
                      id={textId}
                      value={closing.text}
                      onChange={(event) =>
                        onChange(
                          closings.with(index, {
                            ...closing,
                            text: event.target.value
                          })
                        )
                      }
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={used}
                      focusableWhenDisabled
                      aria-label={`Remover ${label}`}
                      aria-describedby={used ? usedId : undefined}
                      onClick={() => remove(index)}
                    >
                      <Trash2 data-icon="inline-start" aria-hidden />
                      Remover
                    </Button>
                    {used && (
                      <p id={usedId} className="text-sm text-muted-foreground">
                        Em uso na ordem dos fechamentos. Tire-o de lá para
                        remover.
                      </p>
                    )}
                  </div>
                </FieldSet>
              </li>
            )
          })}
        </ul>
      )}
      <Button
        ref={addButton}
        type="button"
        variant="outline"
        className="self-start"
        aria-describedby={DESCRIPTION_ID}
        onClick={add}
      >
        <Plus data-icon="inline-start" aria-hidden />
        Adicionar fechamento
      </Button>
    </FieldSet>
  )
}
