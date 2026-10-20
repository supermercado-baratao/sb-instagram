'use client'

import type { ComponentProps } from 'react'
import { useFormStatus } from 'react-dom'

import { Button } from '@/app/components/ui/shadcn/button'

// A second click while the action runs would create another offer or copy
export const SubmitButton = (props: ComponentProps<typeof Button>) => {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} focusableWhenDisabled {...props} />
  )
}
