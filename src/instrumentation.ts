export const register = async () => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { startInstance } = await import('@/entry/startup')
  await startInstance()
}
