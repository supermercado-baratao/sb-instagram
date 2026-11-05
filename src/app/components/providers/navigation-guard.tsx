'use client'

import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, useState } from 'react'

import { LeaveWithoutSavingDialog } from '@/app/components/blocks/leave-without-saving-dialog'

type NavigationGuard = {
  setBlocked: (blocked: boolean) => void
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
  const [blocked, setBlocked] = useState(false)
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

  const leave = () => {
    if (pending === undefined) return
    setPending(undefined)
    pending.onLeave?.()
    router.push(pending.href)
  }

  return (
    <NavigationGuardContext value={{ setBlocked, requestNavigation }}>
      {children}
      <LeaveWithoutSavingDialog
        open={pending !== undefined}
        onCancel={() => setPending(undefined)}
        onLeave={leave}
      />
    </NavigationGuardContext>
  )
}
