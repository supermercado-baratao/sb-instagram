'use client'

import { Pencil } from 'lucide-react'
import { useState } from 'react'

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
import type { Product } from '@/domain/product'

import { ProductForm } from './product-form'

type EditProductDialogProps = {
  product: Product
  photoVersion?: number
  noEanImages: string[]
  onSaved: (product: Product) => void
}

export const EditProductDialog = ({
  product,
  photoVersion,
  noEanImages,
  onSaved
}: EditProductDialogProps) => {
  const [open, setOpen] = useState(false)
  // Saving swaps the slot's product while the popup is still closing, and the form must keep the
  // values it opened with, since its fields are uncontrolled
  const [editing, setEditing] = useState(product)

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) setEditing(product)
        setOpen(isOpen)
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Editar ${product.name}`}
          />
        }
      >
        <Pencil aria-hidden />
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-2xl sm:p-6"
        // The photo input comes first in the form, so the name the form focuses itself has to win
        initialFocus={false}
      >
        <DialogHeader>
          <DialogTitle>Editar produto</DialogTitle>
          <DialogDescription>
            As alterações valem para todas as ofertas que usam este produto.
          </DialogDescription>
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
          onSaved={(saved) => {
            onSaved(saved)
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
