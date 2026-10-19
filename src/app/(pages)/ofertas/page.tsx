import { Copy, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { connection } from 'next/server'

import { formatValidUntil, type OfferSummary } from '@/domain/offer'
import { database } from '@/infra/database/client'
import { listOffers } from '@/infra/offer'

import {
  DeleteOfferButton,
  OFFERS_HEADING_ID
} from './_components/delete-offer-button'
import { OffersAnnouncer } from './_components/offers-announcer'
import { SubmitButton } from './_components/submit-button'
import { createOfferAction, duplicateOfferAction } from './actions'

export const metadata: Metadata = {
  title: 'Ofertas'
}

const describeOffer = ({ validUntil, pageCount }: OfferSummary) => {
  const date = formatValidUntil(validUntil)
  return [
    date ? `Válida até ${date}` : 'Sem validade',
    pageCount === 1 ? '1 página' : `${pageCount} páginas`
  ].join(' · ')
}

const OffersPage = async () => {
  // Renders per request, so `next build` never opens the database
  await connection()
  const offers = listOffers(database)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <OffersAnnouncer>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1
              id={OFFERS_HEADING_ID}
              tabIndex={-1}
              className="text-2xl font-semibold tracking-tight outline-none"
            >
              Ofertas
            </h1>
            <p className="text-muted-foreground">
              Cada oferta reúne as páginas que vão juntas para o Instagram.
            </p>
          </div>
          <form action={createOfferAction}>
            <SubmitButton>
              <Plus data-icon="inline-start" aria-hidden />
              Nova oferta
            </SubmitButton>
          </form>
        </header>

        {offers.length === 0 ? (
          <p className="text-muted-foreground">
            Nenhuma oferta ainda. Crie a primeira para montar as páginas.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="font-medium wrap-break-word">{offer.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {describeOffer(offer)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={duplicateOfferAction.bind(null, offer.id)}>
                    <SubmitButton
                      variant="outline"
                      size="sm"
                      aria-label={`Duplicar ${offer.name}`}
                    >
                      <Copy data-icon="inline-start" aria-hidden />
                      Duplicar
                    </SubmitButton>
                  </form>
                  <DeleteOfferButton id={offer.id} name={offer.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </OffersAnnouncer>
    </main>
  )
}

export default OffersPage
