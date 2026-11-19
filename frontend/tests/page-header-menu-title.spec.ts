import { computed, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import PageHeader from '@/components/base/PageHeader.vue'

const state = vi.hoisted(() => ({
  route: { path: '/payments' },
  menuStore: null as { menuItems: Array<{ id: number; name: string; url: string; icon: string }> } | null
}))

vi.mock('vue-router', () => ({ useRoute: () => state.route }))
vi.mock('@/stores/menu', () => {
  state.menuStore = reactive({ menuItems: [{ id: 1, name: '供应商打款', url: '/payments', icon: 'fas fa-money-bill' }] })
  return { useMenuStore: () => state.menuStore }
})
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({
  isMobile: computed(() => false),
  screenWidth: computed(() => 1280)
}) }))

const render = () => mount(PageHeader, {
  props: { title: '货款结算' },
  global: { stubs: { IconRenderer: true } }
})

afterEach(() => { if (state.menuStore) state.menuStore.menuItems = [{ id: 1, name: '供应商打款', url: '/payments', icon: 'fas fa-money-bill' }] })

it('页面标题优先跟随菜单名称，菜单改名后响应更新', async () => {
  const wrapper = render()
  expect(wrapper.find('h1').text()).toBe('供应商打款')
  state.menuStore!.menuItems = [{ id: 1, name: '供应商付款', url: '/payments', icon: 'fas fa-money-bill' }]
  await wrapper.vm.$nextTick()
  expect(wrapper.find('h1').text()).toBe('供应商付款')
  wrapper.unmount()
})

it('当前路由没有菜单项时保留页面标题', async () => {
  const wrapper = render()
  state.menuStore!.menuItems = []
  await wrapper.vm.$nextTick()
  expect(wrapper.find('h1').text()).toBe('货款结算')
  wrapper.unmount()
})
