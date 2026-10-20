'use client'

import { createContext, type ReactNode, use, useState } from 'react'

const AnnounceContext = createContext<(message: string) => void>(() => {})

// The status region sits outside the list, so it survives the row that a delete unmounts
export const OffersAnnouncer = ({ children }: { children: ReactNode }) => {
  const [message, setMessage] = useState('')

  return (
    <AnnounceContext value={setMessage}>
      {children}
      <p role="status" className="sr-only">
        {message}
      </p>
    </AnnounceContext>
  )
}

export const useAnnounce = () => use(AnnounceContext)
