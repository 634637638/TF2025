import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElForm } from 'element-plus'
import QuickSaleModal from '@/components/query/QuickSaleModal.vue'
import { PaymentChannelSelect, PaymentMethodSelect } from '@/components/payment'
import { vIdentifierInput } from '@/directives/identifier-input'
import type { QuickSaleFormState } from '@/components/query/quick-sale/types'
import type { QueryOperationOptions } from '@/types'
import type { CheckoutAdditionalGoodsDraft } from '@/types/sales-checkout'

const mocks = vi.hoisted(() => ({ denied: new Set<string>(), hidden: new Set<string>(), post: vi.fn(), warning: vi.fn(), error: vi.fn() }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 7, name: '销售员' } }) }))
vi.mock('@/composables/mobile', async importOriginal => ({ ...await importOriginal<typeof import('@/composables/mobile')>(),
  useMobile: () => ({ isMobile: computed(() => false), isIOS: computed(() => false) }) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({
  canEdit: computed(() => !mocks.denied.has(`${module}:edit`)), requirePermission: (action: string) => !mocks.denied.has(`${module}:${action}`),
  canView: computed(() => !mocks.denied.has(`${module}:view`)), canCreate: computed(() => !mocks.denied.has(`${module}:create`)),
  canSell: computed(() => !mocks.denied.has(`${module}:sell`)), hasPermission: (action: string) => !action.startsWith('goods-') && !mocks.denied.has(`${module}:${action}`)
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ success: vi.fn(), warning: mocks.warning, error: mocks.error, info: vi.fn(), prompt: vi.fn() }) }))
vi.mock('@/utils/unified-api', () => { const api = { post: mocks.post }; return { default: api, unifiedApi: api } })
vi.mock('@/services/reference-options', () => ({ getModels: vi.fn().mockResolvedValue({ success: true, data: [{ id: 2, name: '测试型号', brand_id: 1 }] }) }))
vi.mock('@/services/customer-options', () => ({ searchCustomerOptions: vi.fn().mockResolvedValue([]) }))

const Checkout = { name: 'CheckoutProbe', props: { modelValue: Boolean, phones: Array, quickPhone: Object, defaults: Object, initialCustomer: Object, initialSelection: Object },
  emits: ['confirm', 'update:modelValue', 'customer-updated'], template: '<div class="checkout-probe" />' }
const Dialog = { props: { modelValue: Boolean }, emits: ['update:modelValue'], template: '<div v-if="modelValue"><slot /><slot name="footer" /></div>' }
const options: QueryOperationOptions = { brands: [{ id: 1, name: '测试品牌' }], models: [], colors: [{ id: 3, name: '黑' }],
  memories: [{ id: 4, size: '128G' }], stores: [{ id: 1, name: '一店' }], suppliers: [{ id: 5, name: '供应商' }], users: [{ id: 7, name: '销售员' }] }
const wrappers: ReturnType<typeof mount>[] = []
const render = async (status = 'sold') => {
  const wrapper = mount(QuickSaleModal, { props: { modelValue: false, options }, global: { plugins: [ElementPlus],
    components: { PaymentMethodSelect, PaymentChannelSelect },
    // 保留真实表单校验；下拉浮层交互由公共控件测试覆盖，此处只验证合单边界。
    stubs: { MobileDialog: Dialog, OptimizedScanner: true, SalesGoodsCheckoutDialog: Checkout, ElSelect: true, ElOption: true, ElDatePicker: true }, directives: { permission: {}, 'identifier-input': vIdentifierInput } } })
  wrappers.push(wrapper)
  await wrapper.setProps({ modelValue: true }); await flushPromises()
  const form = wrapper.findComponent(ElForm).props('model') as QuickSaleFormState
  Object.assign(form, { brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, supplier_id: 5, store_id: 1,
    serial_number: 'SN0001', imei: '123456789012345', purchase_cost: 80.01, sale_price: 100.02,
    customer_name: '测试客户', customer_phone: '13800138000', sale_operator_id: 7, status, payment_method: 'cash', remarks: '整批备注' })
  await flushPromises()
  return { wrapper, form }
}
const goodsButton = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('button').find(button => button.text() === '配件')
beforeEach(() => { mocks.denied.clear(); mocks.hidden.clear(); vi.clearAllMocks() })
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

it('快速出库配件入口仅转入草稿，保留采购设备和公共资料，不提前发起手机销售', async () => {
  const { wrapper, form } = await render()
  await goodsButton(wrapper)!.trigger('click'); await flushPromises()
  const checkout = wrapper.getComponent(Checkout)
  expect(checkout.props('quickPhone')).toMatchObject({ supplier_id: 5, purchase_cost: 80.01, sale_price: 100.02, serial_number: 'SN0001' })
  expect(checkout.props('defaults')).toMatchObject({ customer_name: '测试客户', store_id: 1, operator_id: 7, remarks: '整批备注' })
  expect(checkout.props('phones')).toEqual([expect.objectContaining({ phone_id: 1, sale_price: 100.02 })])
  expect(mocks.post).not.toHaveBeenCalled()
  const selection: CheckoutAdditionalGoodsDraft = { goods: [{ key: 'goods1', option: { id: 56, name: '充电器', brand_name: null,
    product_model: null, barcode: null, sale_price: 30, quantity: 10, serial_quantity: 0 }, quantity: 1, unit_price: 30,
  sale_type: 'sale', linked_phone_id: 1, serial_mode: false, serial_numbers: [], gift_return_unit_price: null }],
  store_id: 1, points_quote: null, points_context: '', remarks: '附加商品备注' }
  checkout.vm.$emit('confirm', selection)
  checkout.vm.$emit('update:modelValue', false)
  await flushPromises()
  expect(mocks.post).not.toHaveBeenCalled()
  expect(wrapper.emitted('success')).toBeUndefined()
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  expect(form.remarks).toBe('附加商品备注')
  await goodsButton(wrapper)!.trigger('click'); await flushPromises()
  expect(wrapper.getComponent(Checkout).props('initialSelection')).toEqual(selection)
})

it('取消配件结算保留快速出库内容，重新打开使用最新设备价格', async () => {
  const { wrapper, form } = await render()
  await goodsButton(wrapper)!.trigger('click'); await flushPromises()
  wrapper.getComponent(Checkout).vm.$emit('update:modelValue', false); await flushPromises()
  expect(form.sale_price).toBe(100.02)
  expect(form.remarks).toBe('整批备注')
  form.sale_price = 150.01
  await goodsButton(wrapper)!.trigger('click'); await flushPromises()
  expect(wrapper.getComponent(Checkout).props('quickPhone').sale_price).toBe(150.01)
  expect(mocks.post).not.toHaveBeenCalled()
})

it('设备资料未通过原表单校验时不打开配件结算或销售手机', async () => {
  const { wrapper, form } = await render()
  form.imei = ''
  await goodsButton(wrapper)!.trigger('click'); await flushPromises()
  expect(wrapper.findComponent(Checkout).exists()).toBe(false)
  expect(mocks.post).not.toHaveBeenCalled()
})

it.each(['peer_transfer', 'supplier_proxy'])('%s不提供配件合单入口', async status => {
  const { wrapper } = await render(status)
  expect(goodsButton(wrapper)).toBeUndefined()
})

it.each([{ denied: ['accessories:sell', 'accessories:gift'] }, { denied: ['inventory:sell'] }, { denied: ['query:create'] }])('缺少动作权限 $denied 不显示配件入口', async ({ denied }) => {
  denied.forEach(permission => mocks.denied.add(permission))
  const { wrapper } = await render()
  expect(goodsButton(wrapper)).toBeUndefined()
  expect(mocks.post).not.toHaveBeenCalled()
})

it('必要手机字段隐藏不进入共同结算', async () => {
  const { wrapper } = await render()
  mocks.hidden.add('sale.purchase_cost')
  await goodsButton(wrapper)!.trigger('click'); await flushPromises()
  expect(wrapper.findComponent(Checkout).exists()).toBe(false)
  expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining('字段权限'))
  expect(mocks.post).not.toHaveBeenCalled()
})
