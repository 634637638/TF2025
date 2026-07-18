export interface TextColumnWidthOptions {
  minWidth?: number
  maxWidth?: number
  horizontalPadding?: number
  asciiCharacterWidth?: number
  wideCharacterWidth?: number
}

const WIDE_CHARACTER_PATTERN = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/u

/**
 * Returns a deterministic minimum width for identifiers that must stay complete.
 * The estimate uses the global table font metrics and leaves room for cell padding.
 */
export const getTextColumnMinWidth = (
  values: Array<string | number | null | undefined>,
  options: TextColumnWidthOptions = {}
) => {
  const {
    minWidth = 144,
    maxWidth = Number.POSITIVE_INFINITY,
    horizontalPadding = 36,
    asciiCharacterWidth = 8,
    wideCharacterWidth = 13
  } = options

  const contentWidth = values.reduce<number>((largestWidth, rawValue) => {
    const text = String(rawValue ?? '-')
    const textWidth = Array.from(text).reduce((width, character) => {
      return width + (WIDE_CHARACTER_PATTERN.test(character) ? wideCharacterWidth : asciiCharacterWidth)
    }, 0)

    return Math.max(largestWidth, textWidth)
  }, 0)

  return Math.min(maxWidth, Math.max(minWidth, Math.ceil(contentWidth + horizontalPadding)))
}

export const getIdentifierColumnMinWidth = (
  values: Array<string | number | null | undefined>,
  options: TextColumnWidthOptions = {}
) => getTextColumnMinWidth(values, options)
