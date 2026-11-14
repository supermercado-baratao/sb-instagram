'use client'

import { cn } from 'cn'
import { Upload } from 'lucide-react'
import { type FormEvent, type ReactNode, useRef, useState } from 'react'
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
import { Button } from '@/app/components/ui/shadcn/button'
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

export const RESTORE_BACKUP_SECTION_ID = 'restaurar-backup'

const HEADING_ID = 'backup-restore-heading'
const FILE_INPUT_ID = 'backup-file'
const FILE_ERROR_ID = 'backup-file-error'
const FILE_DESCRIPTION_ID = 'backup-file-description'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
})

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

type RestoreBackupFormProps = {
  title: string
  description: ReactNode
  className?: string
  onBusyChange?: (busy: boolean) => void
  onRestored?: () => void
}

export const RestoreBackupForm = ({
  title,
  description,
  className,
  onBusyChange,
  onRestored
}: RestoreBackupFormProps) => {
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
    onBusyChange?.(true)
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
      onBusyChange?.(false)
      showFileError(result.message)
      return
    }
    setPrepared(result)
    setOpen(true)
  }

  const cancel = () => {
    setOpen(false)
    if (!confirmed.current) onBusyChange?.(false)
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
    onBusyChange?.(false)
    if (result.status === 'error') {
      toast.error(result.message, { duration: Infinity })
      return
    }
    if (fileInput.current) fileInput.current.value = ''
    toast.success('Backup restaurado.')
    onRestored?.()
  }

  const busy = reading || restoring

  return (
    <section
      id={RESTORE_BACKUP_SECTION_ID}
      aria-labelledby={HEADING_ID}
      className={cn('flex max-w-2xl flex-col gap-4', className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id={HEADING_ID} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
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
            O arquivo .zip do backup, por exemplo
            sb-instagram-backup-AAAA-MM-DD.zip ou backup-exemplo.zip.
          </FieldDescription>
          {fileError && <FieldError id={FILE_ERROR_ID}>{fileError}</FieldError>}
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
    </section>
  )
}
