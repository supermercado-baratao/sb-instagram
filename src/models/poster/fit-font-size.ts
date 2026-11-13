type FitFontSizeOptions = {
  text: string
  width: number
  lines: number
  maxFontSize: number
  minFontSize: number
  // Average glyph advance as a fraction of the font size, measured per font
  charWidth: number
}

export const fitFontSize = ({
  text,
  width,
  lines,
  maxFontSize,
  minFontSize,
  charWidth
}: FitFontSizeOptions) => {
  const length = text.trim().length
  if (length === 0) return maxFontSize
  const fitted = Math.floor((width * lines) / (length * charWidth))
  return Math.min(maxFontSize, Math.max(minFontSize, fitted))
}
