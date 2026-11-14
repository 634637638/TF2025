import { computed } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElForm, ElInput, ElSelect, ElSwitch } from 'element-plus'
import AccessoryCatalogView from '@/views/accessories/AccessoryCatalogView.vue'
import AccessoryStockLocations from '@/components/AccessoryStockLocations.vue'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), success: vi.fn(), error: vi.fn(), edit: true, view: true, hidden: new Set<string>() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => mocks.view), canEdit: computed(() => mocks.edit), canCreate: computed(() => mocks.edit), requirePermission: () => mocks.edit
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { init: async () => {}, isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) } }))
const Slot = { template: '<div><slot /><slot name="actions" /></div>' }
const Dialog = { props: { modelValue: Boolean, beforeClose: { type: Function, required: true } }, emits: ['update:modelValue'],
  template: '<section v-if="modelValue" class="catalog-dialog" @keydown.esc="beforeClose(() => $emit(\'update:modelValue\', false))"><slot /><slot name="footer" /></section>' }
const wrappers: ReturnType<typeof mount>[] = []
const render = () => {
  const wrapper = mount(AccessoryCatalogView, { global: { plugins: [ElementPlus],
    stubs: { PermissionGate: Slot, PageHeader: Slot, MobileDialog: Dialog, DataEmptyState: true },
    directives: { 'tf-loading': {}, permission: {} }, config: { globalProperties: { $getNumberColumnWidth: () => 72, $getActionColumnWidth: () => 100 } }
  } })
  wrappers.push(wrapper)
  return wrapper
}
const locationView = () => {
  const wrapper = mount(AccessoryStockLocations, { props: { accessoryId: 55 }, global: { plugins: [ElementPlus], stubs: { DataEmptyState: true }, directives: { 'tf-loading': {} } } })
  wrappers.push(wrapper)
  return wrapper
}
const settings = { data: { warehouse_store_id: 3, stores: [{ id: 2, name: '门店A' }, { id: 3, name: '总仓B' }] } }
beforeEach(() => {
  mocks.view = mocks.edit = true
  mocks.hidden.clear()
  mocks.get.mockReset()
  mocks.post.mockReset()
  mocks.put.mockReset()
  mocks.post.mockResolvedValue({ success: true })
  mocks.put.mockResolvedValue({ success: true })
  mocks.get.mockImplementation(async (url: string) => url.endsWith('/settings') ? settings : url.endsWith('/stock') ? { data: { stores: [{ store_id: 2, store_name: '门店A', quantity: 7 }] } } : { data: { categories: [], units: [] } })
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })

describe('配件设置与店铺库存', () => {
  it('设置保留类型和单位管理，读取总仓、保存指定门店及清空设置', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('商品类型')
    expect(wrapper.text()).toContain('计量单位')
    expect(wrapper.text()).toContain('仓库设置')
    const select = wrapper.findComponent(ElSelect)
    expect(select.props('modelValue')).toBe(3)
    select.vm.$emit('update:modelValue', 2)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.put).toHaveBeenLastCalledWith('/accessories/settings', { warehouse_store_id: 2 })
    select.vm.$emit('update:modelValue', '')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.put).toHaveBeenLastCalledWith('/accessories/settings', { warehouse_store_id: null })
  })

  it('只有查看权限时不能保存，隐藏门店时不请求或展示总仓', async () => {
    mocks.edit = false
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findComponent(ElSelect).props('disabled')).toBe(true)
    expect(wrapper.text()).not.toContain('保存仓库设置')
    await wrapper.get('form').trigger('submit')
    expect(mocks.put).not.toHaveBeenCalled()
    mocks.get.mockClear()
    mocks.hidden.add('stock_info.distribution')
    const hidden = render()
    await flushPromises()
    expect(hidden.text()).not.toContain('仓库设置')
    expect(mocks.get.mock.calls.some(call => call[0].endsWith('/settings'))).toBe(false)
  })

  it('设置读取失败禁止保存，保存失败保留选择且不提示成功', async () => {
    mocks.get.mockRejectedValueOnce(new Error('catalog')).mockRejectedValueOnce(new Error('settings'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('仓库设置读取失败')
    await wrapper.get('form').trigger('submit')
    expect(mocks.put).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(item => item.text() === '刷新')!.trigger('click')
    await flushPromises()
    mocks.put.mockRejectedValueOnce(new Error('network'))
    wrapper.findComponent(ElSelect).vm.$emit('update:modelValue', 2)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.findComponent(ElSelect).props('modelValue')).toBe(2)
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('库存详情展示对应店铺和剩余，切换商品取消旧请求', async () => {
    let resolveOld!: (value: { data: { stores: { store_id: number; store_name: string; quantity: number }[] } }) => void
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const wrapper = locationView()
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal
    await wrapper.setProps({ accessoryId: 56 })
    await flushPromises()
    resolveOld({ data: { stores: [{ store_id: 3, store_name: '旧店铺', quantity: 99 }] } })
    await flushPromises()
    expect(signal.aborted).toBe(true)
    expect(wrapper.text()).toContain('门店A')
    expect(wrapper.text()).toContain('7')
    expect(wrapper.text()).not.toContain('旧店铺')
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/56/stock', expect.objectContaining({ useCache: false }))
  })

  it('库存位置遵守门店字段权限，故障可重试', async () => {
    mocks.hidden.add('stock_info.distribution')
    const hidden = locationView()
    await flushPromises()
    expect(hidden.find('section').exists()).toBe(false)
    expect(mocks.get).not.toHaveBeenCalled()
    mocks.hidden.clear()
    mocks.get.mockRejectedValueOnce(new Error('network'))
    const wrapper = locationView()
    await flushPromises()
    expect(wrapper.text()).toContain('店铺库存读取失败')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('门店A')
    expect(wrapper.text()).not.toContain('店铺库存读取失败')
  })

  it('已迁移类型显示贴膜标记，编辑保留真实值并允许关闭；新增默认不启用', async () => {
    mocks.get.mockImplementation(async (url: string) => url.endsWith('/settings') ? settings : { data: {
      film_ready: true, categories: [{ id: 1, name: '钢化膜', status: 1, sort_order: 0, film_enabled: 1 }], units: [] } })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('用于贴膜')
    await wrapper.findAll('button').find(item => item.text() === '编辑')!.trigger('click')
    const dialog = wrapper.get('.catalog-dialog')
    expect(dialog.findComponent(ElSwitch).props('modelValue')).toBe(true)
    dialog.findComponent(ElSwitch).vm.$emit('update:modelValue', false)
    await dialog.findAll('button').find(item => item.text() === '保存')!.trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/catalog/category/1', {
      name: '钢化膜', status: 1, sort_order: 0, description: '', film_enabled: false }, { showError: false })
    await wrapper.findAll('button').find(item => item.text() === '新增类型')!.trigger('click')
    expect(wrapper.get('.catalog-dialog').findComponent(ElSwitch).props('modelValue')).toBe(false)
    await wrapper.get('.catalog-dialog').findComponent(ElInput).setValue('水凝膜')
    await wrapper.get('.catalog-dialog').findAll('button').find(item => item.text() === '保存')!.trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/catalog/category', expect.objectContaining({ name: '水凝膜', film_enabled: false }), { showError: false })
  })

  it('未迁移目录不展示或提交贴膜字段，单位始终只保存自身资料', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.findAll('button').find(item => item.text() === '新增类型')!.trigger('click')
    expect(wrapper.get('.catalog-dialog').text()).not.toContain('用于贴膜')
    await wrapper.get('.catalog-dialog').findComponent(ElInput).setValue('保护膜')
    await wrapper.get('.catalog-dialog').findAll('button').find(item => item.text() === '保存')!.trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenLastCalledWith('/accessories/catalog/category', { name: '保护膜', sort_order: 0, status: 1, description: '' }, { showError: false })
    await wrapper.findAll('[role="tab"]').find(item => item.text() === '计量单位')!.trigger('click')
    await wrapper.findAll('button').find(item => item.text() === '新增单位')!.trigger('click')
    const dialog = wrapper.get('.catalog-dialog')
    expect(dialog.text()).not.toContain('用于贴膜')
    await dialog.findComponent(ElInput).setValue('张')
    await dialog.findAll('button').find(item => item.text() === '保存')!.trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenLastCalledWith('/accessories/catalog/unit', { name: '张', sort_order: 0, status: 1 }, { showError: false })
  })

  it('类型保存期间禁用编辑、取消与Escape，拒绝失败后保留原草稿', async () => {
    let fail!: (reason: Error) => void
    mocks.post.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
    const wrapper = render()
    await flushPromises()
    await wrapper.findAll('button').find(item => item.text() === '新增类型')!.trigger('click')
    const dialog = wrapper.get('.catalog-dialog')
    await dialog.findComponent(ElInput).setValue('未完成的膜类型')
    await dialog.findAll('button').find(item => item.text() === '保存')!.trigger('click')
    await flushPromises()
    expect(dialog.findComponent(ElForm).props('disabled')).toBe(true)
    expect(dialog.findAll('button').find(item => item.text() === '取消')!.attributes('disabled')).toBeDefined()
    await dialog.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.catalog-dialog').exists()).toBe(true)
    fail(new Error('保存失败'))
    await flushPromises()
    expect(wrapper.get('.catalog-dialog').findComponent(ElInput).props('modelValue')).toBe('未完成的膜类型')
    expect(wrapper.get('.catalog-dialog').findComponent(ElForm).props('disabled')).toBe(false)
    expect(mocks.success).not.toHaveBeenCalled()
  })
})
