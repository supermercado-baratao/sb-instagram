'use client'

import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, useState } from 'react'

import { LeaveWithoutSavingDialog } from '@/app/components/blocks/leave-without-saving-dialog'

type NavigationGuard = {
  setBlocked: (blocked: boolean) => void
  requestNavigation: (href: string) => boolean
}

export const NavigationGuardContext = createContext<
  NavigationGuard | undefined
>(undefined)

export const NavigationGuardProvider = ({
  children
}: {
  children: ReactNode
}) => {
  const router = useRouter()
  const [blocked, setBlocked] = useState(false)
  const [pendingHref, setPendingHref] = useState<string>()

  const requestNavigation = (href: string) => {
    if (blocked) setPendingHref(href)
    return !blocked
  }

  const leave = () => {
    if (pendingHref === undefined) return
    setPendingHref(undefined)
    router.push(pendingHref)
  }

  return (
    <NavigationGuardContext value={{ setBlocked, requestNavigation }}>
      {children}
      <LeaveWithoutSavingDialog
        open={pendingHref !== undefined}
        onCancel={() => setPendingHref(undefined)}
        onLeave={leave}
      />
    </NavigationGuardContext>
  )
}
