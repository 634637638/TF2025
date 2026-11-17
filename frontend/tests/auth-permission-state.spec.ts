import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { canAccessRoutePath } from '@/constants/routePermissions'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(),
  saved: null as unknown, token: '', warning: vi.fn()
}))
vi.mock('@/utils/element-feedback', () => ({ showElementWarning: mocks.warning }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: mocks.get, post: mocks.post } }))
vi.mock('@/services/storage', () => ({ storage: {
  getAuth: () => mocks.saved, getToken: () => mocks.token,
  setAuth: (value: unknown) => { mocks.saved = value },
  setToken: (value: string) => { mocks.token = value },
  get: () => null, has: () => false, set: vi.fn(), remove: vi.fn()
} }))
vi.mock('@/utils/auth-session', () => ({
  clearPersistedAuthData: vi.fn(), setBackendDisconnectedState: vi.fn()
}))
const profile = { id: 7, username: 'isolated', status: 1, roles: ['销售员'] }
const readyResponses = (status = 1) => {
  mocks.get.mockImplementation(async (url: string) => url === '/auth/user'
    ? { success: true, data: { ...profile, status } }
    : { success: true, data: { userPermissions: ['sales_salesview:view', 'sales_salesview:sell'], roles: ['销售员'] } })
}
let store: ReturnType<typeof useAuthStore>
beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState({}, '', '/login')
  setActivePinia(createPinia())
  mocks.token = 'isolated-session-token'
  mocks.saved = { token: mocks.token, user: profile, permissions: ['*'], roles: ['管理员'] }
  mocks.get.mockReset()
  mocks.post.mockReset()
})
afterEach(() => { store?.$dispose(); vi.clearAllTimers(); vi.useRealTimers() })

it('缓存身份必须核验；503 不恢复缓存权限，成功重试后才允许路由和动作', async () => {
  mocks.get.mockRejectedValue({ response: { status: 503 } })
  store = useAuthStore()
  expect(store.hasPermission('sales:sell')).toBe(false)
  await store.loadPersistedAuthData()
  expect(store.token).toBe('isolated-session-token')
  expect(store.isAuthReady).toBe(false)
  expect(store.hasAnyPermission(['sales:view', 'sales:sell'])).toBe(false)
  expect(store.hasRole('管理员')).toBe(false)
  expect(canAccessRoutePath('/sales', store)).toBe(false)
  readyResponses()
  await store.fetchUserInfo()
  expect(store.isAuthReady).toBe(true)
  expect(store.hasPermission('sales:sell')).toBe(true)
  expect(canAccessRoutePath('/sales', store)).toBe(true)
  expect(store.hasPermission('permissions:admin')).toBe(false)
  expect(store.hasRole('管理员')).toBe(false)
})

it.each(['USER_INACTIVE', 'TOKEN_INVALID', 'TOKEN_REVOKED'])('401 %s 清理身份，不恢复旧缓存授权', async code => {
  mocks.get.mockRejectedValue({ response: { status: 401, data: { code } } })
  store = useAuthStore()
  await store.loadPersistedAuthData()
  expect(store.token).toBe('')
  expect(store.user).toBeNull()
  expect(store.isAuthReady).toBe(false)
  expect(store.hasPermission('sales:sell')).toBe(false)
})

it('刷新期间停止授权，停用状态 0 不转为启用', async () => {
  readyResponses()
  store = useAuthStore()
  await store.loadPersistedAuthData()
  expect(store.hasPermission('sales:sell')).toBe(true)
  readyResponses(0)
  const refresh = store.fetchUserInfo()
  expect(store.isAuthReady).toBe(false)
  expect(store.hasPermission('sales:sell')).toBe(false)
  await refresh
  expect(store.user?.status).toBe(0)
  expect(store.isActive).toBe(false)
  expect(store.hasAnyPermission(['sales:view'])).toBe(false)
})

it('仅有持久化身份且角色齐全也必须核验，无效响应不得放行', async () => {
  mocks.token = ''
  mocks.get.mockResolvedValue({ success: false })
  store = useAuthStore()
  await store.loadPersistedAuthData()
  expect(mocks.get).toHaveBeenCalledWith('/auth/user', expect.any(Object))
  expect(store.isAuthReady).toBe(false)
  expect(canAccessRoutePath('/sales', store)).toBe(false)
})

it('令牌刷新失败或响应不完整时清除旧授权', async () => {
  for (const response of [{ success: false }, { success: true, data: {} }]) {
    readyResponses()
    store = useAuthStore()
    await store.loadPersistedAuthData()
    store.lastActivity = Date.now() - 31 * 60 * 1000
    mocks.post.mockResolvedValue(response)
    expect(await store.refreshAuth()).toBe(false)
    expect(store.hasPermission('sales:sell')).toBe(false)
    expect(store.isAuthReady).toBe(false)
    store.$dispose()
  }
})

it('退出后到达的旧身份响应不能恢复登录和权限', async () => {
  let finishUser: ((value: unknown) => void) | undefined
  mocks.get.mockImplementation((url: string) => url === '/auth/user'
    ? new Promise(resolve => { finishUser = resolve })
    : Promise.resolve({ success: true, data: { userPermissions: ['*'] } }))
  store = useAuthStore()
  const pending = store.loadPersistedAuthData()
  store.clearAuth(false)
  finishUser?.({ success: true, data: profile })
  await pending
  expect(store.token).toBe('')
  expect(store.isAuthReady).toBe(false)
  expect(store.hasPermission('sales:sell')).toBe(false)
})

it('登录响应中的停用状态不能转成启用，缺少用户 ID 的响应不得登录', async () => {
  store = useAuthStore()
  mocks.post.mockResolvedValue({ success: true, data: { token: 'isolated-new-session', user: { ...profile, status: 0 }, permissions: ['permissions:admin'] } })
  await store.login({ username: 'isolated', password: 'isolated-password' })
  expect(store.isActive).toBe(false)
  expect(store.isAdmin).toBe(false)
  expect(store.hasPermission('sales:sell')).toBe(false)
  mocks.post.mockResolvedValue({ success: true, data: { token: 'isolated-new-session', user: {}, permissions: ['*'] } })
  await expect(store.login({ username: 'isolated', password: 'isolated-password' })).rejects.toThrow('登录响应数据不完整')
})

it('明确空权限列表优先于摘要，不能从旧摘要恢复已撤销的权限', async () => {
  mocks.get.mockImplementation(async (url: string) => url === '/auth/user'
    ? { success: true, data: profile }
    : { success: true, data: { userPermissions: [], summary: { sales_salesview: { permissions: ['view', 'sell'] } } } })
  store = useAuthStore()
  await store.loadPersistedAuthData()
  expect(store.userPermissions).toEqual([])
  expect(store.hasPermission('sales:sell')).toBe(false)
  expect(canAccessRoutePath('/sales', store)).toBe(false)
})

it('主动退出先通过统一 API 注销服务器会话，再清理本地身份', async () => {
  readyResponses()
  store = useAuthStore()
  await store.loadPersistedAuthData()
  let complete: ((value: { success: boolean }) => void) | undefined
  mocks.post.mockImplementation((url: string) => {
    expect(url).toBe('/auth/logout')
    expect(store.token).toBe('isolated-session-token')
    return new Promise(resolve => { complete = resolve })
  })
  const pending = store.logout()
  expect(mocks.post).toHaveBeenCalledWith('/auth/logout', undefined, { showLoading: false, showError: false })
  expect(store.isAuthReady).toBe(false)
  expect(store.hasPermission('sales:sell')).toBe(false)
  complete?.({ success: true })
  await pending
  expect(store.token).toBe('')
  expect(store.user).toBeNull()
})

it('退出期间未完成的身份查询不能恢复旧权限', async () => {
  readyResponses()
  store = useAuthStore()
  await store.loadPersistedAuthData()
  let complete: ((value: unknown) => void) | undefined
  mocks.get.mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const check = store.fetchUserInfo()
  mocks.post.mockResolvedValue({ success: true })
  await store.logout()
  mocks.get.mockResolvedValue({ success: true, data: { userPermissions: ['sales:sell'] } })
  complete?.({ success: true, data: profile })
  await check
  expect(store.token).toBe('')
  expect(store.isAuthReady).toBe(false)
  expect(store.hasPermission('sales:sell')).toBe(false)
})

it.each(['network', 'invalid-response'])('服务器注销未确认（%s）仍清本地并提示，不能报告服务器已退出', async failure => {
  readyResponses()
  store = useAuthStore()
  await store.loadPersistedAuthData()
  mocks.warning.mockClear()
  if (failure === 'network') mocks.post.mockRejectedValue(new Error('isolated-network'))
  else mocks.post.mockResolvedValue({ success: false })
  await store.logout()
  expect(store.token).toBe('')
  expect(store.user).toBeNull()
  expect(store.isAuthReady).toBe(false)
  expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining('服务器注销未确认'))
})
