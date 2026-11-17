import { computed } from 'vue'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElSelect, ElTableColumn } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ModuleManagementView from '@/views/permissions/page/ModuleManagementView.vue'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), error: vi.fn(), success: vi.fn(),
  mobile: false, canCreate: true, isAdmin: true
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ get isAdmin() { return mocks.isAdmin } }) }))
vi.mock('@/utils/unified-api', () => ({ default: { get: mocks.get, post: mocks.post } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({
  error: mocks.error, success: mocks.success, warning: vi.fn()
}) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => true), canCreate: computed(() => mocks.canCreate),
  canEdit: computed(() => true), canDelete: computed(() => false)
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { isFieldVisible: () => true },
  shouldShowActionColumn: () => true
}))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => mocks.mobile) }) }))

const rows = [
  { id: 1, key: 'dashboard_dashboardview', name: '仪表盘', category: 'system', description: '经营概览',
    is_active: 1, is_custom_name: 0, name_status: '🤖 自动', permission_count: 1, created_at: '2026-11-15 10:00:00' },
  { id: 2, key: 'sales_salesview', name: '销售管理', category: 'business', description: '销售业务',
    is_active: 0, is_custom_name: 1, name_status: '🔒 自定义', permission_count: 9, created_at: '2026-11-15 11:00:00' }
]
const wrappers: VueWrapper[] = []
const findButton = (wrapper: VueWrapper, label: string) => {
  const button = wrapper.findAll('button').find(item => item.text() === label)
  if (!button) throw new Error(`未找到按钮：${label}`)
  return button
}
const render = async () => {
  const wrapper = mount(ModuleManagementView, { global: {
    plugins: [ElementPlus],
    directives: { 'table-double-tap': {} },
    stubs: {
      PermissionGate: { props: ['canView'], template: '<div v-if="canView"><slot /></div>' },
      UnifiedSearchPanel: { template: '<div><slot name="primary" /><slot /></div>' },
      Pagination: true, SectionLoading: true, DataEmptyState: true,
      MobileDialog: { props: ['modelValue', 'title'], template: '<section v-if="modelValue" class="test-dialog"><h2>{{ title }}</h2><slot /><slot name="footer" /></section>' }
    }
  } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.isAdmin = true
  mocks.mobile = false
  mocks.canCreate = true
  mocks.get.mockResolvedValue({ success: true, data: { modules: rows, total: rows.length } })
})
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('模块管理展示与公共按钮', () => {
  it('列表按指定字段排序，切换网格与详情保留接口真实权限数量', async () => {
    const wrapper = await render()
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/modules/registered')
    expect(wrapper.findAll('.module-card .permission-count').map(item => item.text())).toEqual(['1 个', '9 个'])
    const list = findButton(wrapper, '列表')
    expect(list.classes()).toContain('tf-button--neutral')
    expect(list.attributes('aria-pressed')).toBe('false')
    await list.trigger('click')
    await flushPromises()
    expect(wrapper.findAllComponents(ElTableColumn).map(column => column.props('label'))).toEqual([
      '模块名称', '模块标识', '分类', '权限数量', '名称状态', '状态', '创建时间', '操作'
    ])
    expect(wrapper.findAll('.el-table__body .permission-count').map(item => item.text())).toEqual(['1', '9'])
    expect(list.classes()).toContain('tf-button--primary')
    expect(list.attributes('aria-pressed')).toBe('true')
    await findButton(wrapper, '网格').trigger('click')
    await flushPromises()
    await findButton(wrapper, '查看').trigger('click')
    expect(wrapper.find('.test-dialog').text()).toContain('1 个')
    expect(mocks.get).toHaveBeenCalledTimes(1)
  })

  it('缺失数量显示未知标记，不再伪装为零；真实零值仍显示零', async () => {
    mocks.get.mockResolvedValue({ success: true, data: { modules: [
      { ...rows[0], permission_count: undefined }, { ...rows[1], permission_count: 0 }
    ] } })
    const wrapper = await render()
    expect(wrapper.findAll('.module-card .permission-count').map(item => item.text())).toEqual(['— 个', '0 个'])
    await findButton(wrapper, '列表').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.el-table__body .permission-count').map(item => item.text())).toEqual(['—', '0'])
  })

  it('手机保留完整业务字段，操作放入详情且显示相同权限数量', async () => {
    mocks.mobile = true
    const wrapper = await render()
    expect(wrapper.find('.view-toggles').exists()).toBe(false)
    expect(wrapper.findAllComponents(ElTableColumn).map(column => column.props('label'))).toEqual([
      '模块名称', '模块标识', '分类', '权限数量', '名称状态', '状态', '创建时间'
    ])
    expect(wrapper.findAll('.el-table__body .permission-count').map(item => item.text())).toEqual(['1', '9'])
    await wrapper.find('.el-table__body tr').trigger('dblclick')
    expect(wrapper.find('.test-dialog').text()).toContain('1 个')
  })

  it('添加入口使用公共新增按钮，未授权时隐藏', async () => {
    const wrapper = await render()
    expect(findButton(wrapper, '添加模块').classes()).toContain('tf-button--create')
    expect(wrapper.text()).not.toContain('手动添加模块')
    await findButton(wrapper, '添加模块').trigger('click')
    expect(wrapper.find('.test-dialog h2').text()).toBe('添加模块')
    mocks.canCreate = false
    const denied = await render()
    expect(denied.findAll('button').some(button => button.text() === '添加模块')).toBe(false)
  })

  it('添加模块使用公共提交状态防重复，成功后刷新数量', async () => {
    let resolve!: (response: { success: boolean }) => void
    mocks.post.mockReturnValue(new Promise(done => { resolve = done }))
    const wrapper = await render()
    await findButton(wrapper, '添加模块').trigger('click')
    const dialog = wrapper.find('.test-dialog')
    await dialog.find('input[placeholder="例如: subsidy_subsidyview"]').setValue('custom_test')
    await dialog.find('input[placeholder="例如: 国补管理"]').setValue('新增模块')
    dialog.findAllComponents(ElSelect)[0].vm.$emit('update:modelValue', 'custom')
    await flushPromises()
    await findButton(wrapper, '确认添加').trigger('click')
    expect(findButton(wrapper, '添加中...').attributes('disabled')).toBeDefined()
    await findButton(wrapper, '添加中...').trigger('click')
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/modules/manual-create', {
      key: 'custom_test', name: '新增模块', description: '新增模块管理模块',
      category: 'custom', icon: 'fas fa-cube', is_active: 1
    })
    resolve({ success: true })
    await flushPromises()
    expect(wrapper.find('.test-dialog').exists()).toBe(false)
    expect(mocks.get).toHaveBeenCalledTimes(2)
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
