const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/

export const isUuid = (value: string) => UUID_PATTERN.test(value)
