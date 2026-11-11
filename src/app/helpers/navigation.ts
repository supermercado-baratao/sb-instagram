export const OFFER_PATH = '/'
export const RADIO_AD_PATH = '/comercial'
export const PRODUCTS_PATH = '/produtos'
export const BRAND_SETTINGS_PATH = '/configuracoes'
export const BACKUP_PATH = '/configuracoes/backup'

const LEGACY_TAB_PATHS = new Map([
  ['marca', BRAND_SETTINGS_PATH],
  ['comercial', RADIO_AD_PATH],
  ['backup', BACKUP_PATH]
])

// `/` held every section in tabs before #113, so bookmarks may still carry `?aba=`
export const getLegacyTabPath = (tab: string | string[] | undefined) =>
  typeof tab === 'string' ? LEGACY_TAB_PATHS.get(tab) : undefined
