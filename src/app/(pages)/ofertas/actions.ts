'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { createOfferContent } from '@/domain/offer'
import { DEFAULT_TEMPLATES } from '@/domain/poster-defaults'
import { database } from '@/infra/database/client'
import { createOffer, deleteOffer, duplicateOffer } from '@/infra/offer'

export const createOfferAction = async () => {
  const id = createOffer(database, createOfferContent(DEFAULT_TEMPLATES[0].id))
  redirect(`/ofertas/${id}`)
}

export const duplicateOfferAction = async (id: number) => {
  duplicateOffer(database, id)
  refresh()
}

export const deleteOfferAction = async (id: number) => {
  deleteOffer(database, id)
  refresh()
}
