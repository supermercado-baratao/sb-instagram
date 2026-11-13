import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { needsCatalogExport } from '@/domain/catalog-export'
import { requireBrandSettings } from '@/entry/brand'
import { checkCatalogPhotos, listCatalogStatuses } from '@/infra/catalog/export'
import { database } from '@/infra/database/client'
import { listNoEanImages } from '@/infra/photo'
import { listProducts } from '@/infra/product'

import { ProductEditor } from './_components/product-editor'
import { parseProductListFilter } from './_components/products-href'

export const metadata: Metadata = {
  title: 'Produtos'
}

const readParameter = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? ''

const ProductsPage = async ({ searchParams }: PageProps<'/produtos'>) => {
  // Renders per request, so `next build` never reads the catalog or opens the database
  await connection()
  const { brand } = requireBrandSettings()
  const noEanImages = await listNoEanImages()
  const params = await searchParams
  const query = readParameter(params.q).trim()
  const filter = parseProductListFilter(readParameter(params.origem))
  const statuses = await listCatalogStatuses(database)
  const productPage = await listProducts(database, {
    query,
    filter,
    page: Number(readParameter(params.pagina)),
    catalogExportIds: new Set(
      [...statuses]
        .filter(([, status]) => needsCatalogExport(status))
        .map(([id]) => id)
    )
  })
  const catalogStatuses = await checkCatalogPhotos(
    productPage.items.flatMap((item) =>
      item.origin === 'store' ? [item.product] : []
    ),
    statuses
  )

  return (
    <AppLayout brand={brand}>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <ProductEditor
          noEanImages={noEanImages}
          productPage={productPage}
          query={query}
          filter={filter}
          catalogStatuses={Object.fromEntries(catalogStatuses)}
        />
      </main>
    </AppLayout>
  )
}

export default ProductsPage
