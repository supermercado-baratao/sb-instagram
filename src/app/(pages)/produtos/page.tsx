import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { requireBrandSettings } from '@/entry/brand'
import { database } from '@/infra/database/client'
import { catalogModel } from '@/models/catalog/model'
import { needsCatalogExport } from '@/models/catalog-export/catalog-export'
import { catalogExportModel } from '@/models/catalog-export/model'
import { productModel } from '@/models/product/model'

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
  const noEanImages = await catalogModel.listNoEanImages()
  const params = await searchParams
  const query = readParameter(params.q).trim()
  const filter = parseProductListFilter(readParameter(params.origem))
  const statuses = await catalogExportModel.listStatuses(database)
  const productPage = await productModel.list(database, {
    query,
    filter,
    page: Number(readParameter(params.pagina)),
    catalogExportIds: new Set(
      [...statuses]
        .filter(([, status]) => needsCatalogExport(status))
        .map(([id]) => id)
    )
  })
  const catalogStatuses = await catalogExportModel.checkPhotos(
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
