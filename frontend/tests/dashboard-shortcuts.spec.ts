import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElInput, ElSelect } from 'element-plus'
import DashboardQuickAccess from '@/views/dashboard/page/DashboardQuickAccess.vue'
import DashboardShortcutsCard from '@/views/system/page/DashboardShortcutsCard.vue'
import { useDashboardShortcutsStore } from '@/stores/dashboard-shortcuts'
import { usePageShortcuts, useRouteDialog } from '@/composables/useRouteDialog'
import { canUseShortcut, DASHBOARD_SHORTCUT_ACTIONS, getShortcutActionGroups, getShortcutDestination, getShortcutPages } from '@/utils/dashboard-shortcuts'
import type { DashboardShortcut } from '@/types/dashboard-shortcut'

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  success: vi.fn(), warning: vi.fn(), error: vi.fn(), confirm: vi.fn() }))
vi.mock('@/api/dashboard-shortcuts', () => ({ dashboardShortcutsApi: mocks }))
const acl = reactive({ permissions: ['dashboard:view', 'system:view', 'system:edit', 'system:delete', 'inventory:view', 'inventory:create', 'accessories:view', 'accessories:stock-in', 'accessories:create', 'query:view', 'query:goods-view', 'query:goods-sell'], mobile: false })
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: (permission: string) => acl.permissions.includes('*') || acl.permissions.includes(permission) }) }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: computed(() => acl.mobile) }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/utils/message-box', () => ({ confirmAction: mocks.confirm }))
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn() } }))

const entry = (patch: Partial<DashboardShortcut> = {}): DashboardShortcut => ({ id: 'f14b61ea-213c-4599-9121-111111111111',
  label: '商品销售', kind: 'action', target: 'goods-sale', icon: 'fas fa-shopping-cart', sortOrder: 1, enabled: true, ...patch })
async function makeRouter(path = '/dashboard') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', meta: { requiresAuth: true }, component: { template: '<router-view />' }, children: [
      ...[['dashboard', '首页'], ['inventory', '手机库存'], ['accessories', '配件管理'], ['query', '综合查询'], ['system', '系统设置']].map(([path, title]) => ({ path, meta: { title }, component: { template: '<div />' } })),
      { path: 'query/:id', meta: { title: '动态详情' }, component: { template: '<div />' } }
    ] },
    { path: '/404', meta: { title: '未找到', requiresAuth: false }, component: { template: '<div />' } },
    { path: '/public', meta: { title: '公开页面', requiresAuth: false }, component: { template: '<div />' } }
  ] })
  await router.push(path); await router.isReady(); return router
}
let wrapper: VueWrapper | undefined
beforeEach(() => {
  setActivePinia(createPinia())
  acl.permissions = ['dashboard:view', 'system:view', 'system:edit', 'system:delete', 'inventory:view', 'inventory:create', 'accessories:view', 'accessories:stock-in', 'accessories:create', 'query:view', 'query:goods-view', 'query:goods-sell']
  acl.mobile = false
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.list.mockResolvedValue({ success: true, data: [] })
  mocks.confirm.mockResolvedValue(true)
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined })

const globals = (router: Router) => ({ plugins: [createPinia(), router, ElementPlus],
  stubs: {
    IconRenderer: { props: ['icon'], template: '<i :data-icon="icon" />' },
    SectionLoading: { template: '<span>加载中</span>' }, DataEmptyState: { props: ['description'], template: '<div>{{ description }}</div>' },
    RecordDetailDialog: { props: ['modelValue'], template: '<div v-if="modelValue" class="record-detail"><slot name="actions" /></div>' },
    MobileDialog: { props: ['modelValue'], template: '<div v-if="modelValue" class="dialog"><slot /><slot name="footer" /></div>' }
  }, directives: { permission: {}, 'tf-loading': {}, 'table-double-tap': {} } })

const mountRouteHost = (router: Router, install: () => void) => mount(defineComponent({
  setup() { install(); return () => h('div') }
}), { global: { plugins: [router] } })
const mountRouteDialog = (router: Router, options: Parameters<typeof useRouteDialog>[0]) => mountRouteHost(router, () => useRouteDialog(options))

describe('快捷方式目标及权限', () => {
  it('仅提供已注册、已登录和有映射的业务页面，排除公开页、动态详情及未知路径', async () => {
    const router = await makeRouter()
    expect(getShortcutPages(router).map(item => item.value).sort()).toEqual(['/accessories', '/dashboard', '/inventory', '/query', '/system'])
    expect(getShortcutDestination(entry({ kind: 'page', target: '/missing' }), router)).toBeNull()
    expect(getShortcutDestination(entry({ kind: 'page', target: '//example.com' }), router)).toBeNull()
    expect(getShortcutDestination(entry({ target: 'unknown-action' }), router)).toBeNull()
    expect(getShortcutDestination(entry(), router)).toEqual({ path: '/query', query: { mode: 'goods', openSale: 'true' } })
  })
  it('页面权限、功能动作及停用分别控制；有赠送权限也可打开原商品收银', async () => {
    const router = await makeRouter()
    for (const [permissions, expected] of [
      [['query:view', 'query:goods-view', 'query:goods-sell'], true],
      [['query:view', 'query:goods-view', 'query:goods-gift'], true],
      [['query:view', 'query:goods-view'], false], [['query:goods-view', 'query:goods-sell'], false], [['query:view', 'query:goods-sell'], false]
    ] as const) {
      expect(canUseShortcut(entry(), router, { hasPermission: permission => permissions.some(item => item === permission) })).toBe(expected)
    }
    expect(canUseShortcut(entry({ enabled: false }), router, { hasPermission: () => true })).toBe(false)
    expect(canUseShortcut(entry({ target: 'phone-stock-in' }), router, { hasPermission: permission => permission === 'inventory:view' })).toBe(false)
  })
  it('商品入库快捷方式使用独立的配件入库权限，不要求商品档案创建权限', async () => {
    const router = await makeRouter()
    const stockIn = entry({ label: '商品入库', target: 'goods-stock-in', icon: 'fas fa-box-open' })
    const hasStockIn = (permissions: string[]) => canUseShortcut(stockIn, router, {
      hasPermission: permission => permissions.includes(permission)
    })
    expect(hasStockIn(['accessories:view', 'accessories:stock-in'])).toBe(true)
    expect(hasStockIn(['accessories:view', 'accessories:create'])).toBe(false)
    expect(hasStockIn(['accessories:stock-in'])).toBe(false)
  })
})

describe('快捷方式 Pinia 状态', () => {
  it('管理保存后同步首页，停用不展示；旧读取不能覆盖保存结果', async () => {
    let finish: (value: { success: boolean; data: DashboardShortcut[] }) => void = () => {}
    mocks.list.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const store = useDashboardShortcutsStore()
    const pending = store.load()
    mocks.create.mockResolvedValue({ success: true, data: [entry(), entry({ id: 'other', enabled: false })] })
    const { id: _id, ...input } = entry()
    await store.save(null, input)
    finish({ success: true, data: [] }); await pending
    expect(store.items).toHaveLength(1)
    expect(store.managedItems).toHaveLength(2)
    expect(store.loading).toBe(false)
  })
  it('保存失败保留旧数据；保存中再次点击不产生重复请求', async () => {
    const store = useDashboardShortcutsStore(); store.items = [entry()]
    let reject: (reason: Error) => void = () => {}
    mocks.remove.mockReturnValue(new Promise((_resolve, rejectPromise) => { reject = rejectPromise }))
    const first = store.save(entry().id, null)
    expect(await store.save(entry().id, null)).toBe(false)
    reject(new Error('保存失败'))
    await expect(first).rejects.toThrow('保存失败')
    expect(store.items).toEqual([entry()]); expect(store.saving).toBe(false)
    expect(mocks.remove).toHaveBeenCalledOnce()
  })
})

describe('首页和后台实际组件', () => {
  it('无配置时不显示空卡片；显示已启用且有权限的入口，点击到商品模式并带打开参数', async () => {
    const router = await makeRouter()
    wrapper = mount(DashboardQuickAccess, { global: globals(router) }); await flushPromises()
    expect(wrapper.text()).toBe('')
    const store = useDashboardShortcutsStore()
    store.items = [entry(), entry({ id: 'off', label: '已关闭入口', enabled: false }), entry({ id: 'bad', label: '失效路径', kind: 'page', target: '/missing' })]
    await flushPromises()
    expect(wrapper.text()).toContain('快捷方式'); expect(wrapper.text()).not.toContain('已关闭入口')
    await wrapper.get('button').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/query?mode=goods&openSale=true')
    acl.permissions = acl.permissions.filter(permission => permission !== 'query:goods-sell')
    await flushPromises(); expect(wrapper.text()).toBe('')
  })
  it('读取失败展示重试，重试成功不伪装成仍加载失败', async () => {
    mocks.list.mockRejectedValueOnce(new Error('读取失败')).mockResolvedValueOnce({ success: true, data: [entry()] })
    const router = await makeRouter()
    wrapper = mount(DashboardQuickAccess, { global: globals(router) }); await flushPromises()
    expect(wrapper.text()).toContain('暂时无法加载')
    await wrapper.get('button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('商品销售'); expect(wrapper.text()).not.toContain('重试')
  })
  it('管理新增默认启用，可选页面/功能，选择目标可自动命名，保存后回显', async () => {
    const router = await makeRouter('/system')
    wrapper = mount(DashboardShortcutsCard, { props: { canEdit: true, canDelete: true }, global: globals(router) }); await flushPromises()
    await wrapper.findAll('button').find(item => item.text().includes('新增快捷方式'))!.trigger('click')
    const selects = wrapper.findAllComponents(ElSelect)
    selects[0].vm.$emit('update:modelValue', 'action'); selects[0].vm.$emit('change', 'action'); await flushPromises()
    selects[1].vm.$emit('update:modelValue', 'goods-sale'); selects[1].vm.$emit('change', 'goods-sale'); await flushPromises()
    expect(wrapper.findComponent(ElInput).props('modelValue')).toBe('商品销售')
    mocks.create.mockResolvedValue({ success: true, data: [entry()] })
    await wrapper.findAll('button').find(item => item.text() === '保存')!.trigger('click'); await flushPromises()
    expect(mocks.create).toHaveBeenCalledWith({ label: '商品销售', kind: 'action', target: 'goods-sale', icon: 'fas fa-bolt', sortOrder: 0, enabled: true })
    expect(wrapper.find('.dialog').exists()).toBe(false)
    expect(wrapper.text()).toContain('商品销售')
  })
  it('编辑取消不写入，删除须确认，删除后同步首页；只读用户没有编辑删除入口', async () => {
    mocks.list.mockResolvedValue({ success: true, data: [entry()] })
    const router = await makeRouter('/system')
    wrapper = mount(DashboardShortcutsCard, { props: { canEdit: true, canDelete: true }, global: globals(router) }); await flushPromises()
    await wrapper.get('[aria-label="编辑快捷方式"]').trigger('click')
    await wrapper.get('.dialog input').setValue('草稿')
    await wrapper.findAll('button').find(item => item.text() === '取消')!.trigger('click')
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled()
    mocks.confirm.mockRejectedValueOnce('cancel')
    await wrapper.get('[aria-label="删除快捷方式"]').trigger('click'); await flushPromises()
    expect(mocks.remove).not.toHaveBeenCalled()
    mocks.remove.mockResolvedValue({ success: true, data: [] })
    await wrapper.get('[aria-label="删除快捷方式"]').trigger('click'); await flushPromises()
    expect(mocks.remove).toHaveBeenCalledWith(entry().id)
    expect(useDashboardShortcutsStore().items).toEqual([])
    await wrapper.setProps({ canEdit: false, canDelete: false })
    expect(wrapper.find('[aria-label="编辑快捷方式"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('新增快捷方式')
  })
  it('编辑沿用原编号，可修改显示名称和启停并同步管理列表与首页', async () => {
    mocks.list.mockResolvedValue({ success: true, data: [entry()] })
    const router = await makeRouter('/system')
    wrapper = mount(DashboardShortcutsCard, { props: { canEdit: true, canDelete: true }, global: globals(router) }); await flushPromises()
    await wrapper.get('[aria-label="编辑快捷方式"]').trigger('click')
    await wrapper.get('.dialog input').setValue('快速收银')
    await wrapper.get('.dialog [role="switch"]').trigger('click')
    mocks.update.mockResolvedValue({ success: true, data: [entry({ label: '快速收银', enabled: false })] })
    await wrapper.findAll('button').find(item => item.text() === '保存')!.trigger('click'); await flushPromises()
    const { id, ...input } = entry({ label: '快速收银', enabled: false })
    expect(mocks.update).toHaveBeenCalledWith(id, input)
    expect(useDashboardShortcutsStore().items).toHaveLength(0)
    expect(wrapper.text()).toContain('快速收银'); expect(wrapper.text()).toContain('已停用')
  })
  it('手机管理卡片不显示行内操作，双击后在公共详情执行操作', async () => {
    acl.mobile = true
    mocks.list.mockResolvedValue({ success: true, data: [entry()] })
    const router = await makeRouter('/system')
    wrapper = mount(DashboardShortcutsCard, { props: { canEdit: true, canDelete: true }, global: globals(router) }); await flushPromises()
    expect(wrapper.find('article button').exists()).toBe(false)
    await wrapper.get('article').trigger('dblclick'); await flushPromises()
    expect(wrapper.find('.record-detail').text()).toContain('编辑')
  })
})

describe('快捷功能弹窗参数', () => {
  it('功能候选按页面归组，可用页面或功能名称检索，失效页面不出现在候选中', async () => {
    const router = await makeRouter()
    const groups = getShortcutActionGroups(router)
    expect(groups.find(group => group.label === '配件管理')?.options.map(option => option.value)).toContain('goods-template-create')
    expect(groups.flatMap(group => group.options).find(option => option.value === 'customer-create')).toBeUndefined()
    expect(groups.flatMap(group => group.options).find(option => option.value === 'goods-sale')?.searchLabel).toContain('综合查询')
  })
  it('所有已登记的新功能均通过公共处理消费参数、只打开指定入口且可再次进入', async () => {
    acl.permissions = ['*']
    for (const action of DASHBOARD_SHORTCUT_ACTIONS.filter(action => 'shortcut' in action.query)) {
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: action.path, component: { template: '<div />' } }] })
      await router.push({ path: action.path, query: { ...action.query, keep: 'yes' } }); await router.isReady()
      const open = vi.fn()
      const component = mountRouteHost(router, () => usePageShortcuts(action.path, { [action.id]: { open } }))
      try {
        await flushPromises()
        expect(open, action.id).toHaveBeenCalledOnce()
        expect(router.currentRoute.value.query).toEqual({ keep: 'yes' })
        await router.push({ path: action.path, query: action.query }); await flushPromises()
        expect(open, action.id).toHaveBeenCalledTimes(2)
      } finally { component.unmount() }
    }
  })
  it('功能仍需页面、动作和字段权限，等异步初始化完成再处理', async () => {
    const router = await makeRouter('/accessories?shortcut=goods-template-create')
    const ready = ref(false); const fieldAllowed = ref(false); const open = vi.fn()
    wrapper = mountRouteHost(router, () => usePageShortcuts('/accessories', {
      'goods-template-create': { open, ready: () => ready.value, allowed: () => fieldAllowed.value }
    }))
    await flushPromises(); expect(router.currentRoute.value.query.shortcut).toBe('goods-template-create')
    ready.value = true; await flushPromises()
    expect(open).not.toHaveBeenCalled(); expect(router.currentRoute.value.query.shortcut).toBeUndefined()
    fieldAllowed.value = true; await flushPromises(); expect(open).not.toHaveBeenCalled()
    acl.permissions = acl.permissions.filter(permission => permission !== 'accessories:create')
    await router.push('/accessories?shortcut=goods-template-create'); await flushPromises(); expect(open).not.toHaveBeenCalled()
    acl.permissions = ['accessories:create']
    await router.push('/accessories?shortcut=goods-template-create'); await flushPromises(); expect(open).not.toHaveBeenCalled()
    acl.permissions.push('accessories:view')
    await router.push('/accessories?shortcut=goods-template-create'); await flushPromises(); expect(open).toHaveBeenCalledOnce()
  })
  it('公开业务页面须由路由明确开放，登录、错误和依赖记录的页面不能作为快捷目标', async () => {
    const router = await makeRouter()
    router.addRoute({ path: '/price-query', component: { template: '<div />' }, meta: { title: '报价查询', requiresAuth: false, dashboardShortcut: true } })
    router.addRoute({ path: '/record/:id', component: { template: '<div />' }, meta: { title: '记录', requiresAuth: false, dashboardShortcut: true } })
    expect(getShortcutPages(router).map(page => page.value)).toContain('/price-query')
    expect(getShortcutPages(router).map(page => page.value)).not.toContain('/record/:id')
    expect(canUseShortcut(entry({ kind: 'page', target: '/price-query' }), router, { hasPermission: () => false })).toBe(true)
  })
  it('等待异步面板就绪再打开，消费参数，保留其他参数，返回页面不会重复打开', async () => {
    const router = await makeRouter('/query?mode=goods&openSale=true')
    const ready = ref(false); const open = vi.fn()
    wrapper = mountRouteDialog(router, { path: '/query', flag: 'openSale', allowed: () => true, ready: () => ready.value, open })
    await flushPromises(); expect(open).not.toHaveBeenCalled()
    ready.value = true; await flushPromises()
    expect(open).toHaveBeenCalledOnce(); expect(router.currentRoute.value.query).toEqual({ mode: 'goods' })
    await router.push('/dashboard'); await router.push('/query?mode=goods'); await flushPromises()
    expect(open).toHaveBeenCalledOnce()
    await router.push('/query?mode=goods&openSale=true'); await flushPromises(); expect(open).toHaveBeenCalledTimes(2)
  })
  it('没有动作权限不打开且消费参数，之后获权不会自动打开旧请求', async () => {
    const router = await makeRouter('/accessories?openStockIn=true')
    const allowed = ref(false); const open = vi.fn()
    wrapper = mountRouteDialog(router, { path: '/accessories', flag: 'openStockIn', allowed: () => allowed.value, open })
    await flushPromises(); expect(router.currentRoute.value.query.openStockIn).toBeUndefined()
    allowed.value = true; await flushPromises(); expect(open).not.toHaveBeenCalled()
  })
})
