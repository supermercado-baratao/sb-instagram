'use client'

import { cn } from 'cn'
import { CircleAlert, Download } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import { CATALOG_EXPORT_REPORT_FILE } from '@/domain/catalog-export'

const FILE_NAME = 'catalogo.zip'

type Status = {
  kind: 'error' | 'info'
  message: string
  // A new id remounts the message, so the same text twice in a row is announced again
  id: number
}

const fetchExport = async () => {
  // fetch rejects when the instance can't be reached, e.g. restarting during a long export
  try {
    const response = await fetch(`/produtos/${FILE_NAME}`)
    return response.ok ? await response.blob() : undefined
  } catch {
    return
  }
}

type CatalogExportButtonProps = {
  onFinished: () => void
}

export const CatalogExportButton = ({
  onFinished
}: CatalogExportButtonProps) => {
  const [status, setStatus] = useState<Status>()
  const [exporting, startExport] = useTransition()

  const show = (status: Omit<Status, 'id'>) =>
    setStatus({ ...status, id: Date.now() })

  // Fetched instead of linked, since preparing every photo takes a while and a plain link would
  // give no sign of progress
  const exportCatalog = () => {
    show({ kind: 'info', message: 'Preparando as fotos dos produtos…' })
    startExport(async () => {
      await downloadExport()
      // A scanner types into the focused element and sends Enter, so leaving the focus here would
      // run the export again on the next scan
      onFinished()
    })
  }

  const downloadExport = async () => {
    const zip = await fetchExport()
    if (!zip) {
      show({
        kind: 'error',
        message: 'Não foi possível exportar os produtos. Tente de novo.'
      })
      return
    }
    const url = URL.createObjectURL(zip)
    const link = document.createElement('a')
    link.href = url
    link.download = FILE_NAME
    link.click()
    URL.revokeObjectURL(url)
    show({
      kind: 'info',
      message: `Exportação baixada. Veja em ${CATALOG_EXPORT_REPORT_FILE} os produtos que ficaram de fora.`
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="self-start"
        disabled={exporting}
        focusableWhenDisabled
        onClick={exportCatalog}
      >
        <Download data-icon="inline-start" aria-hidden />
        Exportar para o catálogo
      </Button>
      <div aria-live="polite" className="min-h-5">
        {status && (
          <p
            key={status.id}
            className={cn(
              'flex items-center gap-2 text-sm',
              status.kind === 'error' && 'text-destructive',
              status.kind === 'info' && 'text-muted-foreground'
            )}
          >
            {status.kind === 'error' && (
              <CircleAlert className="size-4 shrink-0" aria-hidden />
            )}
            {status.message}
          </p>
        )}
      </div>
    </div>
  )
}
