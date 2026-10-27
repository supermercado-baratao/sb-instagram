'use client'

import { CircleAlert, Plus, X } from 'lucide-react'
import { type KeyboardEvent, useId, useRef, useState } from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { INVALID_CODE_MESSAGE } from '@/app/helpers/product-code'
import { isValidCode, normalizeCode } from '@/domain/product'

type CodesFieldProps = {
  codes: string[]
  onChange: (update: (codes: string[]) => string[]) => void
  // The registration dialog takes the first code in its own field, so this one lists the others
  others?: boolean
  codeFieldValue?: string
}

const getCodeError = (code: string, codes: string[]) => {
  if (code === '') return 'Informe o código.'
  if (!isValidCode(code)) return INVALID_CODE_MESSAGE
  if (codes.includes(code)) return 'Este código já está na lista.'
}

export const CodesField = ({
  codes,
  onChange,
  others = false,
  codeFieldValue = ''
}: CodesFieldProps) => {
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const legend = others ? 'Outros códigos' : 'Códigos'
  // A product needs a code, and the dialog's own field holds one already
  const canRemove = others || codes.length > 1

  const add = () => {
    const code = normalizeCode(input.current?.value ?? '')
    const codeError = getCodeError(code, [codeFieldValue, ...codes])
    input.current?.focus()
    if (codeError) {
      setError(codeError)
      // A scanner types the next code where the cursor is, so the wrong one must be replaced
      input.current?.select()
      return
    }
    setError(undefined)
    onChange((current) => [...current, code])
    if (input.current) input.current.value = ''
  }

  // A scanner sends Enter after the code, which would submit the whole product form
  const addOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    add()
  }

  const remove = (code: string) => {
    onChange((current) => current.filter((other) => other !== code))
    setError(undefined)
    input.current?.focus()
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      {/* Removing a code unmounts its row, so the list is submitted from here instead */}
      {codes.map((code) => (
        <input key={code} type="hidden" name="code" value={code} />
      ))}
      <FieldDescription id={`${id}-code-description`}>
        Bipar qualquer um deles encontra este produto. Para uma foto com várias
        variações, como as fragrâncias de um sabonete, adicione o código de cada
        uma.
      </FieldDescription>
      {codes.length > 0 && (
        <ul aria-label={legend} className="flex flex-wrap gap-2">
          {codes.map((code) => (
            <li
              key={code}
              className="flex min-h-7 items-center gap-1 rounded-md border border-border py-0.5 pr-0.5 pl-2.5 font-mono text-sm"
            >
              <span className={canRemove ? undefined : 'pr-2'}>{code}</span>
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remover o código ${code}`}
                  onClick={() => remove(code)}
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-start gap-2">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor={`${id}-code`} className="sr-only">
            Adicionar código
          </FieldLabel>
          <Input
            ref={input}
            id={`${id}-code`}
            autoComplete="off"
            spellCheck={false}
            placeholder="Bipe ou digite outro código"
            onKeyDown={addOnEnter}
            onChange={() => setError(undefined)}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error
                ? `${id}-code-description ${id}-code-error`
                : `${id}-code-description`
            }
            className="font-mono"
          />
          <div aria-live="polite">
            {error && (
              <p
                id={`${id}-code-error`}
                className="flex items-center gap-2 text-sm text-destructive"
              >
                <CircleAlert className="size-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        </Field>
        <Button type="button" variant="outline" onClick={add}>
          <Plus data-icon="inline-start" />
          Adicionar
        </Button>
      </div>
    </FieldSet>
  )
}
