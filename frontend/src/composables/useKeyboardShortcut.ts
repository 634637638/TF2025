import { onScopeDispose, toValue, type MaybeRefOrGetter } from 'vue'

export interface KeyboardShortcutOptions {
  key: string
  enabled?: MaybeRefOrGetter<boolean>
  alt?: boolean
  ctrl?: boolean
  meta?: boolean
  ctrlOrMeta?: boolean
  shift?: boolean
  preventDefault?: boolean
  ignoreEditable?: boolean
  allowRepeat?: boolean
  target?: Window | Document
}

export function useKeyboardShortcut(
  options: KeyboardShortcutOptions,
  handler: (event: KeyboardEvent) => void
): () => void {
  const target = options.target ?? (typeof window === 'undefined' ? undefined : window)
  if (!target) return () => undefined

  const handleKeydown = (event: KeyboardEvent) => {
    if (options.enabled !== undefined && !toValue(options.enabled)) return
    if (event.key.toLowerCase() !== options.key.toLowerCase()) return
    if (!options.allowRepeat && event.repeat) return
    if (event.altKey !== Boolean(options.alt)) return
    if (options.ctrlOrMeta) {
      if (event.ctrlKey === event.metaKey) return
    } else if (event.ctrlKey !== Boolean(options.ctrl) || event.metaKey !== Boolean(options.meta)) {
      return
    }
    if (event.shiftKey !== Boolean(options.shift)) return

    if (options.ignoreEditable !== false && event.target instanceof HTMLElement) {
      const editable = event.target.closest('input, textarea, select, [contenteditable="true"]')
      if (editable) return
    }

    if (options.preventDefault !== false) event.preventDefault()
    handler(event)
  }

  target.addEventListener('keydown', handleKeydown as EventListener)
  const stop = () => target.removeEventListener('keydown', handleKeydown as EventListener)
  onScopeDispose(stop)
  return stop
}
