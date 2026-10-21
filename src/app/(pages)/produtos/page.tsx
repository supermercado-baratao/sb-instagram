import type { Metadata } from 'next'
import { connection } from 'next/server'

import { AppLayout } from '@/app/components/layouts/app'
import { requireBrandSettings } from '@/app/helpers/brand-settings'
import { database } from '@/infra/database/client'
import { listNoEanImages } from '@/infra/photo'
import { listProducts } from '@/infra/product'

import { ProductEditor } from './_components/product-editor'

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
  const productPage = listProducts(database, {
    query,
    page: Number(readParameter(params.pagina))
  })

  return (
    <AppLayout brand={brand}>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">
            Bipe o código com o leitor ou digite e aperte Enter.
          </p>
        </header>
        <ProductEditor
          noEanImages={noEanImages}
          productPage={productPage}
          query={query}
        />
      </main>
    </AppLayout>
  )
}

export default ProductsPage
