import type { Directive, DirectiveBinding } from 'vue'
import { isIdentifierInputCharacter, isIdentifierInputValue, type IdentifierInputKind } from '@/utils/identifier-input'

type TextControl = HTMLInputElement | HTMLTextAreaElement

interface IdentifierInputState {
  control: TextControl
  kind: IdentifierInputKind
  composing: boolean
  previousValue: string
  cleanup: () => void
}

interface IdentifierDirectiveElement extends HTMLElement {
  _tfIdentifierInputState?: IdentifierInputState
}

const isTextControl = (value: Element | null): value is TextControl =>
  value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement

const findTextControl = (element: HTMLElement): TextControl | null =>
  isTextControl(element) ? element : element.querySelector('input, textarea')

const rejectEvent = (event: Event) => {
  event.preventDefault()
  event.stopImmediatePropagation()
}

const restoreInvalidValue = (control: TextControl, state: IdentifierInputState, event: Event) => {
  if (isIdentifierInputValue(control.value, state.kind)) {
    state.previousValue = control.value
    return
  }
  rejectEvent(event)
  control.value = state.previousValue
}

const createState = (control: TextControl, kind: IdentifierInputKind): IdentifierInputState => {
  const state: IdentifierInputState = {
    control,
    kind,
    composing: false,
    previousValue: control.value,
    cleanup: () => {}
  }

  const handleBeforeInput = (event: Event) => {
    if (state.composing || (event instanceof InputEvent && event.isComposing)) return
    if (event instanceof InputEvent && event.data !== null && !isIdentifierInputCharacter(event.data, state.kind)) {
      rejectEvent(event)
    }
  }

  const handlePaste = (event: Event) => {
    const text = (event as ClipboardEvent).clipboardData?.getData('text')
    if (text !== undefined && !isIdentifierInputValue(text, state.kind)) rejectEvent(event)
  }

  const handleDrop = (event: Event) => {
    const text = (event as DragEvent).dataTransfer?.getData('text')
    if (text !== undefined && !isIdentifierInputValue(text, state.kind)) rejectEvent(event)
  }

  const handleInput = (event: Event) => {
    if (state.composing || (event instanceof InputEvent && event.isComposing)) {
      event.stopImmediatePropagation()
      return
    }
    if (event instanceof InputEvent && event.inputType.startsWith('delete') && !isIdentifierInputValue(control.value, state.kind)) {
      state.previousValue = control.value
      return
    }
    restoreInvalidValue(control, state, event)
  }

  const handleCompositionStart = () => { state.composing = true }
  const handleCompositionEnd = () => {
    state.composing = false
    queueMicrotask(() => {
      if (!isIdentifierInputValue(control.value, state.kind)) control.value = state.previousValue
    })
  }

  control.addEventListener('beforeinput', handleBeforeInput, true)
  control.addEventListener('paste', handlePaste, true)
  control.addEventListener('drop', handleDrop, true)
  control.addEventListener('input', handleInput, true)
  control.addEventListener('compositionstart', handleCompositionStart, true)
  control.addEventListener('compositionend', handleCompositionEnd, true)
  state.cleanup = () => {
    control.removeEventListener('beforeinput', handleBeforeInput, true)
    control.removeEventListener('paste', handlePaste, true)
    control.removeEventListener('drop', handleDrop, true)
    control.removeEventListener('input', handleInput, true)
    control.removeEventListener('compositionstart', handleCompositionStart, true)
    control.removeEventListener('compositionend', handleCompositionEnd, true)
  }
  return state
}

export const vIdentifierInput: Directive<HTMLElement, IdentifierInputKind> = {
  mounted(element, binding: DirectiveBinding<IdentifierInputKind>) {
    const control = findTextControl(element)
    if (!control) return
    const host = element as IdentifierDirectiveElement
    const state = createState(control, binding.value)
    host._tfIdentifierInputState = state
  },
  updated(element, binding: DirectiveBinding<IdentifierInputKind>) {
    const state = (element as IdentifierDirectiveElement)._tfIdentifierInputState
    if (!state) return
    if (binding.value !== binding.oldValue) state.kind = binding.value
    if (isIdentifierInputValue(state.control.value, state.kind)) state.previousValue = state.control.value
  },
  unmounted(element) {
    const host = element as IdentifierDirectiveElement
    host._tfIdentifierInputState?.cleanup()
    delete host._tfIdentifierInputState
  }
}
