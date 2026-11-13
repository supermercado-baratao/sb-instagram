import type { StoreBrand } from '@/models/brand/brand'
import type { Brand } from '@/models/poster/poster'

// The logo keeps the same URL on every upload, so the version makes the poster load the new one
export const getLogoUrl = ({ logo, updatedAt }: StoreBrand) =>
  logo ? `/marca/logo?v=${updatedAt.getTime()}` : null

export const getPosterBrand = (storeBrand: StoreBrand): Brand => ({
  name: storeBrand.name,
  slogan: storeBrand.slogan,
  instagram: storeBrand.instagram,
  logo: getLogoUrl(storeBrand)
})
