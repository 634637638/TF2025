import type { BusinessScope } from '@/types/shared'

export const businessScopeOptions: { value: BusinessScope; label: string }[] = [
  { value: 'phone', label: '手机' },
  { value: 'accessory', label: '配件' },
  { value: 'both', label: '手机+配件' }
]

export const businessScopeLabel = (scope?: BusinessScope | null) =>
  businessScopeOptions.find(option => option.value === scope)?.label || '手机+配件'
