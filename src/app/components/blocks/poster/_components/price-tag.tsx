import { splitPrice } from '@/models/poster/poster'

import { FitText } from './fit-text'
import { posterPlaceholders } from './placeholders'

type PriceTagProps = {
  priceInCents: number
  unit: string
  scale: number
}

const DECIMAL_BOX = { width: 30, height: 26, fontSize: 22 }
const UNIT_BOX = { width: 30, height: 26, fontSize: 13 }
const INTEGER_BOX = {
  width: 40,
  height: DECIMAL_BOX.height + UNIT_BOX.height,
  fontSize: 48
}

export const PriceTag = ({ priceInCents, unit, scale }: PriceTagProps) => {
  const { integer, decimal } = splitPrice(priceInCents)
  const label = `R$ ${integer},${decimal} ${unit || posterPlaceholders.unit}`

  return (
    <div
      role="img"
      aria-label={label}
      className="absolute top-1.5 right-1.5 flex size-[110px] origin-top-right items-center justify-center rounded-full border-4 border-(--poster-accent) bg-white/90 leading-none shadow-[0_4px_10px_var(--poster-shadow)]"
      style={{ scale }}
    >
      <div className="flex items-center gap-0.5 font-(family-name:--font-poster-heading)">
        <span className="text-[14px] text-(--poster-accent)">R$</span>
        <FitText
          text={integer}
          className="fill-(--poster-primary-deep)"
          {...INTEGER_BOX}
        />
        <div className="flex flex-col">
          <FitText
            text={`,${decimal}`}
            className="fill-(--poster-primary-deep)"
            {...DECIMAL_BOX}
          />
          <FitText
            text={unit || posterPlaceholders.unit}
            className="fill-(--poster-accent) font-(family-name:--font-poster-body) font-bold"
            {...UNIT_BOX}
          />
        </div>
      </div>
    </div>
  )
}
