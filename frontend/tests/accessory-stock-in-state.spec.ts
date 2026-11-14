import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { storage } from '@/services/storage'
import { useAccessoryStockInStore } from '@/stores/accessory-stock-in'
import { isAccessoryStockInInput, isAccessoryStockInReceipt } from '@/utils/accessory-stock-in'

const input = { accessory_id: 55, supplier_id: 4, store_id: 2, total_quantity: 3, purchase_cost: 10.25 }
beforeEach(() => { setActivePinia(createPinia()); sessionStorage.clear() })

it('采购凭据跨关闭/Pinia重建恢复原请求，不因编辑草稿或再次点击换键；成功后新采购才生成新键', () => {
  const firstStore = useAccessoryStockInStore(), first = firstStore.prepare(7, input)
  expect(first.request_key).toMatch(/^[a-f0-9]{32}$/)
  setActivePinia(createPinia())
  const restored = useAccessoryStockInStore()
  expect(restored.load(7)).toEqual(first)
  expect(restored.prepare(7, { ...input, total_quantity: 99 })).toEqual(first)
  restored.complete(7, first.request_key)
  expect(restored.load(7)).toBeNull()
  const next = restored.prepare(7, input)
  expect(next.request_key).not.toBe(first.request_key)
})

it('不同入库员不读取彼此未确认的采购，不允许使用另一请求清理凭据', () => {
  const store = useAccessoryStockInStore(), original = store.prepare(7, input)
  expect(store.load(8)).toBeNull()
  expect(store.prepare(8, input).request_key).not.toBe(original.request_key)
  expect(() => store.complete(7, 'f'.repeat(32))).toThrow('凭据已变化')
  expect(store.load(7)).toEqual(original)
})

it('持久化失败在调用API之前拒绝；清理失败仍保留原请求供重试', () => {
  const store = useAccessoryStockInStore()
  const set = vi.spyOn(storage, 'set').mockImplementationOnce(() => {})
  expect(() => store.prepare(7, input)).toThrow('无法保存')
  set.mockRestore()
  const saved = store.prepare(7, input)
  vi.spyOn(storage, 'remove').mockImplementationOnce(() => {})
  expect(() => store.complete(7, saved.request_key)).toThrow('未能清理')
  expect(store.load(7)).toEqual(saved)
})

it('恢复边界拒绝未知字段、错误类型和破损凭据，不能静默抛弃原请求后另建采购', () => {
  for (const change of [{ request_key: 123 }, { operator_id: 999 }, { store_id: [2] }, { remarks: true },
    { serial_numbers: ['00AA'] }, { serial_numbers: [{ serial_number: 'SN', store_id: 2, unknown: true }] },
    { distribution: [{ store_id: 2, quantity: 1, unknown: true }] }]) {
    const saved = { ...input, request_key: 'a'.repeat(32), ...change }
    expect(isAccessoryStockInInput(saved)).toBe(false)
    storage.set('tf2025_accessory_stock_in_pending_7', saved, 'session')
    expect(() => useAccessoryStockInStore().prepare(7, input)).toThrow('无法读取')
  }
})

it('回执允许字段脱敏但不接受缺失/错误金额或缺少重放标记的伪成功', () => {
  const receipt = { stock_in_id: 31, batch_no: 'IN31', accessory_id: 55, quantity: 3,
    total_amount: 30.75, inventory_time: '2026-11-14 10:00:00', replayed: true }
  expect(isAccessoryStockInReceipt(receipt)).toBe(true)
  expect(isAccessoryStockInReceipt({ ...receipt, stock_in_id: null, batch_no: null, quantity: null, total_amount: null, inventory_time: null })).toBe(true)
  for (const change of [{ total_amount: undefined }, { total_amount: -1 }, { total_amount: '30.75' }, { quantity: 0 }, { replayed: undefined }]) {
    expect(isAccessoryStockInReceipt({ ...receipt, ...change })).toBe(false)
  }
})
