'use client'

import Link from 'next/link'
import { type ComponentProps, use } from 'react'

import { NavigationGuardContext } from '@/app/components/providers/navigation-guard'

type GuardedLinkProps = Omit<
  ComponentProps<typeof Link>,
  'href' | 'onNavigate' | 'replace' | 'scroll' | 'transitionTypes'
> & {
  href: string
  // Runs only once the navigation goes ahead, unlike `onClick`, which also fires when the guard
  // then keeps the user on the page
  onLeave?: () => void
}

// Next.js has no router-level hook to block navigation, so each internal link asks the guard
// through `onNavigate` (node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md)
export const GuardedLink = ({ href, onLeave, ...props }: GuardedLinkProps) => {
  const guard = use(NavigationGuardContext)

  return (
    <Link
      href={href}
      onNavigate={(event) => {
        // The tabs at `/` differ only by query, so the path alone can't tell the current page
        const { pathname, search } = new URL(href, location.href)
        const isCurrentPage =
          pathname + search === location.pathname + location.search
        if (
          guard &&
          !isCurrentPage &&
          !guard.requestNavigation(href, onLeave)
        ) {
          event.preventDefault()
          return
        }
        onLeave?.()
      }}
      {...props}
    />
  )
}
