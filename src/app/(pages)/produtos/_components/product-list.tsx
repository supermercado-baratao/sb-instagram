import { ImageOff } from 'lucide-react'

import type { Product } from '@/domain/product'

import { DeleteProductButton } from './delete-product-button'

type ProductListProps = {
  products: Product[]
  busy: boolean
  onOpen: (code: string) => void
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
      <li key={product.code} className="flex items-center gap-1 pr-2">
        <button
          type="button"
          // Not disabled, so the clicked row keeps the focus while the lookup runs
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) onOpen(product.code)
          }}
          className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset aria-disabled:cursor-wait aria-disabled:hover:bg-transparent"
        >
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {product.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- the photo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
              <img
                src={`/fotos/${encodeURIComponent(product.code)}`}
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
          <span className="shrink-0 font-mono text-sm text-muted-foreground">
            {product.code}
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
