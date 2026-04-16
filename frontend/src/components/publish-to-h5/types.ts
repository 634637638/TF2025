export interface PublishFormState {
  sale_price: number | null
  condition_grade: string
  battery_status: string | number | null
  screen_condition: string
  system_version: string
  model_version: string
  warranty_date: string
  is_warranty_expired: boolean
}

export interface UploadedMediaItem {
  id: number
  image_type: string
  image_url: string
  is_primary?: boolean | number
}

export interface PendingUploadFile {
  uid: string
  name: string
  raw?: File
  status?: string
  url?: string
}

export interface HeicConverterOptions {
  blob: Blob
  toType: string
  quality: number
}

export type HeicConverter = (options: HeicConverterOptions) => Promise<Blob | Blob[]>

export interface MediaUploadOptions {
  file: File
  onError: (error: Error) => void
  onSuccess: (response: unknown) => void
}

export interface UploadResult {
  success?: boolean
  message?: string
}

export interface PublishInspectionResponse {
  sale_price?: number | string | null
  condition_grade?: string | null
  battery_status?: string | number | null
  screen_condition?: string | null
  system_version?: string | null
  model_version?: string | null
  warranty_date?: string | null
  is_warranty_expired?: boolean | number | null
}
