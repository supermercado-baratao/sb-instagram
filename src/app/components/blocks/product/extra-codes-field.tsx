'use client'

import { CircleAlert, Plus, X } from 'lucide-react'
import {
  type KeyboardEvent,
  useId,
  useRef,
  useState,
  useTransition
} from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'

import { checkExtraCode } from './actions'

type ExtraCodesFieldProps = {
  productCode: string
  codes: string[]
  onChange: (update: (codes: string[]) => string[]) => void
}

export const ExtraCodesField = ({
  productCode,
  codes,
  onChange
}: ExtraCodesFieldProps) => {
  const [error, setError] = useState<string>()
  const [checking, startCheck] = useTransition()
  const input = useRef<HTMLInputElement>(null)
  const id = useId()

  const add = () => {
    if (checking) return
    const value = input.current?.value ?? ''
    startCheck(async () => {
      const result = await checkExtraCode(productCode, value)
      input.current?.focus()
      if (result.status === 'error') {
        setError(result.message)
        // A scanner types the next code where the cursor is, so the wrong one must be replaced
        input.current?.select()
        return
      }
      setError(undefined)
      // The list may have changed while the code was checked on the server
      onChange((current) =>
        current.includes(result.code) ? current : [...current, result.code]
      )
      if (input.current) input.current.value = ''
    })
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
      <FieldLegend variant="label">Outros códigos</FieldLegend>
      {/* Removing a code unmounts its row, so the list is submitted from here instead */}
      {codes.map((code) => (
        <input key={code} type="hidden" name="extraCode" value={code} />
      ))}
      <FieldDescription id={`${id}-extra-code-description`}>
        Códigos de variações vendidas com a mesma foto, como as fragrâncias de
        um sabonete. Bipar qualquer um deles encontra este produto.
      </FieldDescription>
      {codes.length > 0 && (
        <ul aria-label="Outros códigos" className="flex flex-wrap gap-2">
          {codes.map((code) => (
            <li
              key={code}
              className="flex items-center gap-1 rounded-md border border-border py-0.5 pr-0.5 pl-2.5 font-mono text-sm"
            >
              {code}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remover o código ${code}`}
                onClick={() => remove(code)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-start gap-2">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor={`${id}-extra-code`} className="sr-only">
            Adicionar outro código
          </FieldLabel>
          <Input
            ref={input}
            id={`${id}-extra-code`}
            autoComplete="off"
            spellCheck={false}
            placeholder="Bipe ou digite outro código"
            onKeyDown={addOnEnter}
            onChange={() => setError(undefined)}
            aria-busy={checking || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error
                ? `${id}-extra-code-description ${id}-extra-code-error`
                : `${id}-extra-code-description`
            }
            className="font-mono"
          />
          <div aria-live="polite">
            {error && (
              <p
                id={`${id}-extra-code-error`}
                className="flex items-center gap-2 text-sm text-destructive"
              >
                <CircleAlert className="size-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        </Field>
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={checking}
          focusableWhenDisabled
        >
          <Plus data-icon="inline-start" />
          Adicionar
        </Button>
      </div>
    </FieldSet>
  )
}
