'use client'

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
}

export const LeaveWithoutSavingDialog = ({
  open,
  onCancel,
  onLeave
}: LeaveWithoutSavingDialogProps) => (
  <AlertDialog
    open={open}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) onCancel()
    }}
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
        <AlertDialogDescription>
          As alterações que ainda não foram salvas serão perdidas.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Continuar editando</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onLeave}>
          Sair sem salvar
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
