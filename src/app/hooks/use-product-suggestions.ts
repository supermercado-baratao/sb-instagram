import { useRef, useState, useTransition } from 'react'

import { searchInstanceProducts } from '@/app/components/blocks/product/actions'
import type { Product } from '@/domain/product'

// Long enough for a scanner to finish the code and press Enter before any suggestion is fetched
const SUGGESTION_DELAY_MS = 250

export const useProductSuggestions = () => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [suggesting, startSuggest] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Discards a response that arrives after a newer query or a submit
  const request = useRef(0)

  const stop = () => {
    clearTimeout(timer.current)
    request.current += 1
  }

  const close = () => {
    stop()
    setSuggestions([])
    setOpen(false)
  }

  const suggest = (text: string) => {
    setQuery(text)
    stop()
    if (text.trim() === '') {
      close()
      return
    }

    const current = request.current
    timer.current = setTimeout(() => {
      startSuggest(async () => {
        const found = await searchInstanceProducts(text)
        if (current !== request.current) return
        startSuggest(() => {
          setSuggestions(found)
          setOpen(true)
        })
      })
    }, SUGGESTION_DELAY_MS)
  }

  const onOpenChange = (next: boolean) => {
    if (next) {
      setOpen(suggestions.length > 0)
      return
    }
    // A pending fetch would reopen the list after the user left or dismissed it
    stop()
    setOpen(false)
  }

  return {
    query,
    setQuery,
    suggestions,
    open,
    onOpenChange,
    suggesting,
    suggest,
    stop,
    close
  }
}
