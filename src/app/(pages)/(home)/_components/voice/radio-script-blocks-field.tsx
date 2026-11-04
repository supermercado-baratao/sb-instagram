'use client'

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CopyPlus,
  ListOrdered,
  MessageSquareText,
  Trash2
} from 'lucide-react'
import { useRef } from 'react'
import { flushSync } from 'react-dom'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldLabel
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { Textarea } from '@/app/components/ui/shadcn/textarea'
import {
  MAX_BLOCK_PAGE_COUNT,
  type RadioScriptBlock
} from '@/domain/radio-script'

// Blocks have no id of their own, so each one gets a key that follows it when it moves
export type KeyedRadioScriptBlock = { key: number; block: RadioScriptBlock }

type RadioScriptBlocksFieldProps = {
  blocks: KeyedRadioScriptBlock[]
  invalidIndex?: number
  errorId: string
  // An error about the whole sequence, shown next to the button that fixes it
  sequenceError?: string
  onChange: (blocks: KeyedRadioScriptBlock[]) => void
  onRemove: (label: string) => void
}

export const ADD_PRODUCTS_BUTTON_ID = 'radio-script-add-products'

const SEQUENCE_ERROR_ID = 'radio-script-sequence-error'

export const getBlockInputId = (key: number) => `radio-script-block-${key}`

const getBlockLabel = ({ type }: RadioScriptBlock, index: number) =>
  `Bloco ${index + 1}, ${type === 'text' ? 'texto' : 'produtos'}`

const describePages = (pageCount: number) =>
  pageCount === 1 ? 'a próxima página' : `as próximas ${pageCount} páginas`

const focus = (selector: string) =>
  document.querySelector<HTMLElement>(selector)?.focus()

export const keyBlocks = (blocks: RadioScriptBlock[]) =>
  blocks.map((block, key) => ({ key, block }))

export const RadioScriptBlocksField = ({
  blocks,
  invalidIndex,
  errorId,
  sequenceError,
  onChange,
  onRemove
}: RadioScriptBlocksFieldProps) => {
  const addTextButton = useRef<HTMLButtonElement>(null)
  const nextKey = () => Math.max(-1, ...blocks.map(({ key }) => key)) + 1

  const add = (block: RadioScriptBlock) => {
    const key = nextKey()
    flushSync(() => onChange([...blocks, { key, block }]))
    focus(`#${getBlockInputId(key)}`)
  }

  const move = (from: number, to: number) => {
    // React moves the block's node, which drops the focus, so it goes back to the same button
    flushSync(() =>
      onChange(blocks.with(from, blocks[to]).with(to, blocks[from]))
    )
    const button = to < from ? 'move-before' : 'move-after'
    focus(`#${getBlockInputId(blocks[from].key)}-${button}`)
  }

  const duplicate = (index: number) => {
    const key = nextKey()
    flushSync(() =>
      onChange(blocks.toSpliced(index + 1, 0, { ...blocks[index], key }))
    )
    focus(`#${getBlockInputId(key)}`)
  }

  const remove = (index: number) => {
    // The block goes away with the button that had focus, so it moves to a neighbor or the add
    // button
    const neighbor = blocks[index + 1] ?? blocks[index - 1]
    flushSync(() => onChange(blocks.toSpliced(index, 1)))
    onRemove(getBlockLabel(blocks[index].block, index))
    if (neighbor) focus(`#${getBlockInputId(neighbor.key)}`)
    else addTextButton.current?.focus()
  }

  const update = (index: number, block: RadioScriptBlock) =>
    onChange(blocks.with(index, { ...blocks[index], block }))

  return (
    <div className="flex flex-col gap-4">
      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum bloco no roteiro.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {blocks.map(({ key, block }, index) => {
            const id = getBlockInputId(key)
            const label = getBlockLabel(block, index)
            const invalid = invalidIndex === index
            return (
              <li
                key={key}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                {block.type === 'text' ? (
                  <Field>
                    <FieldLabel htmlFor={id}>
                      <MessageSquareText aria-hidden />
                      {label}
                    </FieldLabel>
                    <Textarea
                      id={id}
                      value={block.text}
                      onChange={(event) =>
                        update(index, {
                          type: 'text',
                          text: event.target.value
                        })
                      }
                    />
                  </Field>
                ) : (
                  <Field
                    className="max-w-xs"
                    data-invalid={invalid ? true : undefined}
                  >
                    <FieldLabel htmlFor={id}>
                      <ListOrdered aria-hidden />
                      {label}
                    </FieldLabel>
                    <Input
                      id={id}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_BLOCK_PAGE_COUNT}
                      autoComplete="off"
                      aria-invalid={invalid ? true : undefined}
                      aria-describedby={
                        invalid
                          ? `${id}-description ${errorId}`
                          : `${id}-description`
                      }
                      value={
                        Number.isNaN(block.pageCount) ? '' : block.pageCount
                      }
                      onChange={(event) =>
                        update(index, {
                          type: 'products',
                          pageCount:
                            event.target.value === ''
                              ? NaN
                              : Number(event.target.value)
                        })
                      }
                    />
                    <FieldDescription id={`${id}-description`}>
                      Páginas da oferta neste bloco.{' '}
                      {Number.isSafeInteger(block.pageCount) &&
                        block.pageCount > 0 &&
                        `Recebe ${describePages(block.pageCount)}, com os seus produtos.`}
                    </FieldDescription>
                  </Field>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    id={`${id}-move-before`}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    focusableWhenDisabled
                    aria-label={`Mover ${label} para antes`}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp data-icon="inline-start" aria-hidden />
                    Antes
                  </Button>
                  <Button
                    id={`${id}-move-after`}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === blocks.length - 1}
                    focusableWhenDisabled
                    aria-label={`Mover ${label} para depois`}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown data-icon="inline-start" aria-hidden />
                    Depois
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Duplicar ${label}`}
                    onClick={() => duplicate(index)}
                  >
                    <CopyPlus data-icon="inline-start" aria-hidden />
                    Duplicar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remover ${label}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 data-icon="inline-start" aria-hidden />
                    Remover
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          ref={addTextButton}
          type="button"
          variant="outline"
          onClick={() => add({ type: 'text', text: '' })}
        >
          <MessageSquareText data-icon="inline-start" aria-hidden />
          Adicionar texto
        </Button>
        <Button
          id={ADD_PRODUCTS_BUTTON_ID}
          type="button"
          variant="outline"
          aria-describedby={sequenceError ? SEQUENCE_ERROR_ID : undefined}
          onClick={() => add({ type: 'products', pageCount: 1 })}
        >
          <ListOrdered data-icon="inline-start" aria-hidden />
          Adicionar produtos
        </Button>
      </div>
      {sequenceError && (
        <p
          id={SEQUENCE_ERROR_ID}
          className="flex items-center gap-2 text-sm text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {sequenceError}
        </p>
      )}
    </div>
  )
}
