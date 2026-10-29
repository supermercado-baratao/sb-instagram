import { ImageOff } from 'lucide-react'

import { Badge } from '@/app/components/ui/shadcn/badge'
import { Checkbox } from '@/app/components/ui/shadcn/checkbox'
import { getCatalogPhotoUrl, getPhotoUrl } from '@/app/helpers/product-photo'
import type { CatalogMatch, Product, ProductListItem } from '@/domain/product'

import { DeleteProductButton } from './delete-product-button'

type ProductListProps = {
  items: ProductListItem[]
  busy: boolean
  selectedIds: Set<string>
  onSelect: (product: Product, selected: boolean) => void
  onOpen: (product: Product) => void
  onOpenCatalog: (product: CatalogMatch) => void
  onDeleted: (product: Product) => void
}

const getPhoto = ({ origin, product }: ProductListItem) => {
  if (origin === 'catalog') return getCatalogPhotoUrl(product.ean)
  return product.photo ? getPhotoUrl(product.id) : undefined
}

const getKey = ({ origin, product }: ProductListItem) =>
  origin === 'catalog' ? `catalog-${product.ean}` : product.id

export const ProductList = ({
  items,
  busy,
  selectedIds,
  onSelect,
  onOpen,
  onOpenCatalog,
  onDeleted
}: ProductListProps) => (
  <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
    {items.map((item) => {
      const { product } = item
      const photo = getPhoto(item)

      return (
        <li key={getKey(item)} className="flex items-center gap-1 pr-2 pl-3">
          {item.origin === 'store' ? (
            <Checkbox
              checked={selectedIds.has(item.product.id)}
              onCheckedChange={(checked) => onSelect(item.product, checked)}
              // Its invisible hit area would cover the edge of the button that opens the product
              className="mr-2"
              // Not every product is unique by name, so the codes tell them apart
              aria-label={`Selecionar ${product.name} (${product.codes.join(', ')})`}
            />
          ) : (
            // Only the store's products can be merged, but the rows stay aligned
            <span aria-hidden className="mr-2 size-4 shrink-0" />
          )}
          <button
            type="button"
            onClick={() =>
              item.origin === 'store'
                ? onOpen(item.product)
                : onOpenCatalog(item.product)
            }
            className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- the photo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
                <img
                  src={photo}
                  alt=""
                  loading="lazy"
                  className="size-full object-contain"
                />
              ) : (
                <ImageOff
                  aria-hidden
                  className="size-5 text-muted-foreground"
                />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="font-medium wrap-break-word">
                {product.name}
              </span>
              <span className="text-sm text-muted-foreground">
                {[product.brand, product.unit].filter(Boolean).join(' · ')}
              </span>
              {item.origin === 'store' ? (
                <Badge variant="outline">Da loja</Badge>
              ) : (
                <Badge variant="secondary">Catálogo</Badge>
              )}
            </span>
            <span className="shrink-0 text-right font-mono text-sm text-muted-foreground">
              {product.codes[0]}
              {product.codes.length > 1 && (
                <span className="block font-sans text-xs">
                  +{product.codes.length - 1}{' '}
                  {product.codes.length === 2 ? 'código' : 'códigos'}
                </span>
              )}
            </span>
          </button>
          {item.origin === 'store' ? (
            <DeleteProductButton
              product={item.product}
              disabled={busy}
              onDeleted={onDeleted}
            />
          ) : (
            <span aria-hidden className="size-8 shrink-0" />
          )}
        </li>
      )
    })}
  </ul>
)
