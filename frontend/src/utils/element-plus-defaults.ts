import { ElDatePicker } from 'element-plus'

interface DatePickerPropDefaults {
  placement?: { default?: unknown }
  fallbackPlacements?: { default?: unknown }
}

/**
 * Keep all Element Plus date pickers anchored below their input.
 * This covers date, month and datetime pickers, including legacy pages.
 */
export const configureElementPlusDatePicker = () => {
  const props = (ElDatePicker as unknown as { props?: DatePickerPropDefaults }).props
  if (!props) return

  if (props.placement) {
    props.placement.default = 'bottom-start'
  }

  if (props.fallbackPlacements) {
    props.fallbackPlacements.default = ['bottom-start']
  }
}
