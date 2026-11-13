import { ProductThumbnail } from '@/app/components/blocks/product/product-thumbnail'
import {
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteStatus
} from '@/app/components/ui/custom/autocomplete'
import { getPhotoUrl } from '@/app/helpers/product-photo'
import type { Product } from '@/models/product/product'

type ProductSuggestionsProps = {
  suggestions: Product[]
  suggesting: boolean
}

const ProductSuggestion = ({ product }: { product: Product }) => {
  return (
    <>
      <ProductThumbnail
        size="sm"
        src={product.photo ? getPhotoUrl(product.id) : undefined}
      />
      <span className="flex min-w-0 flex-col">
        <span className="font-medium wrap-break-word">
          {product.description}
        </span>
        <span className="text-xs text-muted-foreground">
          {product.unit && `${product.unit} · `}
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
