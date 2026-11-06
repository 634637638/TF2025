type MessageConfig = {
  message: string
  type?: 'success' | 'warning' | 'info' | 'error'
  duration?: number
  showClose?: boolean
  placement?: 'top' | 'top-left' | 'top-right' | 'bottom' | 'bottom-left' | 'bottom-right'
  onClose?: () => void
  [key: string]: unknown
}

type MessageOptions = string | MessageConfig

type NotificationOptions = {
  title?: string
  message?: string
  type?: 'success' | 'warning' | 'info' | 'error'
  duration?: number
  showClose?: boolean
  position?: string
  [key: string]: unknown
}

type LoadingOptions = {
  lock?: boolean
  text?: string
  background?: string
  target?: string | HTMLElement
  customClass?: string
  fullscreen?: boolean
  spinner?: string
}

export type LoadingInstance = {
  close: () => void
}

let elementPlusLoader: Promise<typeof import('element-plus')> | null = null
const autoDismissMessages = new Set<symbol>()
const MESSAGE_DISMISS_STAGGER_MS = 400

const trackAutoDismissMessage = (
  options: MessageConfig
): MessageConfig => {
  const centeredOptions: MessageConfig = { ...options, placement: 'top' }
  const duration = options.duration ?? 3000
  if (duration <= 0) return centeredOptions

  const token = Symbol('global-message')
  const originalOnClose = options.onClose
  const staggeredOptions: MessageConfig = {
    ...centeredOptions,
    duration: duration + autoDismissMessages.size * MESSAGE_DISMISS_STAGGER_MS,
    onClose: () => {
      autoDismissMessages.delete(token)
      originalOnClose?.()
    }
  }
  autoDismissMessages.add(token)
  return staggeredOptions
}

export const loadElementPlus = () => {
  if (!elementPlusLoader) {
    elementPlusLoader = import('element-plus')
  }

  return elementPlusLoader
}

export const showElementMessage = async (options: MessageOptions) => {
  const { ElMessage } = await loadElementPlus()
  const messageOptions = typeof options === 'string' ? { message: options } : options
  const trackedOptions = trackAutoDismissMessage(messageOptions)

  try {
    return ElMessage(trackedOptions as Parameters<typeof ElMessage>[0])
  } catch (error) {
    if (trackedOptions.onClose !== messageOptions.onClose) {
      trackedOptions.onClose?.()
    }
    throw error
  }
}

export const showElementSuccess = (options: string | Omit<MessageConfig, 'type'>) => {
  if (typeof options === 'string') {
    return showElementMessage({
      message: options,
      type: 'success'
    })
  }

  return showElementMessage({
    ...options,
    type: 'success'
  } as MessageOptions)
}

export const showElementWarning = (options: string | Omit<MessageConfig, 'type'>) => {
  if (typeof options === 'string') {
    return showElementMessage({
      message: options,
      type: 'warning'
    })
  }

  return showElementMessage({
    ...options,
    type: 'warning'
  } as MessageOptions)
}

export const showElementError = (options: string | Omit<MessageConfig, 'type'>) => {
  if (typeof options === 'string') {
    return showElementMessage({
      message: options,
      type: 'error'
    })
  }

  return showElementMessage({
    ...options,
    type: 'error'
  } as MessageOptions)
}

export const showElementNotification = async (options: NotificationOptions) => {
  const { ElNotification } = await loadElementPlus()
  return ElNotification(options as Parameters<typeof ElNotification>[0])
}

export const showElementLoading = async (options: LoadingOptions): Promise<LoadingInstance> => {
  const { ElLoading } = await loadElementPlus()
  return ElLoading.service(options) as LoadingInstance
}

export const closeAllElementMessages = async () => {
  const { ElMessage } = await loadElementPlus()
  ElMessage.closeAll()
}
