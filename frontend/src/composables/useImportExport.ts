import { unref, type Ref } from 'vue'
import { unifiedApi, type RequestConfig } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'

type MaybeRef<T> = T | Ref<T>

export interface FileDownloadOptions {
  filename: string
  mimeType?: string
  bom?: string
}

export interface ExportFileOptions {
  url: string
  filename: string
  params?: Record<string, any>
  data?: any
  method?: 'get' | 'post'
  config?: RequestConfig
  mimeType?: string
  allowed?: MaybeRef<boolean>
  loading?: Ref<boolean>
  onNoPermission?: () => void
  successMessage?: string
  errorMessage?: string
  onError?: (error: unknown, fallbackMessage: string) => void
}

export interface ExportTextFileOptions extends FileDownloadOptions {
  content: string
  allowed?: MaybeRef<boolean>
  loading?: Ref<boolean>
  onNoPermission?: () => void
  successMessage?: string
  errorMessage?: string
  onError?: (error: unknown, fallbackMessage: string) => void
}

export interface ImportFileOptions<T = any> {
  url: string
  file?: File
  fieldName?: string
  formData?: FormData
  extraData?: Record<string, string | Blob>
  config?: RequestConfig
  allowed?: MaybeRef<boolean>
  loading?: Ref<boolean>
  onNoPermission?: () => void
  successMessage?: string
  errorMessage?: string
  onError?: (error: unknown, fallbackMessage: string) => void
}

const isBlob = (value: unknown): value is Blob => typeof Blob !== 'undefined' && value instanceof Blob

const saveBlobFile = (data: BlobPart | Blob, options: FileDownloadOptions) => {
  const { filename, mimeType } = options
  const blob = isBlob(data) ? data : new Blob([data], mimeType ? { type: mimeType } : undefined)
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.URL.revokeObjectURL(url)
}

const sanitizeParams = <T extends Record<string, any>>(params?: T): Partial<T> => {
  if (!params) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === '' || value === null || value === undefined) {
        return false
      }

      if (Array.isArray(value) && value.length === 0) {
        return false
      }

      return true
    })
  ) as Partial<T>
}

const resolveAllowed = (allowed?: MaybeRef<boolean>) => allowed === undefined ? true : !!unref(allowed)

const withLoading = async <T>(loading: Ref<boolean> | undefined, task: () => Promise<T>): Promise<T> => {
  if (loading) {
    loading.value = true
  }

  try {
    return await task()
  } finally {
    if (loading) {
      loading.value = false
    }
  }
}

export const useImportExport = () => {
  const { success, handleApiError } = useNotification()

  const buildDateFilename = (prefix: string, extension: string, format = TIME_FORMATS.DATE) => {
    return `${prefix}_${TimeUtil.nowFormatted(format)}.${extension.replace(/^\./, '')}`
  }

  const downloadTextFile = (content: string, options: FileDownloadOptions) => {
    const payload = options.bom ? `${options.bom}${content}` : content
    saveBlobFile(payload, {
      filename: options.filename,
      mimeType: options.mimeType || 'text/plain;charset=utf-8;'
    })
  }

  const exportFile = async ({
    url,
    filename,
    params,
    data,
    method = 'get',
    config,
    mimeType,
    allowed,
    loading,
    onNoPermission,
    successMessage,
    errorMessage = '导出失败',
    onError
  }: ExportFileOptions) => {
    if (!resolveAllowed(allowed)) {
      onNoPermission?.()
      return
    }

    return withLoading(loading, async () => {
      try {
        const requestConfig: RequestConfig = {
          ...config,
          params: sanitizeParams(params),
          responseType: 'blob'
        }

        const response = method === 'post'
          ? await unifiedApi.post(url, data, requestConfig)
          : await unifiedApi.get(url, requestConfig)

        saveBlobFile(response as unknown as BlobPart, { filename, mimeType })

        if (successMessage) {
          success(successMessage)
        }
      } catch (error) {
        if (onError) {
          onError(error, errorMessage)
          return
        }

        handleApiError(error, errorMessage)
      }
    })
  }

  const exportTextFile = async ({
    content,
    filename,
    mimeType,
    bom,
    allowed,
    loading,
    onNoPermission,
    successMessage,
    errorMessage = '导出失败',
    onError
  }: ExportTextFileOptions) => {
    if (!resolveAllowed(allowed)) {
      onNoPermission?.()
      return
    }

    return withLoading(loading, async () => {
      try {
        downloadTextFile(content, { filename, mimeType, bom })

        if (successMessage) {
          success(successMessage)
        }
      } catch (error) {
        if (onError) {
          onError(error, errorMessage)
          return
        }

        handleApiError(error, errorMessage)
      }
    })
  }

  const importFile = async <T = any>({
    url,
    file,
    fieldName = 'file',
    formData,
    extraData,
    config,
    allowed,
    loading,
    onNoPermission,
    successMessage,
    errorMessage = '导入失败',
    onError
  }: ImportFileOptions<T>) => {
    if (!resolveAllowed(allowed)) {
      onNoPermission?.()
      return null
    }

    return withLoading(loading, async () => {
      try {
        const payload = formData ?? new FormData()

        if (file) {
          payload.append(fieldName, file)
        }

        if (extraData) {
          Object.entries(extraData).forEach(([key, value]) => {
            payload.append(key, value)
          })
        }

        const response = await unifiedApi.upload<T>(url, payload, config)

        if (successMessage) {
          success(successMessage)
        }

        return response
      } catch (error) {
        if (onError) {
          onError(error, errorMessage)
          return null
        }

        handleApiError(error, errorMessage)
        return null
      }
    })
  }

  return {
    buildDateFilename,
    sanitizeParams,
    saveBlobFile,
    downloadTextFile,
    exportFile,
    exportTextFile,
    importFile
  }
}

export default useImportExport
