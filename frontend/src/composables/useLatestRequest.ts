import { onBeforeUnmount } from 'vue'

type LatestRequestContext = {
  requestId: number
  signal: AbortSignal
  isLatest: () => boolean
}

type LatestRequestOptions = {
  cancelPrevious?: boolean
}

const isCanceledError = (error: unknown) => {
  const err = error as { name?: string; code?: string; message?: string }
  return err?.name === 'CanceledError' ||
    err?.code === 'ERR_CANCELED' ||
    err?.message === 'canceled'
}

export function useLatestRequest() {
  let latestRequestId = 0
  let abortController: AbortController | null = null

  const nextRequest = (options: LatestRequestOptions = {}): LatestRequestContext => {
    const { cancelPrevious = true } = options

    if (cancelPrevious) {
      abortController?.abort()
    }

    abortController = new AbortController()
    const requestId = ++latestRequestId
    const currentController = abortController

    return {
      requestId,
      signal: currentController.signal,
      isLatest: () => requestId === latestRequestId &&
        abortController === currentController &&
        !currentController.signal.aborted
    }
  }

  const cancelLatest = () => {
    abortController?.abort()
    abortController = null
    latestRequestId += 1
  }

  onBeforeUnmount(cancelLatest)

  return {
    nextRequest,
    cancelLatest,
    isCanceledError
  }
}

export { isCanceledError }
