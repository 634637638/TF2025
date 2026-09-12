import { extractResponseData } from '@/utils/api-response'
import { unifiedApi as api } from '@/utils/unified-api'

interface PhoneReferenceValues {
  brand_id: number | null
  model_id: number | null
  color_id: number | null
  memory_id: number | null
  brand: string
  model: string
  color: string
  memory: string
}

interface PhoneReferenceResult {
  brand_id: number
  model_id: number
  color_id: number
  memory_id: number
}

type ReferenceName = 'brand' | 'model' | 'color' | 'memory'

const normalize = (value: unknown) => String(value || '').trim().toLocaleLowerCase()

const sameName = (left: unknown, right: unknown) => {
  const normalizedLeft = normalize(left)
  const normalizedRight = normalize(right)
  return normalizedLeft !== '' && normalizedLeft === normalizedRight
}

const asPositiveId = (value: unknown): number | null => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

const getRows = (response: unknown): Array<Record<string, unknown>> => {
  // 统一响应之外仍有少量历史接口会再包一层 data/records/models。
  // 递归展开有限层级，避免把对象包装误当成一条规格记录。
  const unwrap = (value: unknown, depth = 0): unknown => {
    if (depth > 4 || value === null || value === undefined) return value
    if (Array.isArray(value)) return value
    if (typeof value !== 'object') return value
    const record = value as Record<string, unknown>
    for (const key of ['data', 'records', 'brands', 'models', 'colors', 'memories']) {
      if (key in record) {
        const nested = unwrap(record[key], depth + 1)
        if (Array.isArray(nested)) return nested
      }
    }
    return value
  }

  const rows = unwrap(extractResponseData<unknown>(response))
  if (!Array.isArray(rows)) return []
  return rows.filter((item): item is Record<string, unknown> => (
    item !== null && typeof item === 'object' && !Array.isArray(item)
  ))
}

const findId = (rows: Array<Record<string, unknown>>, field: ReferenceName, value: string) => {
  const row = rows.find(item => {
    const candidate = field === 'memory'
      ? (item.size ?? item.storage_size ?? item.name)
      : item.name
    return sameName(candidate, value)
  })
  return asPositiveId(row?.id)
}

/**
 * 将编辑表单中的可读名称解析为数据库外键。
 * 编辑弹窗允许选择/输入名称，但 phones 更新接口只接受规范 *_id 字段。
 */
export const resolvePhoneReferenceIds = async (
  values: PhoneReferenceValues,
  original: Partial<PhoneReferenceValues> = {}
): Promise<PhoneReferenceResult> => {
  const brandUnchanged = sameName(values.brand, original.brand)
  const modelUnchanged = brandUnchanged && sameName(values.model, original.model)
  const colorUnchanged = sameName(values.color, original.color)
  const memoryUnchanged = sameName(values.memory, original.memory)

  let brandId = brandUnchanged ? asPositiveId(values.brand_id) : null
  let modelId = modelUnchanged ? asPositiveId(values.model_id) : null
  let colorId = colorUnchanged ? asPositiveId(values.color_id) : null
  let memoryId = memoryUnchanged ? asPositiveId(values.memory_id) : null

  if (!brandId) {
    const response = await api.get('/brands', {
      params: { name: values.brand, status: 1, page_size: 50 },
      useCache: false,
      showError: false
    })
    brandId = findId(getRows(response), 'brand', values.brand)
  }
  if (!brandId) throw new Error('请选择有效的品牌')

  if (!modelId) {
    const response = await api.get('/models', {
      params: { brand_id: brandId, name: values.model, status: 1, page_size: 50 },
      useCache: false,
      showError: false
    })
    modelId = findId(getRows(response), 'model', values.model)
  }
  if (!modelId) throw new Error('请选择有效的型号')

  if (!colorId) {
    const response = await api.get('/colors', {
      params: { name: values.color, status: 1, page_size: 50 },
      useCache: false,
      showError: false
    })
    colorId = findId(getRows(response), 'color', values.color)
  }
  if (!colorId) throw new Error('请选择有效的颜色')

  if (!memoryId) {
    const response = await api.get('/memories', {
      params: { size: values.memory, status: 1, page_size: 50 },
      useCache: false,
      showError: false
    })
    memoryId = findId(getRows(response), 'memory', values.memory)
  }
  if (!memoryId) throw new Error('请选择有效的内存')

  return {
    brand_id: brandId,
    model_id: modelId,
    color_id: colorId,
    memory_id: memoryId
  }
}
