import { ImageOff } from 'lucide-react'

import {
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteStatus
} from '@/app/components/ui/custom/autocomplete'
import { getPhotoUrl } from '@/app/helpers/product-photo'
import type { Product } from '@/domain/product'

type ProductSuggestionsProps = {
  suggestions: Product[]
  suggesting: boolean
}

const ProductSuggestion = ({ product }: { product: Product }) => {
  const details = [product.brand, product.unit].filter(Boolean).join(' · ')
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted">
        {product.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the photo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
          <img
            src={getPhotoUrl(product.id)}
            alt=""
            className="size-full object-contain"
          />
        ) : (
          <ImageOff className="size-4 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-medium wrap-break-word">{product.name}</span>
        <span className="text-xs text-muted-foreground">
          {details && `${details} · `}
          <span className="font-mono">{product.codes.join(', ')}</span>
        </span>
      </span>
    </>
  )
}

export const ProductSuggestions = ({
  suggestions,
  suggesting
}: ProductSuggestionsProps) => {
  const status = suggesting ? 'Buscando…' : 'Nenhum produto encontrado.'
  // A list without the focus says nothing by itself, so the count is read out
  const count =
    suggesting || suggestions.length === 0
      ? undefined
      : `${suggestions.length} ${suggestions.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`

  return (
    <AutocompleteContent aria-busy={suggesting || undefined}>
      <AutocompleteStatus>
        {count === undefined ? (
          <p className="p-2 text-sm text-muted-foreground">{status}</p>
        ) : (
          <span className="sr-only">{count}</span>
        )}
      </AutocompleteStatus>
      <AutocompleteList>
        {(product: Product) => (
          <AutocompleteItem key={product.id} value={product}>
            <ProductSuggestion product={product} />
          </AutocompleteItem>
        )}
      </AutocompleteList>
    </AutocompleteContent>
  )
}
