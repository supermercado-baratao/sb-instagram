import {
  Download,
  FileArchive,
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
} from '@/app/helpers/generation'
import {
  getRadioListMarkdown,
  getRadioScriptMarkdown,
  getRadioScriptWarning
} from '@/domain/radio-script'
import type { Generation } from '@/models/generation/generation'
import { formatValidUntil } from '@/models/offer/offer'

import { CopyPagesButton } from './copy-pages-button'
import { DeleteGenerationButton } from './delete-generation-button'
import { GeneratedAt } from './generated-at'
import { RadioTextDialog } from './radio-text-dialog'

const describePages = (pageCount: number) =>
  pageCount === 1 ? '1 arte' : `${pageCount} artes`

const GenerationCard = ({ generation }: { generation: Generation }) => {
  const validUntil = formatValidUntil(generation.validUntil)
  const pageNumbers = Array.from(
    { length: generation.pageCount },
    (_, index) => index + 1
  )
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>
            Oferta {generation.number}
            {validUntil && ` · válida até ${validUntil}`}
          </h2>
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
                className="block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-muted-foreground"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, already at its final size, so next/image's optimizer adds nothing */}
                <img
                  src={getGenerationPageHref(generation, pageNumber)}
                  alt={`Arte ${pageNumber} da oferta ${generation.number} (abre em nova aba)`}
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
        <CopyPagesButton generation={generation} />
        <a
          href={getGenerationHref(generation, 'paginas.zip')}
          download
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Download data-icon="inline-start" aria-hidden />
          Baixar artes
          <span className="sr-only"> da oferta {generation.number}</span>
        </a>
        <a
          href={getGenerationHref(generation, 'paginas.pdf')}
          target="_blank"
          rel="noopener"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Printer data-icon="inline-start" aria-hidden />
          Imprimir artes
          <span className="sr-only">
            {' '}
            da oferta {generation.number} (abre em nova aba)
          </span>
        </a>
        <a
          href={getGenerationHref(generation, 'ofertas.json')}
          download
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FileBraces data-icon="inline-start" aria-hidden />
          Baixar dados (JSON)
          <span className="sr-only"> da oferta {generation.number}</span>
        </a>
        <a
          href={getGenerationHref(generation, 'geracao.zip')}
          download
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FileArchive data-icon="inline-start" aria-hidden />
          Baixar tudo (ZIP)
          <span className="sr-only"> da oferta {generation.number}</span>
        </a>
        {generation.radioScript && (
          <>
            <RadioTextDialog
              title="Roteiro do comercial"
              description="Os blocos salvos em Comercial, com os produtos de cada arte e os preços por extenso."
              copiedMessage="Roteiro do comercial copiado."
              icon={<Megaphone data-icon="inline-start" aria-hidden />}
              generationNumber={generation.number}
              text={getRadioScriptMarkdown(generation.radioScript)}
              warning={getRadioScriptWarning(generation.radioScript)}
              href={getGenerationHref(generation, 'roteiro.md')}
            />
            <RadioTextDialog
              title="Lista de produtos"
              description="Os produtos do comercial, numerados em sequência, com o texto da locução e o preço."
              copiedMessage="Lista de produtos copiada."
              icon={<ListOrdered data-icon="inline-start" aria-hidden />}
              generationNumber={generation.number}
              text={getRadioListMarkdown(generation.radioScript)}
              warning={getRadioScriptWarning(generation.radioScript)}
              href={getGenerationHref(generation, 'lista.md')}
            />
          </>
        )}
        <DeleteGenerationButton generation={generation} />
      </CardFooter>
    </Card>
  )
}

export const GenerationList = ({
  generations
}: {
  generations: Generation[]
}) =>
  generations.length === 0 ? (
    <p className="text-sm text-muted-foreground">
      Nenhuma oferta gerada ainda. Salve a oferta e clique em Gerar oferta, ou
      importe uma oferta baixada em outra instalação.
    </p>
  ) : (
    <ol className="flex flex-col gap-4">
      {generations.map((generation) => (
        <li key={generation.id}>
          <GenerationCard generation={generation} />
        </li>
      ))}
    </ol>
  )
