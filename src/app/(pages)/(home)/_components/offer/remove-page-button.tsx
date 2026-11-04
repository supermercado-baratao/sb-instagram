'use client'

import { Trash2 } from 'lucide-react'
import { useRef } from 'react'

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

type RemovePageButtonProps = {
  pageNumber: number
  productCount: number
  disabled: boolean
  onRemove: () => void
}

const describeProducts = (productCount: number) => {
  if (productCount === 0) return 'Ela ainda não tem produtos.'
  return productCount === 1
    ? 'O produto colocado nela sai da oferta.'
    : `Os ${productCount} produtos colocados nela saem da oferta.`
}

export const RemovePageButton = ({
  pageNumber,
  productCount,
  disabled,
  onRemove
}: RemovePageButtonProps) => {
  const removed = useRef(false)

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="sm"
            disabled={disabled}
            focusableWhenDisabled
          />
        }
      >
        <Trash2 data-icon="inline-start" aria-hidden />
        Remover página
      </AlertDialogTrigger>
      <AlertDialogContent
        // After a removal the trigger is gone and the editor focuses the next page's tab
        finalFocus={() => !removed.current}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Remover a página {pageNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            {describeProducts(productCount)} A remoção só vale depois de salvar
            a oferta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              removed.current = true
              onRemove()
            }}
          >
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
