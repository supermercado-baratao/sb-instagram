import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/app/components/ui/shadcn/pagination'

type ProductPaginationProps = {
  query: string
  page: number
  pageCount: number
}

const getPageHref = (query: string, page: number) => {
  const params = new URLSearchParams()
  if (query !== '') params.set('q', query)
  if (page > 1) params.set('pagina', String(page))
  const search = params.toString()
  return search === '' ? '/produtos' : `/produtos?${search}`
}

export const ProductPagination = ({
  query,
  page,
  pageCount
}: ProductPaginationProps) => (
  <Pagination aria-label="Páginas de produtos">
    <PaginationContent className="gap-2">
      {page > 1 && (
        <PaginationItem>
          <PaginationPrevious
            href={getPageHref(query, page - 1)}
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
            href={getPageHref(query, page + 1)}
            text="Próxima"
            aria-label="Próxima página"
          />
        </PaginationItem>
      )}
    </PaginationContent>
  </Pagination>
)
