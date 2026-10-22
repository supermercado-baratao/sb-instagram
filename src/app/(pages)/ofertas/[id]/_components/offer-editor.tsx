'use client'

import { cn } from 'cn'
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  Download,
  Plus,
  Save
} from 'lucide-react'
import { useState, useTransition } from 'react'
import { flushSync } from 'react-dom'

import { Poster } from '@/app/components/blocks/poster'
import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import { Button, buttonVariants } from '@/app/components/ui/shadcn/button'
import { Field, FieldGroup, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/shadcn/tabs'
import { getPosterOffer, getPosterProducts } from '@/app/helpers/offer-poster'
import { useUnsavedChangesWarning } from '@/app/hooks/use-unsaved-changes-warning'
import {
  addPage,
  findPageWithoutPrice,
  movePage,
  type OfferContent,
  type OfferPage,
  removePage
} from '@/domain/offer'
import {
  type Brand,
  getPageTemplate,
  type PosterTemplate
} from '@/domain/poster'

import { saveOfferAction } from '../actions'
import { PagePanel } from './page-panel'
import { PRICE_MISSING_ATTRIBUTE } from './price-field'

type OfferEditorProps = {
  id: number
  offer: OfferContent
  brand: Brand
  templates: PosterTemplate[]
}

type Status = {
  kind: 'saved' | 'error' | 'info'
  message: string
  field?: 'name'
  // A new id remounts the message, so the same text twice in a row is announced again
  id: number
}

const getTabId = (key: number) => `page-tab-${key}`

export const OfferEditor = ({
  id,
  offer,
  brand,
  templates
}: OfferEditorProps) => {
  const [content, setContent] = useState(offer)
  const [saved, setSaved] = useState(offer)
  // Pages have no id until they are saved, so each one gets a key that follows it when it moves
  const [pageKeys, setPageKeys] = useState(() =>
    offer.pages.map((_, index) => index)
  )
  const [selectedKey, setSelectedKey] = useState(0)
  const [status, setStatus] = useState<Status>()
  const [saving, startSave] = useTransition()
  const [downloading, startDownload] = useTransition()
  const dirty = content !== saved

  const selectedIndex = Math.max(pageKeys.indexOf(selectedKey), 0)
  const selectedPage = content.pages[selectedIndex]
  const selectedTemplate = getPageTemplate(templates, selectedPage.templateId)

  useUnsavedChangesWarning(dirty)

  const update = (changes: Partial<OfferContent>) => {
    setContent((current) => ({ ...current, ...changes }))
    setStatus(undefined)
  }

  const show = (status: Omit<Status, 'id'>) =>
    setStatus({ ...status, id: Date.now() })

  const updatePage = (index: number, page: OfferPage) =>
    update({ pages: content.pages.with(index, page) })

  const addNewPage = () => {
    const key = Math.max(...pageKeys) + 1
    update({ pages: addPage(content.pages, templates[0]?.id ?? '') })
    setPageKeys([...pageKeys, key])
    setSelectedKey(key)
  }

  const moveSelectedPage = (to: number) => {
    update({ pages: movePage(content.pages, selectedIndex, to) })
    setPageKeys(movePage(pageKeys, selectedIndex, to))
    // The focused button stays put while the tab labels renumber
    show({ kind: 'info', message: `Página movida para a posição ${to + 1}.` })
  }

  const removeSelectedPage = () => {
    const keys = removePage(pageKeys, selectedIndex)
    const nextKey = keys[Math.min(selectedIndex, keys.length - 1)]
    // The panel goes away with the button that had focus, so it moves to the next page's tab
    flushSync(() => {
      update({ pages: removePage(content.pages, selectedIndex) })
      setPageKeys(keys)
      setSelectedKey(nextKey)
      show({ kind: 'info', message: `Página ${selectedIndex + 1} removida.` })
    })
    document.querySelector<HTMLElement>(`#${getTabId(nextKey)}`)?.focus()
  }

  const save = () => {
    if (content.name.trim() === '') {
      show({
        kind: 'error',
        message: 'Dê um nome para a oferta.',
        field: 'name'
      })
      document.querySelector<HTMLElement>('#offer-name')?.focus()
      return
    }
    const pageWithoutPrice = findPageWithoutPrice(content.pages)
    if (pageWithoutPrice !== -1) {
      flushSync(() => {
        setSelectedKey(pageKeys[pageWithoutPrice])
        show({
          kind: 'error',
          message: `Falta o preço de algum produto da página ${pageWithoutPrice + 1}.`
        })
      })
      document
        .querySelector<HTMLElement>(`[${CSS.escape(PRICE_MISSING_ATTRIBUTE)}]`)
        ?.focus()
      return
    }

    const snapshot = content
    startSave(async () => {
      const result = await saveOfferAction(id, snapshot)
      if (result.status === 'error') {
        show({ kind: 'error', message: result.message })
        return
      }
      setSaved(snapshot)
      show({ kind: 'saved', message: 'Oferta salva.' })
    })
  }

  const download = () => {
    show({ kind: 'info', message: 'Gerando as imagens das páginas…' })
    startDownload(async () => {
      const response = await fetch(`/ofertas/${id}/paginas.zip`)
      if (!response.ok) {
        show({
          kind: 'error',
          message: 'Não foi possível gerar as imagens. Tente de novo.'
        })
        return
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `oferta-${id}.zip`
      link.click()
      URL.revokeObjectURL(url)
      show({ kind: 'info', message: 'Imagens baixadas.' })
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4">
        <GuardedLink
          href="/ofertas"
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'self-start'
          })}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Ofertas
        </GuardedLink>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight wrap-break-word">
              {content.name.trim() || 'Oferta sem nome'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {dirty ? 'Alterações não salvas' : 'Tudo salvo'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={dirty || downloading}
              focusableWhenDisabled
              aria-describedby={dirty ? 'download-hint' : undefined}
              onClick={download}
            >
              <Download data-icon="inline-start" aria-hidden />
              Baixar páginas (PNG)
            </Button>
            <Button disabled={saving} focusableWhenDisabled onClick={save}>
              <Save data-icon="inline-start" aria-hidden />
              Salvar
            </Button>
          </div>
        </div>
        {dirty && (
          <p id="download-hint" className="text-sm text-muted-foreground">
            Salve a oferta para baixar as páginas.
          </p>
        )}
        <div aria-live="polite" className="min-h-5">
          {status && (
            <p
              key={status.id}
              className={cn(
                'flex items-center gap-2 text-sm',
                status.kind === 'error' && 'text-destructive',
                status.kind === 'info' && 'text-muted-foreground'
              )}
            >
              {status.kind === 'error' && (
                <CircleAlert className="size-4 shrink-0" aria-hidden />
              )}
              {status.kind === 'saved' && (
                <CircleCheck
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              )}
              {status.message}
            </p>
          )}
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-10">
          <section
            aria-labelledby="offer-texts-heading"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h2 id="offer-texts-heading" className="text-lg font-semibold">
                Textos da oferta
              </h2>
              <p className="text-sm text-muted-foreground">
                Valem para todas as páginas.
              </p>
            </div>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={status?.field === 'name' ? true : undefined}>
                <FieldLabel htmlFor="offer-name">Nome da oferta</FieldLabel>
                <Input
                  id="offer-name"
                  aria-invalid={status?.field === 'name' ? true : undefined}
                  value={content.name}
                  onChange={(event) => update({ name: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="offer-valid-until">Válida até</FieldLabel>
                <Input
                  id="offer-valid-until"
                  type="date"
                  value={content.validUntil ?? ''}
                  onChange={(event) =>
                    update({ validUntil: event.target.value || null })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="offer-highlight-title">
                  Título do destaque
                </FieldLabel>
                <Input
                  id="offer-highlight-title"
                  value={content.highlightTitle}
                  onChange={(event) =>
                    update({ highlightTitle: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="offer-highlight-message">
                  Mensagem do destaque
                </FieldLabel>
                <Input
                  id="offer-highlight-message"
                  value={content.highlightMessage}
                  onChange={(event) =>
                    update({ highlightMessage: event.target.value })
                  }
                />
              </Field>
            </FieldGroup>
          </section>

          <section
            aria-labelledby="offer-pages-heading"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 id="offer-pages-heading" className="text-lg font-semibold">
                  Páginas
                </h2>
                <p className="text-sm text-muted-foreground">
                  Bipe ou digite o código e aperte Enter para colocar o produto.
                </p>
              </div>
              <Button variant="outline" onClick={addNewPage}>
                <Plus data-icon="inline-start" aria-hidden />
                Adicionar página
              </Button>
            </div>
            <Tabs
              value={selectedKey}
              onValueChange={(key) => setSelectedKey(Number(key))}
              className="gap-6"
            >
              <TabsList
                aria-label="Páginas da oferta"
                className="max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto"
              >
                {pageKeys.map((key, index) => (
                  <TabsTrigger key={key} id={getTabId(key)} value={key}>
                    Página {index + 1}
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* Only the selected panel is mounted, so moving its page never re-inserts the
                  focused button's DOM node, which would blur it */}
              <TabsContent key={selectedKey} value={selectedKey}>
                <PagePanel
                  index={selectedIndex}
                  pageCount={content.pages.length}
                  page={selectedPage}
                  templates={templates}
                  onChange={(page) => updatePage(selectedIndex, page)}
                  onMove={moveSelectedPage}
                  onRemove={removeSelectedPage}
                />
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <aside
          aria-labelledby="offer-preview-heading"
          className="flex flex-col items-center gap-3 lg:sticky lg:top-6 lg:self-start"
        >
          <h2
            id="offer-preview-heading"
            className="self-start text-lg font-semibold"
          >
            Pré-visualização da página {selectedIndex + 1}
          </h2>
          {selectedTemplate && (
            <div className="zoom-[0.3] sm:zoom-[0.45] lg:zoom-[0.36] xl:zoom-[0.42]">
              <Poster
                brand={brand}
                offer={getPosterOffer(content)}
                template={selectedTemplate}
                layout={selectedPage.layout}
                products={getPosterProducts(selectedPage.slots)}
              />
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
