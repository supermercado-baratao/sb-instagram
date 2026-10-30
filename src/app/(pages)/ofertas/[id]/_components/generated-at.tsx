'use client'

import { useSyncExternalStore } from 'react'

const formatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
})

const unsubscribe = () => {}
const subscribe = () => unsubscribe

// The container's clock usually runs in UTC, so the time is only written in the browser's zone
export const GeneratedAt = ({ date }: { date: Date }) => {
  const text = useSyncExternalStore(
    subscribe,
    () => formatter.format(date),
    () => ''
  )
  if (text === '') return null
  return (
    <>
      {' · '}
      <time dateTime={date.toISOString()}>{text}</time>
    </>
  )
}
