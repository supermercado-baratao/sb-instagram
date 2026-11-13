'use client'

import { cn } from 'cn'
import { Download, Upload } from 'lucide-react'
import { type FormEvent, type MouseEvent, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
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
import { Button, buttonVariants } from '@/app/components/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import type {
  BackupChange,
  PrepareBackupResponse
} from '@/models/backup/backup'

import { applyBackupAction, discardBackupAction } from './actions'

type PreparedBackup = Extract<PrepareBackupResponse, { status: 'ready' }>

const FILE_INPUT_ID = 'backup-file'
const FILE_ERROR_ID = 'backup-file-error'
const FILE_DESCRIPTION_ID = 'backup-file-description'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
})

const getLocalDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')

const getSubmitLabel = (reading: boolean, restoring: boolean) => {
  if (reading) return 'Lendo backup…'
  if (restoring) return 'Restaurando…'
  return 'Restaurar backup'
}

const ChangesTable = ({ changes }: { changes: BackupChange[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <caption className="sr-only">O que muda</caption>
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th scope="col" className="py-2 pr-4 font-medium">
            Dado
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Agora
          </th>
          <th scope="col" className="py-2 font-medium">
            No backup
          </th>
        </tr>
      </thead>
      <tbody>
        {changes.map(({ label, current, backup, changed }) => (
          <tr key={label} className="border-b border-border last:border-0">
            <th scope="row" className="py-2 pr-4 text-left font-normal">
              {label}
            </th>
            <td className="py-2 pr-4">{current}</td>
            <td className={cn('py-2', changed && 'font-semibold')}>
              {backup}
              {changed && <span className="sr-only"> (muda)</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const BackupPanel = () => {
  const fileInput = useRef<HTMLInputElement>(null)
  const submitButton = useRef<HTMLButtonElement>(null)
  const [fileError, setFileError] = useState<string>()
  const [reading, setReading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  // Kept until the dialog finishes closing, so its content stays during the animation
  const [prepared, setPrepared] = useState<PreparedBackup>()
  const [open, setOpen] = useState(false)
  // Closing the dialog discards the file, which must not happen when it closes to restore it
  const confirmed = useRef(false)

  // The file is named on the server, but with the store's own date, since the container's clock
  // usually runs in UTC
  const setDownloadDate = (event: MouseEvent<HTMLAnchorElement>) => {
    event.currentTarget.search = `?data=${getLocalDate(new Date())}`
  }

  const showFileError = (message: string) => {
    flushSync(() => setFileError(message))
    fileInput.current?.focus()
  }

  const read = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const file = fileInput.current?.files?.[0]
    if (!file) {
      showFileError('Escolha o arquivo do backup.')
      return
    }
    setFileError(undefined)
    setReading(true)
    let result: PrepareBackupResponse
    try {
      const response = await fetch('/backup/restauracao', {
        method: 'POST',
        body: file
      })
      result = (await response.json()) as PrepareBackupResponse
    } catch {
      result = {
        status: 'error',
        message: 'Não foi possível enviar o backup. Tente de novo.'
      }
    }
    setReading(false)
    if (result.status === 'error') {
      showFileError(result.message)
      return
    }
    setPrepared(result)
    setOpen(true)
  }

  const cancel = () => {
    setOpen(false)
    if (!prepared || confirmed.current) return
    void discardBackupAction(prepared.token)
  }

  const restore = async () => {
    if (!prepared) return
    const { token } = prepared
    confirmed.current = true
    setOpen(false)
    setRestoring(true)
    const result = await applyBackupAction(token)
    confirmed.current = false
    setRestoring(false)
    if (result.status === 'error') {
      toast.error(result.message, { duration: Infinity })
      return
    }
    if (fileInput.current) fileInput.current.value = ''
    toast.success('Backup restaurado.')
  }

  const busy = reading || restoring

  return (
    <div className="flex w-full max-w-7xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Backup</h1>
        <p className="text-muted-foreground">
          Uma cópia de tudo o que a loja cadastrou no app, para guardar fora
          deste computador ou levar para outra instalação.
        </p>
      </header>

      <section
        aria-labelledby="backup-download-heading"
        className="flex max-w-2xl flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="backup-download-heading" className="text-lg font-semibold">
            Fazer backup
          </h2>
          <p className="text-sm text-muted-foreground">
            O arquivo leva os produtos e as fotos, a oferta, a marca e o logo, o
            comercial e todo o histórico. O app continua funcionando enquanto o
            backup é baixado. Guarde uma cópia num pendrive, num HD externo ou
            na nuvem.
          </p>
        </div>
        <a
          href="/backup.zip"
          download
          onClick={setDownloadDate}
          className={buttonVariants({ className: 'self-start' })}
        >
          <Download data-icon="inline-start" aria-hidden />
          Baixar backup
        </a>
      </section>

      <section
        aria-labelledby="backup-restore-heading"
        className="flex max-w-2xl flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="backup-restore-heading" className="text-lg font-semibold">
            Restaurar backup
          </h2>
          <p className="text-sm text-muted-foreground">
            Restaurar apaga todos os dados atuais do app e coloca no lugar os do
            backup. Antes de aplicar, o app mostra o que muda.
          </p>
        </div>
        <form noValidate onSubmit={read} className="flex flex-col gap-4">
          <Field data-invalid={fileError ? true : undefined}>
            <FieldLabel htmlFor={FILE_INPUT_ID}>Arquivo do backup</FieldLabel>
            <Input
              ref={fileInput}
              id={FILE_INPUT_ID}
              type="file"
              accept=".zip,application/zip"
              disabled={busy}
              onChange={() => setFileError(undefined)}
              aria-invalid={fileError ? true : undefined}
              aria-describedby={
                fileError
                  ? `${FILE_DESCRIPTION_ID} ${FILE_ERROR_ID}`
                  : FILE_DESCRIPTION_ID
              }
            />
            <FieldDescription id={FILE_DESCRIPTION_ID}>
              O arquivo .zip baixado em &quot;Baixar backup&quot;, por exemplo
              sb-instagram-backup-AAAA-MM-DD.zip.
            </FieldDescription>
            {fileError && (
              <FieldError id={FILE_ERROR_ID}>{fileError}</FieldError>
            )}
          </Field>
          <Button
            ref={submitButton}
            type="submit"
            variant="outline"
            className="self-start"
            disabled={busy}
            focusableWhenDisabled
          >
            {busy ? (
              <Spinner data-icon="inline-start" aria-hidden />
            ) : (
              <Upload data-icon="inline-start" aria-hidden />
            )}
            {getSubmitLabel(reading, restoring)}
          </Button>
        </form>
      </section>

      <AlertDialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) cancel()
        }}
        onOpenChangeComplete={(isOpen) => {
          if (!isOpen) setPrepared(undefined)
        }}
      >
        <AlertDialogContent className="sm:max-w-lg" finalFocus={submitButton}>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar este backup?</AlertDialogTitle>
            {prepared && (
              <AlertDialogDescription>
                Todos os dados atuais do app serão substituídos pelos do backup
                feito em{' '}
                {dateTimeFormatter.format(new Date(prepared.createdAt))}. O que
                foi salvo depois disso se perde.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {prepared && <ChangesTable changes={prepared.changes} />}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={restore}>
              Restaurar backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
