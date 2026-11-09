'use client'

import { CircleAlert, CircleCheck, CircleDashed, Send } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import type { CatalogStatus as Status } from '@/domain/catalog-export'

const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const unsubscribe = () => {}
const subscribe = () => unsubscribe

// The container's clock usually runs in UTC, so the date is only written in the browser's zone
const ExportedAt = ({ date }: { date: Date }) => {
  const text = useSyncExternalStore(
    subscribe,
    () => formatter.format(date),
    () => ''
  )
  if (text === '') return null
  return (
    <>
      {' em '}
      <time dateTime={date.toISOString()}>{text}</time>
    </>
  )
}

const getContent = (status: Status) => {
  switch (status.kind) {
    case 'in-catalog': {
      return { Icon: CircleCheck, text: 'No catálogo' }
    }
    case 'ready': {
      return { Icon: CircleDashed, text: 'Pronto para o catálogo' }
    }
    case 'exported': {
      return { Icon: Send, text: 'Exportado para o catálogo' }
    }
    case 'pending': {
      return { Icon: CircleAlert, text: `Fora do catálogo: ${status.reason}` }
    }
  }
}

type CatalogStatusProps = {
  status: Status
  id: string
}

// Hidden from the row button's name and read as its description instead, since a reason may be a
// whole sentence, heard on every row otherwise
export const CatalogStatus = ({ status, id }: CatalogStatusProps) => {
  const { Icon, text } = getContent(status)
  return (
    <span
      id={id}
      aria-hidden
      className="flex items-start gap-1.5 text-sm text-muted-foreground"
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        {text}
        {status.kind === 'exported' && <ExportedAt date={status.exportedAt} />}
      </span>
    </span>
  )
}
