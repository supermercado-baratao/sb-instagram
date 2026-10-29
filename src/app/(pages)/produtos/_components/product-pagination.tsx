import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/app/components/ui/shadcn/pagination'

import { getProductsHref, type ProductsView } from './products-href'

type ProductPaginationProps = ProductsView & {
  page: number
  pageCount: number
}

export const ProductPagination = ({
  query,
  filter,
  page,
  pageCount
}: ProductPaginationProps) => (
  <Pagination aria-label="Páginas de produtos">
    <PaginationContent className="gap-2">
      {page > 1 && (
        <PaginationItem>
          <PaginationPrevious
            href={getProductsHref({ query, filter, page: page - 1 })}
            text="Anterior"
            aria-label="Página anterior"
          />
        </PaginationItem>
      )}
      <PaginationItem className="text-sm text-muted-foreground">
        Página {page} de {pageCount}
      </PaginationItem>
      {page < pageCount && (
        <PaginationItem>
          <PaginationNext
            href={getProductsHref({ query, filter, page: page + 1 })}
            text="Próxima"
            aria-label="Próxima página"
          />
        </PaginationItem>
      )}
    </PaginationContent>
  </Pagination>
)
