import { describe, expect, it } from 'vitest'

import { getLegacyTabPath } from './navigation'

describe('getLegacyTabPath', () => {
  it.each([
    ['marca', '/configuracoes'],
    ['comercial', '/comercial'],
    ['backup', '/configuracoes/backup']
  ])('sends the %s tab to its page', (tab, path) => {
    expect(getLegacyTabPath(tab)).toBe(path)
  })

  it.each([undefined, 'oferta', 'desconhecida', 'toString', ['marca']])(
    'stays on the offer for %j',
    (tab) => {
      expect(getLegacyTabPath(tab)).toBeUndefined()
    }
  )
})
