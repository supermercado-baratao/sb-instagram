'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { normalizeHexColor, type TemplateDraft } from '@/models/brand/brand'

type TemplateFieldsProps = {
  id: string
  number: number
  template: TemplateDraft
  invalid: boolean
  // Points the invalid name at the status message, which holds the reason
  errorId: string
  canRemove: boolean
  onChange: (template: TemplateDraft) => void
  onRemove: () => void
}

type ColorFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}

// The native picker makes an exact brand color hard to hit, so the code can be typed or
// pasted next to it (#102). Only a complete code reaches the template, and leaving the
// field drops an incomplete one.
const ColorField = ({ id, label, value, onChange }: ColorFieldProps) => {
  const [draft, setDraft] = useState<string>()

  return (
    <Field className="w-auto">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          type="color"
          className="h-8 w-16 cursor-pointer p-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          aria-label={`${label} (código)`}
          autoComplete="off"
          spellCheck={false}
          maxLength={9}
          className="w-24 font-mono"
          value={draft ?? value}
          onChange={(event) => {
            setDraft(event.target.value)
            const color = normalizeHexColor(event.target.value)
            if (color) onChange(color)
          }}
          onBlur={() => setDraft(undefined)}
        />
      </div>
    </Field>
  )
}

export const getTemplateLabel = (template: TemplateDraft, number: number) =>
  template.name.trim() || `Modelo ${number}`

export const TemplateFields = ({
  id,
  number,
  template,
  invalid,
  errorId,
  canRemove,
  onChange,
  onRemove
}: TemplateFieldsProps) => {
  const label = getTemplateLabel(template, number)
  const nameInvalid = invalid && template.name.trim() === ''
  const setColor = (color: keyof TemplateDraft['colors'], value: string) =>
    onChange({ ...template, colors: { ...template.colors, [color]: value } })

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      {/* Every row repeats the color labels, so the legend tells which template they belong to */}
      <FieldSet className="flex-row flex-wrap items-end gap-4">
        <FieldLegend className="sr-only">{label}</FieldLegend>
        <Field
          className="min-w-40 flex-1"
          data-invalid={nameInvalid ? true : undefined}
        >
          <FieldLabel htmlFor={`${id}-name`}>
            Nome do modelo {number}
          </FieldLabel>
          <Input
            id={`${id}-name`}
            autoComplete="off"
            aria-invalid={nameInvalid ? true : undefined}
            aria-describedby={nameInvalid ? errorId : undefined}
            value={template.name}
            onChange={(event) =>
              onChange({ ...template, name: event.target.value })
            }
          />
        </Field>
        <ColorField
          id={`${id}-primary`}
          label="Cor principal"
          value={template.colors.primary}
          onChange={(value) => setColor('primary', value)}
        />
        <ColorField
          id={`${id}-accent`}
          label="Cor de destaque"
          value={template.colors.accent}
          onChange={(value) => setColor('accent', value)}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remover ${label}`}
          disabled={!canRemove}
          focusableWhenDisabled
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      </FieldSet>
    </li>
  )
}
