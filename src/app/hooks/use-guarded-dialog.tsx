import { type ReactNode, useState } from 'react'

import { LeaveWithoutSavingDialog } from '@/app/components/blocks/leave-without-saving-dialog'

import { useUnsavedChangesWarning } from './use-unsaved-changes-warning'

type GuardedDialogOptions = {
  open: boolean
  dirty: boolean
  onOpenChange: (open: boolean) => void
}

// Esc, the close button, a `DialogClose` and a press outside all go through `onOpenChange`, so
// asking there covers every way out but a save, which closes the dialog itself
export const useGuardedDialog = ({
  open,
  dirty,
  onOpenChange
}: GuardedDialogOptions): {
  onOpenChange: (open: boolean) => void
  leaveDialog: ReactNode
} => {
  const [asking, setAsking] = useState(false)
  useUnsavedChangesWarning(open && dirty)

  return {
    onOpenChange: (isOpen) => {
      if (!isOpen && dirty) {
        setAsking(true)
        return
      }
      onOpenChange(isOpen)
    },
    // Rendered inside the dialog's popup, so Base UI nests it and the outer dialog stays open
    leaveDialog: (
      <LeaveWithoutSavingDialog
        open={asking}
        keepFocusOnLeave
        onCancel={() => setAsking(false)}
        onLeave={() => {
          setAsking(false)
          onOpenChange(false)
        }}
      />
    )
  }
}
