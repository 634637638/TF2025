import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import AccessorySerialPanel from '@/components/AccessorySerialPanel.vue'

const mocks = vi.hoisted(() => ({ get: vi.fn(), hidden: new Set<string>() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: mocks.get } }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field)
} }))
const PaginationStub = defineComponent({ props: { current: { type: Number, default: 1 }, total: { type: Number, default: 0 } }, emits: ['current-change', 'size-change'], template: '<div class="pagination">{{ total }}</div>' })
const wrappers: ReturnType<typeof mount>[] = []
const render = () => {
  const wrapper = mount(AccessorySerialPanel, { props: { accessoryId: 5 }, global: {
    plugins: [ElementPlus], stubs: { Pagination: PaginationStub, DataEmptyState: true }, directives: { 'tf-loading': {} }
  } })
  wrappers.push(wrapper)
  return wrapper
}
const result = (serial = '00AA', total = 1) => ({ data: { data: [{ id: 1, accessory_id: 5, serial_number: serial, status: 'gifted', store_name: '门店A', customer_name: '顾客', customer_phone: '13800138000', inventory_time: '2026-11-12 15:00:00', sale_time: '2026-11-12 16:00:00' }], pagination: { total } } })
beforeEach(() => { mocks.hidden.clear(); mocks.get.mockReset(); mocks.get.mockResolvedValue(result()) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

describe('配件SN查询', () => {
  it('展示SN、赠送状态和客户，支持检索及分页', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('00AA')
    expect(wrapper.text()).toContain('已赠送')
    expect(wrapper.text()).toContain('顾客')
    wrapper.findComponent(PaginationStub).vm.$emit('current-change', 2)
    await flushPromises()
    expect(mocks.get.mock.calls.at(-1)?.[1].params.page).toBe(2)
    await wrapper.get('input').setValue('00BB')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.get.mock.calls.at(-1)?.[1].params).toEqual({ search: '00BB', page: 1, page_size: 20 })
  })

  it('切换商品后忽略旧响应，并取消旧请求', async () => {
    let resolveOld!: (value: ReturnType<typeof result>) => void
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const wrapper = render()
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal
    await wrapper.setProps({ accessoryId: 6 })
    await flushPromises()
    resolveOld(result('STALE', 500))
    await flushPromises()
    expect(signal.aborted).toBe(true)
    expect(wrapper.text()).not.toContain('STALE')
    expect(wrapper.text()).toContain('00AA')
  })

  it('隐藏SN时不请求，隐藏客户字段时不渲染对应列', async () => {
    mocks.hidden.add('basic_info.serial_number')
    const hidden = render()
    await flushPromises()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(hidden.find('section').exists()).toBe(false)
    mocks.hidden.clear()
    mocks.hidden.add('customer_info.customer_phone')
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).not.toContain('13800138000')
    expect(wrapper.text()).not.toContain('客户手机号')
  })

  it('接口故障显示失败并允许重试，不把失败当作空结果', async () => {
    mocks.get.mockRejectedValueOnce(new Error('network'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('SN明细加载失败')
    await wrapper.findAll('button').find(button => button.text() === '刷新')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('00AA')
    expect(wrapper.text()).not.toContain('SN明细加载失败')
  })
})
