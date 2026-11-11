import { computed, defineComponent, h, inject, provide, type PropType, type Ref, type SetupContext } from 'vue'
import { ElInput, ElInputNumber } from 'element-plus'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BrandsView from '@/views/brands/BrandsView.vue'
import ModelsView from '@/views/models/ModelsView.vue'
import ColorsView from '@/views/colors/ColorsView.vue'
import MemoriesView from '@/views/memories/MemoriesView.vue'
import type { Brand } from '@/types'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), put: vi.fn(), post: vi.fn(), success: vi.fn(), warning: vi.fn(), failure: vi.fn(),
  error: vi.fn(), handleApiError: vi.fn(), confirm: vi.fn(), mobile: false
}))
vi.mock('@/utils/unified-api', () => ({ default: mocks, unifiedApi: mocks }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/utils/apiPermissionError', () => ({ handleApiErrorWithPermission: mocks.failure }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canView: computed(() => true), canCreate: computed(() => true), canEdit: computed(() => true), canDelete: computed(() => true)
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: vi.fn().mockResolvedValue(undefined), isFieldVisible: () => true },
  shouldShowActionColumn: () => true
}))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => mocks.mobile) }) }))
vi.mock('@/composables/useRefreshData', () => ({ useRefreshData: () => ({ refreshing: computed(() => false), refresh: vi.fn() }) }))
vi.mock('@/composables/useElementTableSortable', () => ({ useElementTableSortable: vi.fn() }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ permissions: [], isAuthenticated: true }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({}) }))
vi.mock('@/services/reference-options', () => ({ getCachedBrands: vi.fn().mockResolvedValue({ success: true, data: [{ id: 1, name: '品牌' }] }) }))

const Slot = { template: '<div><slot /><slot name="actions" /></div>' }
const Table = defineComponent({
  props: { data: { type: Array as PropType<Brand[]>, required: true } },
  setup(props, { slots }) {
    provide('rows', computed(() => props.data))
    return () => h('div', slots.default?.())
  }
})
const Column = {
  props: { label: { type: String, default: '' } },
  setup(props: { label: string }, { slots }: SetupContext) {
    const rows = inject<Ref<Brand[]>>('rows')!
    return () => h('div', { 'data-column': props.label }, rows.value.map((row, $index) => slots.default?.({ row, $index })))
  }
}
const InputNumber = {
  props: { modelValue: { type: Number, default: undefined }, disabled: Boolean }, emits: ['change', 'update:modelValue'],
  setup(props: { modelValue?: number; disabled: boolean }, { emit }: SetupContext) {
    return () => h('input', { type: 'number', value: props.modelValue, disabled: props.disabled,
      onChange: (event: Event) => {
        const value = Number((event.target as HTMLInputElement).value)
        emit('update:modelValue', value)
        emit('change', value)
      } })
  }
}
const Input = {
  props: ['modelValue'], emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}
const Select = {
  props: ['modelValue'], emits: ['update:modelValue', 'change'],
  template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', Number($event.target.value)); $emit(\'change\')"><option value="" /><option value="1">品牌</option></select>'
}
const Search = { template: '<div><slot name="primary" /><slot /><button class="search" @click="$emit(\'search\')">搜索</button></div>' }
const Pagination = { name: 'Pagination', emits: ['change'], template: '<div />' }
const Dialog = {
  props: ['modelValue'], emits: ['update:modelValue', 'close'],
  template: '<div v-if="modelValue" class="dialog" tabindex="-1" @keydown.esc="$emit(\'update:modelValue\', false)"><button aria-label="关闭" @click="$emit(\'update:modelValue\', false); $emit(\'close\')">关闭</button><slot /><slot name="footer" /></div>'
}
const Button = { template: '<button><slot /></button>' }
const FormItem = { props: ['label'], template: '<label>{{ label }}<slot /></label>' }
const wrappers: ReturnType<typeof shallowMount>[] = []
let storedRows: (Brand & { size: string; brand_id: number })[]

const render = async (view: typeof BrandsView, realInput = false) => {
  const wrapper = shallowMount(view, {
    global: {
      components: { ElInput },
      mocks: { $getNumberColumnWidth: () => 70, $getActionColumnWidth: () => 130 },
      directives: { permission: {}, 'tf-loading': {} },
      stubs: { PermissionGate: Slot, PageHeader: Slot, ElTable: Table, ElTableColumn: Column,
        ElInputNumber: realInput ? ElInputNumber : InputNumber, ElInput: realInput ? false : Input, ElSelect: Select, UnifiedSearchPanel: Search,
        Pagination, MobileDialog: Dialog, ElButton: Button, ElForm: Slot, ElFormItem: FormItem,
        ElOption: true, ElRadio: true, ElRadioGroup: true, DataEmptyState: true }
    }
  })
  wrappers.push(wrapper)
  await flushPromises()
  if (view === ModelsView) {
    await wrapper.find('select[placeholder="品牌"]').setValue('1')
    await flushPromises()
  }
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mobile = false
  storedRows = [45, 60, 90].map((id, index) => ({ id, name: `记录${index}`, size: `${id}GB`, sort_order: index === 2 ? 60 : 45, brand_id: 1 }))
  mocks.get.mockImplementation(async (url: string, config?: { params?: { page?: number; page_size?: number } }) => {
    if (url.includes('stats')) return { success: true, data: {} }
    const domain = url.slice(1)
    return { success: true, data: { [domain]: storedRows.map(row => ({ ...row })), pagination: {
      page: config?.params?.page || 1, page_size: config?.params?.page_size || 100, total: 300
    } } }
  })
  mocks.put.mockImplementation(async (_url: string, body: { items: { id: number; sort_order: number }[] }) => {
    for (const item of body.items) {
      const row = storedRows.find(row => row.id === item.id)
      if (row) row.sort_order = item.sort_order
    }
    return { success: true }
  })
})
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe.each([
  ['brands', BrandsView], ['models', ModelsView], ['colors', ColorsView], ['memories', MemoriesView]
] as const)('%s 实际页面排序交互', (domain, view) => {
  it('检索并翻页后按记录 ID 保存，其他值不变；重复排序不产生重复序号', async () => {
    const wrapper = await render(view)
    const keyword = wrapper.find('input[placeholder^="搜索"]')
    await keyword.setValue('记录')
    await wrapper.find('.search').trigger('click')
    await flushPromises()
    wrapper.findComponent(Pagination).vm.$emit('change', 2, 100)
    await flushPromises()
    expect(wrapper.findAll('.table-number-badge').map(item => item.text())).toEqual(['101', '102', '103'])
    await wrapper.find('[data-column="排序"] input').setValue('72')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith(`/${domain}/batch/reorder`, { items: [{ id: 45, sort_order: 72 }] }, { showError: false })
    expect(storedRows.map(row => [row.id, row.sort_order])).toEqual([[45, 72], [60, 45], [90, 60]])
    expect(wrapper.findAll('[data-column="排序"] input').map(item => (item.element as HTMLInputElement).value)).toEqual(['45', '60', '72'])
    expect(mocks.get).toHaveBeenLastCalledWith(domain === 'models' ? '/models/stats/overview' : `/${domain}`, expect.any(Object))
    const lastListCall = mocks.get.mock.calls.filter(call => call[0] === `/${domain}`).at(-1)!
    expect(lastListCall[1]).toMatchObject({ useCache: false, params: { page: 2, [domain === 'memories' ? 'size' : 'name']: '记录' } })
    expect(wrapper.findAll('.table-number-badge').map(item => item.text())).toEqual(['101', '102', '103'])
    expect((keyword.element as HTMLInputElement).value).toBe('记录')
    expect(mocks.success).toHaveBeenCalledWith('排序已保存')
  })

  it('接口失败显示错误并恢复当前输入值，不改变其他行', async () => {
    const wrapper = await render(view)
    mocks.put.mockRejectedValueOnce(new Error('保存失败'))
    await wrapper.find('[data-column="排序"] input').setValue('72')
    await flushPromises()
    expect(wrapper.findAll('[data-column="排序"] input').map(item => (item.element as HTMLInputElement).value)).toEqual(['45', '45', '60'])
    expect(mocks.failure).toHaveBeenCalledOnce()
    expect(mocks.success).not.toHaveBeenCalled()
  })

  describe.each([false, true])('新增弹窗，手机端=%s', mobile => {
    it.each(['取消', '关闭', 'Escape'])('%s 直接关闭并重置草稿，不二次确认或写入', async action => {
      mocks.mobile = mobile
      const wrapper = await render(view)
      const open = () => wrapper.findAll('button').find(item => item.text() === '新增')!.trigger('click')
      await open()
      const input = wrapper.find('.dialog input:not([type="number"])')
      await input.setValue(domain === 'memories' ? '8+128GB' : '新增草稿')
      await wrapper.find('.dialog input[type="number"]').setValue('8')
      if (domain === 'models') await wrapper.find('.dialog select[placeholder="请选择品牌"]').setValue('1')
      if (action === 'Escape') await wrapper.find('.dialog').trigger('keydown', { key: 'Escape' })
      else await wrapper.findAll('.dialog button').find(item => item.text() === action)!.trigger('click')
      await flushPromises()
      expect(wrapper.find('.dialog').exists()).toBe(false)
      expect(mocks.confirm).not.toHaveBeenCalled()
      expect(mocks.put).not.toHaveBeenCalled()
      expect(mocks.post).not.toHaveBeenCalled()
      await open()
      expect((wrapper.find('.dialog input:not([type="number"])').element as HTMLInputElement).value).toBe('')
      expect((wrapper.find('.dialog input[type="number"]').element as HTMLInputElement).value).toBe('0')
      if (domain === 'models') expect((wrapper.find('.dialog select[placeholder="请选择品牌"]').element as HTMLSelectElement).value).toBe('')
    })
  })

  it('编辑记录取消仍保留未保存确认，拒绝关闭时保留内容', async () => {
    const wrapper = await render(view)
    await wrapper.findAll('button').find(item => item.text() === '编辑')!.trigger('click')
    await wrapper.find('.dialog input:not([type="number"])').setValue(domain === 'memories' ? '8+128GB' : '编辑草稿')
    mocks.confirm.mockResolvedValueOnce(false)
    await wrapper.findAll('.dialog button').find(item => item.text() === '取消')!.trigger('click')
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(wrapper.find('.dialog').exists()).toBe(true)
    expect(mocks.put).not.toHaveBeenCalled()
    mocks.confirm.mockResolvedValueOnce(true)
    await wrapper.find('.dialog button[aria-label="关闭"]').trigger('click')
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.dialog').exists()).toBe(false)
  })
})

it('新增型号弹窗使用“型号”标签和输入提示', async () => {
  const wrapper = await render(ModelsView)
  await wrapper.findAll('button').find(item => item.text() === '新增')!.trigger('click')
  expect(wrapper.find('.dialog').text()).not.toContain('型号名称')
  expect(wrapper.find('.dialog input[placeholder="请输入型号"]').exists()).toBe(true)
  expect(wrapper.findAll('.dialog label').some(item => item.text() === '型号')).toBe(true)
})

it('真实 Element 数字控件在保存失败后恢复原值并允许再次修改', async () => {
  const wrapper = await render(BrandsView, true)
  mocks.put.mockRejectedValueOnce(new Error('保存失败'))
  const input = wrapper.find('[data-column="排序"] input')
  await input.setValue('72')
  await input.trigger('blur')
  await flushPromises()
  expect(mocks.failure).toHaveBeenCalledOnce()
  expect(wrapper.findAll('[data-column="排序"] input').map(item => (item.element as HTMLInputElement).value)).toEqual(['45', '45', '60'])
  const retry = wrapper.find('[data-column="排序"] input')
  await retry.setValue('72')
  await retry.trigger('blur')
  await flushPromises()
  expect(storedRows.find(row => row.id === 45)?.sort_order).toBe(72)
  expect(mocks.success).toHaveBeenCalledWith('排序已保存')
})
