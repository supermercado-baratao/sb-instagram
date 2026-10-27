import { ImageOff } from 'lucide-react'

import { getPhotoUrl } from '@/app/helpers/product-photo'
import type { Product } from '@/domain/product'

import { DeleteProductButton } from './delete-product-button'

type ProductListProps = {
  products: Product[]
  busy: boolean
  onOpen: (product: Product) => void
  onDeleted: (product: Product) => void
}

export const ProductList = ({
  products,
  busy,
  onOpen,
  onDeleted
}: ProductListProps) => (
  <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
    {products.map((product) => (
      <li key={product.id} className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={() => onOpen(product)}
          className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {product.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- the photo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
              <img
                src={getPhotoUrl(product.id)}
                alt=""
                loading="lazy"
                className="size-full object-contain"
              />
            ) : (
              <ImageOff aria-hidden className="size-5 text-muted-foreground" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium wrap-break-word">{product.name}</span>
            <span className="text-sm text-muted-foreground">
              {[product.brand, product.unit].filter(Boolean).join(' · ')}
            </span>
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
        <DeleteProductButton
          product={product}
          disabled={busy}
          onDeleted={onDeleted}
        />
      </li>
    ))}
  </ul>
)
