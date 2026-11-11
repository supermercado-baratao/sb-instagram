import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { requireBrandSettings } from '@/app/helpers/brand-settings'
import { database } from '@/infra/database/client'
import { findOffer } from '@/infra/offer'
import { listPronunciations } from '@/infra/pronunciation'
import { findRadioScriptTemplate } from '@/infra/radio-script'

import { RadioAdForm } from './_components/radio-ad-form'

export const metadata: Metadata = { title: 'Comercial' }

const RadioAdPage = async () => {
  await connection()
  const { brand } = requireBrandSettings()

  return (
    <AppLayout brand={brand}>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10 sm:px-6">
        <RadioAdForm
          offer={findOffer(database)}
          initialPronunciations={listPronunciations(database)}
          initialRadioScript={findRadioScriptTemplate(database)}
        />
      </main>
    </AppLayout>
  )
}

export default RadioAdPage
