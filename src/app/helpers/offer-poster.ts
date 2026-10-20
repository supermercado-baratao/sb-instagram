import {
  formatValidUntil,
  type OfferContent,
  type OfferSlot
} from '@/domain/offer'
import {
  HIDDEN_FIELD_MARKER,
  type Offer,
  type OfferProduct
} from '@/domain/poster'

// Keeps the date line readable on the poster while the offer has no validity yet
export const VALIDITY_PLACEHOLDER = '__/__/____'

export const getPhotoUrl = (code: string) =>
  `/fotos/${encodeURIComponent(code)}`

// An empty slot becomes a blank product, which the poster fills with its placeholders. A product
// without a brand hides the line instead, since the "MARCA" placeholder would print on its card
export const getPosterProducts = (slots: OfferSlot[]): OfferProduct[] =>
  slots.map((slot) =>
    slot
      ? {
          code: slot.product.code,
          codeType: slot.product.codeType,
          name: slot.product.name,
          brand: slot.product.brand ?? HIDDEN_FIELD_MARKER,
          unit: slot.product.unit ?? '',
          image: slot.product.photo ? getPhotoUrl(slot.product.code) : null,
          priceInCents: slot.priceInCents
        }
      : {
          code: '',
          codeType: 'internal',
          name: '',
          brand: '',
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
