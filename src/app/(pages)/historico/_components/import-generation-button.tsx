'use client'

import { Upload } from 'lucide-react'
import { type ChangeEvent, useRef, useState } from 'react'
import { toast } from 'sonner'

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
import { Button } from '@/app/components/ui/shadcn/button'
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import { GENERATIONS_PATH } from '@/app/helpers/generation'
import type { PrepareGenerationImportResponse } from '@/models/generation-archive/archive'
import { formatValidUntil } from '@/models/offer/offer'

import {
  discardGenerationImportAction,
  importGenerationAction
} from '../actions'

const DESCRIPTION_ID = 'import-generation-description'

type Preview = Extract<PrepareGenerationImportResponse, { status: 'ready' }>

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
})

const describePages = (pageCount: number) =>
  pageCount === 1 ? '1 arte' : `${pageCount} artes`

const getButtonLabel = (reading: boolean, importing: boolean) => {
  if (reading) return 'Lendo arquivo…'
  if (importing) return 'Importando…'
  return 'Importar para o histórico'
}

const PreviewList = ({ preview }: { preview: Preview }) => {
  const validUntil = formatValidUntil(preview.validUntil)
  const rows: [string, string][] = [
    ['Oferta no arquivo', String(preview.number)],
    ['Gerada em', dateTimeFormatter.format(new Date(preview.createdAt))],
    ['Artes', describePages(preview.pageCount)],
    ['Validade', validUntil ?? 'Sem validade'],
    ['Entra como', `Oferta ${preview.nextNumber}`]
  ]
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export const ImportGenerationButton = () => {
  const fileInput = useRef<HTMLInputElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  // Kept until the dialog finishes closing, so its content stays during the animation
  const [preview, setPreview] = useState<Preview>()
  const [open, setOpen] = useState(false)
  // Closing the dialog discards the file, which must not happen when it closes to import it
  const confirmed = useRef(false)

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Cleared at once, so choosing the same file again fires another change
    input.value = ''
    if (!file) return
    toast.dismiss()
    setReading(true)
    let result: PrepareGenerationImportResponse
    try {
      const response = await fetch(`${GENERATIONS_PATH}/importacao`, {
        method: 'POST',
        body: file
      })
      result = (await response.json()) as PrepareGenerationImportResponse
    } catch {
      result = {
        status: 'error',
        message: 'Não foi possível enviar o arquivo da oferta. Tente de novo.'
      }
    }
    setReading(false)
    if (result.status === 'error') {
      toast.error(result.message, { duration: Infinity })
      button.current?.focus()
      return
    }
    setPreview(result)
    setOpen(true)
  }

  const cancel = () => {
    setOpen(false)
    if (!preview || confirmed.current) return
    void discardGenerationImportAction(preview.token)
  }

  const confirm = async () => {
    if (!preview) return
    confirmed.current = true
    setOpen(false)
    setImporting(true)
    let result: Awaited<ReturnType<typeof importGenerationAction>>
    try {
      result = await importGenerationAction(preview.token)
    } catch {
      result = {
        status: 'error',
        message: 'Não foi possível importar a oferta. Tente de novo.'
      }
    }
    confirmed.current = false
    setImporting(false)
    if (result.status === 'error') {
      toast.error(result.message, { duration: Infinity })
      return
    }
    toast.success(`Oferta importada como oferta ${result.number}.`)
  }

  const busy = reading || importing

  return (
    <div className="flex flex-col gap-2">
      {/* The button opens it, so the input stays out of the tab order and the accessibility tree */}
      <input
        ref={fileInput}
        type="file"
        accept=".zip,application/zip"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={read}
      />
      <Button
        ref={button}
        variant="outline"
        className="self-start"
        aria-describedby={DESCRIPTION_ID}
        disabled={busy}
        focusableWhenDisabled
        onClick={() => fileInput.current?.click()}
      >
        {busy ? (
          <Spinner data-icon="inline-start" aria-hidden />
        ) : (
          <Upload data-icon="inline-start" aria-hidden />
        )}
        {getButtonLabel(reading, importing)}
      </Button>
      <p id={DESCRIPTION_ID} className="text-sm text-muted-foreground">
        Escolha o arquivo .zip baixado em &quot;Baixar tudo (ZIP)&quot;, por
        exemplo oferta-3-completa.zip. Ele entra no histórico como uma oferta
        nova.
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) cancel()
        }}
        onOpenChangeComplete={(isOpen) => {
          if (!isOpen) setPreview(undefined)
        }}
      >
        <AlertDialogContent finalFocus={button}>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar esta oferta?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela entra no histórico com o próximo número e a data em que foi
              gerada. A oferta atual e o resto do histórico continuam como
              estão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {preview && <PreviewList preview={preview} />}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>
              Importar oferta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
