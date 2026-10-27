// The version changes the URL after a new upload in the same session, since the URL stays the same
export const getPhotoUrl = (productId: string, version?: number) =>
  `/fotos/${encodeURIComponent(productId)}${version === undefined ? '' : `?v=${version}`}`

export const getCatalogPhotoUrl = (ean: string) =>
  `/catalogo/ean/${encodeURIComponent(ean)}`
