import { cn } from 'cn'

import {
  posterBodyFont,
  posterHeadingFont
} from '@/app/components/blocks/poster/_components/fonts'
import { InstagramMark } from '@/app/components/blocks/poster/_components/instagram-mark'
import { getPosterPalette } from '@/app/components/blocks/poster/_components/palette'
import { ProductCard } from '@/app/components/blocks/poster/_components/product-card'
import { POSTER_SIZE } from '@/constants/poster'
import {
  type Brand,
  getPosterLayout,
  getVisibleProducts,
  type Offer,
  type OfferProduct,
  type PosterLayout,
  type PosterTemplate
} from '@/models/poster/poster'

type PosterProps = {
  brand: Brand
  offer: Offer
  template: PosterTemplate
  layout: PosterLayout
  products: OfferProduct[]
}

const POSTER_PADDING_X = 24
const GRID_GAP = 16

export const Poster = ({
  brand,
  offer,
  template,
  layout,
  products
}: PosterProps) => {
  const layoutConfig = getPosterLayout(layout)
  const columnWidth =
    (POSTER_SIZE.width -
      POSTER_PADDING_X * 2 -
      GRID_GAP * (layoutConfig.columns - 1)) /
    layoutConfig.columns

  return (
    <article
      aria-label={`Ofertas de ${brand.name}`}
      className={cn(
        posterHeadingFont.variable,
        posterBodyFont.variable,
        'relative flex shrink-0 flex-col gap-[18px] overflow-hidden bg-(--poster-primary) pt-[26px] pb-[22px] font-(family-name:--font-poster-body) text-white'
      )}
      style={{
        ...getPosterPalette(template),
        width: POSTER_SIZE.width,
        height: POSTER_SIZE.height,
        paddingInline: POSTER_PADDING_X,
        backgroundImage:
          'repeating-linear-gradient(118deg, rgb(255 255 255 / 0.055) 0 46px, transparent 46px 96px), radial-gradient(130% 78% at 50% -6%, var(--poster-primary-light) 0%, var(--poster-primary-bright) 38%, var(--poster-primary) 70%, var(--poster-primary-deep) 100%)'
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-45 -left-35 size-[620px] rounded-full bg-radial from-(--poster-accent-glow) to-transparent to-68%"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-30 -right-40 size-[520px] rounded-full bg-radial from-white/20 to-transparent to-70%"
      />

      <header className="relative grid grid-cols-[352px_minmax(0,1fr)] gap-[18px]">
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-[26px] border-[5px] border-(--poster-accent) bg-linear-to-b from-white to-(--poster-primary-tint) px-4 pt-3.5 pb-3 shadow-[0_8px_0_var(--poster-shadow)]">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/image lazy loads and rewrites the URL, so the PNG could be captured before the logo arrives
            <img
              src={brand.logo}
              alt={brand.name}
              className="block h-auto max-h-[150px] w-[230px] object-contain"
            />
          ) : (
            <p className="text-center font-(family-name:--font-poster-heading) text-[44px] leading-none text-(--poster-primary) uppercase">
              {brand.name}
            </p>
          )}
          {brand.slogan && (
            <p className="text-center font-(family-name:--font-poster-heading) text-[27px] leading-none tracking-wide text-(--poster-primary) uppercase">
              {brand.slogan}
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center gap-3 rounded-[26px] border-[5px] border-white bg-linear-to-b from-(--poster-accent) to-(--poster-accent-dark) px-[22px] py-[18px] font-(family-name:--font-poster-heading) uppercase shadow-[0_8px_0_var(--poster-shadow)]">
          <h2
            className="line-clamp-2 text-[56px] tracking-wide text-yellow-400 [text-shadow:0_3px_0_var(--poster-accent-shadow)]"
            style={{ lineHeight: 0.95 }}
          >
            {offer.highlightTitle}
          </h2>
          <p className="line-clamp-2 text-[42px]" style={{ lineHeight: 1.2 }}>
            {offer.highlightMessage}
          </p>
        </div>
      </header>

      <ul
        className="relative grid min-h-0 flex-1 pb-1.5"
        style={{
          gap: GRID_GAP,
          gridTemplateColumns: `repeat(${layoutConfig.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layoutConfig.rows}, minmax(0, 1fr))`
        }}
      >
        {getVisibleProducts({ layout, products }).map((product, index) => (
          <ProductCard
            // Slots are positional and an empty slot has no code yet
            key={index}
            product={product}
            layout={layoutConfig}
            width={columnWidth}
          />
        ))}
      </ul>

      <footer className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[22px] border-4 border-white bg-linear-to-b from-(--poster-accent) to-(--poster-accent-dark) px-[18px] py-3 shadow-[0_7px_0_var(--poster-shadow)]">
        <p className="text-[21px] font-medium" style={{ lineHeight: 1.15 }}>
          Ofertas válidas somente até{' '}
          <strong className="font-bold">{offer.validUntil}</strong> ou enquanto
          durarem os estoques. Produtos sujeitos a limites por cliente. Imagens
          meramente ilustrativas.
        </p>
        {brand.instagram && (
          <p className="flex items-center gap-2.5 rounded-full bg-white py-2 pr-5 pl-3 font-(family-name:--font-poster-heading) text-[32px] text-(--poster-primary)">
            <InstagramMark />
            {brand.instagram}
          </p>
        )}
      </footer>
    </article>
  )
}
