import { type RefObject, useEffect, useState } from 'react'

import { getPosterFitScale } from '@/domain/poster'

export const usePosterFitScale = (stage: RefObject<HTMLElement | null>) => {
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(getPosterFitScale(entry.contentRect))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [stage])

  return scale
}
