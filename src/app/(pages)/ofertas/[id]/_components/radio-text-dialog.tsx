'use client'

import { Copy, Download, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

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

type RadioTextDialogProps = {
  title: string
  description: string
  copiedMessage: string
  icon: LucideIcon
  generationNumber: number
  text: string
  href: string
}

export const RadioTextDialog = ({
  title,
  description,
  copiedMessage,
  icon: Icon,
  generationNumber,
  text,
  href
}: RadioTextDialogProps) => {
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
        <Icon data-icon="inline-start" aria-hidden />
        {title}
        <span className="sr-only"> da geração {generationNumber}</span>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {title} da geração {generationNumber}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Scrollable, so it takes the keyboard focus to scroll (WCAG 2.1.1) */}
        <pre
          role="region"
          tabIndex={0}
          aria-label={title}
          className="overflow-y-auto rounded-lg border border-border bg-muted p-4 font-sans text-sm whitespace-pre-wrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
