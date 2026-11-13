import { Settings } from 'lucide-react'
import type { ReactNode } from 'react'

import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import { buttonVariants } from '@/app/components/ui/shadcn/button'
import { getLogoUrl } from '@/app/helpers/brand-poster'
import { GENERATIONS_PATH } from '@/app/helpers/generation'
import {
  BRAND_SETTINGS_PATH,
  OFFER_PATH,
  PRODUCTS_PATH,
  RADIO_AD_PATH
} from '@/app/helpers/navigation'
import type { StoreBrand } from '@/models/brand/brand'

import { NavLink } from './_components/nav-link'

const CONTENT_ID = 'conteudo'

type AppLayoutProps = {
  brand: StoreBrand
  children: ReactNode
}

export const AppLayout = ({ brand, children }: AppLayoutProps) => {
  const logoUrl = getLogoUrl(brand)

  return (
    <>
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
        {/* Always the whole width, so the links never move under the pointer between pages */}
        <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <GuardedLink
            href={OFFER_PATH}
            className="flex h-10 min-w-0 items-center rounded-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-muted-foreground"
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
          <nav aria-label="Principal" className="flex min-w-0 flex-1">
            {/* Ordered as the week's work goes; settings sit apart, since they are rarely used (#113) */}
            <ul className="flex flex-1 flex-wrap gap-1">
              <li>
                <NavLink href={OFFER_PATH}>Oferta</NavLink>
              </li>
              <li>
                <NavLink href={RADIO_AD_PATH}>Comercial</NavLink>
              </li>
              <li>
                <NavLink href={PRODUCTS_PATH}>Produtos</NavLink>
              </li>
              <li>
                <NavLink href={GENERATIONS_PATH}>Histórico</NavLink>
              </li>
              <li className="ml-auto">
                <NavLink href={BRAND_SETTINGS_PATH}>
                  <Settings data-icon="inline-start" aria-hidden />
                  Configurações
                </NavLink>
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
    </>
  )
}
