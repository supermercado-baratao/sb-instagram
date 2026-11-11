'use client'

import type { LucideIcon } from 'lucide-react'
import { type ComponentProps, useRef, useState } from 'react'

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

export const CLEAR_NOTE =
  'A limpeza só vale depois de salvar a oferta, e o histórico não muda.'

type ClearOfferButtonProps = {
  label: string
  size?: ComponentProps<typeof Button>['size']
  icon: LucideIcon
  title: string
  description: string
  disabled: boolean
  onConfirm: () => void
  getNextField: () => HTMLElement | null
}

export const ClearOfferButton = ({
  label,
  size,
  icon: Icon,
  title,
  description,
  disabled,
  onConfirm,
  getNextField
}: ClearOfferButtonProps) => {
  const [open, setOpen] = useState(false)
  const confirmed = useRef(false)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (next) confirmed.current = false
        setOpen(next)
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size={size}
            disabled={disabled}
            focusableWhenDisabled
          />
        }
      >
        <Icon data-icon="inline-start" aria-hidden />
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent
        // A scanner types right after clearing, and the trigger may be disabled by then
        finalFocus={() => (confirmed.current ? getNextField() : true)}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              confirmed.current = true
              setOpen(false)
              onConfirm()
            }}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
