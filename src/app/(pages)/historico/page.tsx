import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { GENERATIONS_HEADING_ID } from '@/app/helpers/generation'
import { requireBrandSettings } from '@/entry/brand'
import { database } from '@/infra/database/client'
import { listGenerations } from '@/infra/generation'

import { GenerationList } from './_components/generation-list'
import { ImportGenerationButton } from './_components/import-generation-button'

export const metadata: Metadata = { title: 'Histórico' }

const GenerationsPage = async () => {
  await connection()
  const { brand } = requireBrandSettings()

  return (
    <AppLayout brand={brand}>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1
              id={GENERATIONS_HEADING_ID}
              tabIndex={-1}
              className="text-2xl font-semibold tracking-tight outline-none"
            >
              Histórico
            </h1>
            <p className="text-sm text-muted-foreground">
              Cada oferta gerada guarda as artes, o PDF e o comercial como
              estavam ao gerar. Mudar a oferta, um produto ou a marca depois não
              altera o histórico.
            </p>
          </div>
          <ImportGenerationButton />
        </header>
        <GenerationList generations={listGenerations(database)} />
      </main>
    </AppLayout>
  )
}

export default GenerationsPage
