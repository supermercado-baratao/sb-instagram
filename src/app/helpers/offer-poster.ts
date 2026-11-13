import { getPhotoUrl } from '@/app/helpers/product-photo'
import {
  formatValidUntil,
  type OfferContent,
  type OfferSlot
} from '@/domain/offer'
import { type Offer, type OfferProduct } from '@/domain/poster'
import { getCodeType } from '@/models/product/product'

// Keeps the date line readable on the poster while the offer has no validity yet
export const VALIDITY_PLACEHOLDER = '__/__/____'

// An empty slot becomes a blank product, which the poster fills with its placeholders
export const getPosterProducts = (
  slots: OfferSlot[],
  photoVersion?: number
): OfferProduct[] =>
  slots.map((slot) =>
    slot
      ? {
          code: slot.product.codes[0] ?? '',
          codeType: getCodeType(slot.product.codes[0] ?? ''),
          description: slot.product.description,
          unit: slot.product.unit ?? '',
          image: slot.product.photo
            ? getPhotoUrl(slot.product.id, photoVersion)
            : null,
          priceInCents: slot.priceInCents
        }
      : {
          code: '',
          codeType: 'internal',
          description: '',
          unit: '',
          image: null,
          priceInCents: 0
        }
  )

export const getPosterOffer = (content: OfferContent): Offer => ({
  validUntil: formatValidUntil(content.validUntil) ?? VALIDITY_PLACEHOLDER,
  highlightTitle: content.highlightTitle,
  highlightMessage: content.highlightMessage
})
