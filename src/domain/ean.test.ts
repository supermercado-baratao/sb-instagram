import { describe, expect, test } from 'vitest'

import { isValidEan } from './ean'

describe('isValidEan', () => {
  test.each(['7891000100103', '96385074', '036000291452'])(
    'accepts %s, which has a correct check digit',
    (code) => {
      expect(isValidEan(code)).toBe(true)
    }
  )

  test.each(['7891000100104', '96385075', '036000291453'])(
    'rejects %s, which has a wrong check digit',
    (code) => {
      expect(isValidEan(code)).toBe(false)
    }
  )

  test.each(['1234567', '12345678901', '78910001001030'])(
    'rejects %s, which has an unsupported length',
    (code) => {
      expect(isValidEan(code)).toBe(false)
    }
  )

  test.each(['789100010010a', ' 7891000100103', '7891000-100103', ''])(
    'rejects "%s", which is not made only of digits',
    (code) => {
      expect(isValidEan(code)).toBe(false)
    }
  )
})
