import { describe, expect, it } from 'vitest'

import { getHomeTabHref, parseHomeTab } from './home-tabs'

describe('parseHomeTab', () => {
  it('finds the tab named in the URL', () => {
    expect(parseHomeTab('comercial').id).toBe('comercial')
  })

  it.each([undefined, 'desconhecida', ['marca', 'comercial']])(
    'falls back to the offer on %j',
    (value) => {
      expect(parseHomeTab(value).id).toBe('oferta')
    }
  )
})

describe('getHomeTabHref', () => {
  it('leaves the default tab out of the URL', () => {
    expect(getHomeTabHref('oferta')).toBe('/')
    expect(getHomeTabHref('marca')).toBe('/?aba=marca')
  })
})
