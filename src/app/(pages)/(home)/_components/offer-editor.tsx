'use client'

import { cn } from 'cn'
import { CircleAlert, Eraser, Images, Plus, Save } from 'lucide-react'
import { useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import { GuardedLink } from '@/app/components/ui/custom/guarded-link'
import { Button, buttonVariants } from '@/app/components/ui/shadcn/button'
import { Field, FieldGroup, FieldLabel } from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'
import { Spinner } from '@/app/components/ui/shadcn/spinner'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/app/components/ui/shadcn/tabs'
import { GENERATIONS_PATH } from '@/app/helpers/generation'
import { RADIO_AD_PATH } from '@/app/helpers/navigation'
import { useUnsavedChangesWarning } from '@/app/hooks/use-unsaved-changes-warning'
import {
  addPage,
  clearOfferPrices,
  clearOfferProducts,
  copySlotToNewPage,
  copySlotToPage,
  countProducts,
  findPageWithoutPrice,
  getPageConflict,
  movePage,
  moveSlotToNewPage,
  moveSlotToPage,
  type OfferBackupSummary,
  type OfferContent,
  type OfferPage,
  removePage,
  replaceProduct,
  setProductPrice,
  setSlot
} from '@/domain/offer'
import type { Brand, PosterTemplate } from '@/domain/poster'
import type { Product } from '@/domain/product'

import {
  generateOfferAction,
  restoreOfferAction,
  saveOfferAction
} from './actions'
import { CLEAR_NOTE, ClearOfferButton } from './clear-offer-button'
import type { MoveTarget } from './move-product-button'
import { PagePanel } from './page-panel'
import { PosterFullView } from './poster-full-view'
import { PosterStage } from './poster-stage'
import { PRICE_MISSING_ATTRIBUTE } from './price-field'
import { RestoreOfferButton } from './restore-offer-button'

type OfferEditorProps = {
  offer: OfferContent
  backup: OfferBackupSummary | undefined
  brand: Brand
  templates: PosterTemplate[]
  noEanImages: string[]
}

type Status = {
  kind: 'error' | 'info'
  message: string
  // A new id remounts the message, so the same text twice in a row is announced again
  id: number
}

const viewGenerations = (
  <GuardedLink
    href={GENERATIONS_PATH}
    className={buttonVariants({ variant: 'outline', size: 'sm' })}
    onLeave={() => toast.dismiss()}
  >
    Ver no histórico
  </GuardedLink>
)

const generationActions = (
  <div className="ml-auto shrink-0">{viewGenerations}</div>
)

const generationWarningActions = (
  <div className="flex w-full flex-wrap justify-end gap-2">
    <GuardedLink
      href={RADIO_AD_PATH}
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
      onLeave={() => toast.dismiss()}
    >
      Ajustar comercial
    </GuardedLink>
    {viewGenerations}
  </div>
)

const getTabId = (key: number) => `page-tab-${key}`

const describeKept = (count: number) =>
  count === 1 ? 'O produto continua' : `Os ${count} produtos continuam`

const describeRemoved = (count: number) =>
  count === 1 ? 'O produto sai' : `Os ${count} produtos saem`

const describeScope = (count: number) =>
  count === 1
    ? 'Vale para a única arte da oferta.'
    : `Vale para todas as ${count} artes da oferta.`

const describeLeftOut = (count: number) =>
  count === 1
    ? '1 produto excluído do cadastro desde essa versão ficou de fora.'
    : `${count} produtos excluídos do cadastro desde essa versão ficaram de fora.`

// A toast, since a slot can be too far down the page to see the header's status line
const notify = (message: string, warnedPage?: number) => {
  toast.dismiss()
  if (warnedPage === undefined) {
    toast.info(message)
    return
  }
  toast.warning(
    `${message} A arte ${warnedPage + 1} já tem outro produto com um código em comum.`,
    { duration: 10_000 }
  )
}

const UNDO_NOTE = 'Para desfazer, volte à versão anterior de novo.'

export const OfferEditor = ({
  offer,
  backup: initialBackup,
  brand,
  templates,
  noEanImages
}: OfferEditorProps) => {
  const [content, setContent] = useState(offer)
  const [saved, setSaved] = useState(offer)
  // Pages have no id until they are saved, so each one gets a key that follows it when it moves
  const [pageKeys, setPageKeys] = useState(() =>
    offer.pages.map((_, index) => index)
  )
  const [selectedKey, setSelectedKey] = useState(0)
  const [status, setStatus] = useState<Status>()
  // A photo keeps its URL when it changes, so an edited product needs a new one to reload it
  const [photoVersion, setPhotoVersion] = useState<number>()
  // The price fields keep what was typed, so clearing the offer remounts them with the new content
  const [clearCount, setClearCount] = useState(0)
  const [saving, startSave] = useTransition()
  const [generating, startGenerate] = useTransition()
  const [backup, setBackup] = useState(initialBackup)
  const [restoring, startRestore] = useTransition()
  const busy = saving || generating || restoring
  const dirty = content !== saved

  const selectedIndex = Math.max(pageKeys.indexOf(selectedKey), 0)
  const selectedPage = content.pages[selectedIndex]
  const productCount = countProducts(content.pages)
  const filledPageCount = content.pages.filter(
    (page) => countProducts([page]) > 0
  ).length

  let restoreHint: string | undefined
  if (!backup) restoreHint = 'restore-hint'
  else if (dirty) restoreHint = 'restore-dirty-hint'

  useUnsavedChangesWarning(dirty)

  const update = (changes: Partial<OfferContent>) => {
    setContent((current) => ({ ...current, ...changes }))
    setStatus(undefined)
  }

  const show = (status: Omit<Status, 'id'>) =>
    setStatus({ ...status, id: Date.now() })

  const updatePage = (index: number, page: OfferPage) =>
    update({ pages: content.pages.with(index, page) })

  const updatePrice = (productId: string, priceInCents: number) =>
    update({ pages: setProductPrice(content.pages, productId, priceInCents) })

  // The product is already saved, so the saved copy takes it too and the offer doesn't look changed
  const updateProduct = (product: Product) => {
    const next = { ...content, pages: replaceProduct(content.pages, product) }
    setContent(next)
    setSaved(
      saved === content
        ? next
        : { ...saved, pages: replaceProduct(saved.pages, product) }
    )
    setPhotoVersion(Date.now())
    toast.success(`${product.description} atualizado.`)
  }

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
    show({ kind: 'info', message: `Arte movida para a posição ${to + 1}.` })
  }

  const copyProduct = (position: number, target: MoveTarget) => {
    const from = { page: selectedIndex, position }
    const copied = selectedPage.slots[position]
    if (!copied) return
    const { description } = copied.product

    if (target.kind === 'new-page') {
      update({
        pages: copySlotToNewPage(content.pages, from, templates[0]?.id ?? '')
      })
      setPageKeys([...pageKeys, Math.max(...pageKeys) + 1])
      notify(
        `${description} copiado para a nova arte ${content.pages.length + 1}.`
      )
      return
    }

    const { to } = target
    update({ pages: copySlotToPage(content.pages, from, to) })
    const warnsTarget =
      getPageConflict(content.pages[to.page], copied.product) === 'shared-code'
    notify(
      `${description} copiado para a arte ${to.page + 1}.`,
      warnsTarget ? to.page : undefined
    )
  }

  const moveProduct = (position: number, target: MoveTarget) => {
    const from = { page: selectedIndex, position }
    const moved = selectedPage.slots[position]
    if (!moved) return
    const { description } = moved.product

    if (target.kind === 'new-page') {
      update({
        pages: moveSlotToNewPage(content.pages, from, templates[0]?.id ?? '')
      })
      setPageKeys([...pageKeys, Math.max(...pageKeys) + 1])
      notify(
        `${description} movido para a nova arte ${content.pages.length + 1}.`
      )
      return
    }

    const { to } = target
    const other = content.pages[to.page].slots[to.position]
    const pages = moveSlotToPage(content.pages, from, to)
    update({ pages })
    // Reads the pages after the move, when the product that left no longer counts as a conflict
    const withoutMoved = setSlot(pages[to.page], to.position, null)
    const warnsTarget =
      getPageConflict(withoutMoved, moved.product) === 'shared-code'
    if (!other) {
      notify(
        `${description} movido para a arte ${to.page + 1}.`,
        warnsTarget ? to.page : undefined
      )
      return
    }
    const withoutOther = setSlot(pages[from.page], position, null)
    const warnsSource =
      getPageConflict(withoutOther, other.product) === 'shared-code'
    const warnedPage = warnsSource ? from.page : to.page
    notify(
      `${description} movido para a arte ${to.page + 1}, e ${other.product.description} veio para esta arte.`,
      warnsTarget || warnsSource ? warnedPage : undefined
    )
  }

  const removeSelectedPage = () => {
    const keys = removePage(pageKeys, selectedIndex)
    const nextKey = keys[Math.min(selectedIndex, keys.length - 1)]
    // The panel goes away with the button that had focus, so it moves to the next page's tab
    flushSync(() => {
      update({ pages: removePage(content.pages, selectedIndex) })
      setPageKeys(keys)
      setSelectedKey(nextKey)
      show({ kind: 'info', message: `Arte ${selectedIndex + 1} removida.` })
    })
    document.querySelector<HTMLElement>(`#${getTabId(nextKey)}`)?.focus()
  }

  const clear = (next: OfferContent, message: string) => {
    setContent(next)
    setClearCount(clearCount + 1)
    show({ kind: 'info', message })
  }

  const save = () => {
    const pageWithoutPrice = findPageWithoutPrice(content.pages)
    if (pageWithoutPrice !== -1) {
      flushSync(() => {
        setSelectedKey(pageKeys[pageWithoutPrice])
        show({
          kind: 'error',
          message: `Falta o preço de algum produto da arte ${pageWithoutPrice + 1}.`
        })
      })
      document
        .querySelector<HTMLElement>(`[${CSS.escape(PRICE_MISSING_ATTRIBUTE)}]`)
        ?.focus()
      return
    }

    const snapshot = content
    startSave(async () => {
      const result = await saveOfferAction(snapshot)
      if (result.status === 'error') {
        setStatus(undefined)
        // An error stays until it is closed, so it isn't missed (WCAG 2.2.1)
        toast.error(result.message, { duration: Infinity })
        return
      }
      setSaved(snapshot)
      setBackup(result.backup)
      setStatus(undefined)
      toast.success('Oferta salva.')
    })
  }

  const restore = () => {
    startRestore(async () => {
      const result = await restoreOfferAction()
      toast.dismiss()
      if (result.status === 'error') {
        toast.error(result.message, { duration: Infinity })
        return
      }
      const { content: restored, missingProductCount } = result
      const keys = restored.pages.map((_, index) => index)
      setContent(restored)
      setSaved(restored)
      setPageKeys(keys)
      setSelectedKey(keys[0])
      setClearCount(clearCount + 1)
      setStatus(undefined)
      setBackup(result.backup)
      if (missingProductCount > 0) {
        // Stays until closed, like an error, since the store has to place those products again
        toast.warning(
          `Versão anterior restaurada. ${describeLeftOut(missingProductCount)} ${UNDO_NOTE}`,
          { duration: Infinity }
        )
        return
      }
      toast.success(`Versão anterior restaurada. ${UNDO_NOTE}`, {
        duration: 10_000
      })
    })
  }

  const generate = () => {
    show({ kind: 'info', message: 'Gerando a oferta…' })
    startGenerate(async () => {
      const result = await generateOfferAction()
      setStatus(undefined)
      toast.dismiss()
      if (result.status === 'error') {
        toast.error(result.message, { duration: Infinity })
        return
      }
      if (result.warning) {
        // Stays until closed, like an error, since the radio ad needs fixing (WCAG 2.2.1)
        toast.warning(`Oferta ${result.number} gerada. ${result.warning}`, {
          duration: Infinity,
          // On a line of their own, or the long message is squeezed beside two links
          classNames: { toast: 'flex-wrap' },
          action: generationWarningActions
        })
        return
      }
      // Longer than the default, so there is time to reach its action
      toast.success(`Oferta ${result.number} gerada.`, {
        duration: 10_000,
        action: generationActions
      })
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight wrap-break-word">
              Oferta atual
            </h1>
            <p className="text-sm text-muted-foreground">
              {dirty ? 'Alterações não salvas' : 'Tudo salvo'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RestoreOfferButton
              backup={backup}
              disabled={dirty || busy}
              restoring={restoring}
              describedBy={restoreHint}
              onConfirm={restore}
            />
            <Button
              variant="outline"
              disabled={dirty || busy}
              focusableWhenDisabled
              aria-describedby={
                dirty
                  ? 'generate-description generate-hint'
                  : 'generate-description'
              }
              onClick={generate}
            >
              {generating ? (
                <Spinner data-icon="inline-start" aria-hidden />
              ) : (
                <Images data-icon="inline-start" aria-hidden />
              )}
              {generating ? 'Gerando oferta…' : 'Gerar oferta'}
            </Button>
            <Button disabled={busy} focusableWhenDisabled onClick={save}>
              {saving ? (
                <Spinner data-icon="inline-start" aria-hidden />
              ) : (
                <Save data-icon="inline-start" aria-hidden />
              )}
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
        <p id="generate-description" className="text-sm text-muted-foreground">
          Gerar oferta cria as artes, o PDF para imprimir, o roteiro do
          comercial e a lista de produtos, e guarda tudo no histórico.
        </p>
        {dirty && (
          <p className="text-sm text-muted-foreground">
            <span id="generate-hint">Salve a oferta antes de gerar.</span>
            {/* Saving would replace the stored version, which is what the store wants back */}
            {backup && (
              <span id="restore-dirty-hint">
                {' '}
                Para voltar à versão anterior sem salvar o que mudou, recarregue
                a página e descarte as alterações.
              </span>
            )}
          </p>
        )}
        {!backup && (
          <p id="restore-hint" className="text-sm text-muted-foreground">
            Ainda não há versão anterior para voltar. Ela fica guardada quando
            você salva uma alteração.
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
              {status.message}
            </p>
          )}
        </div>
      </header>

      {/* The preview column is as wide as a poster as tall as the screen, up to 40% of the width */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_min(40vw,calc((100dvh-6rem)*0.8))]">
        {/* What is typed while restoring would be replaced by the restored offer */}
        <div className="flex min-w-0 flex-col gap-10" inert={restoring}>
          <section
            aria-labelledby="offer-texts-heading"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h2 id="offer-texts-heading" className="text-lg font-semibold">
                Textos da oferta
              </h2>
              <p className="text-sm text-muted-foreground">
                Valem para todas as artes.
              </p>
            </div>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
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
              <Field className="sm:col-span-2">
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
                  Artes
                </h2>
                <p className="text-sm text-muted-foreground">
                  Bipe ou digite o código e aperte Enter para colocar o produto.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ClearOfferButton
                  label="Limpar preços de todas as artes"
                  icon={Eraser}
                  title="Limpar os preços de todas as artes?"
                  description={`${describeScope(content.pages.length)} ${describeKept(productCount)} ${filledPageCount === 1 ? 'na arte' : 'nas artes'}, sem preço, e a validade da oferta é apagada. Será preciso digitar os preços de novo para salvar. ${CLEAR_NOTE}`}
                  disabled={productCount === 0}
                  getNextField={() =>
                    document.querySelector<HTMLElement>(
                      `[${CSS.escape(PRICE_MISSING_ATTRIBUTE)}]`
                    )
                  }
                  onConfirm={() =>
                    clear(
                      clearOfferPrices(content),
                      'Preços e validade limpos. Digite os novos preços e salve.'
                    )
                  }
                />
                <ClearOfferButton
                  label="Limpar produtos de todas as artes"
                  icon={Eraser}
                  title="Limpar os produtos de todas as artes?"
                  description={`${describeScope(content.pages.length)} ${describeRemoved(productCount)} ${filledPageCount === 1 ? 'da arte' : 'das artes'}, com os preços, e a validade da oferta é apagada. As artes, os modelos e os textos do destaque continuam. ${CLEAR_NOTE}`}
                  disabled={productCount === 0}
                  getNextField={() =>
                    document.querySelector<HTMLElement>(
                      `#page-${selectedIndex}-slot-0-code`
                    )
                  }
                  onConfirm={() =>
                    clear(
                      clearOfferProducts(content),
                      'Produtos, preços e validade limpos. Coloque os novos produtos e salve.'
                    )
                  }
                />
                <Button variant="outline" onClick={addNewPage}>
                  <Plus data-icon="inline-start" aria-hidden />
                  Adicionar arte
                </Button>
              </div>
            </div>
            <Tabs
              value={selectedKey}
              onValueChange={(key) => setSelectedKey(Number(key))}
              className="gap-6"
            >
              <TabsList
                aria-label="Artes da oferta"
                className="max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto"
              >
                {pageKeys.map((key, index) => (
                  <TabsTrigger key={key} id={getTabId(key)} value={key}>
                    Arte {index + 1}
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* Only the selected panel is mounted, so moving its page never re-inserts the
                  focused button's DOM node, which would blur it */}
              <TabsContent
                key={`${selectedKey}-${clearCount}`}
                value={selectedKey}
                tabIndex={-1}
              >
                <PagePanel
                  index={selectedIndex}
                  pages={content.pages}
                  templates={templates}
                  noEanImages={noEanImages}
                  photoVersion={photoVersion}
                  onChange={(page) => updatePage(selectedIndex, page)}
                  onPriceChange={updatePrice}
                  onProductSaved={updateProduct}
                  onNotice={(message) => show({ kind: 'info', message })}
                  onMove={moveSelectedPage}
                  onMoveProduct={moveProduct}
                  onCopyProduct={copyProduct}
                  onRemove={removeSelectedPage}
                />
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <aside
          aria-labelledby="offer-preview-heading"
          className="flex flex-col items-center gap-3 lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:self-start"
        >
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <h2 id="offer-preview-heading" className="text-lg font-semibold">
              Pré-visualização da arte {selectedIndex + 1}
            </h2>
            <PosterFullView
              content={content}
              brand={brand}
              templates={templates}
              photoVersion={photoVersion}
              selectedIndex={selectedIndex}
            />
          </div>
          <PosterStage
            content={content}
            brand={brand}
            templates={templates}
            photoVersion={photoVersion}
            index={selectedIndex}
            className="aspect-4/5 w-full max-w-xl lg:aspect-auto lg:max-w-none lg:flex-1 lg:items-start"
          />
        </aside>
      </div>
    </div>
  )
}
