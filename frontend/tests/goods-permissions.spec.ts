import { beforeEach, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { canViewAccessoryField, canViewQueryGoodsField } from '@/components/accessory-field-permissions'
import { getModuleFields } from '@/config/moduleFields'
import { useGoodsPermissions } from '@/composables/useGoodsPermissions'

const fieldRules = vi.hoisted(() => ({ hidden: new Map<string, Set<string>>() }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  isFieldVisible: (module: string, field: string) => !fieldRules.hidden.get(module)?.has(field)
} }))
const granted = reactive(new Set<string>())
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({
  canView: computed(() => granted.has(`${module}:view`)),
  canCreate: computed(() => granted.has(`${module}:create`)),
  hasPermission: (action: string) => granted.has(`${module}:${action}`)
}) }))
beforeEach(() => { granted.clear(); fieldRules.hidden.clear() })

it('综合查询只读、销售、赠送分别授权，撤回查看立即关闭共享业务能力', () => {
  const access = useGoodsPermissions()
  granted.add('query:view'); granted.add('query:goods-view')
  expect([access.canView.value, access.canCreate.value, access.canGift.value, access.source.value]).toEqual([true, false, false, 'query'])
  granted.add('query:goods-sell')
  expect([access.canCreate.value, access.canGift.value]).toEqual([true, false])
  granted.delete('query:goods-sell'); granted.add('query:goods-gift')
  expect([access.canCreate.value, access.canGift.value]).toEqual([false, true])
  for (const permission of ['query:view', 'query:goods-view']) {
    granted.delete(permission)
    expect(['view', 'create', 'gift'].map(access.hasPermission)).toEqual([false, false, false])
    granted.add(permission)
  }
  expect(access.hasPermission('edit')).toBe(false)
})

it('商品管理沿用原动作，贴膜权限不能变成普通商品销售或赠送', () => {
  const access = useGoodsPermissions()
  granted.add('query:view'); granted.add('query:film')
  expect(['view', 'create', 'gift'].map(access.hasPermission)).toEqual([false, false, false])
  granted.add('accessories:view'); granted.add('accessories:sell')
  expect([access.canView.value, access.canCreate.value, access.canGift.value, access.source.value]).toEqual([true, true, false, 'accessories'])
  expect(access.canQuery.value).toBe(false)
})

it('商品管理撤销查看后，即使保留销售和赠送动作仍拒绝', () => {
  const access = useGoodsPermissions()
  granted.add('accessories:sell'); granted.add('accessories:gift')
  expect(['view', 'create', 'gift'].map(access.hasPermission)).toEqual([false, false, false])
  granted.add('accessories:view')
  expect(['view', 'create', 'gift'].map(access.hasPermission)).toEqual([true, true, true])
  granted.delete('accessories:view')
  expect(['view', 'create', 'gift'].map(access.hasPermission)).toEqual([false, false, false])
})

it('商品模式字段只读独立范围，配件、手机同名字段不会交叉限制', () => {
  fieldRules.hidden.set('accessories_accessoriesview', new Set(['customer_info.customer_phone']))
  fieldRules.hidden.set('query_queryview', new Set(['basic_info.name']))
  expect(canViewAccessoryField('customer_phone')).toBe(false)
  expect(canViewQueryGoodsField('customer_phone')).toBe(true)
  expect(canViewQueryGoodsField('name')).toBe(true)
  fieldRules.hidden.set('query_goods', new Set(['price_info.purchase_cost']))
  expect(canViewQueryGoodsField('purchase_cost')).toBe(false)
  expect(canViewQueryGoodsField('profit')).toBe(false)
  expect(canViewAccessoryField('purchase_cost')).toBe(true)
  const fields = getModuleFields('query_goods')
  expect(fields.some((field: { id: string }) => field.id === 'price_info.profit')).toBe(true)
  expect(fields.some((field: { id: string }) => field.id === 'customer_info.customer_phone')).toBe(true)
  expect(fields.some((field: { id: string }) => field.id === 'stats.total_phones')).toBe(false)
})
