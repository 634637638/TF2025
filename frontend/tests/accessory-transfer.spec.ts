import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElInputNumber, ElSelect, ElSwitch } from 'element-plus'
import AccessoryTransferModal from '@/components/AccessoryTransferModal.vue'
import AccessoryTransferHistory from '@/components/AccessoryTransferHistory.vue'
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), options: vi.fn(), success: vi.fn(), error: vi.fn(), transfer: true, hidden: new Set<string>() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/services/reference-options', () => ({ getAccessoryEntryOptions: mocks.options }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ hasPermission: () => mocks.transfer, requirePermission: () => mocks.transfer }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) } }))
const Dialog = { props: { modelValue: Boolean }, template: '<div><slot /><slot name="footer" /></div>' }
const Pagination = { props: { current: Number, total: Number }, emits: ['change'], template: '<button @click="$emit(\'change\', 2)">第二页</button>' }
const wrappers: ReturnType<typeof mount>[] = []
const scrollHandlers = new Map<HTMLElement, () => Promise<void>>()
const infiniteScroll = {
  mounted(element: HTMLElement, binding: { value: () => Promise<void> }) { scrollHandlers.set(element, binding.value) },
  unmounted(element: HTMLElement) { scrollHandlers.delete(element) }
}
const scrollSerials = async () => {
  const handler = scrollHandlers.values().next().value
  expect(handler).toBeDefined()
  await handler?.()
  await flushPromises()
}
const render = async (tracking = 0) => {
  const wrapper = mount(AccessoryTransferModal, { props: { modelValue: true, accessory: { id: 56, template_id: 55, name: '通用充电宝', serial_tracking: tracking } },
    global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog }, directives: { permission: {}, 'tf-loading': {}, 'infinite-scroll': infiniteScroll } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const button = (wrapper: Awaited<ReturnType<typeof render>>) => wrapper.findAll('button').find(item => item.text() === '确认划拨')!
const target = async (wrapper: Awaited<ReturnType<typeof render>>, id = 2) => { wrapper.findAllComponents(ElSelect)[1].vm.$emit('update:modelValue', id); await flushPromises() }
beforeEach(() => {
  mocks.transfer = true
  mocks.hidden.clear()
  mocks.options.mockResolvedValue({ data: { stores: [{ id: 1, name: '一店', status: 1 }, { id: 2, name: '二店', status: 1 }, { id: 3, name: '停用店', status: 0 }] } })
  mocks.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/stock') ? { stores: [{ store_id: 1, store_name: '一店', quantity: 50, plain_quantity: 48, serial_quantity: 2 }] } : { data: [{ serial_number: '00AA' }, { serial_number: '00BB' }], pagination: { total: 2 } } }))
  mocks.post.mockResolvedValue({ success: true })
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })
describe('配件跨店库存划拨', () => {
  it('普通库存按数量划拨，只显示启用授权店，自动选唯一来源，保留实际品牌商品身份', async () => {
    const wrapper = await render()
    expect(wrapper.findAllComponents(ElSelect)[0].props('modelValue')).toBe(1)
    expect(wrapper.text()).not.toContain('停用店')
    await target(wrapper)
    wrapper.findComponent(ElInputNumber).vm.$emit('update:modelValue', 20)
    await button(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/transfer', expect.objectContaining({ accessory_id: 56, from_store_id: 1, to_store_id: 2, quantity: 20, request_key: expect.stringMatching(/^[a-f0-9]{32}$/) }))
    expect(wrapper.emitted('success')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
  it('SN模式仅选实物并自动计数，库存查询限定来源店在库，普通及SN库存分别限制', async () => {
    const wrapper = await render(1)
    expect(wrapper.findComponent(ElInputNumber).exists()).toBe(false)
    expect(mocks.get).toHaveBeenCalledWith('/accessories/56/serials', expect.objectContaining({ params: expect.objectContaining({ stock_only: true, store_id: 1 }) }))
    await target(wrapper)
    const serials = wrapper.findAllComponents(ElSelect)[2]
    serials.vm.$emit('update:modelValue', ['00AA', '00BB'])
    await flushPromises()
    await button(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/transfer', expect.objectContaining({ quantity: 2, serial_numbers: ['00AA', '00BB'] }))
  })
  it('超过100件SN可滚动读完全部分页，选择后搜索仍保留回显，到末页不再请求', async () => {
    const serialRows = Array.from({ length: 125 }, (_, index) => ({ serial_number: `SN${String(index + 1).padStart(3, '0')}` }))
    mocks.get.mockImplementation(async (url: string, config: { params: { page: number; page_size: number; search: string } }) => {
      if (url.endsWith('/stock')) return { data: { stores: [{ store_id: 1, store_name: '一店', quantity: 125, plain_quantity: 0, serial_quantity: 125 }] } }
      const { page, page_size: pageSize, search } = config.params
      const matches = serialRows.filter(row => row.serial_number.includes(search))
      return { data: { data: matches.slice((page - 1) * pageSize, page * pageSize), pagination: { total: matches.length } } }
    })
    const wrapper = await render(1)
    const select = wrapper.findAllComponents(ElSelect)[2]
    select.vm.$emit('update:modelValue', ['SN001'])
    await flushPromises()
    for (let page = 2; page <= 7; page++) await scrollSerials()
    const optionLabels = () => select.findAllComponents({ name: 'ElOption' }).map(option => option.props('label'))
    expect(optionLabels()).toHaveLength(125)
    expect(optionLabels()).toContain('SN125')
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/56/serials', expect.objectContaining({ params: expect.objectContaining({ page: 7, page_size: 20 }) }))
    const calls = mocks.get.mock.calls.length
    await scrollSerials()
    expect(mocks.get).toHaveBeenCalledTimes(calls)
    await select.props('remoteMethod')?.('SN125')
    await flushPromises()
    expect(optionLabels()).toEqual(['SN001', 'SN125'])
    expect(select.props('modelValue')).toEqual(['SN001'])
    await target(wrapper)
    await button(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/transfer', expect.objectContaining({ quantity: 1, serial_numbers: ['SN001'] }))
  })
  it('下一页失败保留已读和已选SN，重新打开下拉重试原页，不跳页或自动重复请求', async () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({ serial_number: `SN${index + 1}` }))
    mocks.get.mockImplementation(async (url: string) => ({ data: url.endsWith('/stock')
      ? { stores: [{ store_id: 1, store_name: '一店', quantity: 21, serial_quantity: 21 }] }
      : { data: rows, pagination: { total: 21 } } }))
    const wrapper = await render(1)
    const select = wrapper.findAllComponents(ElSelect)[2]
    select.vm.$emit('update:modelValue', ['SN1'])
    mocks.get.mockRejectedValueOnce(new Error('network'))
    await scrollSerials()
    expect(mocks.error).toHaveBeenCalledTimes(1)
    expect(select.findAllComponents({ name: 'ElOption' })).toHaveLength(20)
    expect(select.props('modelValue')).toEqual(['SN1'])
    const calls = mocks.get.mock.calls.length
    await scrollSerials()
    expect(mocks.get).toHaveBeenCalledTimes(calls)
    mocks.get.mockResolvedValueOnce({ data: { data: [{ serial_number: 'SN21' }], pagination: { total: 21 } } })
    select.vm.$emit('visible-change', true)
    await flushPromises()
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/56/serials', expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }))
    expect(select.findAllComponents({ name: 'ElOption' })).toHaveLength(21)
  })
  it('重复滚动只读一次，搜索词变化取消旧分页，迟到响应不能混入新结果', async () => {
    const wrapper = await render(1)
    const select = wrapper.findAllComponents(ElSelect)[2]
    let resolveOld: ((value: unknown) => void) | undefined
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const oldSearch = select.props('remoteMethod')?.('old')
    const signal = mocks.get.mock.calls.at(-1)?.[1].signal as AbortSignal
    mocks.get.mockResolvedValueOnce({ data: { data: [{ serial_number: 'NEW' }], pagination: { total: 2 } } })
    await select.props('remoteMethod')?.('new')
    expect(signal.aborted).toBe(true)
    resolveOld?.({ data: { data: [{ serial_number: 'OLD' }], pagination: { total: 1 } } })
    await oldSearch
    await flushPromises()
    expect(select.findAllComponents({ name: 'ElOption' }).map(option => option.props('label'))).toEqual(['NEW'])
    let resolvePage: ((value: unknown) => void) | undefined
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolvePage = resolve }))
    const page = scrollSerials()
    await flushPromises()
    const calls = mocks.get.mock.calls.length
    await scrollSerials()
    expect(mocks.get).toHaveBeenCalledTimes(calls)
    resolvePage?.({ data: { data: [{ serial_number: 'NEW2' }], pagination: { total: 2 } } })
    await page
    expect(select.findAllComponents({ name: 'ElOption' }).map(option => option.props('label'))).toEqual(['NEW', 'NEW2'])
  })
  it('更换来源店或关闭时取消SN请求并清空选择，迟到响应不得恢复旧店SN', async () => {
    const wrapper = await render(1)
    const select = wrapper.findAllComponents(ElSelect)[2]
    select.vm.$emit('update:modelValue', ['00AA'])
    let resolveOld: ((value: unknown) => void) | undefined
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const oldSearch = select.props('remoteMethod')?.('old')
    const signal = mocks.get.mock.calls.at(-1)?.[1].signal as AbortSignal
    const source = wrapper.findAllComponents(ElSelect)[0]
    source.vm.$emit('update:modelValue', 2)
    source.vm.$emit('change', 2)
    await flushPromises()
    expect(signal.aborted).toBe(true)
    expect(select.props('modelValue')).toEqual([])
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/56/serials', expect.objectContaining({ params: expect.objectContaining({ store_id: 2, search: '', page: 1 }) }))
    await wrapper.setProps({ modelValue: false })
    resolveOld?.({ data: { data: [{ serial_number: 'OLD' }], pagination: { total: 1 } } })
    await oldSearch
    await flushPromises()
    expect(select.findAllComponents({ name: 'ElOption' })).toHaveLength(0)
    expect(select.props('modelValue')).toEqual([])
  })
  it('失败保留草稿和请求标识；重复点击提交时只发一次', async () => {
    const wrapper = await render()
    await target(wrapper)
    mocks.post.mockRejectedValueOnce(new Error('network'))
    await button(wrapper).trigger('click')
    await flushPromises()
    const key = mocks.post.mock.calls[0][1].request_key
    expect(wrapper.emitted('success')).toBeUndefined()
    let resolve: ((value: { success: boolean }) => void) | undefined
    mocks.post.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    await button(wrapper).trigger('click')
    await button(wrapper).trigger('click')
    expect(mocks.post).toHaveBeenCalledTimes(2)
    expect(mocks.post.mock.calls[1][1].request_key).toBe(key)
    resolve?.({ success: true })
    await flushPromises()
    expect(wrapper.emitted('success')).toHaveLength(1)
  })
  it('来源等于接收或数量超出普通库存时禁止提交，可切换本次SN模式', async () => {
    const wrapper = await render()
    await target(wrapper, 1)
    expect(button(wrapper).attributes('disabled')).toBeDefined()
    await target(wrapper)
    wrapper.findComponent(ElInputNumber).vm.$emit('update:modelValue', 49)
    await flushPromises()
    expect(wrapper.findComponent(ElInputNumber).props('modelValue')).toBe(48)
    expect(wrapper.findComponent(ElInputNumber).props('max')).toBe(48)
    wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', true)
    wrapper.findComponent(ElSwitch).vm.$emit('change', true)
    await flushPromises()
    expect(wrapper.findComponent(ElInputNumber).exists()).toBe(false)
  })
  it.each(['stock_info.distribution', 'stock_info.total_quantity', 'basic_info.name'])('隐藏必要字段%s不读取库存或提交', async field => {
    mocks.hidden.add(field)
    const wrapper = await render()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(button(wrapper).attributes('disabled')).toBeDefined()
  })
  it('无独立划拨权限不查询，关闭后旧响应不能覆盖新商品', async () => {
    mocks.transfer = false
    const wrapper = await render()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(button(wrapper).attributes('disabled')).toBeDefined()
    mocks.transfer = true
    let old: ((value: unknown) => void) | undefined
    mocks.get.mockImplementationOnce(() => new Promise(done => { old = done }))
    await wrapper.setProps({ accessory: { id: 57, name: '新商品' } })
    await wrapper.setProps({ modelValue: false })
    old?.({ data: { stores: [{ store_id: 99, quantity: 100 }] } })
    await flushPromises()
    expect(wrapper.findAllComponents(ElSelect)[0].props('modelValue')).toBeNull()
  })
  it('历史分页读取禁用缓存，隐藏店铺不查询', async () => {
    mocks.get.mockResolvedValue({ data: { data: [], pagination: { total: 21 } } })
    const wrapper = mount(AccessoryTransferHistory, { props: { accessoryId: 56 }, global: { plugins: [ElementPlus], mocks: { $getNumberColumnWidth: () => 72 }, stubs: { Pagination, DataEmptyState: true }, directives: { 'tf-loading': {} } } })
    wrappers.push(wrapper)
    await flushPromises()
    wrapper.findComponent(Pagination).vm.$emit('change', 2)
    await flushPromises()
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/56/transfers', expect.objectContaining({ params: { page: 2, page_size: 20 }, useCache: false }))
    mocks.hidden.add('stock_info.distribution')
    mocks.get.mockClear()
    await wrapper.setProps({ accessoryId: 57 })
    await flushPromises()
    expect(mocks.get).not.toHaveBeenCalled()
  })
})
