'use client'

import type { ReactNode } from 'react'

import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/shadcn/tabs'
import {
  getHomeTabHref,
  HOME_TABS,
  type HomeTabId
} from '@/app/helpers/home-tabs'

type HomeTabsProps = {
  current: HomeTabId
  children: ReactNode
}

// The server renders only the current tab, so each tab is a link that goes through the
// unsaved-changes guard (node_modules/@base-ui/react/docs/react/components/tabs.md, "Links")
export const HomeTabs = ({ current, children }: HomeTabsProps) => (
  <Tabs value={current} className="flex-1 gap-8">
    <TabsList variant="line" aria-label="Seções">
      {HOME_TABS.map(({ id, label }) => (
        <TabsTrigger
          key={id}
          value={id}
          nativeButton={false}
          render={<GuardedLink href={getHomeTabHref(id)} />}
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
