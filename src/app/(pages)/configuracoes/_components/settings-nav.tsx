import { cn } from 'cn'

import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import {
  SETTINGS_PATH,
  VOICE_SETTINGS_PATH
} from '@/app/helpers/brand-settings'

const SECTIONS = [
  { href: SETTINGS_PATH, label: 'Marca' },
  { href: VOICE_SETTINGS_PATH, label: 'Comercial' }
]

type SettingsNavProps = {
  current: string
}

export const SettingsNav = ({ current }: SettingsNavProps) => (
  <nav aria-label="Configurações" className="border-b border-border">
    <ul className="-mb-px flex gap-4">
      {SECTIONS.map(({ href, label }) => (
        <li key={href}>
          <GuardedLink
            href={href}
            aria-current={href === current ? 'page' : undefined}
            className={cn(
              'inline-flex h-10 items-center rounded-t-md border-b-2 border-transparent px-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
              'aria-[current=page]:border-foreground aria-[current=page]:text-foreground'
            )}
          >
            {label}
          </GuardedLink>
        </li>
      ))}
    </ul>
  </nav>
)
