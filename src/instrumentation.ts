export const register = async () => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { runMigrations } = await import('@/infra/database/migrate')
  await runMigrations()
}
