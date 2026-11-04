'use client'

import { cn } from 'cn'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'

import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import { buttonVariants } from '@/app/components/ui/shadcn/button'
import { HOME_TABS, parseHomeTab } from '@/app/helpers/home-tabs'

type NavLinkProps = {
  href: string
  children: ReactNode
}

export const NavLink = ({ href, children }: NavLinkProps) => {
  const pathname = usePathname()
  const tab = useSearchParams().get('aba') ?? undefined
  // A nested page such as the offer editor still marks its section, but only the section page
  // itself is the current page (https://www.w3.org/TR/wai-aria-1.2/#aria-current)
  // The other tabs of `/` share its path, but the link leaves them for the first one
  const onOtherHomeTab = pathname === '/' && parseHomeTab(tab) !== HOME_TABS[0]
  const onPage = pathname === href && !onOtherHomeTab
  const current = onPage
    ? 'page'
    : pathname === href || pathname.startsWith(`${href}/`) || undefined

  return (
    <GuardedLink
      href={href}
      aria-current={current}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        'aria-[current]:bg-muted aria-[current]:underline aria-[current]:underline-offset-4 aria-[current]:hover:bg-muted'
      )}
    >
      {children}
    </GuardedLink>
  )
}
