'use client'

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CopyPlus,
  ListOrdered,
  MessageSquareText,
  Trash2,
  Unlink
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
  duplicateBlock,
  getLinkedBlockIndexes,
  getNextProductsBlockId,
  isValidBlockPageCount,
  joinNumbers,
  MAX_BLOCK_PAGE_COUNT,
  type RadioScriptBlock,
  type RadioScriptBlockItems,
  separateBlock,
  setTextBlockText
} from '@/domain/radio-script'

// Blocks have no id of their own, so each one gets a key that follows it when it moves
export type KeyedRadioScriptBlock = { key: number; block: RadioScriptBlock }

type RadioScriptBlocksFieldProps = {
  blocks: KeyedRadioScriptBlock[]
  // The saved offer's products each block takes, in the same order, `undefined` without an offer
  blockItems?: (RadioScriptBlockItems | undefined)[]
  // The blocks share the products evenly, so they have no page count
  splitEvenly: boolean
  invalidIndex?: number
  errorId: string
  // An error about the whole sequence, shown next to the button that fixes it
  sequenceError?: string
  onChange: (blocks: KeyedRadioScriptBlock[]) => void
  onAnnounce: (message: string) => void
}

export const ADD_PRODUCTS_BUTTON_ID = 'radio-script-add-products'

const SEQUENCE_ERROR_ID = 'radio-script-sequence-error'

export const getBlockInputId = (key: number) => `radio-script-block-${key}`

const SHOWN_PRODUCT_COUNT = 3

export const describePageNumbers = (numbers: number[]) =>
  numbers.length === 1
    ? `página ${numbers[0]}`
    : `páginas ${joinNumbers(numbers)}`

export const describeMissingPages = (count: number) =>
  count === 1
    ? 'Falta 1 página com produtos na oferta salva.'
    : `Faltam ${count} páginas com produtos na oferta salva.`

const describeBlockNumbers = (indexes: number[]) => {
  const numbers = indexes.map((index) => index + 1)
  return numbers.length === 1
    ? `o bloco ${numbers[0]}`
    : `os blocos ${joinNumbers(numbers)}`
}

// Announcements use it with no pages or link, which would read as if they were about another block
const getShortBlockLabel = ({ type }: RadioScriptBlock, index: number) =>
  `Bloco ${index + 1}, ${type === 'text' ? 'texto' : 'produtos'}`

const describeProductCount = (count: number) =>
  count === 1 ? '1 produto' : `${count} produtos`

const getBlockLabel = (
  blocks: RadioScriptBlock[],
  index: number,
  assigned: RadioScriptBlockItems | undefined,
  splitEvenly: boolean
) => {
  const label = getShortBlockLabel(blocks[index], index)
  if (assigned && splitEvenly) {
    return `${label}, ${describeProductCount(assigned.items.length)}`
  }
  if (assigned && assigned.pageNumbers.length > 0) {
    return `${label}, ${describePageNumbers(assigned.pageNumbers)}`
  }
  const linked = getLinkedBlockIndexes(blocks, index)
  if (linked.length === 0) return label
  const numbers = joinNumbers(linked.map((other) => other + 1))
  return linked.length === 1
    ? `${label}, igual ao bloco ${numbers}`
    : `${label}, igual aos blocos ${numbers}`
}

const describeNextPages = (pageCount: number) =>
  pageCount === 1 ? 'a próxima página' : `as próximas ${pageCount} páginas`

const describeProducts = ({ items }: RadioScriptBlockItems) => {
  const descriptions = items.map(({ product }) => product.description)
  const shown = descriptions.slice(0, SHOWN_PRODUCT_COUNT).join(', ')
  const rest = descriptions.length - SHOWN_PRODUCT_COUNT
  if (rest <= 0) return shown
  return `${shown} e mais ${rest} ${rest === 1 ? 'produto' : 'produtos'}`
}

const describeMoved = ({ items }: RadioScriptBlockItems) => {
  const count = items.filter(({ moved }) => moved).length
  if (count === 0) return
  return count === 1
    ? '1 produto foi movido para este bloco.'
    : `${count} produtos foram movidos para este bloco.`
}

// Without a saved offer there are no pages to name, so it says how many the block takes
const describeBlockPages = (
  pageCount: number,
  assigned: RadioScriptBlockItems | undefined
) => {
  if (!assigned)
    return `Recebe ${describeNextPages(pageCount)}, com os seus produtos.`
  const parts = []
  const numbers = assigned.pageNumbers
  if (numbers.length > 0) {
    parts.push(
      assigned.items.length > 0
        ? `Recebe ${numbers.length === 1 ? 'a' : 'as'} ${describePageNumbers(numbers)}: ${describeProducts(assigned)}.`
        : `Recebe ${numbers.length === 1 ? 'a' : 'as'} ${describePageNumbers(numbers)}, mas os produtos dela já entram em outro bloco.`
    )
  } else if (assigned.items.length > 0) {
    parts.push(`Recebe ${describeProducts(assigned)}.`)
  }
  parts.push(describeMoved(assigned))
  if (assigned.missingPageCount > 0) {
    parts.push(describeMissingPages(assigned.missingPageCount))
  }
  return parts.filter(Boolean).join(' ')
}

const describeSharedProducts = (
  assigned: RadioScriptBlockItems | undefined
) => {
  if (!assigned) return 'Recebe uma parte igual dos produtos da oferta.'
  if (assigned.items.length === 0) return 'Não recebe produtos da oferta salva.'
  return [
    `Recebe ${describeProductCount(assigned.items.length)}: ${describeProducts(assigned)}.`,
    describeMoved(assigned)
  ]
    .filter(Boolean)
    .join(' ')
}

const focus = (selector: string) =>
  document.querySelector<HTMLElement>(selector)?.focus()

// The domain rules keep each block in its place, so the keys follow them by index
const withKeys = (
  keyed: { key: number }[],
  next: RadioScriptBlock[]
): KeyedRadioScriptBlock[] =>
  keyed.map(({ key }, index) => ({ key, block: next[index] }))

export const keyBlocks = (blocks: RadioScriptBlock[]) =>
  blocks.map((block, key) => ({ key, block }))

export const RadioScriptBlocksField = ({
  blocks,
  blockItems,
  splitEvenly,
  invalidIndex,
  errorId,
  sequenceError,
  onChange,
  onAnnounce
}: RadioScriptBlocksFieldProps) => {
  const addTextButton = useRef<HTMLButtonElement>(null)
  const plainBlocks = blocks.map(({ block }) => block)
  const nextKey = () => Math.max(-1, ...blocks.map(({ key }) => key)) + 1
  const labelOf = (index: number) =>
    getBlockLabel(plainBlocks, index, blockItems?.[index], splitEvenly)

  const add = (block: RadioScriptBlock) => {
    const key = nextKey()
    // A moved product points to a products block by its id
    const added =
      block.type === 'products'
        ? { ...block, id: getNextProductsBlockId(plainBlocks) }
        : block
    flushSync(() => onChange([...blocks, { key, block: added }]))
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
      onChange(
        withKeys(
          blocks.toSpliced(index + 1, 0, { ...blocks[index], key }),
          duplicateBlock(plainBlocks, index)
        )
      )
    )
    focus(`#${getBlockInputId(key)}`)
  }

  const separate = (index: number) => {
    const message = `${getShortBlockLabel(plainBlocks[index], index)}, separado d${describeBlockNumbers(getLinkedBlockIndexes(plainBlocks, index))}.`
    // The button goes away with the link, so the focus moves to the block's text
    flushSync(() =>
      onChange(withKeys(blocks, separateBlock(plainBlocks, index)))
    )
    onAnnounce(message)
    focus(`#${getBlockInputId(blocks[index].key)}`)
  }

  const remove = (index: number) => {
    // The block goes away with the button that had focus, so it moves to a neighbor or the add
    // button
    const neighbor = blocks[index + 1] ?? blocks[index - 1]
    flushSync(() => onChange(blocks.toSpliced(index, 1)))
    onAnnounce(`${getShortBlockLabel(plainBlocks[index], index)} removido.`)
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
            const assigned = blockItems?.[index]
            const label = labelOf(index)
            const linked = getLinkedBlockIndexes(plainBlocks, index)
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
                      aria-describedby={
                        linked.length > 0 ? `${id}-description` : undefined
                      }
                      value={block.text}
                      onChange={(event) =>
                        onChange(
                          withKeys(
                            blocks,
                            setTextBlockText(
                              plainBlocks,
                              index,
                              event.target.value
                            )
                          )
                        )
                      }
                    />
                    {linked.length > 0 && (
                      <FieldDescription id={`${id}-description`}>
                        Alterar este texto também altera{' '}
                        {describeBlockNumbers(linked)}.
                      </FieldDescription>
                    )}
                  </Field>
                ) : (
                  <>
                    {splitEvenly ? (
                      // Split evenly the block has nothing to fill; the id still takes the focus when the
                      // block is added or duplicated
                      <div
                        id={id}
                        role="group"
                        tabIndex={-1}
                        aria-labelledby={`${id}-label`}
                        aria-describedby={`${id}-description`}
                        className="-m-1 flex flex-col gap-2 rounded-md p-1 outline-none focus-visible:ring-3 focus-visible:ring-muted-foreground"
                      >
                        <p
                          id={`${id}-label`}
                          className="flex items-center gap-2 text-sm leading-snug font-medium [&_svg]:size-4"
                        >
                          <ListOrdered aria-hidden />
                          {label}
                        </p>
                        <p
                          id={`${id}-description`}
                          className="text-sm text-muted-foreground"
                        >
                          {describeSharedProducts(assigned)}
                        </p>
                      </div>
                    ) : (
                      <Field data-invalid={invalid ? true : undefined}>
                        <FieldLabel htmlFor={id}>
                          <ListOrdered aria-hidden />
                          {label}
                        </FieldLabel>
                        <Input
                          id={id}
                          className="max-w-xs"
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
                              ...block,
                              pageCount:
                                event.target.value === ''
                                  ? NaN
                                  : Number(event.target.value)
                            })
                          }
                        />
                        <FieldDescription id={`${id}-description`}>
                          Páginas da oferta neste bloco.{' '}
                          {isValidBlockPageCount(block.pageCount) &&
                            describeBlockPages(block.pageCount, assigned)}
                        </FieldDescription>
                      </Field>
                    )}
                  </>
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
                  {linked.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Separar ${label}`}
                      onClick={() => separate(index)}
                    >
                      <Unlink data-icon="inline-start" aria-hidden />
                      Separar
                    </Button>
                  )}
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
