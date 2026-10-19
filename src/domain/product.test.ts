import { describe, expect, test } from 'vitest'

import { isValidCode } from './product'

describe('isValidCode', () => {
  test.each(['7891000100103', '2001', 'PIC-01', 'cod_7.5'])(
    'accepts %s',
    (code) => {
      expect(isValidCode(code)).toBe(true)
    }
  )

  test.each(['', '../1234', 'a/b', String.raw`a\b`, 'pão'])(
    'rejects %s',
    (code) => {
      expect(isValidCode(code)).toBe(false)
    }
  )
})
