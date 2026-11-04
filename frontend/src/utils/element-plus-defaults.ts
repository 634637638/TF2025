import { ElDatePicker } from 'element-plus'

interface DatePickerPropDefaults {
  placement?: { default?: unknown }
  fallbackPlacements?: { default?: unknown }
}

const hasDatePickerProps = (value: unknown): value is { props: DatePickerPropDefaults } => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null || !('props' in value)) {
    return false
  }
  return typeof value.props === 'object' && value.props !== null
}

/**
 * Keep all Element Plus date pickers anchored below their input.
 * This covers date, month and datetime pickers, including legacy pages.
 */
export const configureElementPlusDatePicker = () => {
  if (!hasDatePickerProps(ElDatePicker)) return
  const props = ElDatePicker.props

  if (props.placement) {
    props.placement.default = 'bottom-start'
  }

  if (props.fallbackPlacements) {
    props.fallbackPlacements.default = ['bottom-start']
  }
}
