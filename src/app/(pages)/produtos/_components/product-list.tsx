import { ProductThumbnail } from '@/app/components/blocks/product/product-thumbnail'
import { Badge } from '@/app/components/ui/shadcn/badge'
import { Checkbox } from '@/app/components/ui/shadcn/checkbox'
import { getCatalogPhotoUrl, getPhotoUrl } from '@/app/helpers/product-photo'
import type { CatalogStatus as Status } from '@/domain/catalog-export'
import type { CatalogMatch, Product, ProductListItem } from '@/domain/product'

import { CatalogStatus } from './catalog-status'
import { DeleteProductButton } from './delete-product-button'

type ProductListProps = {
  items: ProductListItem[]
  catalogStatuses: Record<string, Status>
  busy: boolean
  selectedIds: Set<string>
  onSelect: (product: Product, selected: boolean) => void
  // The row's button, where the focus goes back when the product's dialog closes
  onOpen: (product: Product, row: HTMLElement) => void
  onOpenCatalog: (product: CatalogMatch, row: HTMLElement) => void
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
  catalogStatuses,
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
      const catalogStatus =
        item.origin === 'store' ? catalogStatuses[item.product.id] : undefined
      const catalogStatusId = `catalog-status-${getKey(item)}`

      return (
        <li key={getKey(item)} className="flex items-center gap-1 pr-2 pl-3">
          {item.origin === 'store' ? (
            <Checkbox
              checked={selectedIds.has(item.product.id)}
              onCheckedChange={(checked) => onSelect(item.product, checked)}
              // Its invisible hit area would cover the edge of the button that opens the product
              className="mr-2"
              // Not every product is unique by description, so the codes tell them apart
              aria-label={`Selecionar ${product.description} (${product.codes.join(', ')})`}
            />
          ) : (
            // Only the store's products can be merged, but the rows stay aligned
            <span aria-hidden className="mr-2 size-4 shrink-0" />
          )}
          <button
            type="button"
            aria-describedby={catalogStatus ? catalogStatusId : undefined}
            onClick={(event) =>
              item.origin === 'store'
                ? onOpen(item.product, event.currentTarget)
                : onOpenCatalog(item.product, event.currentTarget)
            }
            className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-muted-foreground focus-visible:ring-inset"
          >
            <ProductThumbnail src={photo} loading="lazy" />
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="font-medium wrap-break-word">
                {product.description}
              </span>
              {product.unit && (
                <span className="text-sm text-muted-foreground">
                  {product.unit}
                </span>
              )}
              {item.origin === 'store' ? (
                <Badge variant="outline">Da loja</Badge>
              ) : (
                <Badge variant="secondary">Catálogo</Badge>
              )}
              {catalogStatus && (
                <CatalogStatus id={catalogStatusId} status={catalogStatus} />
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
