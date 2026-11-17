import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElInputNumber } from 'element-plus'
import Panel from '@/components/AccessoryInventoryAdjustmentModal.vue'
import type { AccessoryBatchStock } from '@/types/accessory'

const mocks = vi.hoisted(() => ({ adjust: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/api/accessory-inventory', () => ({ adjustAccessoryInventory: mocks.adjust }))
vi.mock('@/utils/sales-checkout', () => ({ createCheckoutKey: () => 'a'.repeat(32) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ success: mocks.success, error: mocks.error }) }))
const Dialog = { props: ['modelValue'], template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>' }
const row: AccessoryBatchStock = { row_key: 'event:91', accessory_id: 31, store_id: 2, store_name: '二店',
  brand_name: '品牌甲', product_model: 'MODEL-A', batch_no: 'IN-7', supplier_name: '供应商', inventory_time: null,
  inventory_operator_name: null, purchase_cost: '12.50', usage_type: 'sale', serial_tracking: 0, quantity: 4, source_status: 'purchase' }
const receipt = () => ({ success: true, data: { adjustment_id: 112, accessory_id: 31, store_id: 2, stock_in_id: 7,
  previous_quantity: 4, counted_quantity: 6, delta: 2, replayed: false } })
const wrappers: ReturnType<typeof mount>[] = []
const render = () => {
  const wrapper = mount(Panel, { props: { modelValue: true, accessoryId: 31, accessoryName: '测试商品', row },
    global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog } } })
  wrappers.push(wrapper)
  return wrapper
}
const fill = async (wrapper: ReturnType<typeof render>) => {
  wrapper.findComponent(ElInputNumber).vm.$emit('update:modelValue', 6)
  await wrapper.find('textarea').setValue('实物复核为六件')
}
const confirm = (wrapper: ReturnType<typeof render>) => wrapper.findAll('button').find(button => /确认盘点|重试原盘点/.test(button.text()))!
beforeEach(() => { vi.clearAllMocks(); mocks.adjust.mockResolvedValue(receipt()) })
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

it('必填原因后提交本批实物数量、原结存及唯一键，成功通知父列表刷新', async () => {
  const wrapper = render()
  expect(confirm(wrapper).attributes('disabled')).toBeDefined()
  await fill(wrapper)
  await confirm(wrapper).trigger('click'); await flushPromises()
  expect(mocks.adjust).toHaveBeenCalledWith(31, { request_key: 'a'.repeat(32), row_key: 'event:91',
    expected_quantity: 4, counted_quantity: 6, reason: '实物复核为六件' })
  expect(wrapper.emitted('success')).toHaveLength(1)
  expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
})

it('不确定结果保留原请求并冻结表单，重试核对原回执后只刷新一次', async () => {
  mocks.adjust.mockRejectedValueOnce(new Error('请求超时'))
  const wrapper = render()
  await fill(wrapper)
  await confirm(wrapper).trigger('click'); await flushPromises()
  expect(wrapper.emitted('success')).toBeUndefined()
  expect(wrapper.findComponent(ElInputNumber).props('disabled')).toBe(true)
  expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
  expect(confirm(wrapper).text()).toContain('重试原盘点')
  mocks.adjust.mockResolvedValueOnce({ ...receipt(), data: { ...receipt().data, replayed: true } })
  await confirm(wrapper).trigger('click'); await flushPromises()
  expect(mocks.adjust.mock.calls[1]).toEqual(mocks.adjust.mock.calls[0])
  expect(mocks.success).toHaveBeenCalledWith('已核对原盘点结果')
  expect(wrapper.emitted('success')).toHaveLength(1)
})

it('缺少核对数量的响应不当成盘点成功', async () => {
  mocks.adjust.mockResolvedValueOnce({ success: true, data: { adjustment_id: 112 } })
  const wrapper = render()
  await fill(wrapper)
  await confirm(wrapper).trigger('click'); await flushPromises()
  expect(wrapper.emitted('success')).toBeUndefined()
  expect(mocks.error).toHaveBeenCalled()
  expect(confirm(wrapper).text()).toContain('重试原盘点')
})
