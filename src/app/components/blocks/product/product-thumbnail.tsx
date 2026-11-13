import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { ImageOff } from 'lucide-react'

const thumbnailVariants = cva(
  'flex shrink-0 items-center justify-center overflow-hidden bg-muted',
  {
    variants: {
      size: {
        sm: 'size-8 rounded-sm',
        md: 'size-12 rounded-md',
        lg: 'size-14 rounded-md'
      }
    },
    defaultVariants: { size: 'md' }
  }
)

type ProductThumbnailProps = VariantProps<typeof thumbnailVariants> & {
  src: string | undefined
  loading?: 'lazy'
  imageClassName?: string
}

export const ProductThumbnail = ({
  src,
  size,
  loading,
  imageClassName
}: ProductThumbnailProps) => (
  <span className={thumbnailVariants({ size })}>
    {src ? (
      // eslint-disable-next-line @next/next/no-img-element -- the photo changes on every upload and is served by our own route, so next/image's optimizer would only cache a stale copy
      <img
        src={src}
        alt=""
        loading={loading}
        className={cn('size-full object-contain', imageClassName)}
      />
    ) : (
      <ImageOff
        aria-hidden
        className={cn(
          'text-muted-foreground',
          size === 'sm' ? 'size-4' : 'size-5'
        )}
      />
    )}
  </span>
)
