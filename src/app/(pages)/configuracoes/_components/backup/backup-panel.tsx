'use client'

import { Download } from 'lucide-react'
import type { MouseEvent } from 'react'

import { RestoreBackupForm } from '@/app/components/blocks/backup/restore-backup-form'
import { buttonVariants } from '@/app/components/ui/shadcn/button'

const getLocalDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')

// The file is named on the server, but with the store's own date, since the container's clock
// usually runs in UTC
const setDownloadDate = (event: MouseEvent<HTMLAnchorElement>) => {
  event.currentTarget.search = `?data=${getLocalDate(new Date())}`
}

export const BackupPanel = () => (
  <div className="flex w-full max-w-7xl flex-col gap-8">
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Backup</h1>
      <p className="text-muted-foreground">
        Uma cópia de tudo o que a loja cadastrou no app, para guardar fora deste
        computador ou levar para outra instalação.
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
          backup é baixado. Guarde uma cópia num pendrive, num HD externo ou na
          nuvem.
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

    <RestoreBackupForm
      title="Restaurar backup"
      description="Restaurar apaga todos os dados atuais do app e coloca no lugar os do backup. Antes de aplicar, o app mostra o que muda."
    />
  </div>
)
