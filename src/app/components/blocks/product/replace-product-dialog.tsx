'use client'

import { ArrowRight } from 'lucide-react'

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
import type { Product, ProductChange } from '@/domain/product'

import type { PhotoChange } from './actions'

export type ReplaceRequest = {
  current: Product
  changes: ProductChange[]
  photoChange: PhotoChange
}

type ReplaceProductDialogProps = {
  open: boolean
  // Kept after closing, so the content stays during the closing animation
  request: ReplaceRequest | undefined
  onCancel: () => void
  onConfirm: () => void
}

const FIELD_LABELS: Record<ProductChange['field'], string> = {
  name: 'Nome',
  brand: 'Marca',
  unit: 'Unidade'
}

const PHOTO_CHANGE_LABELS: Record<NonNullable<PhotoChange>, string> = {
  added: 'O produto não tinha foto e passa a ter a nova.',
  replaced: 'A foto atual é trocada pela nova.'
}

const Value = ({ value }: { value: string | null }) =>
  value ? (
    <span className="font-medium text-foreground">{value}</span>
  ) : (
    <span className="italic">vazio</span>
  )

export const ReplaceProductDialog = ({
  open,
  request,
  onCancel,
  onConfirm
}: ReplaceProductDialogProps) => (
  <AlertDialog
    open={open}
    onOpenChange={(next) => {
      if (!next) onCancel()
    }}
  >
    <AlertDialogContent>
      {request && (
        <>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir os dados do produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {request.current.codes.length === 1
                ? `O código ${request.current.codes[0]} já está cadastrado como ${request.current.name}.`
                : `Os códigos ${request.current.codes.join(', ')} já estão cadastrados como ${request.current.name}.`}{' '}
              Salvar troca estes dados:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {request.changes.map(({ field, from, to }) => (
              <li key={field} className="flex flex-wrap items-center gap-x-2">
                <span className="text-foreground">{FIELD_LABELS[field]}:</span>
                <Value value={from} />
                <ArrowRight className="size-4 shrink-0" />
                <span className="sr-only">passa a ser</span>
                <Value value={to} />
              </li>
            ))}
            {request.photoChange && (
              <li>
                <span className="text-foreground">Foto:</span>{' '}
                {PHOTO_CHANGE_LABELS[request.photoChange]}
              </li>
            )}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </>
      )}
    </AlertDialogContent>
  </AlertDialog>
)
