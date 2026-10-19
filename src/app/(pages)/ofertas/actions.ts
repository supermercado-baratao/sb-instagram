'use server'

import { refresh } from 'next/cache'

import { createOfferContent } from '@/domain/offer'
import { DEFAULT_TEMPLATES } from '@/domain/poster-defaults'
import { database } from '@/infra/database/client'
import { createOffer, deleteOffer, duplicateOffer } from '@/infra/offer'

export const createOfferAction = async () => {
  createOffer(database, createOfferContent(DEFAULT_TEMPLATES[0].id))
  refresh()
}

export const duplicateOfferAction = async (id: number) => {
  duplicateOffer(database, id)
  refresh()
}

export const deleteOfferAction = async (id: number) => {
  deleteOffer(database, id)
  refresh()
}
