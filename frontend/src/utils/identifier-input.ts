export type IdentifierInputKind = 'accessory-serial' | 'accessory-serial-list' | 'device-serial' | 'imei' | 'serial-text'

const patterns: Record<IdentifierInputKind, RegExp> = {
  'accessory-serial': /^[A-Za-z0-9._/-]*$/,
  'accessory-serial-list': /^[A-Za-z0-9._/-]*(?:\r?\n[A-Za-z0-9._/-]*)*$/,
  'device-serial': /^[A-Za-z0-9/-]*$/,
  imei: /^\d*$/,
  'serial-text': /^[^\p{Script=Han}]*$/u
}

export const isIdentifierInputValue = (value: string, kind: IdentifierInputKind): boolean =>
  patterns[kind].test(value)

export const isIdentifierInputCharacter = (value: string, kind: IdentifierInputKind): boolean => {
  if (!value) return true
  return isIdentifierInputValue(value, kind === 'accessory-serial-list' ? 'accessory-serial-list' : kind)
}
