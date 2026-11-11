'use client'

import { History } from 'lucide-react'
import { useState } from 'react'

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
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import type { OfferBackupSummary } from '@/domain/offer'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const timeFormatter = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' })

const describePages = (count: number) =>
  count === 1 ? '1 arte' : `${count} artes`

const describeProducts = (count: number) =>
  count === 1 ? '1 produto' : `${count} produtos`

const describeMissing = (count: number) =>
  count === 1
    ? ' 1 produto foi excluído do cadastro desde então e fica de fora.'
    : ` ${count} produtos foram excluídos do cadastro desde então e ficam de fora.`

// Only rendered while the dialog is open, so the time is written in the browser's zone
const describeBackup = (backup: OfferBackupSummary) => {
  const replacedAt = new Date(backup.replacedAt)
  return `Traz de volta a oferta como estava até ${dateFormatter.format(replacedAt)} às ${timeFormatter.format(replacedAt)}: ${describePages(backup.pageCount)} e ${describeProducts(backup.productCount)}, com os preços, a validade e os textos do destaque.${backup.missingProductCount > 0 ? describeMissing(backup.missingProductCount) : ''} A oferta atual fica guardada no lugar dela, então dá para desfazer voltando à versão anterior de novo. O histórico não muda.`
}

type RestoreOfferButtonProps = {
  backup: OfferBackupSummary | undefined
  disabled: boolean
  restoring: boolean
  describedBy: string | undefined
  onConfirm: () => void
}

export const RestoreOfferButton = ({
  backup,
  disabled,
  restoring,
  describedBy,
  onConfirm
}: RestoreOfferButtonProps) => {
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            disabled={!backup || disabled || restoring}
            focusableWhenDisabled
            aria-describedby={describedBy}
          />
        }
      >
        {restoring ? (
          <Spinner data-icon="inline-start" aria-hidden />
        ) : (
          <History data-icon="inline-start" aria-hidden />
        )}
        {restoring ? 'Voltando…' : 'Voltar à versão anterior'}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Voltar à versão anterior?</AlertDialogTitle>
          {backup && (
            <AlertDialogDescription>
              {describeBackup(backup)}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            Voltar à versão anterior
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
