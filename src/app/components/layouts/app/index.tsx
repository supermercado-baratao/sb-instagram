import { cn } from 'cn'
import type { ReactNode } from 'react'

import { NavigationGuardProvider } from '@/app/components/providers/navigation-guard'
import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import { buttonVariants } from '@/app/components/ui/shadcn/button'
import { getLogoUrl } from '@/app/helpers/brand-poster'
import { SETTINGS_PATH } from '@/app/helpers/brand-settings'
import type { StoreBrand } from '@/domain/brand'

import { NavLink } from './_components/nav-link'

const CONTENT_ID = 'conteudo'

type AppLayoutProps = {
  brand: StoreBrand
  // Drops the max width, for a page that needs the whole screen
  wide?: boolean
  children: ReactNode
}

export const AppLayout = ({ brand, wide, children }: AppLayoutProps) => {
  const logoUrl = getLogoUrl(brand)

  return (
    <NavigationGuardProvider>
      <a
        href={`#${CONTENT_ID}`}
        className={buttonVariants({
          className:
            'fixed top-2 left-2 z-50 -translate-y-16 focus-visible:translate-y-0'
        })}
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-border">
        <div
          className={cn(
            'mx-auto flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6',
            !wide && 'max-w-7xl'
          )}
        >
          <GuardedLink
            href="/ofertas"
            className="flex h-10 min-w-0 items-center rounded-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- the logo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
              <img
                src={logoUrl}
                alt={brand.name}
                className="h-10 w-auto max-w-40 object-contain"
              />
            ) : (
              <span className="truncate">{brand.name}</span>
            )}
          </GuardedLink>
          <nav aria-label="Principal">
            <ul className="flex gap-1">
              <li>
                <NavLink href="/ofertas">Ofertas</NavLink>
              </li>
              <li>
                <NavLink href="/produtos">Produtos</NavLink>
              </li>
              <li>
                <NavLink href={SETTINGS_PATH}>Configurações</NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <div
        id={CONTENT_ID}
        tabIndex={-1}
        className="flex flex-1 flex-col outline-none"
      >
        {children}
      </div>
    </NavigationGuardProvider>
  )
}
