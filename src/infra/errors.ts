// An error the store can act on: its message is shown as it is, so it's written for the store
// (pt-BR) and says what to do next
export class AppError extends Error {
  readonly name = 'AppError'
}
