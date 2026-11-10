'use client'

import { cn } from 'cn'
import {
  CircleAlert,
  Download,
  ExternalLink,
  type LucideIcon,
  RefreshCw
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button, buttonVariants } from '@/app/components/ui/shadcn/button'
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import { CATALOG_EXPORT_REPORT_FILE } from '@/domain/catalog-export'

const FILE_NAME = 'catalogo.zip'

// The instance has no git, so the store sends the ZIP through GitHub's site (#66)
const SENDING_GUIDE_URL =
  'https://github.com/supermercado-baratao/sb-instagram/blob/main/CONTRIBUTING.md#enviando-pelo-site-do-github'

type Status = {
  kind: 'error' | 'info'
  message: string
  // A new id remounts the message, so the same text twice in a row is announced again
  id: number
}

type ExportResult =
  | { status: 'exported'; zip: Blob; count: number }
  | { status: 'empty' }
  | { status: 'error' }

const fetchExport = async (all: boolean): Promise<ExportResult> => {
  // fetch rejects when the instance can't be reached, e.g. restarting during a long export
  try {
    const response = await fetch(
      `/produtos/${FILE_NAME}${all ? '?todos=1' : ''}`,
      {
        method: 'POST'
      }
    )
    if (response.status === 204) return { status: 'empty' }
    if (!response.ok) return { status: 'error' }
    return {
      status: 'exported',
      zip: await response.blob(),
      count: Number(response.headers.get('X-Exported-Count'))
    }
  } catch {
    return { status: 'error' }
  }
}

const download = (zip: Blob) => {
  const url = URL.createObjectURL(zip)
  const link = document.createElement('a')
  link.href = url
  link.download = FILE_NAME
  link.click()
  URL.revokeObjectURL(url)
}

const getExportedMessage = (count: number) =>
  `Exportação baixada com ${count === 1 ? '1 produto' : `${count} produtos`}. Veja em ${CATALOG_EXPORT_REPORT_FILE} os que ficaram de fora.`

type ExportButtonContentProps = {
  busy: boolean
  icon: LucideIcon
  label: string
}

// Both labels share one grid cell, so the button keeps the longest one's width and the link
// next to it never moves under the pointer while exporting; the hidden label is also hidden
// from screen readers
const ExportButtonContent = ({
  busy,
  icon: Icon,
  label
}: ExportButtonContentProps) => (
  <>
    {busy ? (
      <Spinner data-icon="inline-start" aria-hidden />
    ) : (
      <Icon data-icon="inline-start" aria-hidden />
    )}
    <span className="grid">
      <span className={cn('col-start-1 row-start-1', busy && 'invisible')}>
        {label}
      </span>
      <span className={cn('col-start-1 row-start-1', !busy && 'invisible')}>
        Exportando…
      </span>
    </span>
  </>
)

type CatalogExportButtonProps = {
  onFinished: () => void
}

export const CatalogExportButton = ({
  onFinished
}: CatalogExportButtonProps) => {
  const router = useRouter()
  const [status, setStatus] = useState<Status>()
  const [exporting, startExport] = useTransition()
  const [exportingAll, setExportingAll] = useState(false)

  const show = (status: Omit<Status, 'id'>) =>
    setStatus({ ...status, id: Date.now() })

  // Fetched instead of linked, since preparing every photo takes a while and a plain link would
  // give no sign of progress
  const exportCatalog = (all: boolean) => {
    show({ kind: 'info', message: 'Preparando as fotos dos produtos…' })
    setExportingAll(all)
    startExport(async () => {
      const result = await fetchExport(all)
      if (result.status === 'error') {
        show({
          kind: 'error',
          message: 'Não foi possível exportar os produtos. Tente de novo.'
        })
      } else if (result.status === 'empty') {
        show({
          kind: 'info',
          message:
            'Nenhum produto novo ou alterado desde a última exportação. Veja a situação de cada um em Enviar ao catálogo.'
        })
      } else {
        download(result.zip)
        show({ kind: 'info', message: getExportedMessage(result.count) })
        // The list shows what was exported
        router.refresh()
      }
      // A scanner types into the focused element and sends Enter, so leaving the focus here would
      // run the export again on the next scan
      onFinished()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={exporting}
          focusableWhenDisabled
          onClick={() => exportCatalog(false)}
        >
          <ExportButtonContent
            busy={exporting && !exportingAll}
            icon={Download}
            label="Exportar para o catálogo"
          />
        </Button>
        <Button
          variant="ghost"
          disabled={exporting}
          focusableWhenDisabled
          onClick={() => exportCatalog(true)}
        >
          <ExportButtonContent
            busy={exporting && exportingAll}
            icon={RefreshCw}
            label="Exportar todos de novo"
          />
        </Button>
        <a
          href={SENDING_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: 'link' })}
        >
          Como enviar ao catálogo
          <ExternalLink data-icon="inline-end" aria-hidden />
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      </div>
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
