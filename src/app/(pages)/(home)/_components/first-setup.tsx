'use client'

import { useRef, useState } from 'react'

import { RestoreBackupForm } from '@/app/components/blocks/backup/restore-backup-form'
import { BrandSettingsForm } from '@/app/components/blocks/brand/brand-settings-form'
import { createBrandContent } from '@/models/brand/brand'

const SWAP_TIMEOUT_MS = 10_000

// The restore swaps this whole screen for the offer editor, so the focus would fall to the body
// with the button it was on (#130). The action resolves before React commits the new page, so
// this waits for the first setup to leave the document
const focusHeadingAfterSwap = (firstSetup: HTMLElement | null) => {
  if (!firstSetup) return
  const focusHeading = () => {
    if (firstSetup.isConnected) return false
    const heading = document.querySelector<HTMLElement>('main h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus()
    }
    return true
  }
  if (focusHeading()) return
  const observer = new MutationObserver(() => {
    if (focusHeading()) observer.disconnect()
  })
  observer.observe(document.body, { childList: true, subtree: true })
  setTimeout(() => observer.disconnect(), SWAP_TIMEOUT_MS)
}

export const FirstSetup = () => {
  // Saving the brand while a backup replaces it would race the two writes
  const [restoring, setRestoring] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  return (
    <>
      <div ref={root} inert={restoring} className="flex w-full justify-center">
        <BrandSettingsForm
          firstSetup
          initialContent={createBrandContent()}
          initialLogoUrl={null}
        />
      </div>
      <div className="mt-12 w-full max-w-7xl border-t border-border pt-10">
        <RestoreBackupForm
          title="Já tem um backup?"
          description="Vai trazer o app de outro computador ou experimentar o backup de exemplo? Restaure o arquivo aqui, sem configurar a marca: ela vem do backup, com os produtos, a oferta e o histórico."
          onBusyChange={setRestoring}
          onRestored={() => focusHeadingAfterSwap(root.current)}
        />
      </div>
    </>
  )
}
