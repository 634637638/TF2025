import { unifiedApi } from '@/utils/unified-api'

export type CustomerSearchContext = 'generic' | 'sales' | 'rentals' | 'repairs'

/** 客户手机号/关键词下拉统一展示条数。页面不得单独覆盖。 */
export const CUSTOMER_SEARCH_PAGE_SIZE = 50

export interface CustomerOption {
  id: number
  name: string
  phone: string
  apple_id?: string | null
  member_number?: string | null
  vip_level?: string | null
  id_card?: string | null
  [key: string]: unknown
}

const CUSTOMER_SEARCH_ENDPOINTS: Record<CustomerSearchContext, { path: string; parameter: 'keyword' | 'search' }> = {
  generic: { path: '/customers/search', parameter: 'keyword' },
  sales: { path: '/sales/customers', parameter: 'search' },
  rentals: { path: '/rentals/customers', parameter: 'keyword' },
  repairs: { path: '/repairs/customers/search', parameter: 'keyword' }
}

const readResponseItems = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  const record = payload as { customers?: unknown; items?: unknown; records?: unknown }
  for (const value of [record.customers, record.items, record.records]) {
    if (Array.isArray(value)) return value
  }
  return []
}

export const normalizeCustomerOption = (value: unknown): CustomerOption | null => {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const id = Number(item.id)
  if (!Number.isInteger(id) || id <= 0) return null

  return {
    ...item,
    id,
    name: String(item.name || ''),
    phone: String(item.phone || '')
  } as CustomerOption
}

/**
 * 统一客户远程检索入口。业务上下文只决定授权路由，返回字段和前端类型保持一致。
 * 客户搜索始终按关键词远程查询，不预加载全量客户，也不在前端截断结果。
 */
export const searchCustomerOptions = async (
  keyword: string,
  context: CustomerSearchContext = 'generic'
): Promise<CustomerOption[]> => {
  const normalizedKeyword = String(keyword || '').trim()
  if (normalizedKeyword.length < 2) return []

  const endpoint = CUSTOMER_SEARCH_ENDPOINTS[context]
  const response = await unifiedApi.get(endpoint.path, {
    params: {
      [endpoint.parameter]: normalizedKeyword,
      page: 1,
      page_size: CUSTOMER_SEARCH_PAGE_SIZE
    },
    useCache: false,
    showError: false
  })

  if (!response.success) return []
  return readResponseItems(response.data)
    .map(normalizeCustomerOption)
    .filter((item): item is CustomerOption => item !== null)
}
