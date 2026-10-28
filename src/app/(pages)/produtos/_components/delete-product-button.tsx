'use client'

import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'

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
import { formatQuotedList } from '@/app/helpers/list-format'
import type { Product } from '@/domain/product'

import { deleteProductAction } from '../actions'

export const PRODUCTS_HEADING_ID = 'products-title'

type DeleteProductButtonProps = {
  product: Product
  disabled: boolean
  onDeleted: (product: Product) => void
}

// The deleted row takes the trigger with it, so focus would fall back to <body>
const getFinalFocus = () =>
  document.querySelector<HTMLElement>(`#${PRODUCTS_HEADING_ID}`)

const getInUseMessage = (offers: string[]) => {
  const names = formatQuotedList(offers)
  return offers.length === 1
    ? `Este produto está na oferta ${names}. Tire-o dela antes de excluir.`
    : `Este produto está nas ofertas ${names}. Tire-o delas antes de excluir.`
}

export const DeleteProductButton = ({
  product,
  disabled,
  onDeleted
}: DeleteProductButtonProps) => {
  const [open, setOpen] = useState(false)
  const [deleting, startDelete] = useTransition()
  const [refusal, setRefusal] = useState<string>()
  const closeButton = useRef<HTMLButtonElement>(null)

  // The refusal unmounts the focused "Excluir", which would leave focus on the dialog itself
  useEffect(() => {
    if (refusal) closeButton.current?.focus()
  }, [refusal])

  const confirm = () =>
    startDelete(async () => {
      const result = await deleteProductAction(product.id)
      if (result.status === 'deleted') {
        getFinalFocus()?.focus()
        onDeleted(product)
        return
      }
      setRefusal(
        result.status === 'in-use'
          ? getInUseMessage(result.offers)
          : result.message
      )
    })

  return (
    <AlertDialog
      open={open}
      // Closing mid-delete would suggest it was cancelled, while the row may still disappear
      onOpenChange={(next) => {
        if (deleting) return
        setOpen(next)
        if (next) setRefusal(undefined)
      }}
    >
      <AlertDialogTrigger
        render={<Button variant="ghost" size="icon" />}
        // Not every product is unique by name, so the codes tell them apart
        aria-label={`Excluir ${product.name} (${product.codes.join(', ')})`}
        disabled={disabled}
      >
        <Trash2 aria-hidden />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {refusal
              ? `Não é possível excluir “${product.name}”`
              : `Excluir “${product.name}”?`}
          </AlertDialogTitle>
          <AlertDialogDescription
            // A fresh alert is announced, while a changed description is not read again
            key={refusal ? 'refusal' : 'confirm'}
            role={refusal ? 'alert' : undefined}
          >
            {refusal ??
              'O produto e a foto dele serão apagados. As imagens do catálogo da comunidade continuam disponíveis.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {refusal ? (
            <AlertDialogCancel ref={closeButton}>Fechar</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={deleting}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleting}
                focusableWhenDisabled
                onClick={confirm}
              >
                Excluir
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
