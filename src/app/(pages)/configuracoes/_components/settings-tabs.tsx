'use client'

import type { ReactNode } from 'react'

import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/shadcn/tabs'
import { BACKUP_PATH, BRAND_SETTINGS_PATH } from '@/app/helpers/navigation'

const SETTINGS_TABS = [
  { href: BRAND_SETTINGS_PATH, label: 'Marca' },
  { href: BACKUP_PATH, label: 'Backup' }
] as const

export type SettingsTabPath = (typeof SETTINGS_TABS)[number]['href']

type SettingsTabsProps = {
  current: SettingsTabPath
  children: ReactNode
}

// The server renders only the current tab, so each tab is a link that goes through the
// unsaved-changes guard (node_modules/@base-ui/react/docs/react/components/tabs.md, "Links")
export const SettingsTabs = ({ current, children }: SettingsTabsProps) => (
  <Tabs value={current} className="flex-1 gap-8">
    <TabsList variant="line" aria-label="Configurações">
      {SETTINGS_TABS.map(({ href, label }) => (
        <TabsTrigger
          key={href}
          value={href}
          nativeButton={false}
          render={<GuardedLink href={href} />}
        >
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
    {/* Its content starts with controls, so the panel needs no tab stop of its own
        (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) */}
    <TabsContent value={current} tabIndex={-1} className="text-base">
      {children}
    </TabsContent>
  </Tabs>
)
