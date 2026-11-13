export const CATALOG_IMAGE_EXTENSION = '.png'
export const CATALOG_DATA_EXTENSION = '.json'

// The poster shows a photo at about 340 px at most (the 4-product layout), so 800 px keeps a 2x
// margin while every pixel still reaches the poster; files are lossless to keep labels legible
export const CATALOG_IMAGE_RULES = {
  format: 'png',
  minSide: 600,
  maxSide: 800,
  maxMegabytes: 1
}
