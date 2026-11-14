import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Panel from '@/views/payments/page/AccessoryPurchaseReturnContext.vue'
import RecordDetailDialog from '@/components/RecordDetailDialog.vue'
import RecordDescriptions from '@/components/RecordDescriptions.vue'
import type { AccessoryPurchaseReturnContext, AccessoryPurchaseReturnQuote } from '@/types/accessory'

const mocks = vi.hoisted(() => ({ get: vi.fn(), quote: vi.fn(), post: vi.fn() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { post: mocks.post } }))
vi.mock('@/api/accessory-purchases', () => ({ getAccessoryPurchaseReturnContext: mocks.get, quoteAccessoryPurchaseReturn: mocks.quote }))
const access = reactive({ purchase: true, inventory: true, mobile: false, hidden: new Set<string>() })
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({ canView: computed(() => module === 'accessories' ? access.inventory : access.purchase) }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { permissions: ref({}), isFieldVisible: (_module: string, key: string) => !access.hidden.has(key) } }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => access.mobile) }) }))
const Dialog = { props: ['modelValue'], template: '<div v-if="modelValue" class="dialog"><slot /></div>' }
const Pagination = { props: ['current', 'total'], emits: ['change'], template: '<div class="pagination" />' }
const Empty = { props: ['title', 'description', 'actionText'], emits: ['action'], template: '<div>{{ title }}{{ description }}<button v-if="actionText" @click="$emit(\'action\')">{{ actionText }}</button></div>' }
const result = (id = 8, page = 1, total = 21): { success: boolean; data: AccessoryPurchaseReturnContext } => ({ success: true, data: {
  purchase: { id, has_snapshot: false, name: `采购商品${id}`, batch_no: 'ORIGINAL-8', supplier_id: 3, supplier_name: '原供应商', store_id: 1,
    store_name: '原一店', quantity: 50, purchase_cost: '12.50', total_amount: '625.00', paid_amount: 625, unpaid_amount: 0, payment_status: 'paid' },
  ledger_status: 'verified', current_quantity: 30,
  serials: { data: [{ id: 91, serial_number: '000ABC', store_id: 2, store_name: '当前二店' }],
    pagination: { page: 1, page_size: 20, total: 1, total_pages: 1, has_next: false, has_prev: false } },
  data: Array.from({ length: Math.max(0, Math.min(20, total - (page - 1) * 20)) }, (_, index) => ({ row_key: `event:${(page - 1) * 20 + index + 1}`,
    store_id: 2, store_name: '当前二店', quantity: 1, purchase_cost: '12.50', usage_type: 'sale', serial_tracking: index % 2 })),
  pagination: { page, page_size: 20, total, total_pages: Math.ceil(total / 20), has_next: page * 20 < total, has_prev: page > 1 }
} })
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  const wrapper = mount(Panel, { props: { visible: true, purchaseId: 8 }, global: { plugins: [ElementPlus],
    components: { RecordDetailDialog, RecordDescriptions }, stubs: { MobileDialog: Dialog, Pagination, DataEmptyState: Empty, SectionLoading: true },
    directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
beforeEach(() => {
  mocks.quote.mockReset()
  access.purchase = access.inventory = true; access.mobile = false; access.hidden.clear()
  mocks.get.mockImplementation(async (id: number, page: number) => {
    const data = result(id, page)
    if (access.hidden.has('basic_info.serial_number')) data.data.serials = null
    return data
  })
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })
const button = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find(item => item.text() === text)!

it('核对原单整批金额与当前原批次余额分别显示；普通和SN分页查看且无退供提交', async () => {
  const wrapper = await render()
  for (const text of ['原供应商', '原一店', '当前二店', '625', '30 件', 'SN逐件', '普通数量', '收费', '本页仅核对']) expect(wrapper.text()).toContain(text)
  expect(mocks.get).toHaveBeenCalledWith(8, 1, 20, expect.any(AbortSignal), { page: 1, search: '' })
  expect(wrapper.findAll('button').some(item => /提交|退款|退供确认/.test(item.text()))).toBe(false)
  wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith(8, 2, 20, expect.any(AbortSignal), { page: 1, search: '' })
})

it('退供核对名称区分入库时资料及旧单当前档案，不根据名称猜快照', async () => {
  const data = result(); data.data.purchase.has_snapshot = true
  mocks.get.mockResolvedValue(data)
  const wrapper = await render()
  expect(wrapper.text()).toContain('商品名称（入库时）')
  expect(wrapper.text()).not.toContain('商品名称（当前档案）')
})

it('退供核对缺少快照来源标记拒绝继续试算', async () => {
  const data = result()
  Reflect.deleteProperty(data.data.purchase, 'has_snapshot')
  mocks.get.mockResolvedValue(data)
  const wrapper = await render()
  expect(wrapper.text()).toContain('退供核对失败')
  expect(wrapper.text()).not.toContain('原供应商')
})

it('历史缺流水保留未知，不把无原批次认成零库存或可退零件', async () => {
  const data = result(8, 1, 0); data.data.ledger_status = 'untracked'; data.data.current_quantity = null
  data.data.serials = null
  mocks.get.mockResolvedValue(data)
  const wrapper = await render()
  expect(wrapper.text()).toContain('无法确认可退数量')
  expect(wrapper.text()).not.toContain('剩余 0 件')
  expect(wrapper.findComponent(Pagination).exists()).toBe(false)
})

it('任一必要权限或字段缺失均不读取，开启中的撤权取消请求并清除旧数据', async () => {
  for (const field of ['payment.purchase_cost', 'purchase.quantity', 'stock_info.distribution', 'stock_info.total_quantity']) {
    access.hidden.add(field); mocks.get.mockClear()
    const wrapper = await render()
    expect(mocks.get).not.toHaveBeenCalled(); expect(wrapper.find('.dialog').exists()).toBe(false)
    access.hidden.delete(field); wrapper.unmount()
  }
  const wrapper = await render()
  const signal: AbortSignal = mocks.get.mock.calls.at(-1)![3]
  access.inventory = false; await flushPromises()
  expect(signal.aborted).toBe(true)
  expect(wrapper.text()).not.toContain('原供应商')
  expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  access.inventory = true; access.purchase = false; mocks.get.mockClear(); await render()
  expect(mocks.get).not.toHaveBeenCalled()
})

it('切换原单与关闭取消在途请求，迟到旧单不覆盖当前核对，卸载释放请求', async () => {
  let finish: ((value: ReturnType<typeof result>) => void) | undefined
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const wrapper = await render(), oldSignal: AbortSignal = mocks.get.mock.calls[0][3]
  await wrapper.setProps({ purchaseId: 9 }); await flushPromises()
  expect(oldSignal.aborted).toBe(true)
  finish?.(result(8)); await flushPromises()
  expect(wrapper.text()).toContain('采购商品9'); expect(wrapper.text()).not.toContain('采购商品8')
  const signal: AbortSignal = mocks.get.mock.calls.at(-1)![3]
  await wrapper.setProps({ visible: false }); expect(signal.aborted).toBe(true)
  await wrapper.setProps({ visible: true }); await flushPromises()
  const last: AbortSignal = mocks.get.mock.calls.at(-1)![3]
  wrapper.unmount(); expect(last.aborted).toBe(true)
})

it('错误、错误原单及不完整分页不展示旧库存，允许重试且不当作空记录', async () => {
  const wrapper = await render()
  for (const data of [new Error('读取失败'), { success: true }, result(9), result(8, 2)]) {
    if (data instanceof Error) mocks.get.mockRejectedValueOnce(data)
    else mocks.get.mockResolvedValueOnce(data)
    await button(wrapper, '重新核对').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('退供核对失败'); expect(wrapper.text()).not.toContain('当前二店')
    expect(wrapper.text()).not.toContain('暂无剩余库存')
  }
  await button(wrapper, '重试').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('当前二店')
})

it('分页因并发出库消失时回到有效页重读，手机双击明细及敏感字段受同一权限控制', async () => {
  access.mobile = true
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce(result(8, 2, 1))
  wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith(8, 1, 20, expect.any(AbortSignal), { page: 1, search: '' })
  await wrapper.find('.el-table__body tbody tr').trigger('dblclick'); await flushPromises()
  expect(wrapper.findComponent(RecordDetailDialog).props('modelValue')).toBe(true)
  access.hidden.add('basic_info.serial_tracking'); access.hidden.add('basic_info.usage_type'); access.hidden.add('price_info.purchase_cost')
  await flushPromises()
  expect(wrapper.text()).not.toContain('SN逐件'); expect(wrapper.text()).not.toContain('管理方式')
  expect(wrapper.findComponent(RecordDetailDialog).props('fields').filter((field: { visible: boolean }) => field.visible).some((field: { key: string }) => field.key === 'purchase_cost')).toBe(false)
})

it('SN独立分页和字面搜索只读取当前采购，搜索回首页且不改原批次数量', async () => {
  mocks.get.mockImplementation(async (id: number, page: number, _size: number, _signal: AbortSignal, serials: { page: number; search: string }) => {
    const data = result(id, page), total = serials.search ? 1 : 21
    data.data.serials = { data: Array.from({ length: Math.min(20, total - (serials.page - 1) * 20) }, (_, index) => ({
      id: (serials.page - 1) * 20 + index + 1, serial_number: serials.search || `000SN${(serials.page - 1) * 20 + index}`, store_id: 2, store_name: '当前二店'
    })), pagination: { page: serials.page, page_size: 20, total, total_pages: Math.ceil(total / 20), has_next: serials.page * 20 < total, has_prev: serials.page > 1 } }
    return data
  })
  const wrapper = await render()
  expect(wrapper.findAll('.el-table')).toHaveLength(2)
  wrapper.findAllComponents(Pagination)[1].vm.$emit('change', 2); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith(8, 1, 20, expect.any(AbortSignal), { page: 2, search: '' })
  expect(wrapper.text()).toContain('000SN20')
  await wrapper.find('input[placeholder="检索本批次在库SN"]').setValue(' 00%_A ')
  await button(wrapper, '搜索SN').trigger('click'); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith(8, 1, 20, expect.any(AbortSignal), { page: 1, search: '00%_A' })
  expect(wrapper.text()).toContain('00%_A'); expect(wrapper.text()).toContain('30 件')
})

it('SN手机详情显示前导零及当前店，撤销SN字段权限后清空详情、检索和在途请求', async () => {
  access.mobile = true
  const wrapper = await render()
  await wrapper.findAll('.el-table')[1].find('.el-table__body tbody tr').trigger('dblclick'); await flushPromises()
  const detail = wrapper.findAllComponents(RecordDetailDialog)[1]
  expect(detail.props('modelValue')).toBe(true)
  expect(detail.text()).toContain('000ABC'); expect(detail.text()).toContain('当前二店')
  const signal: AbortSignal = mocks.get.mock.calls.at(-1)![3]
  access.hidden.add('basic_info.serial_number'); await flushPromises()
  expect(signal.aborted).toBe(true); expect(wrapper.text()).not.toContain('000ABC')
  expect(detail.props('modelValue')).toBe(false)
  expect(wrapper.find('input[placeholder="检索本批次在库SN"]').exists()).toBe(false)
  expect(mocks.get).toHaveBeenLastCalledWith(8, 1, 20, expect.any(AbortSignal), undefined)
})

it('SN响应缺失、重复或分页数量错误时不能显示为已核对，恢复后允许重试', async () => {
  const wrapper = await render()
  for (const reason of ['missing', 'duplicate', 'page', 'count', 'store']) {
    const data = result()
    if (reason === 'missing') data.data.serials = null
    else if (data.data.serials) {
      if (reason === 'duplicate') data.data.serials.data.push(data.data.serials.data[0])
      if (reason === 'page') data.data.serials.pagination.page = 2
      if (reason === 'count') data.data.serials.pagination.total = 2
      if (reason === 'store') data.data.serials.data[0].store_id = null
    }
    mocks.get.mockResolvedValueOnce(data)
    await button(wrapper, '重新核对').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('退供核对失败'); expect(wrapper.text()).not.toContain('000ABC')
  }
  await button(wrapper, '重试').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('000ABC')
})

it('SN末页因售出消失时回有效页，迟到检索结果不得覆盖新采购单', async () => {
  const wrapper = await render()
  const page2 = result(); page2.data.serials!.data = []; page2.data.serials!.pagination.page = 2
  mocks.get.mockResolvedValueOnce(page2)
  wrapper.findAllComponents(Pagination)[1].vm.$emit('change', 2); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith(8, 1, 20, expect.any(AbortSignal), { page: 1, search: '' })
  let finish: ((value: ReturnType<typeof result>) => void) | undefined
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await wrapper.find('input[placeholder="检索本批次在库SN"]').setValue('旧SN')
  await wrapper.find('input[placeholder="检索本批次在库SN"]').trigger('keyup.enter')
  const signal: AbortSignal = mocks.get.mock.calls.at(-1)![3]
  await wrapper.setProps({ purchaseId: 9 }); await flushPromises()
  expect(signal.aborted).toBe(true)
  const old = result(); old.data.serials!.data[0].serial_number = '旧SN'
  finish?.(old); await flushPromises()
  expect(wrapper.text()).toContain('采购商品9'); expect(wrapper.text()).not.toContain('旧SN')
  expect(wrapper.find('input[placeholder="检索本批次在库SN"]').element).toHaveProperty('value', '')
})

const quoted = (extra: Partial<AccessoryPurchaseReturnQuote> = {}) => ({ success: true, data: {
  purchase_id: 8, quantity: 2, purchase_cost: 12.5, total_amount: 25, payment_status: 'paid', latest_event_id: 1, preview_only: true,
  data: [
    { row_key: 'event:1', store_id: 2, store_name: '当前二店', quantity: 1, usage_type: 'sale', serial_tracking: 0, serial_numbers: [] },
    { row_key: 'event:2', store_id: 2, store_name: '当前二店', quantity: 1, usage_type: 'sale', serial_tracking: 1, serial_numbers: ['000ABC'] }
  ], ...extra
} satisfies AccessoryPurchaseReturnQuote })
const selectOrdinary = async (wrapper: ReturnType<typeof mount>) => {
  const field = wrapper.find('input[role="spinbutton"]')
  await field.setValue('1'); await field.trigger('change'); await flushPromises()
}
const selectSN = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.find('input[type="checkbox"]').setValue(true); await flushPromises()
}

it('普通批次与SN选择后服务端按原价试算，提交仅包含原批次、数量和逐件ID', async () => {
  mocks.quote.mockResolvedValue(quoted())
  const wrapper = await render()
  expect(button(wrapper, '按原采购价试算').attributes('disabled')).toBeDefined()
  await selectOrdinary(wrapper); await selectSN(wrapper)
  await button(wrapper, '按原采购价试算').trigger('click'); await flushPromises()
  expect(mocks.quote).toHaveBeenCalledWith(8, { batches: [{ row_key: 'event:1', quantity: 1 }], serial_ids: [91] }, expect.any(AbortSignal))
  expect(wrapper.text()).toContain('原采购价试算金额'); expect(wrapper.text()).toContain('¥25')
  expect(wrapper.text()).toContain('仅为原采购价试算'); expect(wrapper.find('[role="status"]').text()).toContain('000ABC')
  await button(wrapper, '清空选择').trigger('click'); await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
  expect(button(wrapper, '按原采购价试算').attributes('disabled')).toBeDefined()
})

it('批次和SN跨页保留选择，重读使旧试算失效，重新核对则清空草稿', async () => {
  mocks.quote.mockResolvedValue(quoted({ quantity: 1, total_amount: 12.5, data: quoted().data.data.slice(0, 1) }))
  const wrapper = await render(); await selectOrdinary(wrapper)
  await button(wrapper, '按原采购价试算').trigger('click'); await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
  wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
  expect(wrapper.text()).toContain('已选普通批次 1 条')
  await selectOrdinary(wrapper); await selectSN(wrapper)
  await button(wrapper, '按原采购价试算').trigger('click'); await flushPromises()
  expect(mocks.quote.mock.calls.at(-1)![1]).toEqual({ batches: [{ row_key: 'event:1', quantity: 1 }, { row_key: 'event:21', quantity: 1 }], serial_ids: [91] })
  await button(wrapper, '重新核对').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('已选普通批次 0 条、SN 0 件')
})

it('草稿变更取消试算且旧响应不能恢复结果，关闭、换单与撤权同样清理', async () => {
  let finish: ((value: ReturnType<typeof quoted>) => void) | undefined
  mocks.quote.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const wrapper = await render(); await selectOrdinary(wrapper); await selectSN(wrapper)
  await button(wrapper, '按原采购价试算').trigger('click')
  const signal: AbortSignal = mocks.quote.mock.calls[0][2]
  await button(wrapper, '清空选择').trigger('click'); expect(signal.aborted).toBe(true)
  finish?.(quoted()); await flushPromises(); expect(wrapper.find('[role="status"]').exists()).toBe(false)
  mocks.quote.mockResolvedValue(quoted())
  for (const reason of ['close', 'purchase', 'permission']) {
    await selectOrdinary(wrapper); await selectSN(wrapper)
    await button(wrapper, '按原采购价试算').trigger('click'); await flushPromises()
    const current: AbortSignal = mocks.quote.mock.calls.at(-1)![2]
    if (reason === 'close') await wrapper.setProps({ visible: false })
    if (reason === 'purchase') await wrapper.setProps({ purchaseId: 9 })
    if (reason === 'permission') access.hidden.add('basic_info.usage_type')
    await flushPromises(); expect(current.aborted).toBe(true)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    if (reason === 'close') { await wrapper.setProps({ visible: true }); await flushPromises() }
  }
})

it('试算错误或金额/原单/SN响应不一致不显示金额，失败保留选择可重试', async () => {
  const wrapper = await render(); await selectOrdinary(wrapper); await selectSN(wrapper)
  for (const value of [new Error('库存改变'), quoted({ purchase_id: 9 }), quoted({ total_amount: 26 }), { success: true, data: { ...quoted().data, preview_only: false } },
    quoted({ data: [{ ...quoted().data.data[1], quantity: 2, serial_numbers: ['000ABC', 'OTHER'] }] })]) {
    if (value instanceof Error) mocks.quote.mockRejectedValueOnce(value)
    else mocks.quote.mockResolvedValueOnce(value)
    await button(wrapper, '按原采购价试算').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('退供试算失败'); expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('已选普通批次 1 条、SN 1 件')
  }
  mocks.quote.mockResolvedValueOnce(quoted())
  await button(wrapper, '重试试算').trigger('click'); await flushPromises()
  expect(wrapper.find('[role="status"]').text()).toContain('¥25')
})

it('必要库存字段隐藏不提供选择或试算；SN隐藏仍允许普通试算，手机可操作', async () => {
  access.mobile = true
  for (const field of ['price_info.purchase_cost', 'basic_info.usage_type', 'basic_info.serial_tracking']) {
    access.hidden.add(field)
    const wrapper = await render()
    expect(wrapper.find('input[role="spinbutton"]').exists()).toBe(false)
    expect(wrapper.findAll('button').some(item => item.text() === '按原采购价试算')).toBe(false)
    access.hidden.delete(field); wrapper.unmount()
  }
  access.hidden.add('basic_info.serial_number')
  const wrapper = await render(); await selectOrdinary(wrapper)
  mocks.quote.mockResolvedValue(quoted({ quantity: 1, total_amount: 12.5, data: quoted().data.data.slice(0, 1) }))
  await button(wrapper, '按原采购价试算').trigger('click'); await flushPromises()
  expect(mocks.quote.mock.calls.at(-1)![1].serial_ids).toEqual([])
  expect(wrapper.find('[role="status"]').text()).toContain('¥12.5')
})

it('退供试算API复用统一实例且关闭写请求自动缓存失效，不产生真实库存操作', async () => {
  const api = await vi.importActual<typeof import('@/api/accessory-purchases')>('@/api/accessory-purchases')
  const input = { batches: [{ row_key: 'event:1', quantity: 1 }], serial_ids: [] }, signal = new AbortController().signal
  await api.quoteAccessoryPurchaseReturn(8, input, signal)
  expect(mocks.post).toHaveBeenCalledWith('/supplier-payments/accessory-purchases/8/return/quote', input,
    expect.objectContaining({ signal, cacheInvalidationScope: false, useCache: false, showLoading: false, showError: false }))
})
