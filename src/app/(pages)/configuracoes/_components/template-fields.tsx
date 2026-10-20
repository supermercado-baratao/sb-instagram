'use client'

import { Trash2 } from 'lucide-react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import type { TemplateDraft } from '@/domain/brand'

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
        <Field className="w-auto">
          <FieldLabel htmlFor={`${id}-primary`}>Cor principal</FieldLabel>
          <Input
            id={`${id}-primary`}
            type="color"
            className="h-8 w-16 cursor-pointer p-1"
            value={template.colors.primary}
            onChange={(event) => setColor('primary', event.target.value)}
          />
        </Field>
        <Field className="w-auto">
          <FieldLabel htmlFor={`${id}-accent`}>Cor de destaque</FieldLabel>
          <Input
            id={`${id}-accent`}
            type="color"
            className="h-8 w-16 cursor-pointer p-1"
            value={template.colors.accent}
            onChange={(event) => setColor('accent', event.target.value)}
          />
        </Field>
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
