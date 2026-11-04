export interface NativeInputInstance {
  input?: HTMLInputElement | null
  $el?: HTMLElement | null
}

export const resolveNativeTextInput = (source: unknown): HTMLInputElement | null => {
  if (!source) return null
  if (source instanceof HTMLInputElement) return source

  if (source instanceof HTMLElement) {
    const nestedInput = source.querySelector('input, textarea')
    return nestedInput instanceof HTMLInputElement ? nestedInput : null
  }

  const candidate = source as NativeInputInstance & { target?: EventTarget | null }
  if (candidate.target instanceof HTMLInputElement) return candidate.target

  if (candidate.target instanceof HTMLElement) {
    const nestedInput = candidate.target.querySelector('input, textarea')
    if (nestedInput instanceof HTMLInputElement) return nestedInput
  }

  if (candidate.input instanceof HTMLInputElement) return candidate.input

  if (candidate.$el instanceof HTMLElement) {
    const nestedInput = candidate.$el.querySelector('input, textarea')
    return nestedInput instanceof HTMLInputElement ? nestedInput : null
  }

  return null
}
