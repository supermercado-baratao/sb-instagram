'use client'

import { Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/app/components/ui/shadcn/alert-dialog'
import { Button } from '@/app/components/ui/shadcn/button'
import type { OfferGeneration } from '@/domain/offer-generation'

import { deleteOfferGenerationAction } from '../actions'

export const GENERATIONS_HEADING_ID = 'offer-generations-heading'

// The deleted card takes the trigger with it, so focus would fall back to <body>
const getFinalFocus = () =>
  document.querySelector<HTMLElement>(`#${GENERATIONS_HEADING_ID}`)

export const DeleteGenerationButton = ({
  generation
}: {
  generation: OfferGeneration
}) => {
  const [open, setOpen] = useState(false)
  const [deleting, startDelete] = useTransition()

  const confirm = () =>
    startDelete(async () => {
      const result = await deleteOfferGenerationAction(
        generation.offerId,
        generation.id
      )
      setOpen(false)
      toast.dismiss()
      if (result.status === 'error') {
        toast.error(result.message, { duration: Infinity })
        return
      }
      getFinalFocus()?.focus()
      toast.success(`Geração ${generation.number} excluída.`)
    })

  return (
    <AlertDialog
      open={open}
      // Closing mid-delete would suggest it was cancelled, while the card still disappears
      onOpenChange={(next) => !deleting && setOpen(next)}
    >
      <AlertDialogTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={`Excluir a geração ${generation.number}`}
      >
        <Trash2 data-icon="inline-start" aria-hidden />
        Excluir
      </AlertDialogTrigger>
      <AlertDialogContent finalFocus={getFinalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir a geração {generation.number}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            As imagens, o PDF e o JSON desta geração serão apagados. A oferta e
            as outras gerações continuam como estão.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            focusableWhenDisabled
            onClick={confirm}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
