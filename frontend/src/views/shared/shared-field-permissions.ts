import { fieldPermissions } from '@/composables/useFieldPermissions'

export const SHARED_FIELD_MODULE_KEY = 'shared_sharedview'

export const SHARED_FIELD_IDS = {
  title: 'post_info.title', content: 'post_info.content', category: 'post_info.category', visibility: 'post_info.visibility',
  attachments: 'post_info.attachments', is_pinned: 'post_info.is_pinned', author: 'author_info.author',
  created_at: 'time_info.created_at', updated_at: 'time_info.updated_at', category_name: 'category_info.name',
  category_total: 'category_info.total', category_sort_order: 'category_info.sort_order',
  category_operations: 'category_info.operations', operations: 'system_info.operations'
} as const

export type SharedFieldName = keyof typeof SHARED_FIELD_IDS

export const canViewSharedField = (field: SharedFieldName) => fieldPermissions.isFieldVisible(
  SHARED_FIELD_MODULE_KEY,
  SHARED_FIELD_IDS[field]
)

export const pickVisibleSharedFields = <T extends object>(
  source: T,
  fieldMap: Partial<Record<keyof T, SharedFieldName>>
) => Object.fromEntries(
  Object.entries(source as Record<string, unknown>).filter(([key]) => {
    const field = fieldMap[key as keyof T]
    return field ? canViewSharedField(field) : false
  })
) as Partial<T>
