import { computed, defineComponent, h, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import PermissionsView from '@/views/permissions/PermissionsView.vue'
import { usePermissionsPageContext, type PermissionsPageContext } from '@/views/permissions/page/context'
import { vPermission } from '@/directives/permission'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), delete: vi.fn(), confirm: vi.fn(), success: vi.fn(), warning: vi.fn(),
  error: vi.fn(), handleApiError: vi.fn(),
  auth: { userPermissions: ['permissions_permissionsview:view', 'permissions_permissionsview:delete'], isAuthenticated: true, isActive: true }
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/composables/usePagePermissions', () => ({
  usePagePermissions: () => ({
    canView: computed(() => true), canCreate: computed(() => false), canEdit: computed(() => false),
    canDelete: computed(() => mocks.auth.userPermissions.includes('permissions_permissionsview:delete'))
  })
}))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: vi.fn(), isFieldVisible: () => true }, shouldShowActionColumn: () => true
}))
vi.mock('@/composables', () => ({ useLoadingState: () => ({ loading: computed(() => false) }) }))
vi.mock('@/composables/useRefreshData', () => ({ useRefreshData: () => ({ refreshing: computed(() => false), refresh: vi.fn() }) }))
vi.mock('@/composables/useImportExport', () => ({ useImportExport: () => ({ exportTextFile: vi.fn(), buildDateFilename: vi.fn() }) }))

const ButtonStub = {
  props: { disabled: Boolean, loading: Boolean }, emits: ['click'],
  template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>'
}
const SlotStub = { template: '<div><slot /><slot name="actions" /></div>' }
let context: PermissionsPageContext
const LogsStub = defineComponent({
  setup() {
    context = usePermissionsPageContext()
    return () => h('div', context.paginatedLogs.map(log => log.id).join(','))
  }
})
const wrappers: ReturnType<typeof shallowMount>[] = []
const button = (wrapper: ReturnType<typeof shallowMount>, label: string) => wrapper.findAll('button').find(item => item.text() === label)!
const logResponse = (ids = [1, 2], total = ids.length) => ({ success: true, data: { logs: ids.map(id => ({ id })), pagination: { total } } })
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const render = async () => {
  const wrapper = shallowMount(PermissionsView, {
    global: {
      directives: { permission: vPermission },
      stubs: { ElButton: ButtonStub, PageHeader: SlotStub, PermissionGate: SlotStub, LogsPage: LogsStub }
    }
  })
  wrappers.push(wrapper)
  await flushPromises()
  await button(wrapper, '权限日志').trigger('click')
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mocks.auth = reactive({ userPermissions: ['permissions_permissionsview:view', 'permissions_permissionsview:delete'], isAuthenticated: true, isActive: true })
  mocks.get.mockImplementation(async (url: string) => url === '/permission-logs/logs'
    ? logResponse() : { success: true, data: { roles: [], modules: [], pagination: { total: 0 } } })
  mocks.delete.mockResolvedValue({ success: true, data: { deleted_count: 2 } })
  mocks.confirm.mockResolvedValue(true)
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.resetAllMocks()
})

describe('权限日志全量清空交互', () => {
  it('取消确认不发送删除且保留日志', async () => {
    mocks.confirm.mockResolvedValue(false)
    const wrapper = await render()
    await button(wrapper, '清空日志').trigger('click')
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining('筛选范围外'), '清空权限日志', expect.any(Object))
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(context.paginatedLogs).toHaveLength(2)
    expect(button(wrapper, '清空日志').attributes('disabled')).toBeUndefined()
  })

  it('清空不带筛选条件，成功后回第一页重新读取，确认和请求期间阻止重复提交', async () => {
    const confirmation = deferred<boolean>()
    mocks.confirm.mockReturnValue(confirmation.promise)
    const wrapper = await render()
    context.logsPagination.page = 3
    context.logSearchForm.username = '筛选用户'
    await button(wrapper, '清空日志').trigger('click')
    await button(wrapper, '清空日志').trigger('click')
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(mocks.delete).not.toHaveBeenCalled()
    const deletion = deferred<{ success: boolean }>()
    mocks.delete.mockReturnValue(deletion.promise)
    confirmation.resolve(true)
    await flushPromises()
    expect(button(wrapper, '清空日志').attributes('disabled')).toBeDefined()
    await button(wrapper, '清空日志').trigger('click')
    expect(mocks.delete).toHaveBeenCalledTimes(1)
    expect(mocks.delete).toHaveBeenCalledWith('/permission-logs/logs', { showError: false })
    mocks.get.mockResolvedValue(logResponse([]))
    deletion.resolve({ success: true })
    await flushPromises()
    expect(context.logsPagination.page).toBe(1)
    expect(context.logsPagination.total).toBe(0)
    expect(context.paginatedLogs).toEqual([])
    expect(mocks.success).toHaveBeenCalledWith('权限日志已清空')
  })

  it('删除失败保留原页码、总数和列表，允许重试', async () => {
    const wrapper = await render()
    context.logsPagination.page = 3
    mocks.delete.mockRejectedValue(new Error('删除失败'))
    await button(wrapper, '清空日志').trigger('click')
    await flushPromises()
    expect(context.logsPagination.page).toBe(3)
    expect(context.logsPagination.total).toBe(2)
    expect(context.paginatedLogs).toHaveLength(2)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.handleApiError).toHaveBeenCalledTimes(1)
    expect(button(wrapper, '清空日志').attributes('disabled')).toBeUndefined()
  })

  it('真实权限指令隐藏无删除权限的按钮，确认期间权限撤销也不发送删除', async () => {
    const wrapper = await render()
    const confirmation = deferred<boolean>()
    mocks.confirm.mockReturnValue(confirmation.promise)
    await button(wrapper, '清空日志').trigger('click')
    mocks.auth.userPermissions = ['permissions_permissionsview:view']
    await flushPromises()
    expect(button(wrapper, '清空日志').attributes('data-permission-hidden')).toBe('true')
    confirmation.resolve(true)
    await flushPromises()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.warning).toHaveBeenCalledWith('您没有删除权限日志的权限')
  })

  it('确认期间发出的旧列表请求不能在清空后回填；删除期间不读取列表', async () => {
    const wrapper = await render()
    const confirmation = deferred<boolean>()
    mocks.confirm.mockReturnValue(confirmation.promise)
    await button(wrapper, '清空日志').trigger('click')
    const oldRequest = deferred<ReturnType<typeof logResponse>>()
    mocks.get.mockReturnValueOnce(oldRequest.promise)
    const oldRefresh = context.refreshLogs()
    const deletion = deferred<{ success: boolean }>()
    mocks.delete.mockReturnValue(deletion.promise)
    confirmation.resolve(true)
    await flushPromises()
    const readCount = mocks.get.mock.calls.length
    await context.refreshLogs()
    expect(mocks.get).toHaveBeenCalledTimes(readCount)
    mocks.get.mockResolvedValue(logResponse([]))
    deletion.resolve({ success: true })
    await flushPromises()
    oldRequest.resolve(logResponse([99]))
    await oldRefresh
    await flushPromises()
    expect(context.paginatedLogs).toEqual([])
    expect(context.logsPagination.total).toBe(0)
    expect(context.logsLoading).toBe(false)
  })
})
