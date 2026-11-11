'use client'

import { ArrowLeftRight } from 'lucide-react'

import { Button } from '@/app/components/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/app/components/ui/shadcn/dropdown-menu'

export type ProductsBlockOption = { id: number; label: string }

type MoveToBlockMenuProps = {
  id: string
  description: string
  // The block that speaks the product now
  blockId: number
  moved: boolean
  blocks: ProductsBlockOption[]
  onMove: (blockId: number | undefined) => void
}

export const MoveToBlockMenu = ({
  id,
  description,
  blockId,
  moved,
  blocks,
  onMove
}: MoveToBlockMenuProps) => {
  const others = blocks.filter((block) => block.id !== blockId)
  if (!moved && others.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            id={id}
            variant="ghost"
            size="icon-sm"
            // The preview's surface is already `bg-muted`, the ghost hover color
            className="hover:bg-background dark:hover:bg-background"
            aria-label={`Mover ${description} para outro bloco`}
          />
        }
      >
        <ArrowLeftRight aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto">
        {/* Screen readers seldom read a group's label while moving through a menu, so each item
            names its action too */}
        {others.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Mover para</DropdownMenuLabel>
            {others.map((block) => (
              <DropdownMenuItem key={block.id} onClick={() => onMove(block.id)}>
                <span className="sr-only">Mover para </span>
                {block.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
        {moved && (
          <>
            {others.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => onMove(undefined)}>
              Voltar ao lugar original
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
