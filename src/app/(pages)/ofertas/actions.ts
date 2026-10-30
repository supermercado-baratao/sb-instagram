'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireBrandSettings } from '@/app/helpers/brand-settings'
import { createOfferContent } from '@/domain/offer'
import { database } from '@/infra/database/client'
import { createOffer, deleteOffer, duplicateOffer } from '@/infra/offer'

export const createOfferAction = async () => {
  const { templates } = requireBrandSettings()
  const id = createOffer(database, createOfferContent(templates[0].id))
  redirect(`/ofertas/${id}`)
}

export const duplicateOfferAction = async (id: number) => {
  duplicateOffer(database, id)
  refresh()
}

export const deleteOfferAction = async (id: number) => {
  await deleteOffer(database, id)
  refresh()
}
