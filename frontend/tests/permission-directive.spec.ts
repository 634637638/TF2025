import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, nextTick, defineComponent, h, withDirectives, type PropType } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { vPermission, vPermissionNot } from '@/directives/permission'
import SalesPageHeader from '@/views/sales/page/SalesPageHeader.vue'

const mocks = vi.hoisted(() => ({ auth: { userPermissions: [] as string[], isAuthenticated: true, isActive: true } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
type PermissionValue = string | { permission: string | string[]; mode?: 'any' | 'all' }
const Button = defineComponent({
  props: { value: { type: [String, Object] as PropType<PermissionValue>, required: true }, inverse: Boolean },
  setup: props => () => withDirectives(h('button', '操作'), [[props.inverse ? vPermissionNot : vPermission, props.value]])
})
const wrappers: VueWrapper[] = []
const render = (value: PermissionValue, inverse = false) => {
  const wrapper = mount(Button, { props: { value, inverse } })
  wrappers.push(wrapper); return wrapper
}
beforeEach(() => { mocks.auth = reactive({ userPermissions: [], isAuthenticated: true, isActive: true }) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })
const actions = ['accessories:create', 'accessories:gift']

describe('公共权限指令', () => {
  it('任一动作获权即可显示配件销售入口，权限撤销后及时隐藏', async () => {
    const wrapper = render({ permission: actions })
    expect(wrapper.element.style.display).toBe('none')
    mocks.auth.userPermissions = ['accessories_accessoriesview:gift']; await nextTick()
    expect(wrapper.element.style.display).toBe('')
    mocks.auth.userPermissions = ['accessories:create']; await nextTick()
    expect(wrapper.element.style.display).toBe('')
    mocks.auth.userPermissions = ['sales:sell']; await nextTick()
    expect(wrapper.element.style.display).toBe('none')
  })
  it('all模式逐项校验，某模块通配不能代替其他模块动作', async () => {
    mocks.auth.userPermissions = ['accessories:*']
    const wrapper = render({ permission: ['accessories:create', 'sales:sell'], mode: 'all' })
    expect(wrapper.element.style.display).toBe('none')
    mocks.auth.userPermissions.push('sales:sell'); await nextTick()
    expect(wrapper.element.style.display).toBe('')
    await wrapper.setProps({ value: { permission: actions, mode: 'all' } })
    expect(wrapper.element.style.display).toBe('')
  })
  it('单权限和全局通配保持兼容，反向指令与更新后的绑定一致', async () => {
    const wrapper = render('accessories:create', true)
    expect(wrapper.element.style.display).toBe('')
    mocks.auth.userPermissions = ['accessories:create']; await nextTick()
    expect(wrapper.element.style.display).toBe('none')
    await wrapper.setProps({ value: 'accessories:gift' })
    expect(wrapper.element.style.display).toBe('')
    mocks.auth.userPermissions = ['*']; await nextTick()
    expect(wrapper.element.style.display).toBe('none')
    mocks.auth.userPermissions = ['all:*']; await nextTick()
    expect(wrapper.element.style.display).toBe('none')
  })
  it('销售页真实按钮在普通员工有销售或赠送权限时可见且能触发开单', async () => {
    mocks.auth.userPermissions = ['accessories:create']
    const wrapper = mount(SalesPageHeader, {
      props: { batchMode: false, selectedCount: 0, canSell: true, canSellGoods: true, canExport: false, exportLoading: false, refreshing: false },
      global: { directives: { permission: vPermission }, stubs: { PageHeader: { template: '<div><slot name="actions" /></div>' }, ElButton: { template: '<button><slot /></button>' } } }
    })
    wrappers.push(wrapper)
    const button = wrapper.findAll('button').find(item => item.text() === '销售商品')!
    expect(button.element.style.display).toBe('')
    await button.trigger('click'); expect(wrapper.emitted('sell-goods')).toHaveLength(1)
    mocks.auth.userPermissions = ['accessories:gift']; await nextTick()
    expect(button.element.style.display).toBe('')
    mocks.auth.userPermissions = []; await nextTick()
    expect(button.element.style.display).toBe('none')
  })
})
