import { defineComponent, h, ref } from 'vue'
import { ElButton, ElCheckbox, ElForm, ElFormItem, ElInput } from 'element-plus'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useForm, ValidationRules } from '@/composables/forms/useForm'
import LoginView from '@/views/H5-mobile/page/LoginView.vue'
import RegisterView from '@/views/H5-mobile/page/RegisterView.vue'
import OrderQuery from '@/views/H5-mobile/page/OrderQuery.vue'

const mocks = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn(), orders: vi.fn(), push: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(), setToken: vi.fn(), setUser: vi.fn() }))
vi.mock('@/composables', () => ({ useForm, ValidationRules, useLoadingState: () => ({ loading: ref(false) }) }))
vi.mock('@/api/auth', () => ({ login: mocks.login, register: mocks.register, getUserOrders: vi.fn(), tokenManager: { setToken: mocks.setToken, isAuthenticated: () => false }, userManager: { setUser: mocks.setUser, getUser: () => null } }))
vi.mock('@/api/shop-public', () => ({ getPublicConfig: async () => ({ success: true, data: {} }), getOrdersByPhone: mocks.orders }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push, currentRoute: ref({ name: 'MobileOrderQuery' }) }), useRoute: () => ({ query: {} }) }))

const wrappers: ReturnType<typeof mount>[] = []
const render = async (view: typeof LoginView) => {
  const wrapper = mount(view, { global: { components: { ElButton, ElCheckbox, ElForm, ElFormItem, ElInput }, stubs: { RouterLink: defineComponent({ setup: (_, { slots }) => () => h('a', slots.default?.()) }), SectionLoading: true, DataEmptyState: true }, directives: { 'tf-loading': {} } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const fill = async (wrapper: ReturnType<typeof mount>, values: string[]) => {
  const inputs = wrapper.findAll('input:not([type="checkbox"])')
  for (const [index, value] of values.entries()) await inputs[index].setValue(value)
}
const click = async (wrapper: ReturnType<typeof mount>) => { await wrapper.get('.el-button').trigger('click'); await flushPromises() }
beforeEach(() => {
  mocks.login.mockResolvedValue({ token: 'mock-session', user: {} })
  mocks.register.mockResolvedValue({ token: 'mock-session', user: {} })
  mocks.orders.mockResolvedValue({ data: [{ customer_name: '张三', items: [] }], total: 1 })
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })

describe('H5 实际视图首次提交校验', () => {
  it('不先失焦也拒绝非法登录；合法格式手机号与原密码提交', async () => {
    const wrapper = await render(LoginView)
    await fill(wrapper, ['138中00138000', '  Ab<&123  '])
    await click(wrapper)
    expect(mocks.login).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(wrapper.text()).toContain('请输入正确的手机号'))
    await fill(wrapper, ['+86 138-0013-8000', '  Ab<&123  '])
    await click(wrapper)
    expect(mocks.login).toHaveBeenCalledExactlyOnceWith({ phone: '13800138000', password: '  Ab<&123  ' })
  })
  it('注册必须同意协议且两次密码一致，失败不写认证状态', async () => {
    const wrapper = await render(RegisterView)
    await fill(wrapper, ['张三', '13800138000', 'Abc123', 'Abc124'])
    await click(wrapper)
    expect(mocks.register).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(wrapper.text()).toContain('两次输入的密码不一致'))
    await vi.waitFor(() => expect(wrapper.text()).toContain('请阅读并同意用户协议和隐私政策'))
    expect(mocks.setToken).not.toHaveBeenCalled()
    await fill(wrapper, ['张三', '13800138000', 'Abc123', 'Abc123'])
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await click(wrapper)
    expect(mocks.register).toHaveBeenCalledExactlyOnceWith({ name: '张三', phone: '13800138000', password: 'Abc123' })
  })
  it('订单验证拒绝纯空白姓名和非法手机号，合法值才查询', async () => {
    const wrapper = await render(OrderQuery)
    await fill(wrapper, ['138001380001', '   '])
    await click(wrapper)
    expect(mocks.orders).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(wrapper.text()).toContain('请输入姓名'))
    await fill(wrapper, ['13800138000', '张三'])
    await click(wrapper)
    expect(mocks.orders).toHaveBeenCalledExactlyOnceWith('13800138000', { page: 1, page_size: 10, customer_name: '张三' })
  })
})
