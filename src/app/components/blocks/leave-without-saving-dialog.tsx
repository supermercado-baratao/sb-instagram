'use client'

import { useRef } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/app/components/ui/shadcn/alert-dialog'

type LeaveWithoutSavingDialogProps = {
  open: boolean
  onCancel: () => void
  onLeave: () => void
  // For a dialog nested in the one it guards, whose own final focus must win over this one's
  // return to an element that is gone
  keepFocusOnLeave?: boolean
}

export const LeaveWithoutSavingDialog = ({
  open,
  onCancel,
  onLeave,
  keepFocusOnLeave = false
}: LeaveWithoutSavingDialogProps) => {
  const left = useRef(false)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
    >
      <AlertDialogContent
        finalFocus={() => {
          const leaving = left.current
          left.current = false
          return !(leaving && keepFocusOnLeave)
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
          <AlertDialogDescription>
            As alterações que ainda não foram salvas serão perdidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              left.current = true
              onLeave()
            }}
          >
            Sair sem salvar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
