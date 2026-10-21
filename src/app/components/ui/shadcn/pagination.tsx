import type { VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon
} from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { buttonVariants } from '@/app/components/ui/shadcn/button'

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="pagination"
    data-slot="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
)

const PaginationContent = ({
  className,
  ...props
}: React.ComponentProps<'ul'>) => (
  <ul
    data-slot="pagination-content"
    className={cn('flex items-center gap-0.5', className)}
    {...props}
  />
)

const PaginationItem = ({ ...props }: React.ComponentProps<'li'>) => (
  <li data-slot="pagination-item" {...props} />
)

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<VariantProps<typeof buttonVariants>, 'size'> &
  React.ComponentProps<typeof Link>

const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) => (
  // A link styled as a button, since Base UI's Button would give it button semantics
  // (https://base-ui.com/react/components/button#rendering-links-as-buttons)
  <Link
    aria-current={isActive ? 'page' : undefined}
    data-slot="pagination-link"
    data-active={isActive}
    className={cn(
      buttonVariants({ variant: isActive ? 'outline' : 'ghost', size }),
      className
    )}
    {...props}
  />
)

const PaginationPrevious = ({
  className,
  text = 'Previous',
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn('pl-1.5!', className)}
    {...props}
  >
    <ChevronLeftIcon data-icon="inline-start" />
    <span className="hidden sm:block">{text}</span>
  </PaginationLink>
)

const PaginationNext = ({
  className,
  text = 'Next',
  ...props
}: React.ComponentProps<typeof PaginationLink> & { text?: string }) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn('pr-1.5!', className)}
    {...props}
  >
    <span className="hidden sm:block">{text}</span>
    <ChevronRightIcon data-icon="inline-end" />
  </PaginationLink>
)

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    data-slot="pagination-ellipsis"
    className={cn(
      "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  >
    <MoreHorizontalIcon />
    <span className="sr-only">More pages</span>
  </span>
)

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
}
