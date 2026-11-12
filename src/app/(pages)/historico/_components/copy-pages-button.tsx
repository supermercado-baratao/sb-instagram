'use client'

import { CopyPlus } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import { Button, buttonVariants } from '@/app/components/ui/shadcn/button'
import { Checkbox } from '@/app/components/ui/shadcn/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/app/components/ui/shadcn/dialog'
import { FieldLegend, FieldSet } from '@/app/components/ui/shadcn/field'
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import { getGenerationPageHref } from '@/app/helpers/generation'
import { OFFER_PATH } from '@/app/helpers/navigation'
import type { Generation } from '@/domain/generation'

import { copyGenerationPagesAction } from '../actions'

const describeCopied = (count: number) =>
  count === 1
    ? '1 arte copiada para o fim da oferta.'
    : `${count} artes copiadas para o fim da oferta.`

const describeCopyButton = (count: number) => {
  if (count === 0) return 'Copiar artes'
  return count === 1 ? 'Copiar 1 arte' : `Copiar ${count} artes`
}

const describeMissing = (count: number) =>
  count === 1
    ? ' 1 produto não existe mais e ficou de fora.'
    : ` ${count} produtos não existem mais e ficaram de fora.`

const openOffer = (
  <GuardedLink
    href={OFFER_PATH}
    className={buttonVariants({ variant: 'outline', size: 'sm' })}
    onLeave={() => toast.dismiss()}
  >
    Abrir oferta
  </GuardedLink>
)

export const CopyPagesButton = ({ generation }: { generation: Generation }) => {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [copying, startCopy] = useTransition()

  const pageNumbers = Array.from(
    { length: generation.pageCount },
    (_, index) => index + 1
  )

  const changeOpen = (next: boolean) => {
    // Closing mid-copy would suggest it was cancelled, while the pages still reach the offer
    if (copying) return
    if (next) setSelected(new Set())
    setOpen(next)
  }

  const toggle = (pageNumber: number, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(pageNumber)
    else next.delete(pageNumber)
    setSelected(next)
  }

  const copy = () =>
    startCopy(async () => {
      const result = await copyGenerationPagesAction(generation.id, [
        ...selected
      ])
      toast.dismiss()
      if (result.status === 'error') {
        toast.error(result.message, { duration: Infinity })
        return
      }
      setOpen(false)
      const missing =
        result.missingProductCount > 0
          ? describeMissing(result.missingProductCount)
          : ''
      toast.success(`${describeCopied(result.pageCount)}${missing}`, {
        duration: 10_000,
        action: openOffer
      })
    })

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <CopyPlus data-icon="inline-start" aria-hidden />
        Copiar artes
        <span className="sr-only">
          {' '}
          da oferta {generation.number} para a oferta atual
        </span>
      </DialogTrigger>
      <DialogContent showCloseButton={!copying}>
        <DialogHeader>
          <DialogTitle>Copiar artes da oferta {generation.number}</DialogTitle>
          <DialogDescription>
            As artes escolhidas entram no fim da oferta atual, com os produtos e
            preços desta oferta. As artes que já estão lá continuam como estão,
            e um produto que já está na oferta mantém o preço de lá.
          </DialogDescription>
        </DialogHeader>
        <FieldSet className="min-w-0">
          <FieldLegend className="sr-only">Artes para copiar</FieldLegend>
          <ul className="-m-1 flex max-h-[60vh] flex-wrap gap-3 overflow-y-auto p-1">
            {pageNumbers.map((pageNumber) => (
              <li key={pageNumber}>
                <label className="group flex w-24 cursor-pointer flex-col gap-2 text-sm has-data-disabled:cursor-not-allowed">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, already at its final size, so next/image's optimizer adds nothing */}
                  <img
                    src={getGenerationPageHref(generation, pageNumber)}
                    alt=""
                    loading="lazy"
                    width={96}
                    height={120}
                    className="aspect-4/5 w-24 rounded-md border border-border object-cover group-has-data-checked:ring-2 group-has-data-checked:ring-primary"
                  />
                  <span className="flex items-center gap-2">
                    <Checkbox
                      checked={selected.has(pageNumber)}
                      onCheckedChange={(checked) => toggle(pageNumber, checked)}
                      disabled={copying}
                    />
                    Arte {pageNumber}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </FieldSet>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={copying}>
            Cancelar
          </DialogClose>
          <Button
            onClick={copy}
            disabled={copying || selected.size === 0}
            focusableWhenDisabled
          >
            {copying && <Spinner data-icon="inline-start" />}
            {copying ? 'Copiando…' : describeCopyButton(selected.size)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
