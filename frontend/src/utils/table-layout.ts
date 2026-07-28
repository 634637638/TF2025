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
    horizontalPadding = 24,
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

export interface ActionColumnWidthOptions {
  minWidth?: number
  buttonWidth?: number
  buttonGap?: number
  horizontalPadding?: number
  buttonHorizontalPadding?: number
  iconWidth?: number
  iconTextGap?: number
  borderWidth?: number
  asciiCharacterWidth?: number
  wideCharacterWidth?: number
}

export type ActionVisibility<Row> = boolean | ((row: Row) => boolean)
export type ActionLabel<Row> = string | ((row: Row) => string)
export interface ActionDescriptor<Row> {
  label: ActionLabel<Row>
  visible: ActionVisibility<Row>
}
export type ActionColumnInput = number | readonly string[]
export type AdaptiveAction<Row> = ActionVisibility<Row> | ActionDescriptor<Row>

const getActionLabelWidth = (
  label: string,
  options: ActionColumnWidthOptions
) => {
  const {
    buttonWidth = 72,
    buttonHorizontalPadding = 20,
    iconWidth = 14,
    iconTextGap = 4,
    borderWidth = 2,
    asciiCharacterWidth = 8,
    wideCharacterWidth = 13
  } = options
  const textWidth = Array.from(label).reduce((width, character) => (
    width + (WIDE_CHARACTER_PATTERN.test(character) ? wideCharacterWidth : asciiCharacterWidth)
  ), 0)

  return Math.max(
    buttonWidth,
    Math.ceil(textWidth + buttonHorizontalPadding + iconWidth + iconTextGap + borderWidth)
  )
}

/**
 * Reserves enough width for the visible global table-action buttons on one row.
 */
export const getActionColumnMinWidth = (
  actions: ActionColumnInput,
  options: ActionColumnWidthOptions = {}
) => {
  const {
    minWidth = 54,
    buttonWidth = 72,
    buttonGap = 8,
    horizontalPadding = 32
  } = options
  const buttonWidths = typeof actions === 'number'
    ? Array.from({ length: Math.max(0, Math.floor(actions)) }, () => buttonWidth)
    : actions.map(label => getActionLabelWidth(label, options))
  const visibleCount = buttonWidths.length

  if (visibleCount === 0) return minWidth

  return Math.max(
    minWidth,
    horizontalPadding + buttonWidths.reduce((total, width) => total + width, 0) + ((visibleCount - 1) * buttonGap)
  )
}

const isActionDescriptor = <Row>(action: AdaptiveAction<Row>): action is ActionDescriptor<Row> => (
  typeof action === 'object' && action !== null && 'label' in action && 'visible' in action
)

const isActionVisible = <Row>(action: AdaptiveAction<Row>, row: Row) => {
  const visibility = isActionDescriptor(action) ? action.visible : action
  return typeof visibility === 'function' ? visibility(row) : visibility
}

const getActionLabel = <Row>(action: AdaptiveAction<Row>, row: Row) => {
  if (!isActionDescriptor(action)) return ''
  return typeof action.label === 'function' ? action.label(row) : action.label
}

/**
 * Calculates an action column from the largest button set visible on any row.
 * Use inside a Vue computed so status and permission changes resize the column.
 */
export const getAdaptiveActionColumnWidth = <Row>(
  rows: readonly Row[],
  actions: readonly AdaptiveAction<Row>[],
  options: ActionColumnWidthOptions = {}
) => {
  const staticLabels = actions.flatMap(action => {
    const visibility = isActionDescriptor(action) ? action.visible : action
    if (visibility !== true) return []
    if (!isActionDescriptor(action) || typeof action.label !== 'string') return ['']
    return [action.label]
  })
  const staticWidth = getActionColumnMinWidth(staticLabels, options)

  return rows.reduce((largestWidth, row) => {
    const visibleLabels = actions
      .filter(action => isActionVisible(action, row))
      .map(action => getActionLabel(action, row))
    return Math.max(largestWidth, getActionColumnMinWidth(visibleLabels, options))
  }, staticWidth)
}
