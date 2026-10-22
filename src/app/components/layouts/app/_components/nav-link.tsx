'use client'

import { cn } from 'cn'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import { buttonVariants } from '@/app/components/ui/shadcn/button'

type NavLinkProps = {
  href: string
  children: ReactNode
}

export const NavLink = ({ href, children }: NavLinkProps) => {
  const pathname = usePathname()
  // A nested page such as the offer editor still marks its section, but only the section page
  // itself is the current page (https://www.w3.org/TR/wai-aria-1.2/#aria-current)
  const current =
    pathname === href ? 'page' : pathname.startsWith(`${href}/`) || undefined

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
