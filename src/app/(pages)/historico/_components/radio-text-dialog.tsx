'use client'

import { cn } from 'cn'
import { CircleAlert, Copy, Download } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { toast } from 'sonner'

import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import { Alert, AlertDescription } from '@/app/components/ui/shadcn/alert'
import { Button, buttonVariants } from '@/app/components/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/app/components/ui/shadcn/dialog'
import { RADIO_AD_PATH } from '@/app/helpers/navigation'

type RadioTextDialogProps = {
  title: string
  description: string
  copiedMessage: string
  icon: ReactNode
  generationNumber: number
  text: string
  warning?: string
  href: string
}

export const RadioTextDialog = ({
  title,
  description,
  copiedMessage,
  icon,
  generationNumber,
  text,
  warning,
  href
}: RadioTextDialogProps) => {
  const textReference = useRef<HTMLPreElement>(null)

  const copy = async () => {
    toast.dismiss()
    try {
      await navigator.clipboard.writeText(text)
      toast.success(copiedMessage)
    } catch {
      toast.error('Não foi possível copiar. Baixe o arquivo.', {
        duration: Infinity
      })
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {icon}
        {title}
        <span className="sr-only"> da oferta {generationNumber}</span>
      </DialogTrigger>
      <DialogContent
        // The warning's link comes first, and would otherwise take the arrow keys that scroll the text
        initialFocus={textReference}
        className={cn(
          'max-h-[calc(100dvh-2rem)] sm:max-w-2xl',
          warning
            ? 'grid-rows-[auto_auto_minmax(0,1fr)_auto]'
            : 'grid-rows-[auto_minmax(0,1fr)_auto]'
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {title} da oferta {generationNumber}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Shown with the dialog, not changed while it is open, so it isn't a live region; the
            generation toast already announced it */}
        {warning && (
          <Alert role={undefined}>
            <CircleAlert aria-hidden />
            <AlertDescription>
              {warning}{' '}
              <GuardedLink
                href={RADIO_AD_PATH}
                className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-muted-foreground"
              >
                Ajustar comercial
              </GuardedLink>
            </AlertDescription>
          </Alert>
        )}
        {/* Scrollable, so it takes the keyboard focus to scroll (WCAG 2.1.1) */}
        <pre
          ref={textReference}
          role="region"
          tabIndex={0}
          aria-label={title}
          className="overflow-y-auto rounded-lg border border-border bg-muted p-4 font-sans text-sm whitespace-pre-wrap outline-none focus-visible:ring-3 focus-visible:ring-muted-foreground"
        >
          {text}
        </pre>
        <DialogFooter>
          <a
            href={href}
            download
            className={buttonVariants({ variant: 'outline' })}
          >
            <Download data-icon="inline-start" aria-hidden />
            Baixar (.md)
          </a>
          <Button onClick={copy}>
            <Copy data-icon="inline-start" aria-hidden />
            Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
