import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { storage } from '@/services/storage'
import { useAccessoryStockInStore } from '@/stores/accessory-stock-in'
import { isAccessoryStockInInput, isAccessoryStockInReceipt, isAccessoryStockInRequest, isAccessoryColorStockInReceipt } from '@/utils/accessory-stock-in'

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
    { inventory_time: '' }, { inventory_time: '2026-02-30 10:00:00' }, { inventory_time: '2026-11-14 12:00:00\n' },
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

it('整组颜色请求跨Pinia重建恢复全部原数量和唯一键，不被新草稿替换', () => {
  const original = useAccessoryStockInStore().prepare(7, { entries: [input, { ...input, accessory_id: 56, total_quantity: 5 }] })
  setActivePinia(createPinia())
  const restored = useAccessoryStockInStore()
  expect(restored.load(7)).toEqual(original)
  expect(restored.prepare(7, input)).toEqual(original)
  expect(restored.prepare(7, { entries: [{ ...input, total_quantity: 99 }] })).toEqual(original)
  restored.complete(7, original.request_key)
  expect(restored.load(7)).toBeNull()
})

it('多颜色持久化和回执拒绝空组、混入防重键/未知字段、重复商品、部分成功或缺失脱敏字段', () => {
  const request_key = 'e'.repeat(32)
  expect(isAccessoryStockInRequest({ request_key, entries: [input, { ...input, accessory_id: 56 }] })).toBe(true)
  for (const entries of [[], [input, input], [{ ...input, request_key }], [{ ...input, unknown: true }], [{ ...input, accessory_id: null }]]) {
    expect(isAccessoryStockInRequest({ request_key, entries })).toBe(false)
  }
  const batch = { stock_in_id: 1, batch_no: 'IN-1', accessory_id: 55, quantity: 3, total_amount: 30.75,
    inventory_time: '2026-11-15 10:00:00', replayed: true }
  expect(isAccessoryColorStockInReceipt({ batches: [batch, { ...batch, accessory_id: 56 }], replayed: true }, 2)).toBe(true)
  expect(isAccessoryColorStockInReceipt({ batches: [{ ...batch, quantity: null, total_amount: null, batch_no: null, stock_in_id: null, inventory_time: null }], replayed: true }, 1)).toBe(true)
  for (const receipt of [{ batches: [batch], replayed: true }, { batches: [batch, batch], replayed: true },
    { batches: [batch, { ...batch, accessory_id: 56, replayed: false }], replayed: true },
    { batches: [batch, { ...batch, accessory_id: 56, total_amount: undefined }], replayed: true }]) {
    expect(isAccessoryColorStockInReceipt(receipt, 2)).toBe(false)
  }
})
