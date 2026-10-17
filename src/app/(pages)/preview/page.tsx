import { Download } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  brand,
  offer,
  products,
  templates
} from '@/app/(pages)/preview/_components/fixtures'
import { getPreviewOptions } from '@/app/(pages)/preview/_components/preview-options'
import { Poster } from '@/app/components/blocks/poster'
import { buttonVariants } from '@/app/components/ui/shadcn/button'
import { posterLayouts } from '@/domain/poster'

export const metadata: Metadata = {
  title: 'Pré-visualização do pôster'
}

const Preview = async ({ searchParams }: PageProps<'/preview'>) => {
  const { layout, template } = getPreviewOptions(await searchParams)
  if (!template) notFound()

  return (
    <main className="flex flex-1 flex-col items-center gap-6 bg-muted p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Pré-visualização do pôster</h1>
      <nav
        aria-label="Quantidade de produtos"
        className="flex flex-wrap justify-center gap-2"
      >
        {posterLayouts.map(({ id }) => (
          <Link
            key={id}
            href={{ query: { layout: id, template: template.id } }}
            aria-current={id === layout ? 'true' : undefined}
            className={buttonVariants({
              variant: id === layout ? 'default' : 'outline'
            })}
          >
            {id} produtos
          </Link>
        ))}
      </nav>
      <nav
        aria-label="Modelo de arte"
        className="flex flex-wrap justify-center gap-2"
      >
        {templates.map(({ id, name }) => (
          <Link
            key={id}
            href={{ query: { layout, template: id } }}
            aria-current={id === template.id ? 'true' : undefined}
            className={buttonVariants({
              variant: id === template.id ? 'default' : 'outline'
            })}
          >
            {name}
          </Link>
        ))}
      </nav>
      <a
        href={`/preview/poster.png?${new URLSearchParams({ layout: String(layout), template: template.id })}`}
        download
        className={buttonVariants()}
      >
        <Download data-icon="inline-start" aria-hidden />
        Baixar PNG
      </a>
      <div className="zoom-[0.3] sm:zoom-[0.55] lg:zoom-[0.7]">
        <Poster
          brand={brand}
          offer={offer}
          template={template}
          layout={layout}
          products={products}
        />
      </div>
    </main>
  )
}

export default Preview
