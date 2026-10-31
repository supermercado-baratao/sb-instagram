import {
  Download,
  FileBraces,
  ListOrdered,
  Megaphone,
  Printer
} from 'lucide-react'

import { buttonVariants } from '@/app/components/ui/shadcn/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/app/components/ui/shadcn/card'
import {
  getGenerationHref,
  getGenerationPageHref
} from '@/app/helpers/offer-generation'
import type { OfferGeneration } from '@/domain/offer-generation'
import {
  getRadioListMarkdown,
  getRadioScriptMarkdown
} from '@/domain/radio-script'

import {
  DeleteGenerationButton,
  GENERATIONS_HEADING_ID
} from './delete-generation-button'
import { GeneratedAt } from './generated-at'
import { RadioTextDialog } from './radio-text-dialog'

const describePages = (pageCount: number) =>
  pageCount === 1 ? '1 página' : `${pageCount} páginas`

const GenerationCard = ({ generation }: { generation: OfferGeneration }) => {
  const pageNumbers = Array.from(
    { length: generation.pageCount },
    (_, index) => index + 1
  )
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3>Geração {generation.number}</h3>
        </CardTitle>
        <CardDescription>
          {describePages(generation.pageCount)}
          <GeneratedAt date={generation.createdAt} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* The padding keeps the focus ring inside the scroll box, which would clip it */}
        <ul className="-m-1 flex gap-2 overflow-x-auto p-1">
          {pageNumbers.map((pageNumber) => (
            <li key={pageNumber} className="shrink-0">
              <a
                href={getGenerationPageHref(generation, pageNumber)}
                target="_blank"
                rel="noopener"
                className="block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, already at its final size, so next/image's optimizer adds nothing */}
                <img
                  src={getGenerationPageHref(generation, pageNumber)}
                  alt={`Página ${pageNumber} da geração ${generation.number} (abre em nova aba)`}
                  loading="lazy"
                  width={96}
                  height={120}
                  className="aspect-4/5 w-24 rounded-md border border-border object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <a
          href={getGenerationHref(generation, 'paginas.zip')}
          download
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Download data-icon="inline-start" aria-hidden />
          Baixar páginas (PNG)
          <span className="sr-only"> da geração {generation.number}</span>
        </a>
        <a
          href={getGenerationHref(generation, 'paginas.pdf')}
          target="_blank"
          rel="noopener"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Printer data-icon="inline-start" aria-hidden />
          Imprimir páginas
          <span className="sr-only">
            {' '}
            da geração {generation.number} (abre em nova aba)
          </span>
        </a>
        <a
          href={getGenerationHref(generation, 'ofertas.json')}
          download
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FileBraces data-icon="inline-start" aria-hidden />
          Exportar produtos (JSON)
          <span className="sr-only"> da geração {generation.number}</span>
        </a>
        {generation.radioScript && (
          <>
            <RadioTextDialog
              title="Roteiro do comercial"
              description="Um bloco por página, com os textos do roteiro salvos em Configurações › Comercial."
              copiedMessage="Roteiro do comercial copiado."
              icon={Megaphone}
              generationNumber={generation.number}
              text={getRadioScriptMarkdown(generation.radioScript)}
              href={getGenerationHref(generation, 'roteiro.md')}
            />
            <RadioTextDialog
              title="Lista da rádio"
              description="Os produtos de cada bloco, numerados em sequência, com o texto da locução e o preço."
              copiedMessage="Lista da rádio copiada."
              icon={ListOrdered}
              generationNumber={generation.number}
              text={getRadioListMarkdown(generation.radioScript)}
              href={getGenerationHref(generation, 'lista.md')}
            />
          </>
        )}
        <DeleteGenerationButton generation={generation} />
      </CardFooter>
    </Card>
  )
}

export const OfferGenerations = ({
  generations
}: {
  generations: OfferGeneration[]
}) => (
  <section
    aria-labelledby={GENERATIONS_HEADING_ID}
    className="flex flex-col gap-4"
  >
    <div className="flex flex-col gap-1">
      <h2
        id={GENERATIONS_HEADING_ID}
        tabIndex={-1}
        className="text-lg font-semibold outline-none"
      >
        Gerações
      </h2>
      <p className="text-sm text-muted-foreground">
        Cada geração guarda as páginas como estavam ao gerar. Mudar um produto
        ou a marca depois não altera as gerações.
      </p>
    </div>
    {generations.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        Nenhuma geração ainda. Salve a oferta e clique em Gerar.
      </p>
    ) : (
      <ol className="flex flex-col gap-4">
        {generations.map((generation) => (
          <li key={generation.id}>
            <GenerationCard generation={generation} />
          </li>
        ))}
      </ol>
    )}
  </section>
)
