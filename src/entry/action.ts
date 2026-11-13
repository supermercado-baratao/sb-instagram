import 'server-only'

import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'

import { AppError } from '@/infra/errors'

export type ActionError = { status: 'error'; message: string }

type ActionOptions = {
  // Shown for an error the store can't act on, which is logged
  fallback: string
  // Shown when the input breaks its schema; without it, the first issue's message is, so a schema
  // parsed without it gives every check a message for the store
  invalid?: string
}

export const actionError = (message: string): ActionError => ({
  status: 'error',
  message
})

// A Server Action is a public endpoint, so the models validate its input again and their errors
// become a result the client shows, instead of an exception
export const runAction = async <TResult>(
  options: ActionOptions,
  handler: () => TResult | Promise<TResult>
): Promise<TResult | ActionError> => {
  try {
    return await handler()
  } catch (error) {
    // redirect() and notFound() work by throwing
    unstable_rethrow(error)
    if (error instanceof AppError) return actionError(error.message)
    if (error instanceof z.ZodError) {
      return actionError(
        options.invalid ?? error.issues[0]?.message ?? options.fallback
      )
    }
    console.error(error)
    return actionError(options.fallback)
  }
}
