'use client'

import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, useCallback, useState } from 'react'

import { LeaveWithoutSavingDialog } from '@/app/components/blocks/leave-without-saving-dialog'

type NavigationGuard = {
  // A count, not a flag: a dialog with changes may open over a page with changes of its own, and
  // closing it must keep the page's guard
  block: () => () => void
  requestNavigation: (href: string, onLeave?: () => void) => boolean
}

export const NavigationGuardContext = createContext<
  NavigationGuard | undefined
>(undefined)

// When focus leaves its list, sonner moves it back to the element focused before the toast. Left
// for the dialog's own focus move, that pulls the focus out of the dialog and under it, so it
// happens here, before the dialog opens and records where to return
const releaseToastFocus = () => {
  const { activeElement } = document
  if (
    activeElement instanceof HTMLElement &&
    activeElement.closest('[data-sonner-toaster]')
  ) {
    activeElement.blur()
  }
}

export const NavigationGuardProvider = ({
  children
}: {
  children: ReactNode
}) => {
  const router = useRouter()
  const [blockers, setBlockers] = useState(0)
  const blocked = blockers > 0
  const [pending, setPending] = useState<{
    href: string
    onLeave?: () => void
  }>()

  const requestNavigation = (href: string, onLeave?: () => void) => {
    if (blocked) {
      releaseToastFocus()
      setPending({ href, onLeave })
    }
    return !blocked
  }

  const block = useCallback(() => {
    setBlockers((count) => count + 1)
    return () => setBlockers((count) => count - 1)
  }, [])

  const leave = () => {
    if (pending === undefined) return
    setPending(undefined)
    pending.onLeave?.()
    router.push(pending.href)
  }

  return (
    <NavigationGuardContext value={{ block, requestNavigation }}>
      {children}
      <LeaveWithoutSavingDialog
        open={pending !== undefined}
        onCancel={() => setPending(undefined)}
        onLeave={leave}
      />
    </NavigationGuardContext>
  )
}
