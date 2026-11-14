import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Entry from '@/views/customers/page/CustomerFilmHistory.vue'

const access = reactive({ customers: true, query: true, accessories: true, film: true, hidden: new Set<string>() })
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: 'customers' | 'query' | 'accessories') => ({
  canView: computed(() => access[module]), hasPermission: () => access.film
}) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  isFieldVisible: (module: string, field: string) => !access.hidden.has(`${module}.${field}`)
} }))
const customer = { id: 9, name: '服务客户', phone: '13800138000' }
const Dialog = { name: 'FilmServiceDialog', props: ['modelValue', 'customer'], emits: ['update:modelValue'],
  template: '<div class="film-history">{{customer.id}} {{customer.name}}<button @click="$emit(\'update:modelValue\',false)">关闭记录</button></div>' }
const wrappers: ReturnType<typeof mount>[] = []
const render = async () => {
  const wrapper = mount(Entry, { props: { active: true, customer }, global: { plugins: [ElementPlus],
    stubs: { FilmServiceDialog: Dialog }, directives: { permission: {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const open = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.findAll('button').find(button => button.text() === '查看贴膜记录')!.trigger('click'); await flushPromises()
}
beforeEach(() => { Object.assign(access, { customers: true, query: true, accessories: true, film: true }); access.hidden.clear() })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })

it('客户详情仅在点击后打开现有贴膜弹窗，传入真实客户身份并支持关闭重开', async () => {
  const wrapper = await render()
  expect(wrapper.findComponent(Dialog).exists()).toBe(false)
  await open(wrapper)
  expect(wrapper.findComponent(Dialog).props('customer')).toEqual(customer)
  await wrapper.find('.film-history button').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(Dialog).exists()).toBe(false)
  await open(wrapper); expect(wrapper.findComponent(Dialog).exists()).toBe(true)
})

it('关闭父详情、切换客户及失去任一必要动作权限立即卸载原贴膜内容', async () => {
  const wrapper = await render()
  await open(wrapper)
  await wrapper.setProps({ customer: { ...customer, id: 10 } })
  expect(wrapper.findComponent(Dialog).exists()).toBe(false)
  await open(wrapper); expect(wrapper.findComponent(Dialog).props('customer').id).toBe(10)
  for (const key of ['customers', 'query', 'accessories', 'film'] as const) {
    access[key] = false; await flushPromises()
    expect(wrapper.text()).toBe(''); expect(wrapper.findComponent(Dialog).exists()).toBe(false)
    access[key] = true; await flushPromises(); await open(wrapper)
  }
  await wrapper.setProps({ active: false })
  expect(wrapper.text()).toBe(''); expect(wrapper.findComponent(Dialog).exists()).toBe(false)
})

it('客户与配件任一身份字段隐藏均不开放入口，恢复权限不自动恢复旧弹窗', async () => {
  const wrapper = await render()
  for (const field of ['customers_customersview.customer.name', 'customers_customersview.customer.phone',
    'accessories_accessoriesview.customer_info.customer_name', 'accessories_accessoriesview.customer_info.customer_phone']) {
    await open(wrapper)
    access.hidden.add(field); await flushPromises()
    expect(wrapper.text()).toBe('')
    access.hidden.clear(); await flushPromises()
    expect(wrapper.findComponent(Dialog).exists()).toBe(false)
  }
})

it('没有有效客户ID或身份内容时不开放入口，不能通过默认值办理其他客户', async () => {
  const wrapper = await render()
  for (const value of [null, { ...customer, id: 0 }, { ...customer, name: '' }, { ...customer, phone: '' }]) {
    await wrapper.setProps({ customer: value }); expect(wrapper.text()).toBe('')
  }
})
