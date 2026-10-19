'use client'

import { Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

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

import { deleteOfferAction } from '../actions'
import { useAnnounce } from './offers-announcer'

export const OFFERS_HEADING_ID = 'offers-heading'

type DeleteOfferButtonProps = {
  id: number
  name: string
}

// The deleted row takes the trigger with it, so focus would fall back to <body>
const getFinalFocus = () =>
  document.querySelector<HTMLElement>(`#${OFFERS_HEADING_ID}`)

export const DeleteOfferButton = ({ id, name }: DeleteOfferButtonProps) => {
  const [open, setOpen] = useState(false)
  const [deleting, startDelete] = useTransition()
  const announce = useAnnounce()

  const confirm = () =>
    startDelete(async () => {
      await deleteOfferAction(id)
      getFinalFocus()?.focus()
      announce(`Oferta “${name}” excluída.`)
    })

  return (
    <AlertDialog
      open={open}
      // Closing mid-delete would suggest it was cancelled, while the row still disappears
      onOpenChange={(next) => !deleting && setOpen(next)}
    >
      <AlertDialogTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={`Excluir ${name}`}
      >
        <Trash2 data-icon="inline-start" aria-hidden />
        Excluir
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            As páginas e os preços desta oferta serão apagados. Os produtos
            continuam cadastrados.
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
