'use client'

import { Pencil } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/app/components/ui/shadcn/dialog'
import { getPhotoUrl } from '@/app/helpers/product-photo'
import { useGuardedDialog } from '@/app/hooks/use-guarded-dialog'
import type { Product } from '@/domain/product'

import { ProductForm } from './product-form'

type EditProductDialogProps = {
  product: Product
  photoVersion?: number
  noEanImages: string[]
  onSaved: (product: Product) => void
  description?: string
  // Given both, the dialog has no trigger of its own and opens where the page asks
  open?: boolean
  onOpenChange?: (open: boolean) => void
  getFocusAfterSave?: () => HTMLElement | null
  getFocusAfterClose?: () => HTMLElement | null
}

export const EditProductDialog = ({
  product,
  photoVersion,
  noEanImages,
  onSaved,
  description = 'As alterações valem para toda a oferta e para o cadastro do produto.',
  open: controlledOpen,
  onOpenChange,
  getFocusAfterSave,
  getFocusAfterClose
}: EditProductDialogProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  // Saving swaps the slot's product while the popup is still closing, and the form must keep the
  // values it opened with, since its fields are uncontrolled
  const [editing, setEditing] = useState(product)
  const [wasOpen, setWasOpen] = useState(open)
  const [dirty, setDirty] = useState(false)
  const savedClose = useRef(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setEditing(product)
      setDirty(false)
    }
  }

  const setOpen = (isOpen: boolean) => {
    setUncontrolledOpen(isOpen)
    onOpenChange?.(isOpen)
  }

  const guard = useGuardedDialog({ open, dirty, onOpenChange: setOpen })

  const getFinalFocus = () => {
    const saved = savedClose.current
    savedClose.current = false
    return (saved ? getFocusAfterSave?.() : getFocusAfterClose?.()) ?? true
  }

  return (
    <Dialog open={open} onOpenChange={guard.onOpenChange}>
      {controlledOpen === undefined && (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Editar ${product.description}`}
            />
          }
        >
          <Pencil aria-hidden />
        </DialogTrigger>
      )}
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-2xl sm:p-6"
        // The photo input comes first in the form, so the name the form focuses itself has to win
        initialFocus={false}
        finalFocus={getFinalFocus}
      >
        <DialogHeader>
          <DialogTitle>Editar produto</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* The popup unmounts when closed, so every opening starts from the current product */}
        <ProductForm
          productId={editing.id}
          codes={editing.codes}
          product={editing}
          photoUrl={
            editing.photo ? getPhotoUrl(editing.id, photoVersion) : undefined
          }
          noEanImages={noEanImages}
          onDirtyChange={setDirty}
          onSaved={(saved) => {
            savedClose.current = true
            onSaved(saved)
            setOpen(false)
          }}
        />
        {guard.leaveDialog}
      </DialogContent>
    </Dialog>
  )
}
