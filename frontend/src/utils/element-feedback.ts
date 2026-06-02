type MessageConfig = {
  message: string
  type?: 'success' | 'warning' | 'info' | 'error'
  duration?: number
  showClose?: boolean
  [key: string]: any
}

type MessageOptions = string | MessageConfig

type NotificationOptions = {
  title?: string
  message?: string
  type?: 'success' | 'warning' | 'info' | 'error'
  duration?: number
  showClose?: boolean
  position?: string
  [key: string]: any
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

export const loadElementPlus = () => {
  if (!elementPlusLoader) {
    elementPlusLoader = import('element-plus')
  }

  return elementPlusLoader
}

export const showElementMessage = async (options: MessageOptions) => {
  const { ElMessage } = await loadElementPlus()
  return ElMessage(options as any)
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
  return ElNotification(options as any)
}

export const showElementLoading = async (options: LoadingOptions): Promise<LoadingInstance> => {
  const { ElLoading } = await loadElementPlus()
  return ElLoading.service(options) as LoadingInstance
}

export const closeAllElementMessages = async () => {
  const { ElMessage } = await loadElementPlus()
  ElMessage.closeAll()
}
