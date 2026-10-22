'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ComponentProps, use } from 'react'

import { NavigationGuardContext } from '@/app/components/providers/navigation-guard'

type GuardedLinkProps = Omit<
  ComponentProps<typeof Link>,
  'href' | 'onNavigate' | 'replace' | 'scroll' | 'transitionTypes'
> & {
  href: string
}

// Next.js has no router-level hook to block navigation, so each internal link asks the guard
// through `onNavigate` (node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md)
export const GuardedLink = ({ href, ...props }: GuardedLinkProps) => {
  const guard = use(NavigationGuardContext)
  const pathname = usePathname()

  return (
    <Link
      href={href}
      onNavigate={(event) => {
        if (href === pathname || !guard) return
        if (!guard.requestNavigation(href)) event.preventDefault()
      }}
      {...props}
    />
  )
}
