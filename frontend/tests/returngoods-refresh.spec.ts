import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import Returngoods from '@/views/system/page/Returngoods.vue'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), clearCache: vi.fn(), success: vi.fn(), error: vi.fn()
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: mocks.get, clearCache: mocks.clearCache } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ success: mocks.success, error: mocks.error }) }))
vi.mock('@/utils/logger', () => ({ default: { error: vi.fn() }, logger: { error: vi.fn() } }))
vi.mock('@/composables', () => ({ useLoadingState: () => ({ loading: ref(false) }) }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: ref(true) }) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: ref(true), canEdit: ref(false), canDelete: ref(false), handleNoPermission: vi.fn()
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: vi.fn(), isFieldVisible: (_module: string, field: string) => field === 'record.product_info' },
  shouldShowActionColumn: () => false
}))
vi.mock('@/services/reference-options', () => ({ searchOperators: vi.fn().mockResolvedValue({ success: true, data: [] }) }))

const response = (model: string) => ({
  success: true,
  data: [{ id: 1, phone_id: 2, model }],
  pagination: { total: 1 }
})
const wrappers: ReturnType<typeof shallowMount>[] = []
const render = async () => {
  mocks.get.mockResolvedValueOnce(response('原有设备'))
  const wrapper = shallowMount(Returngoods, {
    global: {
      stubs: { DataEmptyState: true },
      directives: { 'tf-loading': {} }
    }
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => mocks.get.mockReset())
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
