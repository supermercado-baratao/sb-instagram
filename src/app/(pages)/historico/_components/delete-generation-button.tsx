'use client'

import { Trash2 } from 'lucide-react'
import { useRef, useState, useTransition } from 'react'
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
import { GENERATIONS_HEADING_ID } from '@/app/helpers/generation'
import type { Generation } from '@/domain/generation'

import { deleteGenerationAction } from '../actions'

// The deleted card takes the trigger with it, so focus would fall back to <body>
const getFinalFocus = () =>
  document.querySelector<HTMLElement>(`#${GENERATIONS_HEADING_ID}`)

export const DeleteGenerationButton = ({
  generation
}: {
  generation: Generation
}) => {
  const [open, setOpen] = useState(false)
  const [deleting, startDelete] = useTransition()
  const deleted = useRef(false)

  const confirm = () =>
    startDelete(async () => {
      const result = await deleteGenerationAction(generation.id)
      setOpen(false)
      toast.dismiss()
      if (result.status === 'error') {
        toast.error(result.message, { duration: Infinity })
        return
      }
      deleted.current = true
      getFinalFocus()?.focus()
      toast.success(`Oferta ${generation.number} excluída do histórico.`)
    })

  return (
    <AlertDialog
      open={open}
      // Closing mid-delete would suggest it was cancelled, while the card still disappears
      onOpenChange={(next) => !deleting && setOpen(next)}
    >
      <AlertDialogTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={`Excluir a oferta ${generation.number}`}
      >
        <Trash2 data-icon="inline-start" aria-hidden />
        Excluir
      </AlertDialogTrigger>
      <AlertDialogContent
        finalFocus={() => (deleted.current ? getFinalFocus() : true)}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir a oferta {generation.number}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            As artes, o PDF e os textos desta oferta serão apagados. A oferta
            atual e o resto do histórico continuam como estão.
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
