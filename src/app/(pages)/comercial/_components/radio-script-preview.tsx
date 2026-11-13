import { cn } from 'cn'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/shadcn/tabs'
import type { Product } from '@/models/product/product'
import type { Pronunciation } from '@/models/radio-ad/pronunciation'
import {
  getRadioListMarkdown,
  type RadioScript,
  type RadioScriptPart
} from '@/models/radio-ad/radio-script'

import { VoiceTextDialog } from './voice-text-dialog'

type RadioScriptPreviewProps = {
  // `undefined` while the store has never saved an offer
  script: RadioScript | undefined
  parts: RadioScriptPart[]
  pronunciations: Pronunciation[]
  onProductSaved: (product: Product) => void
}

// The panel scrolls itself: Base UI already makes it a tab stop, named by its tab (WCAG 2.1.1)
const PANEL_CLASS_NAME =
  'min-h-0 overflow-y-auto rounded-lg focus-visible:ring-3 focus-visible:ring-muted-foreground'

const TEXT_CLASS_NAME =
  'min-h-32 rounded-lg border border-border bg-muted p-4 text-sm'

const EMPTY_CLASS_NAME =
  'rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground'

type PreviewTab = 'script' | 'list'

const COPY: Record<
  PreviewTab,
  { label: string; copied: string; failed: string }
> = {
  script: {
    label: 'Copiar roteiro',
    copied: 'Roteiro do comercial copiado.',
    failed: 'Não foi possível copiar o roteiro.'
  },
  list: {
    label: 'Copiar lista',
    copied: 'Lista de produtos copiada.',
    failed: 'Não foi possível copiar a lista.'
  }
}

// The text as the generation would write it, unsaved changes of this page included
const copyText = async (text: string, tab: PreviewTab) => {
  toast.dismiss()
  try {
    await navigator.clipboard.writeText(text)
    toast.success(COPY[tab].copied)
  } catch {
    toast.error(COPY[tab].failed, { duration: Infinity })
  }
}

export const RadioScriptPreview = ({
  script,
  parts,
  pronunciations,
  onProductSaved
}: RadioScriptPreviewProps) => {
  const [tab, setTab] = useState<PreviewTab>('script')
  const text = script
    ? {
        script: script.script,
        // An empty list still ends with a line break
        list: script.list.length > 0 ? getRadioListMarkdown(script) : ''
      }[tab]
    : ''
  const empty = text === ''

  return (
    <aside
      aria-labelledby="radio-script-preview-heading"
      className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start"
    >
      <div className="flex flex-col gap-1">
        <h2 id="radio-script-preview-heading" className="text-lg font-semibold">
          Pré-visualização
        </h2>
        <p className="text-sm text-muted-foreground">
          Mostra as mudanças desta página antes de salvar, com a oferta salva.
          Alterações não salvas na Oferta não aparecem aqui.
        </p>
      </div>
      {script ? (
        <Tabs
          value={tab}
          onValueChange={(value: PreviewTab) => setTab(value)}
          className="min-h-0 flex-1 gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList aria-label="Pré-visualização">
              <TabsTrigger value="script">Roteiro</TabsTrigger>
              <TabsTrigger value="list">Lista de produtos</TabsTrigger>
            </TabsList>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={empty}
              focusableWhenDisabled
              onClick={() => copyText(text, tab)}
            >
              <Copy data-icon="inline-start" aria-hidden />
              {COPY[tab].label}
            </Button>
          </div>
          <TabsContent value="script" className={PANEL_CLASS_NAME}>
            {parts.length === 0 ? (
              <p className={EMPTY_CLASS_NAME}>O roteiro está vazio.</p>
            ) : (
              <div className={cn(TEXT_CLASS_NAME, 'flex flex-col gap-5')}>
                {parts.map((part, partIndex) =>
                  part.type === 'text' ? (
                    <p key={partIndex} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  ) : (
                    // Each product's line has its own way to change what it speaks (#111)
                    <ul key={partIndex} className="flex flex-col gap-1">
                      {part.lines.map(({ item, line }) => (
                        // A product is spoken once per page at most
                        <li
                          key={`${item.product.id}-${item.pageNumber}`}
                          className="flex items-start gap-1"
                        >
                          <span className="flex-1 py-1">{line}</span>
                          <VoiceTextDialog
                            product={item.product}
                            pronunciations={pronunciations}
                            onSaved={onProductSaved}
                          />
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="list" className={PANEL_CLASS_NAME}>
            {script.list.length === 0 ? (
              <p className={EMPTY_CLASS_NAME}>Nenhum produto na lista.</p>
            ) : (
              <pre
                className={cn(TEXT_CLASS_NAME, 'font-sans whitespace-pre-wrap')}
              >
                {getRadioListMarkdown(script)}
              </pre>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <p className={EMPTY_CLASS_NAME}>Nenhuma oferta salva ainda.</p>
      )}
    </aside>
  )
}
