export const HOME_TABS = [
  { id: 'oferta', label: 'Oferta' },
  { id: 'marca', label: 'Marca' },
  { id: 'comercial', label: 'Comercial' },
  { id: 'backup', label: 'Backup' }
] as const

export type HomeTabId = (typeof HOME_TABS)[number]['id']

export const parseHomeTab = (value: string | string[] | undefined) =>
  HOME_TABS.find(({ id }) => id === value) ?? HOME_TABS[0]

export const getHomeTabHref = (id: HomeTabId) =>
  id === HOME_TABS[0].id ? '/' : `/?aba=${id}`
