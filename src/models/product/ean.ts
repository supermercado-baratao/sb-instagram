// EAN-8 and EAN-13, plus the 12-digit UPC-A found on imported products, which USB scanners
// read without the leading zero that would turn it into an EAN-13
const EAN_LENGTHS = new Set([8, 12, 13])

export const isValidEan = (code: string) => {
  if (!/^\d+$/.test(code) || !EAN_LENGTHS.has(code.length)) return false

  const digits = [...code].map(Number)
  const sum = digits
    .slice(0, -1)
    .reduce(
      (total, digit, index) =>
        total + digit * ((code.length - index) % 2 === 0 ? 3 : 1),
      0
    )

  return (10 - (sum % 10)) % 10 === digits.at(-1)
}
