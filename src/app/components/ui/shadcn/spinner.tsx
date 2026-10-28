import { cn } from 'cn'
import { Loader2Icon } from 'lucide-react'

const Spinner = ({ className, ...props }: React.ComponentProps<'svg'>) => (
  <Loader2Icon
    data-slot="spinner"
    role="status"
    aria-label="Carregando"
    className={cn('size-4 animate-spin', className)}
    {...props}
  />
)

export { Spinner }
