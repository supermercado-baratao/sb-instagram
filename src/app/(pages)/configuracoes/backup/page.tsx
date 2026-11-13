import type { Metadata } from 'next'
import { connection } from 'next/server'

import { BackupPanel } from '@/app/(pages)/configuracoes/_components/backup/backup-panel'
import { SettingsTabs } from '@/app/(pages)/configuracoes/_components/settings-tabs'
import { AppLayout } from '@/app/components/layouts/app'
import { BACKUP_PATH } from '@/app/helpers/navigation'
import { requireBrandSettings } from '@/entry/brand'

export const metadata: Metadata = { title: 'Backup' }

const BackupPage = async () => {
  await connection()
  const { brand } = requireBrandSettings()

  return (
    <AppLayout brand={brand}>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10 sm:px-6">
        <SettingsTabs current={BACKUP_PATH}>
          <BackupPanel />
        </SettingsTabs>
      </main>
    </AppLayout>
  )
}

export default BackupPage
