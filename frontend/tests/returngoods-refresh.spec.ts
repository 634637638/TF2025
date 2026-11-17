import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ElTable, ElTableColumn } from 'element-plus'
import RecordDetailDialog from '@/components/RecordDetailDialog.vue'
import Returngoods from '@/views/system/page/Returngoods.vue'

const mocks = vi.hoisted(() => ({
  canEdit: false, canDelete: false, get: vi.fn(), clearCache: vi.fn(), success: vi.fn(), error: vi.fn()
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: mocks.get, clearCache: mocks.clearCache } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ success: mocks.success, error: mocks.error }) }))
vi.mock('@/utils/logger', () => ({ default: { error: vi.fn() }, logger: { error: vi.fn() } }))
vi.mock('@/composables', () => ({ useLoadingState: () => ({ loading: ref(false) }) }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: ref(true) }) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: ref(true), canEdit: ref(mocks.canEdit), canDelete: ref(mocks.canDelete), handleNoPermission: vi.fn()
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: vi.fn(), isFieldVisible: (_module: string, field: string) => ['record.product_info', 'record.refund_amount'].includes(field) },
  shouldShowActionColumn: (_visible: boolean, actions: boolean[]) => actions.some(Boolean)
}))
vi.mock('@/services/reference-options', () => ({ searchOperators: vi.fn().mockResolvedValue({ success: true, data: [] }) }))

const response = (model: string) => ({
  success: true,
  data: [{ id: 1, phone_id: 2, model }],
  pagination: { total: 1 }
})
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  mocks.get.mockResolvedValueOnce(response('原有设备'))
  const wrapper = mount(Returngoods, {
    global: {
      components: { ElTable, ElTableColumn, RecordDetailDialog },
      mocks: { $getNumberColumnWidth: () => 70, $getActionColumnWidth: () => 130 },
      stubs: { DataEmptyState: true, MobileDialog: true, RecordDetailDialog: true,
        ElInput: true, ElButton: true, ElForm: true, ElFormItem: true, ElSelect: true,
        ElOption: true, ElDatePicker: true, Pagination: true, UnifiedSearchPanel: true },
      directives: { 'tf-loading': {}, 'table-double-tap': {} }
    }
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => { mocks.get.mockReset(); mocks.canEdit = false; mocks.canDelete = false })
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.clearAllMocks()
})

describe('系统顶部调用退库列表刷新接口', () => {
  it('刷新接口显示新记录、只失效退库缓存，将结果提示交给父页面', async () => {
    const wrapper = await render()
    mocks.get.mockResolvedValueOnce(response('最新设备'))
    await wrapper.vm.reload()
    await flushPromises()

    expect(wrapper.text()).toContain('最新设备')
    expect(wrapper.text()).not.toContain('原有设备')
    expect(mocks.clearCache).toHaveBeenCalledExactlyOnceWith('/query/returngoods')
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('刷新中保留手机记录，失败向父页面传播且不重复提示', async () => {
    const wrapper = await render()
    let rejectRequest: (reason: Error) => void = () => {}
    mocks.get.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject }))
    const pendingReload = wrapper.vm.reload()
    const failure = expect(pendingReload).rejects.toThrow('模拟请求失败')
    await flushPromises()
    expect(wrapper.text()).toContain('原有设备')
    expect(mocks.get).toHaveBeenCalledTimes(2)

    rejectRequest(new Error('模拟请求失败'))
    await failure
    await flushPromises()
    expect(wrapper.text()).toContain('原有设备')
    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })
})


describe('联合退货凭据展示与动作保护', () => {
  it.each([
    { refund_amount: 120, collection_amount: 0, text: '整单退款' },
    { refund_amount: 0, collection_amount: 20, text: '整单补款' },
    { refund_amount: null, collection_amount: null, text: '-' }
  ])('保留手机原单信息并正确显示 $text，手机详情无编辑删除入口', async amounts => {
    mocks.canEdit = true; mocks.canDelete = true
    const wrapper = await render()
    mocks.get.mockResolvedValueOnce({ success: true, data: [{
      id: 'aftersale:1:6', record_source: 'sales_aftersale', phone_id: 2,
      original_sale_id: 21, model: '联合退货手机', ...amounts
    }], pagination: { total: 1 } })
    await wrapper.vm.reload(); await flushPromises()
    expect(wrapper.text()).toContain('联合退货手机')
    expect(wrapper.text()).toContain(amounts.text)
    const table = wrapper.findComponent(ElTable)
    const row = table.props('data')[0]
    table.vm.$emit('row-dblclick', row, null, new MouseEvent('dblclick'))
    await flushPromises()
    const detail = wrapper.findComponent(RecordDetailDialog)
    expect(detail.props('hasActions')).toBe(false)
  })
})
