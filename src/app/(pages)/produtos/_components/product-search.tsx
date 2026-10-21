'use client'

import { Search } from 'lucide-react'
import Form from 'next/form'
import { useState } from 'react'

import { Button } from '@/app/components/ui/shadcn/button'
import { Input } from '@/app/components/ui/shadcn/input'

type ProductSearchProps = {
  query: string
}

export const ProductSearch = ({ query }: ProductSearchProps) => {
  const [value, setValue] = useState(query)
  const [syncedQuery, setSyncedQuery] = useState(query)

  // Synced during render rather than remounted with a key, so a search keeps the focus in the field
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (query !== syncedQuery) {
    setSyncedQuery(query)
    setValue(query)
  }

  return (
    <Form action="/produtos" role="search" className="flex gap-2">
      <Input
        type="search"
        name="q"
        aria-label="Pesquisar produtos"
        placeholder="Pesquisar pelo nome ou código"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      <Button type="submit" variant="outline">
        <Search data-icon="inline-start" aria-hidden />
        Pesquisar
      </Button>
    </Form>
  )
}
