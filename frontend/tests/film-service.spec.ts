import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import FilmServiceDialog from '@/components/query/FilmServiceDialog.vue'
import QueryDetailDialog from '@/components/query/QueryDetailDialog.vue'
import QueryDetailContent from '@/components/query/QueryDetailContent.vue'
import RecordDescriptions from '@/components/RecordDescriptions.vue'
import type { FilmServiceContext } from '@/types/sales-checkout'
import type { QueryItem } from '@/types'

const mocks = vi.hoisted(() => ({ context: vi.fn() }))
vi.mock('@/api/sales-checkout', () => ({ getFilmServiceContext: mocks.context }))
const access = reactive({ view: true, film: true, create: true, gift: true, hidden: new Set<string>() })
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ canView: computed(() => access.view), canCreate: computed(() => access.create), hasPermission: (action: 'film' | 'gift') => access[action] }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  isFieldVisible: (_module: string, field: string) => !access.hidden.has(field), getHiddenFields: () => [...access.hidden]
} }))
const Dialog = { props: { modelValue: Boolean }, template: '<div v-if="modelValue" class="film-dialog"><slot /><footer v-if="$slots.footer"><slot name="footer" /></footer></div>' }
const Checkout = { props: ['modelValue', 'initialCustomer', 'filmCustomerId', 'filmEligibleForFree', 'defaults'], emits: ['success', 'update:modelValue'], template: '<div class="film-checkout" />' }
const Pagination = { props: ['current', 'pageSize', 'total'], emits: ['change'], template: '<div />' }
const customer = { id: 9, name: '测试客户', phone: '13800138000' }
const fixture = (page = 1, customerId = 9): FilmServiceContext => ({ customer_id: customerId, eligible_for_free: true, service_count: 21, film_quantity: 25,
  data: [{ id: page, order_id: 8, order_no: `FILM${page}`, quantity: 2, store_id: 2, store_name: '服务二店', operator_id: 7, operator_name: '办理员', business_time: '2026-11-14 09:00:00', created_at: '2026-11-14 09:02:00',
    items: [{ name: '免费钢化膜', sale_type: 'gift', quantity: 1, total_amount: 0 }, { name: '收费钢化膜', sale_type: 'sale', quantity: 1, total_amount: 20 }] }],
  pagination: { page, page_size: 20, total: 21, total_pages: 2, has_next: page === 1, has_prev: page > 1 } })
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  const wrapper = mount(FilmServiceDialog, { props: { modelValue: true, customer }, global: { plugins: [ElementPlus], components: { RecordDescriptions }, stubs: { MobileDialog: Dialog, SalesGoodsCheckoutDialog: Checkout, Pagination, DataEmptyState: { template: '<div><slot /><button @click="$emit(\'action\')">重试</button></div>' }, SectionLoading: true }, directives: { permission: {}, 'tf-loading': {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const start = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('button').find(button => button.text() === '办理贴膜')!
beforeEach(() => {
  Object.assign(access, { view: true, film: true, create: true, gift: true }); access.hidden.clear()
  mocks.context.mockImplementation(async (_customer: number, page: number) => ({ success: true, data: fixture(page, _customer) }))
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })

describe('客户贴膜入口及历史', () => {
  it('查看窗口不重复提供关闭按钮，只有查看权限时没有底部空操作区', async () => {
    const wrapper = await render()
    expect(wrapper.find('footer').text()).toBe('办理贴膜')
    expect(wrapper.findAll('button').some(button => button.text() === '关闭')).toBe(false)
    access.create = access.gift = false; await flushPromises()
    expect(wrapper.text()).toContain('FILM1')
    expect(wrapper.find('footer').exists()).toBe(false)
  })
  it('从手机详情动作打开当前客户贴膜，不依赖原购买门店', async () => {
    const item: QueryItem = { 基本信息: { phone_id: 1 }, 客户信息: { customer_id: 9, customer_name: customer.name, customer_phone: customer.phone },
      供应商信息: {}, 店铺信息: {}, 价格信息: {}, 时间信息: {}, 操作员信息: {}, 销售信息: {} }
    const wrapper = mount(QueryDetailDialog, { props: { modelValue: true, detailItem: item, canEdit: false, canDelete: false, canReturnToStock: false }, global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog, FilmServiceDialog: { name: 'FilmServiceDialog', props: ['customer', 'modelValue'], template: '<div />' } }, directives: { permission: {} } } })
    wrappers.push(wrapper)
    const content = wrapper.findComponent(QueryDetailContent)
    await content.findAll('button').find(button => button.text() === '贴膜')!.trigger('click'); await flushPromises()
    expect(wrapper.findComponent({ name: 'FilmServiceDialog' }).props('customer')).toEqual(customer)
    access.film = false
    await wrapper.setProps({ detailItem: { ...item, 基本信息: { ...item.基本信息, phone_id: 2 } } })
    content.vm.$emit('film'); await flushPromises()
    expect(wrapper.findComponent({ name: 'FilmServiceDialog' }).exists()).toBe(false)
  })
  it('区分服务次数与耗膜量，分页显示时间、跨店、收费和免费原单，成功重读第一页', async () => {
    const wrapper = await render()
    expect(wrapper.text()).toContain('累计贴膜次数21')
    expect(wrapper.text()).toContain('累计用膜数量25')
    expect(wrapper.text()).toContain('服务二店')
    expect(wrapper.text()).toContain('免费钢化膜 · 免费 · 1件 · 实收 ¥0')
    expect(wrapper.text()).toContain('收费钢化膜 · 收费 · 1件 · 实收 ¥20')
    wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
    expect(mocks.context).toHaveBeenLastCalledWith(9, 2, 20, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('FILM2')
    await start(wrapper).trigger('click'); await flushPromises()
    expect(wrapper.findComponent(Checkout).props()).toMatchObject({ filmCustomerId: 9, filmEligibleForFree: true, initialCustomer: customer })
    wrapper.findComponent(Checkout).vm.$emit('success'); await flushPromises()
    expect(mocks.context).toHaveBeenLastCalledWith(9, 1, 20, expect.any(AbortSignal))
  })
  it('无免费资格仍可收费，仅赠送权限时不可办理，字段隐藏不泄漏历史金额', async () => {
    mocks.context.mockResolvedValue({ success: true, data: { ...fixture(), eligible_for_free: false } })
    access.hidden.add('price_info.total_price')
    const wrapper = await render()
    expect(wrapper.text()).toContain('当前无免费贴膜资格')
    expect(wrapper.text()).not.toContain('实收')
    expect(start(wrapper).attributes('disabled')).toBeUndefined()
    access.create = false; await flushPromises()
    expect(start(wrapper).attributes('disabled')).toBeDefined()
  })
  it('失败可重试且不允许使用旧资格，关闭、切客和撤权取消旧请求', async () => {
    const wrapper = await render()
    mocks.context.mockRejectedValueOnce(new Error('临时故障'))
    wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
    expect(start(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).not.toContain('累计贴膜次数21')
    expect(wrapper.text()).not.toContain('FILM1')
    await wrapper.findAll('button').find(button => button.text() === '重试')!.trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('FILM2')
    let resolveOld: ((value: { success: boolean; data: FilmServiceContext }) => void) | undefined
    mocks.context.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    wrapper.findComponent(Pagination).vm.$emit('change', 1); await flushPromises()
    const signal = mocks.context.mock.calls.at(-1)![3] as AbortSignal
    await wrapper.setProps({ customer: { ...customer, id: 10 } }); await flushPromises()
    expect(signal.aborted).toBe(true)
    resolveOld?.({ success: true, data: fixture() }); await flushPromises()
    await start(wrapper).trigger('click'); await flushPromises()
    expect(wrapper.findComponent(Checkout).props('filmCustomerId')).toBe(10)
    access.film = false; await flushPromises()
    expect(wrapper.findComponent(Checkout).exists()).toBe(false)
    expect(wrapper.text()).not.toContain('FILM')
    expect((mocks.context.mock.calls.at(-1)![3] as AbortSignal).aborted).toBe(true)
  })
  it('无客户或隐藏必要客户字段不读取，错误客户响应拒绝使用', async () => {
    access.hidden.add('customer_info.customer_phone')
    const wrapper = await render()
    expect(mocks.context).not.toHaveBeenCalled()
    access.hidden.clear()
    mocks.context.mockResolvedValue({ success: true, data: fixture(1, 999) }); await flushPromises()
    expect(start(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.setProps({ customer: null }); await flushPromises()
    expect(start(wrapper)).toBeUndefined()
  })
  it('历史可选字段权限变化取消旧请求并清理已读记录，重授后重新读取而不恢复旧值', async () => {
    const wrapper = await render()
    let resolveOld: ((_value: { success: boolean; data: FilmServiceContext }) => void) | undefined
    mocks.context.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
    const oldSignal = mocks.context.mock.calls.at(-1)![3] as AbortSignal
    mocks.context.mockImplementationOnce(() => new Promise(() => undefined))
    access.hidden.add('stock_info.distribution'); await flushPromises()
    expect(oldSignal.aborted).toBe(true)
    expect(wrapper.text()).not.toContain('服务二店')
    expect(wrapper.text()).not.toContain('FILM1')
    resolveOld?.({ success: true, data: fixture(2) }); await flushPromises()
    expect(wrapper.text()).not.toContain('FILM2')
    const calls = mocks.context.mock.calls.length
    access.hidden.clear(); await flushPromises()
    expect(mocks.context.mock.calls.length).toBe(calls + 1)
    expect(mocks.context).toHaveBeenLastCalledWith(9, 1, 20, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('服务二店')
  })
})
