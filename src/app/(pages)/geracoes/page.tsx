import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { requireBrandSettings } from '@/app/helpers/brand-settings'
import { GENERATIONS_HEADING_ID } from '@/app/helpers/generation'
import { database } from '@/infra/database/client'
import { listGenerations } from '@/infra/generation'

import { GenerationList } from './_components/generation-list'

export const metadata: Metadata = { title: 'Gerações' }

const GenerationsPage = async () => {
  await connection()
  const { brand } = requireBrandSettings()

  return (
    <AppLayout brand={brand}>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1
            id={GENERATIONS_HEADING_ID}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none"
          >
            Gerações
          </h1>
          <p className="text-sm text-muted-foreground">
            Cada geração guarda as páginas como estavam ao gerar. Mudar a
            oferta, um produto ou a marca depois não altera as gerações.
          </p>
        </header>
        <GenerationList generations={listGenerations(database)} />
      </main>
    </AppLayout>
  )
}

export default GenerationsPage
