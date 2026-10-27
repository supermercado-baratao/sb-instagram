'use client'

import { Autocomplete as AutocompletePrimitive } from '@base-ui/react/autocomplete'
import { cn } from 'cn'

import { Input } from '@/app/components/ui/shadcn/input'

// Styled after shadcn's base-nova Combobox, since shadcn has no Autocomplete
// (https://ui.shadcn.com/docs/components/base/combobox)
const Autocomplete = AutocompletePrimitive.Root

const AutocompleteInput = (props: AutocompletePrimitive.Input.Props) => (
  <AutocompletePrimitive.Input
    data-slot="autocomplete-input"
    render={<Input />}
    {...props}
  />
)

const AutocompleteContent = ({
  className,
  side = 'bottom',
  sideOffset = 6,
  align = 'start',
  alignOffset = 0,
  ...props
}: AutocompletePrimitive.Popup.Props &
  Pick<
    AutocompletePrimitive.Positioner.Props,
    'side' | 'align' | 'sideOffset' | 'alignOffset'
  >) => (
  <AutocompletePrimitive.Portal>
    <AutocompletePrimitive.Positioner
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      className="isolate z-50"
    >
      <AutocompletePrimitive.Popup
        data-slot="autocomplete-content"
        className={cn(
          'relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className
        )}
        {...props}
      />
    </AutocompletePrimitive.Positioner>
  </AutocompletePrimitive.Portal>
)

const AutocompleteList = ({
  className,
  ...props
}: AutocompletePrimitive.List.Props) => (
  <AutocompletePrimitive.List
    data-slot="autocomplete-list"
    className={cn(
      'max-h-[min(--spacing(72),var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0',
      className
    )}
    {...props}
  />
)

const AutocompleteItem = ({
  className,
  ...props
}: AutocompletePrimitive.Item.Props) => (
  <AutocompletePrimitive.Item
    data-slot="autocomplete-item"
    className={cn(
      'relative flex w-full cursor-default items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
      className
    )}
    {...props}
  />
)

// Unstyled: the live region must stay displayed, so the message inside it carries the styling
// (https://base-ui.com/react/components/autocomplete)
const AutocompleteStatus = (props: AutocompletePrimitive.Status.Props) => (
  <AutocompletePrimitive.Status data-slot="autocomplete-status" {...props} />
)

export {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteStatus
}
