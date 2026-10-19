import type { Metadata } from 'next'
import { connection } from 'next/server'

import { listNoEanImages } from '@/infra/photo'

import { ProductEditor } from './_components/product-editor'

export const metadata: Metadata = {
  title: 'Produtos'
}

const ProductsPage = async () => {
  // Renders per request, so `next build` never reads the catalog or opens the database
  await connection()
  const noEanImages = await listNoEanImages()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
        <p className="text-muted-foreground">
          Bipe o código com o leitor ou digite e aperte Enter.
        </p>
      </header>
      <ProductEditor noEanImages={noEanImages} />
    </main>
  )
}

export default ProductsPage
