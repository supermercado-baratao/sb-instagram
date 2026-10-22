import { use, useEffect } from 'react'

import { NavigationGuardContext } from '@/app/components/providers/navigation-guard'

export const useUnsavedChangesWarning = (dirty: boolean) => {
  const setBlocked = use(NavigationGuardContext)?.setBlocked

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    setBlocked?.(true)
    return () => {
      window.removeEventListener('beforeunload', warn)
      setBlocked?.(false)
    }
  }, [dirty, setBlocked])
}
