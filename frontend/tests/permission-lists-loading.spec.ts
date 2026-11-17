import { computed, defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PermissionsView from '@/views/permissions/PermissionsView.vue'
import RoleFieldPermissionDialog from '@/views/permissions/page/RoleFieldPermissionDialog.vue'
import DataEmptyState from '@/components/DataEmptyState.vue'
import { usePermissionsPageContext, type PermissionsPageContext } from '@/views/permissions/page/context'
import { vTFLoading } from '@/directives'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), fetchUserFieldPermissions: vi.fn(), init: vi.fn(), error: vi.fn(), handleApiError: vi.fn(), success: vi.fn() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ userPermissions: [], isAuthenticated: true, isActive: true, isAuthReady: true, hasPermission: () => false }) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => true), canCreate: computed(() => false), canEdit: computed(() => false), canDelete: computed(() => false)
}) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: mocks.init, fetchUserFieldPermissions: mocks.fetchUserFieldPermissions, isFieldVisible: () => true }, shouldShowActionColumn: () => true
}))
vi.mock('@/composables', () => ({ useLoadingState: () => ({ loading: computed(() => false) }) }))
vi.mock('@/composables/useRefreshData', () => ({ useRefreshData: () => ({ refreshing: computed(() => false), refresh: async (load: () => Promise<void>) => load() }) }))
vi.mock('@/composables/useImportExport', () => ({ useImportExport: () => ({ exportTextFile: vi.fn(), buildDateFilename: vi.fn() }) }))

let context: PermissionsPageContext
const Probe = defineComponent({ setup() { context = usePermissionsPageContext(); return () => null } })
const Slot = { template: '<div><slot /><slot name="actions" /></div>' }
const Header = { name: 'PageHeader', props: ['description'], template: '<div>{{ description }}<slot name="actions" /></div>' }
const wrappers: VueWrapper[] = []
const rolesResponse = (name = '已有角色') => ({ success: true, data: {
  roles: [{ id: 2, name, code: 'role', created_at: '2026-11-15 10:00:00', updated_at: '2026-11-15 10:00:00' }], total: 1
} })
const usersResponse = (username = '已有用户') => ({ success: true, data: {
  users: [{ id: 3, username, full_name: username, status: 1, roles: [] }], pagination: { total: 1, page: 1 }
} })
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const render = () => {
  const wrapper = mount(PermissionsView, { global: {
    plugins: [ElementPlus], components: { DataEmptyState }, directives: { 'tf-loading': vTFLoading, permission: {}, 'table-double-tap': {} },
    mocks: { $getNumberColumnWidth: () => 64, $getActionColumnWidth: () => 160 },
    stubs: { PermissionGate: Slot, PageHeader: Header, SharedSearchPanel: Probe, Pagination: true, RecordDetailDialog: true,
      RoleFormDialog: true, UserRoleAssignmentDialog: true, ModuleFieldPermissionDialog: true, RoleFieldPermissionDialog: true,
      StoreBindingDialog: true, ModulesPage: true, RolePermissionsPage: true, StoreBindingsPage: true, LogsPage: true }
  } })
  wrappers.push(wrapper)
  return wrapper
}
beforeEach(() => {
  setActivePinia(createPinia())
  mocks.init.mockResolvedValue(undefined)
  mocks.get.mockImplementation(async (url: string) => url.includes('/permissions/roles') ? rolesResponse()
    : url === '/permissions/users-with-roles' ? usersResponse() : { success: true, data: {} })
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.resetAllMocks()
})

it('角色首载从字段配置等待阶段显示公共占位，列表不被慢统计阻塞', async () => {
  const init = deferred<void>(), list = deferred<ReturnType<typeof rolesResponse>>(), stats = deferred<{ success: boolean; data: object }>()
  mocks.init.mockReturnValue(init.promise)
  mocks.get.mockImplementation((url: string) => url.includes('/permissions/roles') ? list.promise : stats.promise)
  const wrapper = render()
  expect(wrapper.find('.table-loading-row__block').text()).toContain('加载角色列表')
  expect(wrapper.text()).not.toContain('暂无角色数据')
  init.resolve(); await flushPromises()
  expect(mocks.get).toHaveBeenCalledWith(expect.stringContaining('/permissions/roles?'), expect.objectContaining({ showLoading: false, signal: expect.any(AbortSignal) }))
  expect(context.rolesLoading).toBe(true)
  list.resolve(rolesResponse()); await flushPromises()
  expect(context.rolesLoading).toBe(false)
  expect(wrapper.find('.table-loading-row__block').exists()).toBe(false)
  expect(wrapper.text()).toContain('已有角色')
  stats.resolve({ success: true, data: {} }); await flushPromises()
})

it('角色分配首次切换显示公共占位，失败后结束等待并支持重新检索', async () => {
  const wrapper = render(); await flushPromises()
  const list = deferred<ReturnType<typeof usersResponse>>()
  mocks.get.mockImplementation((url: string) => url === '/permissions/users-with-roles' ? list.promise : Promise.resolve(rolesResponse()))
  context.activeTab = 'userRoles'; await flushPromises()
  expect(context.usersLoading).toBe(true)
  expect(wrapper.find('.table-loading-row__block').text()).toContain('加载用户列表')
  list.reject(new Error('隔离读取失败')); await flushPromises()
  expect(context.usersLoading).toBe(false)
  expect(wrapper.find('.table-loading-row__block').exists()).toBe(false)
  mocks.get.mockResolvedValue(usersResponse())
  context.searchUsers(); await flushPromises()
  expect(wrapper.text()).toContain('已有用户')
})

it.each(['roles', 'userRoles'] as const)('%s 检索、分页和重置保留数据并显示区域加载，迟到请求不能提前结束等待', async tab => {
  const wrapper = render(); await flushPromises()
  if (tab === 'userRoles') { context.activeTab = tab; await flushPromises() }
  const first = deferred<ReturnType<typeof rolesResponse> | ReturnType<typeof usersResponse>>()
  const second = deferred<ReturnType<typeof rolesResponse> | ReturnType<typeof usersResponse>>()
  const isRole = tab === 'roles', oldText = isRole ? '已有角色' : '已有用户'
  const search = () => isRole ? context.searchRoles() : context.searchUsers()
  const isLoading = () => isRole ? context.rolesLoading : context.usersLoading
  mocks.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  search(); await flushPromises()
  expect(isLoading()).toBe(true)
  expect(wrapper.text()).toContain(oldText)
  expect(wrapper.find('.tf2025-loading-spinner').exists()).toBe(true)
  const signal = mocks.get.mock.lastCall?.[1].signal
  search(); await flushPromises()
  expect(signal.aborted).toBe(true)
  first.resolve(isRole ? rolesResponse('过期内容') : usersResponse('过期内容')); await flushPromises()
  expect(isLoading()).toBe(true)
  expect(wrapper.text()).toContain(oldText)
  expect(wrapper.text()).not.toContain('过期内容')
  second.resolve(isRole ? rolesResponse('最新内容') : usersResponse('最新内容')); await flushPromises()
  expect(isLoading()).toBe(false)
  expect(wrapper.find('.tf2025-loading-spinner').exists()).toBe(false)
  expect(wrapper.text()).toContain('最新内容')
  for (const action of [() => isRole ? context.handleRolesPaginationChange(2, 10) : context.handleUsersPaginationChange(2, 10),
    () => isRole ? context.resetRoleSearch() : context.resetUserSearch()]) {
    const pending = deferred<ReturnType<typeof rolesResponse> | ReturnType<typeof usersResponse>>()
    mocks.get.mockReturnValueOnce(pending.promise)
    void action(); await flushPromises()
    expect(isLoading()).toBe(true)
    expect(wrapper.text()).toContain('最新内容')
    pending.resolve(isRole ? rolesResponse('最新内容') : usersResponse('最新内容')); await flushPromises()
    expect(isLoading()).toBe(false)
  }
})

it('字段配置失败结束首载占位，统一报告错误且不读取角色列表', async () => {
  mocks.init.mockRejectedValue(new Error('字段权限不可用'))
  const wrapper = render(); await flushPromises()
  expect(context.rolesLoading).toBe(false)
  expect(wrapper.find('.table-loading-row__block').exists()).toBe(false)
  expect(mocks.handleApiError).toHaveBeenCalledWith(expect.any(Error), '加载权限字段配置失败')
  expect(mocks.get).not.toHaveBeenCalled()
})

it('页面权限不再显示重复的角色配置说明', async () => {
  const wrapper = render(); await flushPromises()
  context.selectedRoleForPermission = { id: 2, name: '管理员', created_at: '2026-11-15 10:00:00', updated_at: '2026-11-15 10:00:00' }
  context.activeTab = 'pagePermissions'; await flushPromises()
  expect(wrapper.findComponent(Header).props('description')).toBe('')
  expect(wrapper.text()).not.toContain('正在配置角色')
})

it.each(['roles', 'userRoles'] as const)('%s 顶部刷新期间保留已有数据并显示区域反馈', async tab => {
  const wrapper = render(); await flushPromises()
  if (tab === 'userRoles') { context.activeTab = tab; await flushPromises() }
  const pending = deferred<ReturnType<typeof rolesResponse> | ReturnType<typeof usersResponse>>()
  mocks.get.mockImplementation((url: string) => (tab === 'roles' ? url.startsWith('/permissions/roles?') : url === '/permissions/users-with-roles')
    ? pending.promise : Promise.resolve({ success: true, data: {} }))
  await wrapper.findAll('button').find(button => button.text() === '刷新')!.trigger('click')
  expect(wrapper.text()).toContain(tab === 'roles' ? '已有角色' : '已有用户')
  expect(wrapper.find('.tf2025-loading-spinner').exists()).toBe(true)
  pending.resolve(tab === 'roles' ? rolesResponse() : usersResponse()); await flushPromises()
  expect(wrapper.find('.tf2025-loading-spinner').exists()).toBe(false)
  expect(mocks.success).toHaveBeenCalledWith('数据刷新成功', expect.any(Object))
})

it.each(['roles', 'userRoles'] as const)('%s 卸载取消未完成的列表请求', async tab => {
  const wrapper = render(); await flushPromises()
  if (tab === 'userRoles') { context.activeTab = tab; await flushPromises() }
  const pending = deferred<ReturnType<typeof rolesResponse>>()
  mocks.get.mockReturnValueOnce(pending.promise)
  if (tab === 'roles') context.searchRoles()
  else context.searchUsers()
  const signal = mocks.get.mock.lastCall?.[1].signal
  wrapper.unmount(); wrappers.splice(wrappers.indexOf(wrapper), 1)
  expect(signal.aborted).toBe(true)
  pending.reject(new Error('卸载后失败')); await flushPromises()
  expect(mocks.error).not.toHaveBeenCalled()
})

it('字段权限保留接口菜单顺序，每次重新打开读取最新模块顺序', async () => {
  const wrapper = render(); await flushPromises()
  const modules = [
    { key: 'sales_salesview', name: '销售管理', icon: 'sale' },
    { key: 'inventory_inventoryview', name: '库存管理', icon: 'inventory' }
  ]
  mocks.get.mockResolvedValueOnce({ success: true, data: modules })
  context.handleRoleFieldPermissions(context.rolesData[0]); await flushPromises()
  const dialog = wrapper.findComponent({ name: 'RoleFieldPermissionDialog' })
  expect(dialog.props('modules')).toEqual(modules)
  expect(mocks.get).toHaveBeenLastCalledWith('/permissions/module-mappings', { useCache: false })
  dialog.vm.$emit('update:modelValue', false); await flushPromises()
  const reordered = [...modules].reverse()
  mocks.get.mockResolvedValueOnce({ success: true, data: reordered })
  context.handleRoleFieldPermissions(context.rolesData[0]); await flushPromises()
  expect(dialog.props('modules')).toEqual(reordered)
  expect(mocks.get.mock.calls.filter(([url]) => url === '/permissions/module-mappings')).toHaveLength(2)
})

it('商品字段按综合查询 goods 范围读取保存，失败的配置不能保存为空', async () => {
  const wrapper = render(); await flushPromises()
  const module = { key: 'query_queryview', name: '综合查询', icon: 'fas fa-search' }
  mocks.get.mockResolvedValueOnce({ success: true, data: [module] })
  context.handleRoleFieldPermissions(context.rolesData[0]); await flushPromises()
  const dialog = wrapper.findComponent({ name: 'RoleFieldPermissionDialog' })
  const config = { success: true, data: { field_permissions: { query_queryview: { field_config: { hidden_fields: ['price_info.profit'] } } } } }
  mocks.get.mockResolvedValueOnce(config)
  dialog.vm.$emit('selectModule', { ...module, field_scope: 'goods' }); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/permissions/field-permissions/2', expect.objectContaining({
    params: { module_key: 'query_queryview', field_scope: 'goods' }, useCache: false
  }))
  expect(dialog.props('fieldGroups').flatMap((group: { fields: { id: string }[] }) => group.fields).some((field: { id: string }) => field.id === 'price_info.profit')).toBe(true)
  expect(dialog.props('selectedFields')).toEqual(['price_info.profit'])
  mocks.put.mockResolvedValueOnce({ success: true })
  mocks.get.mockResolvedValueOnce(config)
  dialog.vm.$emit('update:selectedFields', ['customer_info.customer_phone'])
  dialog.vm.$emit('save'); await flushPromises()
  expect(mocks.put).toHaveBeenCalledWith('/permissions/field-permissions/2', {
    module_key: 'query_queryview', field_scope: 'goods', field_config: { hidden_fields: ['customer_info.customer_phone'] }
  })
  mocks.put.mockClear()
  mocks.get.mockRejectedValueOnce(new Error('配置读取失败'))
  dialog.vm.$emit('selectModule', { ...module, field_scope: 'goods' }); await flushPromises()
  expect(dialog.props('configReady')).toBe(false)
  dialog.vm.$emit('save'); await flushPromises()
  expect(mocks.put).not.toHaveBeenCalled()
})

it('库存字段三态读取和保存保留明确编辑范围，切换模块清理旧只读状态', async () => {
  const wrapper = render(); await flushPromises()
  const module = { key: 'inventory_inventoryview', name: '库存管理', icon: 'fas fa-warehouse' }
  mocks.get.mockResolvedValueOnce({ success: true, data: [module] })
  context.handleRoleFieldPermissions(context.rolesData[0]); await flushPromises()
  const dialog = wrapper.findComponent({ name: 'RoleFieldPermissionDialog' })
  const config = { success: true, data: { field_permissions: { inventory_inventoryview: { field_config: {
    hidden_fields: ['basic.imei'], readonly_fields: ['price_info.purchase_cost'], editable_fields: ['other_info.remarks']
  } } } } }
  mocks.get.mockResolvedValueOnce(config)
  dialog.vm.$emit('selectModule', module); await flushPromises()
  expect(dialog.props('readonlyFields')).toEqual(['price_info.purchase_cost'])
  expect(dialog.props('editableFields')).toEqual(['other_info.remarks'])
  const fields = dialog.props('fieldGroups').flatMap((group: { fields: { id: string; editable: boolean }[] }) => group.fields)
  expect(fields.find((field: { id: string }) => field.id === 'price_info.purchase_cost').editable).toBe(true)
  expect(fields.find((field: { id: string }) => field.id === 'stats.total_phones').editable).toBe(false)
  dialog.vm.$emit('update:readonlyFields', ['other_info.remarks'])
  dialog.vm.$emit('update:editableFields', ['price_info.purchase_cost'])
  mocks.put.mockResolvedValueOnce({ success: true }); mocks.get.mockResolvedValueOnce(config)
  dialog.vm.$emit('save'); await flushPromises()
  expect(mocks.put).toHaveBeenCalledWith('/permissions/field-permissions/2', {
    module_key: 'inventory_inventoryview', field_config: { hidden_fields: ['basic.imei'], readonly_fields: ['other_info.remarks'], editable_fields: ['price_info.purchase_cost'] }
  })
  mocks.get.mockResolvedValueOnce({ success: true, data: { field_permissions: {} } })
  dialog.vm.$emit('selectModule', { key: 'query_queryview', name: '综合查询', icon: 'search' }); await flushPromises()
  expect(dialog.props('readonlyFields')).toEqual([])
  expect(dialog.props('editableFields')).toBeUndefined()
})


it('库存字段实际控件显示三态，系统字段禁编，切换只读和编辑不会互相覆盖', async () => {
  const wrapper = mount(RoleFieldPermissionDialog, {
    props: {
      modelValue: true, configReady: true, loadingGroups: false, loadingModules: false, saving: false,
      selectedFields: [], readonlyFields: [], editableFields: ['price_info.purchase_cost'], selectedFieldGroupName: '字段',
      selectedModule: { key: 'inventory_inventoryview', name: '库存管理', icon: 'inventory' }, modules: [],
      getFieldTypeLabel: value => value, getSensitivityLabel: value => value, isFieldSensitive: () => false,
      fieldGroups: [{ name: '字段', sensitivity: 'internal', fields: [
        { id: 'price_info.purchase_cost', name: '入库价格', type: 'currency', sensitivity: 'internal', editable: true },
        { id: 'stats.total_phones', name: '总数', type: 'number', sensitivity: 'internal' }
      ] }]
    },
    global: { plugins: [ElementPlus], stubs: { MobileDialog: { template: '<div><slot /><slot name="footer" /></div>' }, IconRenderer: true } }
  })
  wrappers.push(wrapper)
  const groups = wrapper.findAllComponents({ name: 'ElRadioGroup' })
  expect(groups.map(group => group.props('modelValue'))).toEqual(['editable', 'readonly'])
  expect(groups[1].findAllComponents({ name: 'ElRadioButton' })[2].props('disabled')).toBe(true)
  groups[0].vm.$emit('change', 'readonly'); await flushPromises()
  expect(wrapper.emitted('update:readonlyFields')?.at(-1)).toEqual([['price_info.purchase_cost']])
  expect(wrapper.emitted('update:editableFields')?.at(-1)).toEqual([[]])
  await wrapper.setProps({ readonlyFields: ['price_info.purchase_cost'], editableFields: [] })
  groups[0].vm.$emit('change', 'editable'); await flushPromises()
  expect(wrapper.emitted('update:readonlyFields')?.at(-1)).toEqual([[]])
  expect(wrapper.emitted('update:editableFields')?.at(-1)).toEqual([['price_info.purchase_cost']])
  groups[0].vm.$emit('change', 'hidden'); await flushPromises()
  expect(wrapper.emitted('update:selectedFields')?.at(-1)).toEqual([['price_info.purchase_cost']])
})
