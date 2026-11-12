import { use, useEffect } from 'react'

import { NavigationGuardContext } from '@/app/components/providers/navigation-guard'

export const useUnsavedChangesWarning = (dirty: boolean) => {
  const block = use(NavigationGuardContext)?.block

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    const unblock = block?.()
    return () => {
      window.removeEventListener('beforeunload', warn)
      unblock?.()
    }
  }, [dirty, block])
}
