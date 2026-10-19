'use client'

import { CircleCheck } from 'lucide-react'
import { useState } from 'react'

import {
  FieldDescription,
  FieldLegend,
  FieldSet
} from '@/app/components/ui/shadcn/field'
import { Input } from '@/app/components/ui/shadcn/input'

type CatalogImagePickerProps = {
  images: string[]
  value: string
  onChange: (name: string) => void
}

const toLabel = (name: string) => name.replaceAll('-', ' ')

// Names are lowercase, unaccented kebab-case, so the query is folded the same way to match them
const normalizeQuery = (query: string) =>
  query
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replaceAll(/\s+/g, '-')

export const CatalogImagePicker = ({
  images,
  value,
  onChange
}: CatalogImagePickerProps) => {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeQuery(query)
  const visibleImages = images.filter((name) => name.includes(normalizedQuery))

  return (
    <FieldSet>
      {/* Filtering unmounts the radios, so the choice is submitted from here instead */}
      <input type="hidden" name="catalogImage" value={value} />
      <FieldLegend>Ou escolha uma imagem do catálogo</FieldLegend>
      {images.length === 0 ? (
        <FieldDescription>
          O catálogo ainda não tem imagens de produtos sem código de barras.
          Envie uma foto acima.
        </FieldDescription>
      ) : (
        <>
          <Input
            type="search"
            aria-label="Buscar imagem do catálogo"
            placeholder="Buscar pelo nome, ex.: picanha"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <FieldDescription aria-live="polite">
            {visibleImages.length === 0
              ? 'Nenhuma imagem com esse nome. Tente outra palavra.'
              : `${visibleImages.length} ${visibleImages.length === 1 ? 'imagem' : 'imagens'}`}
          </FieldDescription>
          {visibleImages.length > 0 && (
            <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-5">
              {visibleImages.map((name) => (
                <label
                  key={name}
                  className="relative flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-border p-2 text-center text-xs has-checked:border-primary has-checked:bg-muted has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                >
                  <input
                    type="radio"
                    name="catalogImageOption"
                    value={name}
                    checked={value === name}
                    onChange={() => onChange(name)}
                    className="sr-only"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route from the catalog on disk, which next/image would copy into its cache for every size */}
                  <img
                    src={`/catalogo/sem-ean/${name}`}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full object-contain"
                  />
                  {toLabel(name)}
                  {value === name && (
                    <CircleCheck className="absolute top-1.5 right-1.5 size-5 fill-primary text-primary-foreground" />
                  )}
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </FieldSet>
  )
}
