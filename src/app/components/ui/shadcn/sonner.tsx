'use client'

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon
} from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

// The app follows the system theme with no toggle, so next-themes (the shadcn default) isn't needed
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="system"
    closeButton
    containerAriaLabel="Notificações"
    toastOptions={{ closeButtonAriaLabel: 'Fechar notificação' }}
    icons={{
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <Loader2Icon className="size-4 animate-spin" />
    }}
    style={
      {
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
        '--border-radius': 'var(--radius)'
      } as React.CSSProperties
    }
    {...props}
  />
)

export { Toaster }
