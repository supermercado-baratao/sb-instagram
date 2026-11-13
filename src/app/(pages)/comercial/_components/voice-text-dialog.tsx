'use client'

import { Pencil, Save, Sparkles } from 'lucide-react'
import { type FormEvent, useId, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/app/components/ui/shadcn/dialog'
import {
  Field,
  FieldDescription,
  FieldLabel
} from '@/app/components/ui/shadcn/field'
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import { Textarea } from '@/app/components/ui/shadcn/textarea'
import { useGuardedDialog } from '@/app/hooks/use-guarded-dialog'
import type { Product } from '@/models/product/product'
import type { Pronunciation } from '@/models/radio-ad/pronunciation'
import { getEditedVoiceText } from '@/models/radio-ad/radio-script'
import { suggestVoiceText } from '@/models/radio-ad/spoken-text'

import { saveProductVoiceTextAction } from './actions'

type VoiceTextDialogProps = {
  product: Product
  // The dictionary on screen, saved or not, as the preview uses it
  pronunciations: Pronunciation[]
  onSaved: (product: Product) => void
}

export const VoiceTextDialog = ({
  product,
  pronunciations,
  onSaved
}: VoiceTextDialogProps) => {
  const fieldId = useId()
  const [open, setOpen] = useState(false)
  const suggestion = suggestVoiceText(product, pronunciations)
  // Starts from what the script speaks, since the change is usually small
  const spoken = product.voiceText ?? suggestion
  const [value, setValue] = useState(spoken)
  const [openedWith, setOpenedWith] = useState(spoken)
  const [saving, startSave] = useTransition()
  const guard = useGuardedDialog({
    open,
    dirty: value !== openedWith,
    onOpenChange: (isOpen) => {
      if (isOpen) {
        setValue(spoken)
        setOpenedWith(spoken)
      }
      setOpen(isOpen)
    }
  })

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startSave(async () => {
      const result = await saveProductVoiceTextAction(
        product.id,
        getEditedVoiceText(product.voiceText, value, suggestion)
      )
      toast.dismiss()
      if (result.status === 'error') {
        // An error stays until it is closed, so it isn't missed (WCAG 2.2.1)
        toast.error(result.message, { duration: Infinity })
        return
      }
      onSaved(result.product)
      setOpen(false)
      toast.success(`Locução de ${result.product.description} salva.`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={guard.onOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            // The preview's surface is already `bg-muted`, the ghost hover color
            className="hover:bg-background dark:hover:bg-background"
            aria-label={`Editar locução de ${product.description}`}
          />
        }
      >
        <Pencil aria-hidden />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form noValidate onSubmit={save} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Editar locução de {product.description}</DialogTitle>
            <DialogDescription>
              Como o comercial fala o produto. Fica salvo no cadastro do produto
              e vale para as próximas ofertas geradas.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={fieldId}>Texto da locução</FieldLabel>
            <Textarea
              id={fieldId}
              aria-describedby={`${fieldId}-description`}
              placeholder={suggestion}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <FieldDescription id={`${fieldId}-description`}>
              Com números e medidas por extenso. Vazio, o comercial usa a
              sugestão: {suggestion}.
            </FieldDescription>
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              aria-label="Sugerir texto da locução"
              onClick={() => setValue(suggestion)}
            >
              <Sparkles data-icon="inline-start" aria-hidden />
              Sugerir
            </Button>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={saving} focusableWhenDisabled>
              {saving ? (
                <Spinner data-icon="inline-start" aria-hidden />
              ) : (
                <Save data-icon="inline-start" aria-hidden />
              )}
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
        {guard.leaveDialog}
      </DialogContent>
    </Dialog>
  )
}
