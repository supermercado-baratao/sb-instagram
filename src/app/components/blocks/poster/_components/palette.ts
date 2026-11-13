import type { CSSProperties } from 'react'

import type { PosterTemplate } from '@/models/poster/poster'

// A template stores only two colors, so the shades the art needs are derived from them
// with relative colors, which keeps the hue and chroma the store picked
const shade = (color: string, lightness: string, chroma = 'c', alpha = '1') =>
  `oklch(from ${color} ${lightness} ${chroma} h / ${alpha})`

export const getPosterPalette = ({
  colors: { primary, accent }
}: PosterTemplate) =>
  ({
    '--poster-primary': primary,
    '--poster-primary-deep': shade(primary, 'calc(l - 0.08)'),
    '--poster-primary-bright': shade(primary, 'calc(l + 0.14)'),
    '--poster-primary-light': shade(primary, 'calc(l + 0.28)'),
    '--poster-primary-tint': shade(primary, '0.95', 'calc(c * 0.25)'),
    '--poster-primary-label': shade(primary, '0.88', 'calc(c * 0.4)'),
    '--poster-shadow': shade(primary, '0.15', 'c', '0.45'),
    '--poster-accent': accent,
    '--poster-accent-dark': shade(accent, 'calc(l - 0.12)'),
    '--poster-accent-glow': shade(accent, 'l', 'c', '0.55'),
    '--poster-accent-shadow': shade(accent, '0.2', 'c', '0.6')
  }) as CSSProperties
