'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Plus, Trash2 } from 'lucide-react'
import { flushSync } from 'react-dom'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  FieldDescription,
  FieldLegend,
  FieldSet
} from '@/app/components/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/shadcn/select'
import {
  getClosingSequence,
  type RadioScriptClosing,
  type RadioScriptClosingSequence,
  type RadioScriptSequencePart,
  SEQUENCE_PARTS
} from '@/domain/radio-script'

import { getClosingLabel } from './closings-field'

type ClosingSequenceFieldProps = {
  closings: RadioScriptClosing[]
  sequence: RadioScriptClosingSequence
  // Rounds of the saved offer, `undefined` without one
  roundCount?: number
  onChange: (sequence: RadioScriptClosingSequence) => void
  onAnnounce: (message: string) => void
}

const PARTS: Record<
  RadioScriptSequencePart,
  { label: string; lowercase: string; description: string }
> = {
  start: {
    label: 'Começo',
    lowercase: 'começo',
    description:
      'Fecham as primeiras rodadas, quando a oferta tem artes para isso.'
  },
  middle: {
    label: 'Meio',
    lowercase: 'meio',
    description:
      'Repetidos em ordem nas rodadas entre o começo e o fim, quantas vezes for preciso.'
  },
  end: {
    label: 'Fim',
    lowercase: 'fim',
    description:
      'Fecham as últimas rodadas e entram sempre: numa oferta de uma arte só, entra o último.'
  }
}

const EXAMPLE_ROUND_COUNTS = [1, 2, 3, 4, 5, 6]

const NO_CLOSINGS_ID = 'radio-script-sequence-no-closings'

const RULE_ID = 'radio-script-sequence-rule'

const getPartId = (part: RadioScriptSequencePart) =>
  `radio-script-sequence-${part}`

const getEntryId = (part: RadioScriptSequencePart, index: number) =>
  `${getPartId(part)}-${index}`

const focus = (selector: string) =>
  document.querySelector<HTMLElement>(selector)?.focus()

export const ClosingSequenceField = ({
  closings,
  sequence,
  roundCount,
  onChange,
  onAnnounce
}: ClosingSequenceFieldProps) => {
  const items = closings.map((closing) => ({
    value: String(closing.id),
    label: getClosingLabel(closing)
  }))
  const nameOf = (id: number | undefined) => {
    const closing = closings.find((candidate) => candidate.id === id)
    return closing ? getClosingLabel(closing) : 'sem fechamento'
  }
  const exampleCounts =
    roundCount !== undefined &&
    roundCount > 0 &&
    !EXAMPLE_ROUND_COUNTS.includes(roundCount)
      ? [...EXAMPLE_ROUND_COUNTS, roundCount].toSorted((a, b) => a - b)
      : EXAMPLE_ROUND_COUNTS

  const update = (part: RadioScriptSequencePart, ids: number[]) =>
    onChange({ ...sequence, [part]: ids })

  const add = (part: RadioScriptSequencePart) => {
    const ids = sequence[part]
    // Repeating the last one is what the store most often wants, as in a middle of short closings
    const next = ids.at(-1) ?? closings[0].id
    flushSync(() => update(part, [...ids, next]))
    focus(`#${getEntryId(part, ids.length)}`)
  }

  const remove = (part: RadioScriptSequencePart, index: number) => {
    const ids = sequence[part]
    flushSync(() => update(part, ids.toSpliced(index, 1)))
    onAnnounce(`${nameOf(ids[index])} removido do ${PARTS[part].lowercase}.`)
    // The entry goes away with the button that had focus, so it moves to a neighbor or the add button
    const neighbor = Math.min(index, ids.length - 2)
    focus(
      neighbor >= 0
        ? `#${getEntryId(part, neighbor)}`
        : `#${getPartId(part)}-add`
    )
  }

  return (
    <FieldSet className="gap-4">
      <FieldLegend variant="label">Ordem dos fechamentos</FieldLegend>
      <FieldDescription id={RULE_ID}>
        O fim entra sempre, o começo entra nas rodadas que sobram e o meio
        completa o resto.
      </FieldDescription>
      {/* The form shares the screen with the preview from lg up, so the parts follow its width */}
      <div className="@container">
        <div className="grid gap-4 @xl:grid-cols-3">
          {SEQUENCE_PARTS.map((part) => {
            const { label, lowercase, description } = PARTS[part]
            const descriptionId = `${getPartId(part)}-description`
            return (
              <FieldSet
                key={part}
                aria-describedby={descriptionId}
                className="gap-2 rounded-lg border border-border bg-card p-4"
              >
                <FieldLegend variant="label" className="mb-0">
                  {label}
                </FieldLegend>
                <p id={descriptionId} className="text-sm text-muted-foreground">
                  {description}
                </p>
                {sequence[part].length > 0 && (
                  <ol className="flex flex-col gap-2">
                    {sequence[part].map((id, index) => {
                      const position = `${index + 1}º do ${lowercase}`
                      return (
                        // The entries are values that never move, so the index is their key
                        <li key={index} className="flex items-center gap-1">
                          <Select
                            items={items}
                            value={String(id)}
                            onValueChange={(value) => {
                              if (value !== null) {
                                update(
                                  part,
                                  sequence[part].with(index, Number(value))
                                )
                              }
                            }}
                          >
                            <SelectPrimitive.Label className="sr-only">
                              {`Fechamento ${position}`}
                            </SelectPrimitive.Label>
                            <SelectTrigger
                              id={getEntryId(part, index)}
                              aria-describedby={descriptionId}
                              className="min-w-0 flex-1"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remover ${nameOf(id)}, ${position}`}
                            onClick={() => remove(part, index)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </li>
                      )
                    })}
                  </ol>
                )}
                <Button
                  id={`${getPartId(part)}-add`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={closings.length === 0}
                  focusableWhenDisabled
                  aria-label={`Adicionar fechamento ao ${lowercase}`}
                  aria-describedby={
                    closings.length === 0
                      ? `${RULE_ID} ${descriptionId} ${NO_CLOSINGS_ID}`
                      : `${RULE_ID} ${descriptionId}`
                  }
                  onClick={() => add(part)}
                >
                  <Plus data-icon="inline-start" aria-hidden />
                  Adicionar
                </Button>
              </FieldSet>
            )
          })}
        </div>
      </div>
      {closings.length === 0 && (
        <p id={NO_CLOSINGS_ID} className="text-sm text-muted-foreground">
          Adicione um fechamento antes de montar a ordem.
        </p>
      )}
      <table className="w-full max-w-xl text-sm">
        <caption className="mb-2 text-left font-medium">
          Como fica conforme o número de rodadas, uma por arte com produtos
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th scope="col" className="py-1.5 pr-4 font-medium">
              Rodadas
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Fechamentos
            </th>
          </tr>
        </thead>
        <tbody>
          {exampleCounts.map((count) => (
            <tr key={count} className="border-b border-border last:border-0">
              <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                {count}
                {count === roundCount && (
                  <span className="text-muted-foreground"> (oferta salva)</span>
                )}
              </th>
              <td className="py-1.5">
                {getClosingSequence(sequence, count)
                  .map((id) => nameOf(id))
                  .join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </FieldSet>
  )
}
