import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElInputNumber, ElRadioGroup, ElSelect } from 'element-plus'
import FilmServiceDialog from '@/components/query/FilmServiceDialog.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import QueryDetailDialog from '@/components/query/QueryDetailDialog.vue'
import QueryDetailContent from '@/components/query/QueryDetailContent.vue'
import type { CheckoutGoodsOption, FilmServiceContext } from '@/types/sales-checkout'
import type { QueryItem } from '@/types'

const mocks = vi.hoisted(() => ({ context: vi.fn(), checkout: vi.fn(), goods: vi.fn(), stores: vi.fn(), success: vi.fn() }))
vi.mock('@/api/sales-checkout', () => ({ getFilmServiceContext: mocks.context, checkoutSale: mocks.checkout, getFilmProducts: (customerId: number, params: object, signal: AbortSignal) => mocks.goods({ ...params, customer_id: customerId }, signal) }))
vi.mock('@/services/reference-options', () => ({ getStores: mocks.stores }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 7 } }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
const access = reactive({ view: true, film: true, create: true, gift: true, hidden: new Set<string>() })
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ canView: computed(() => access.view), canCreate: computed(() => access.create), hasPermission: (action: 'film' | 'gift') => access[action] }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  isFieldVisible: (_module: string, field: string) => !access.hidden.has(field), getHiddenFields: () => [...access.hidden]
} }))
const Dialog = { props: { modelValue: Boolean, beforeClose: Function }, emits: ['update:modelValue'], template: '<div v-if="modelValue" class="film-dialog"><button class="close" @click="beforeClose(() => $emit(\'update:modelValue\', false))">关闭窗口</button><slot /><footer v-if="$slots.footer"><slot name="footer" /></footer></div>' }
const Checkout = { props: ['modelValue', 'initialCustomer', 'filmCustomerId', 'filmPhoneId', 'filmModelId', 'filmEligibleForFree', 'initialFilmProduct', 'defaults'], emits: ['success', 'update:modelValue'], template: '<div class="film-checkout" />' }
const customer = { id: 9, name: '测试客户', phone: '13800138000' }
const fixture = (page = 1, customerId = 9, phoneId?: number): FilmServiceContext => ({ customer_id: customerId, eligible_for_free: !!phoneId,
  device: phoneId ? { phone_id: phoneId, model_id: 13, model_name: 'iPhone 13' } : null, service_count: 21, film_quantity: 25,
  free_count: 0, paid_count: 21,
  device_service_count: phoneId ? 3 : null, device_film_quantity: phoneId ? 4 : null,
  data: [{ id: page, order_id: 8, order_no: `FILM${page}`, quantity: 2, store_id: 2, store_name: '服务二店', operator_id: 7, operator_name: '办理员', business_time: '2026-11-14 09:00:00', created_at: '2026-11-14 09:02:00',
    items: [{ name: '免费钢化膜', sale_type: 'gift', quantity: 1, total_amount: 0 }, { name: '收费钢化膜', sale_type: 'sale', quantity: 1, total_amount: 20 }] }],
  pagination: { page, page_size: 10, total: 21, total_pages: 3, has_next: page < 3, has_prev: page > 1 } })
const wrappers: ReturnType<typeof mount>[] = []
const render = async (phoneId: number | undefined = 11) => {
  const wrapper = mount(FilmServiceDialog, { props: { modelValue: true, customer, phoneId }, global: { plugins: [ElementPlus], components: { InlineLoading }, stubs: { MobileDialog: Dialog, SalesGoodsCheckoutDialog: Checkout, DataEmptyState: { props: ['title', 'description'], template: '<div>{{ title }}{{ description }}<slot /><button @click="$emit(\'action\')">重试</button></div>' }, SectionLoading: true }, directives: { permission: {}, 'tf-loading': {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const start = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('footer button')[0]
const store = async (wrapper: ReturnType<typeof mount>, id = 2) => { wrapper.findComponent(ElSelect).vm.$emit('update:modelValue', id); await flushPromises() }
const paid = async (wrapper: ReturnType<typeof mount>) => { wrapper.findComponent(ElRadioGroup).vm.$emit('update:modelValue', 'paid'); await flushPromises() }
const scrollHistoryToBottom = async (wrapper: ReturnType<typeof mount>) => {
  const list = wrapper.get('.film-history-list').element
  Object.defineProperties(list, { scrollTop: { configurable: true, writable: true, value: 100 }, clientHeight: { configurable: true, value: 100 }, scrollHeight: { configurable: true, value: 200 } })
  list.dispatchEvent(new Event('scroll'))
  await flushPromises()
}
beforeEach(() => {
  Object.assign(access, { view: true, film: true, create: true, gift: true }); access.hidden.clear()
  mocks.context.mockImplementation(async (id: number, page: number, _size: number, _signal: AbortSignal, phone?: number) => ({ success: true, data: fixture(page, id, phone) }))
  mocks.stores.mockResolvedValue({ success: true, data: [{ id: 1, name: '购买店' }, { id: 2, name: '服务二店' }] })
  mocks.goods.mockResolvedValue({ success: true, data: { data: [{ id: 55, name: '高清膜', brand_name: '品牌甲', color_name: null, unit: '张', quantity: 8, serial_quantity: 0 }], pagination: { total: 1 } } })
  mocks.checkout.mockResolvedValue({ success: true, data: { order_id: 8, film_service_id: 10, paid_amount: 0 } })
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })

describe('按当前手机办理贴膜及跨店历史', () => {
  it('免费候选超过100条时完整读取，按原始分页数量推进后再排除仅SN库存', async () => {
    const options: CheckoutGoodsOption[] = Array.from({ length: 121 }, (_, index) => ({
      id: index + 1, name: `适配膜${index + 1}`, brand_name: '膜品牌', product_model: null, barcode: null,
      sale_price: 0, quantity: 8, serial_quantity: index < 20 ? 8 : 0
    }))
    mocks.goods.mockImplementation(async ({ page, page_size }: { page: number; page_size: number }) => ({
      success: true, data: { data: options.slice((page - 1) * page_size, page * page_size), pagination: { total: options.length } }
    }))
    const wrapper = await render()
    await store(wrapper)
    const select = wrapper.findAllComponents(ElSelect)[1]
    expect(select.findAllComponents({ name: 'ElOption' })).toHaveLength(101)
    expect(select.findAllComponents({ name: 'ElOption' }).map(option => option.props('value'))).toContain(121)
    expect(select.props('modelValue')).toBe(21)
    const calls = mocks.goods.mock.calls
    expect(calls.map(([params]) => params.page)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (const [params, signal] of calls) {
      expect(params).toMatchObject({ store_id: 2, phone_id: 11, customer_id: 9, free_only: true })
      expect(signal).toBe(calls[0][1])
    }
    select.vm.$emit('update:modelValue', 121); await flushPromises()
    await start(wrapper).trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ film_service: expect.objectContaining({ accessory_id: 121 }) }))
  })

  it.each(['reject', 'empty', 'missing-total', 'duplicate'] as const)('后续页%s时不发布残缺候选且禁止办理', async failure => {
    const option = { id: 55, name: '高清膜', quantity: 8, serial_quantity: 0 }
    mocks.goods.mockResolvedValueOnce({ success: true, data: { data: [option], pagination: { total: 2 } } })
    if (failure === 'reject') mocks.goods.mockRejectedValueOnce(new Error('第二页读取失败'))
    else mocks.goods.mockResolvedValueOnce({ success: true, data: {
      data: failure === 'empty' ? [] : [option], pagination: failure === 'missing-total' ? {} : { total: 2 }
    } })
    const wrapper = await render()
    await store(wrapper)
    expect(wrapper.text()).toContain('免费贴膜商品读取失败')
    expect(start(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.findAllComponents(ElSelect)).toHaveLength(1)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })

  it.each(['clear-store', 'switch-store', 'paid', 'close'] as const)('候选分页中%s会取消旧请求，迟到的结果不能恢复旧选项', async change => {
    const option = { id: 55, name: '旧店候选', quantity: 8, serial_quantity: 0 }
    mocks.goods.mockResolvedValueOnce({ success: true, data: { data: [option], pagination: { total: 2 } } })
    let resolvePage!: (value: unknown) => void
    mocks.goods.mockImplementationOnce(() => new Promise(resolve => { resolvePage = resolve }))
    const wrapper = await render()
    await store(wrapper)
    expect(start(wrapper).attributes('disabled')).toBeDefined()
    const signal: AbortSignal = mocks.goods.mock.calls[1][1]
    if (change === 'clear-store') { wrapper.findComponent(ElSelect).vm.$emit('update:modelValue', null); await flushPromises() }
    else if (change === 'switch-store') await store(wrapper, 1)
    else if (change === 'paid') await paid(wrapper)
    else await wrapper.setProps({ modelValue: false })
    expect(signal.aborted).toBe(true)
    const callsBeforeResolve = mocks.goods.mock.calls.length
    resolvePage({ success: true, data: { data: [{ ...option, id: 56 }], pagination: { total: 2 } } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('旧店候选')
    expect(mocks.goods).toHaveBeenCalledTimes(callsBeforeResolve)
    expect(mocks.checkout).not.toHaveBeenCalled()
    if (change === 'switch-store') expect(wrapper.findAllComponents(ElSelect)[1].props('modelValue')).toBe(55)
  })

  it('默认免费、数量1，门店必选；只提交手机与实际耗量，不让前端指定免费膜或价格', async () => {
    const wrapper = await render()
    expect(start(wrapper).text()).toBe('确认免费贴膜')
    expect(start(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent(ElInputNumber).props('modelValue')).toBe(1)
    expect(wrapper.text()).not.toContain('免费贴膜不限原购买门店')
    expect(wrapper.findComponent(Checkout).exists()).toBe(false)
    const quantityRow = wrapper.find('.tf-form-row')
    expect(quantityRow.exists()).toBe(true)
    expect(quantityRow.findAll('.el-form-item')).toHaveLength(2)
    expect(quantityRow.findAll('.el-form-item').map(item => item.find('.el-form-item__label').text())).toEqual(['服务门店', '耗膜数量'])
    for (const field of quantityRow.findAll('.el-form-item')) expect(field.classes()).toContain('tf-form-field--inline')
    await store(wrapper)
    expect(mocks.goods).toHaveBeenLastCalledWith(expect.objectContaining({ store_id: 2, phone_id: 11, customer_id: 9, free_only: true }), expect.any(AbortSignal))
    expect(wrapper.text()).toContain('高清膜 · 品牌甲')
    wrapper.findComponent(ElInputNumber).vm.$emit('update:modelValue', 3); await flushPromises()
    await start(wrapper).trigger('click'); await flushPromises()
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ store_id: 2, operator_id: 7, phones: [], accessories: [],
      film_service: { customer_id: 9, phone_id: 11, mode: 'free', quantity: 3, accessory_id: 55 }, payment_info: expect.objectContaining({ payment_amount: 0 }) }))
    expect(mocks.success).toHaveBeenCalledOnce()
    expect(mocks.context).toHaveBeenLastCalledWith(9, 1, 10, expect.any(AbortSignal), 11)
    expect(start(wrapper).text()).toBe('贴膜完成')
    expect(start(wrapper).attributes('disabled')).toBeDefined()
  expect(mocks.stores).toHaveBeenCalledWith({ strictScope: true })
  })
  it('从手机详情动作传当前客户及手机，切换或撤权后不能沿用旧入口', async () => {
    const item: QueryItem = { 基本信息: { phone_id: 1 }, 客户信息: { customer_id: 9, customer_name: customer.name, customer_phone: customer.phone },
      供应商信息: {}, 店铺信息: {}, 价格信息: {}, 时间信息: {}, 操作员信息: {}, 销售信息: {} }
    const wrapper = mount(QueryDetailDialog, { props: { modelValue: true, detailItem: item, canEdit: false, canDelete: false, canReturnToStock: false }, global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog, FilmServiceDialog: { name: 'FilmServiceDialog', props: ['customer', 'phoneId', 'modelValue'], template: '<div />' } }, directives: { permission: {} } } })
    wrappers.push(wrapper)
    const content = wrapper.findComponent(QueryDetailContent)
    await content.findAll('button').find(button => button.text() === '贴膜')!.trigger('click'); await flushPromises()
    expect(wrapper.findComponent({ name: 'FilmServiceDialog' }).props()).toMatchObject({ customer, phoneId: 1 })
    access.film = false
    await wrapper.setProps({ detailItem: { ...item, 基本信息: { ...item.基本信息, phone_id: 2 } } })
    content.vm.$emit('film'); await flushPromises()
    expect(wrapper.findComponent({ name: 'FilmServiceDialog' }).exists()).toBe(false)
  })
  it('历史按卡片展示并滚动到底部自动追加下一批10条，收费选品绑定当前型号与客户', async () => {
    const wrapper = await render()
    const summary = wrapper.get('dl[aria-label="客户及贴膜统计"]')
    expect(summary.findAll('dt').map(field => field.text())).toEqual(['姓名', '手机号', '本机累计贴膜', '累计总贴膜'])
    expect(summary.findAll('dd').map(field => field.text())).toEqual([customer.name, customer.phone, '3 次 · 4 张', '21 次 · 25 张'])
    expect(wrapper.text()).toContain('本机累计贴膜3 次 · 4 张')
    expect(wrapper.text()).toContain('累计总贴膜21 次 · 25 张')
    expect(wrapper.text()).toContain('贴膜设备')
    expect(wrapper.text()).not.toContain('本次手机型号')
    expect(wrapper.text()).toContain('免费钢化膜')
    expect(wrapper.text()).toContain('收费钢化膜')
    expect(wrapper.text()).toContain('免费')
    expect(wrapper.text()).toContain('收费')
    expect(wrapper.text()).toContain('¥20')
    expect(wrapper.findAll('.film-history-card')).toHaveLength(1)
    expect(wrapper.get('.film-history-list').attributes('aria-label')).toBe('贴膜历史记录列表')
    expect(wrapper.get('.film-history-card').text()).toContain('最新')
    expect(wrapper.get('.film-history-card').text()).toContain('贴膜时间')
    expect(wrapper.get('.film-history-card').text()).not.toContain('服务时间')
    expect(wrapper.get('.film-history-card').text()).not.toContain('记录时间')
    expect(wrapper.get('.film-history-card').text()).toContain('本次消耗1 张')
    expect(wrapper.get('.film-history-card').text()).not.toContain('耗膜数量')
    expect(wrapper.get('.film-history-card').classes()).toContain('film-history-card--paid')
    expect(mocks.context).toHaveBeenLastCalledWith(9, 1, 10, expect.any(AbortSignal), 11)
    await scrollHistoryToBottom(wrapper)
    expect(mocks.context).toHaveBeenLastCalledWith(9, 2, 10, expect.any(AbortSignal), 11)
    expect(wrapper.findAll('.film-history-card')).toHaveLength(2)
    await store(wrapper); await paid(wrapper)
    expect(mocks.goods).toHaveBeenLastCalledWith(expect.objectContaining({ store_id: 2, phone_id: 11, customer_id: 9 }), expect.any(AbortSignal))
    expect(mocks.goods).toHaveBeenLastCalledWith(expect.not.objectContaining({ free_only: false }), expect.any(AbortSignal))
    await start(wrapper).trigger('click'); await flushPromises()
    expect(wrapper.findComponent(Checkout).props()).toMatchObject({ filmCustomerId: 9, filmPhoneId: 11, filmModelId: 13, filmEligibleForFree: true, initialCustomer: customer,
      initialFilmProduct: expect.objectContaining({ id: 55 }),
      defaults: { customer_name: customer.name, customer_phone: customer.phone, store_id: 2 } })
    wrapper.findComponent(Checkout).vm.$emit('success'); await flushPromises()
    expect(mocks.context).toHaveBeenLastCalledWith(9, 1, 10, expect.any(AbortSignal), 11)
  })
  it('按全部、免费和收费筛选历史，筛选数量保持全量口径并重置为第一页', async () => {
    mocks.context.mockImplementation(async (id: number, page: number, pageSize: number, _signal: AbortSignal, phone?: number, saleType?: 'sale' | 'gift') => {
      const data = fixture(page, id, phone)
      data.service_count = 8; data.free_count = 4; data.paid_count = 4
      data.data[0].items = saleType === 'gift'
        ? [{ name: '免费钢化膜', sale_type: 'gift', quantity: 1, total_amount: 0 }]
        : saleType === 'sale'
          ? [{ name: '收费钢化膜', sale_type: 'sale', quantity: 1, total_amount: 20 }]
          : data.data[0].items
      data.pagination = { page, page_size: pageSize, total: saleType ? 4 : 8, total_pages: 1, has_next: false, has_prev: false }
      return { success: true, data }
    })
    const wrapper = await render()
    expect(wrapper.get('.film-history__title').text()).toContain('贴膜记录8')
    expect(wrapper.get('.film-history-filter').text()).toContain('全部 8')
    expect(wrapper.get('.film-history-filter').text()).toContain('免费 4')
    expect(wrapper.get('.film-history-filter').text()).toContain('收费 4')
    const filter = wrapper.findAllComponents(ElRadioGroup)[1]
    filter.vm.$emit('update:modelValue', 'free'); filter.vm.$emit('change', 'free'); await flushPromises()
    expect(mocks.context).toHaveBeenLastCalledWith(9, 1, 10, expect.any(AbortSignal), 11, 'gift')
    expect(wrapper.text()).toContain('免费钢化膜')
    expect(wrapper.text()).not.toContain('收费钢化膜')
    filter.vm.$emit('update:modelValue', 'paid'); filter.vm.$emit('change', 'paid'); await flushPromises()
    expect(mocks.context).toHaveBeenLastCalledWith(9, 1, 10, expect.any(AbortSignal), 11, 'sale')
    expect(wrapper.text()).toContain('收费钢化膜')
    expect(wrapper.text()).not.toContain('免费钢化膜')
    filter.vm.$emit('update:modelValue', 'all'); filter.vm.$emit('change', 'all'); await flushPromises()
    expect(mocks.context).toHaveBeenLastCalledWith(9, 1, 10, expect.any(AbortSignal), 11)
  })
  it('客户详情无当前手机时只读；贴膜授权不要求商品新增和赠送', async () => {
    const wrapper = await render()
    await wrapper.setProps({ phoneId: undefined }); await flushPromises()
    expect(wrapper.text()).toContain('此处仅查看历史')
    expect(wrapper.text()).not.toContain('本机累计贴膜')
    expect(wrapper.text()).toContain('累计总贴膜21 次 · 25 张')
    expect(wrapper.find('.film-dialog > footer').exists()).toBe(false)
    await wrapper.setProps({ phoneId: 11 }); access.create = access.gift = false; await flushPromises()
    expect(wrapper.text()).toContain('FILM1')
    expect(wrapper.find('.film-dialog > footer').exists()).toBe(true)
    access.film = false; await flushPromises()
    expect(wrapper.find('.film-dialog > footer').exists()).toBe(false)
  })
  it('首次明确拒绝允许调整，未知结果则冻结原请求重试；重试拒绝仍不能遗失未知交易', async () => {
    const wrapper = await render(); await store(wrapper)
    const rejected = { response: { status: 409, data: { success: false, code: 'FILM_STOCK_INSUFFICIENT', message: '服务店库存不足' } } }
    mocks.checkout.mockRejectedValueOnce(rejected)
    await start(wrapper).trigger('click'); await flushPromises()
    expect(start(wrapper).text()).toBe('确认免费贴膜')
    expect(wrapper.text()).toContain('服务店库存不足')
    mocks.checkout.mockRejectedValueOnce(new Error('网络中断'))
    await start(wrapper).trigger('click'); await flushPromises()
    const original = JSON.parse(JSON.stringify(mocks.checkout.mock.calls.at(-1)![0]))
    expect(start(wrapper).text()).toBe('重试原贴膜办理')
    expect(wrapper.findAll<HTMLInputElement>('.tf-form-layout input[type="radio"]').every(radio => radio.element.disabled)).toBe(true)
    await wrapper.get('.close').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    mocks.checkout.mockRejectedValueOnce(rejected)
    await start(wrapper).trigger('click'); await flushPromises()
    expect(start(wrapper).text()).toBe('重试原贴膜办理')
    await start(wrapper).trigger('click'); await flushPromises()
    expect(mocks.checkout.mock.calls.at(-1)![0]).toEqual(original)
    expect(mocks.success).toHaveBeenCalledOnce()
  })
  it('结果未知时切客或切手机不能重放到新上下文，回原记录后用原键核对', async () => {
    const wrapper = await render(); await store(wrapper)
    mocks.checkout.mockRejectedValueOnce(new Error('响应未知'))
    await start(wrapper).trigger('click'); await flushPromises()
    const original = JSON.parse(JSON.stringify(mocks.checkout.mock.calls[0][0]))
    await wrapper.setProps({ customer: { ...customer, id: 10 }, phoneId: 12 }); await flushPromises()
    expect(start(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('返回原客户的手机记录')
    await start(wrapper).trigger('click'); expect(mocks.checkout).toHaveBeenCalledOnce()
    await wrapper.setProps({ customer, phoneId: 11 }); await flushPromises()
    await start(wrapper).trigger('click'); await flushPromises()
    expect(mocks.checkout.mock.calls.at(-1)![0]).toEqual(original)
  })
  it('提交中防连点且关闭受控，撤权立即清理历史，迟到回执不恢复旧客数据', async () => {
    const wrapper = await render(); await store(wrapper)
    let resolveWrite: ((value: unknown) => void) | undefined
    mocks.checkout.mockImplementationOnce(() => new Promise(resolve => { resolveWrite = resolve }))
    await start(wrapper).trigger('click'); await start(wrapper).trigger('click')
    expect(mocks.checkout).toHaveBeenCalledOnce()
    expect(start(wrapper).text()).toBe('确认免费贴膜')
    expect(wrapper.findAll<HTMLInputElement>('.tf-form-layout input[type="radio"]').every(radio => radio.element.disabled)).toBe(true)
    access.film = false; await flushPromises()
    expect(wrapper.text()).not.toContain('FILM1')
    resolveWrite?.({ success: true, data: { order_id: 8, film_service_id: 10, paid_amount: 0 } }); await flushPromises()
    expect(wrapper.text()).not.toContain('FILM1')
    expect(mocks.context).toHaveBeenCalledOnce()
  })
  it('加载失败可重试，切客取消旧读请求；手机号隐藏仍可按当前手机关联读取且不展示', async () => {
    const wrapper = await render()
    mocks.context.mockRejectedValueOnce(new Error('临时故障'))
    await scrollHistoryToBottom(wrapper)
    expect(start(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('FILM1')
    const attempts = mocks.context.mock.calls.length
    await scrollHistoryToBottom(wrapper)
    expect(mocks.context).toHaveBeenCalledTimes(attempts)
    await wrapper.findAll('button').find(button => button.text() === '重试')!.trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('FILM2')
    let resolveOld: ((value: { success: boolean; data: FilmServiceContext }) => void) | undefined
    mocks.context.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    await scrollHistoryToBottom(wrapper)
    const signal = mocks.context.mock.calls.at(-1)![3] as AbortSignal
    await wrapper.setProps({ customer: { ...customer, id: 10 }, phoneId: 12 }); await flushPromises()
    expect(signal.aborted).toBe(true)
    resolveOld?.({ success: true, data: fixture(1, 9, 11) }); await flushPromises()
    await store(wrapper); await paid(wrapper); await start(wrapper).trigger('click'); await flushPromises()
    expect(wrapper.findComponent(Checkout).props('filmCustomerId')).toBe(10)
    const calls = mocks.context.mock.calls.length
    access.hidden.add('customer_info.customer_phone'); await flushPromises()
    expect(mocks.context.mock.calls.length).toBeGreaterThan(calls)
  })
  it('手机号字段初始隐藏时仍可办理当前手机，但弹窗不显示手机号', async () => {
    access.hidden.add('customer_info.customer_phone')
    const wrapper = await render()
    expect(wrapper.text()).not.toContain(customer.phone)
    expect(wrapper.text()).toContain('测试客户')
    expect(start(wrapper).attributes('disabled')).toBeDefined()
  })
  it('错误手机或客户响应拒绝使用，不能用不完整响应开放办理', async () => {
    mocks.context.mockResolvedValueOnce({ success: true, data: fixture(1, 9, 12) })
    const wrapper = await render()
    expect(start(wrapper).attributes('disabled')).toBeDefined()
    expect(mocks.checkout).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('FILM1')
  })
  it('可选字段撤权取消旧读并清除缓存显示，重授重新读取', async () => {
    const wrapper = await render()
    let resolveOld: ((value: { success: boolean; data: FilmServiceContext }) => void) | undefined
    mocks.context.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    await scrollHistoryToBottom(wrapper)
    const signal = mocks.context.mock.calls.at(-1)![3] as AbortSignal
    mocks.context.mockImplementationOnce(() => new Promise(() => undefined))
    access.hidden.add('stock_info.distribution'); await flushPromises()
    expect(signal.aborted).toBe(true)
    expect(wrapper.text()).not.toContain('服务二店')
    resolveOld?.({ success: true, data: fixture(2, 9, 11) }); await flushPromises()
    expect(wrapper.text()).not.toContain('FILM2')
    access.hidden.clear(); await flushPromises()
    expect(mocks.context).toHaveBeenLastCalledWith(9, 1, 10, expect.any(AbortSignal), 11)
    expect(wrapper.text()).toContain('服务二店')
  })

  it('没有记录显示零，数量字段隐藏时本机和总计只显示办理次数', async () => {
    const empty = fixture(1, 9, 11)
    Object.assign(empty, { service_count: 0, film_quantity: 0, device_service_count: 0, device_film_quantity: 0, data: [],
      free_count: 0, paid_count: 0,
      pagination: { ...empty.pagination, total: 0, total_pages: 0, has_next: false } })
    mocks.context.mockResolvedValueOnce({ success: true, data: empty })
    const wrapper = await render()
    expect(wrapper.text()).toContain('本机累计贴膜0 次 · 0 张')
    expect(wrapper.text()).toContain('累计总贴膜0 次 · 0 张')
    mocks.context.mockResolvedValueOnce({ success: true, data: { ...fixture(1, 9, 11), film_quantity: null, device_film_quantity: null } })
    access.hidden.add('stock_info.total_quantity'); await flushPromises()
    expect(wrapper.text()).toContain('本机累计贴膜3 次')
    expect(wrapper.text()).toContain('累计总贴膜21 次')
    expect(wrapper.text()).not.toContain(' 张')
    expect(wrapper.find('.film-dialog > footer').exists()).toBe(false)
  })

  it.each([
    { device_service_count: undefined }, { device_service_count: -1 }, { device_service_count: 22 },
    { device_film_quantity: undefined }, { device_film_quantity: 26 }, { film_quantity: null }
  ])('统计字段缺失或无效时拒绝误显为零并禁止办理：%j', async invalid => {
    mocks.context.mockResolvedValueOnce({ success: true, data: { ...fixture(1, 9, 11), ...invalid } })
    const wrapper = await render()
    expect(wrapper.text()).not.toContain('FILM1')
    expect(wrapper.text()).not.toContain('本机累计贴膜0 次')
    expect(start(wrapper).attributes('disabled')).toBeDefined()
  })
})
