import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import DashboardView from '@/views/dashboard/DashboardView.vue'
import { useRemindersStore } from '@/stores/reminders'

const hidden = vi.hoisted(() => new Set<string>())
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { name: '合成员工', username: 'synthetic-user' } }) }))
vi.mock('@/stores/siteSettings', () => ({ useSiteSettingsStore: () => ({ displayName: '合成站点' }) }))
vi.mock('@/composables/usePagePermissions', async () => {
  const { ref } = await import('vue')
  return { usePagePermissions: () => ({ canView: ref(true) }) }
})
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: vi.fn().mockResolvedValue(undefined), isFieldVisible: () => true },
  shouldShowActionColumn: () => false
}))
vi.mock('@/views/reminders/reminder-field-permissions', () => ({ canViewReminderField: (field: string) => !hidden.has(field) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ success: vi.fn(), handleApiError: vi.fn() }) }))
vi.mock('@/composables', async () => {
  const { ref } = await import('vue')
  return { useLoadingState: () => ({ loading: ref(false) }) }
})
vi.mock('@/composables/usePageCache', () => ({
  useCachedRequest: (_key: string, load: () => Promise<unknown>) => load(), DEFAULT_CACHE_TTL: { STATIC: 0 }
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: vi.fn().mockImplementation((url: string) => Promise.resolve({ success: true, data: url === '/dashboard' ? { stats: {} } : [] })) } }))
vi.mock('@/api/announcements', () => ({ announcementsApi: { listPublished: vi.fn().mockResolvedValue({ success: true, data: [] }) } }))

const item = {
  kind: 'reminder' as const, occurrence_id: 11, reminder_id: 8, title: '合成清洁任务',
  content: '清洁配件柜', priority: 'normal', recipient_status: 'snoozed' as const,
  scheduled_at: '2026-11-11 21:00:00', remind_at: '2026-11-08 21:00:00'
}
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  hidden.clear()
  vi.useFakeTimers()
  setActivePinia(createPinia())
})
afterEach(() => { wrapper?.unmount(); vi.useRealTimers() })
async function render() {
  wrapper = mount(DashboardView, { global: { stubs: {
    PermissionGate: { template: '<div><slot /></div>' }, PageHeader: true, SectionLoading: true,
    ComprehensiveWarnings: true, PendingApprovals: true, RichContent: true,
    ElButton: true, ElTag: { template: '<span><slot /></span>' }
  } } })
  await flushPromises()
  return wrapper
}
describe('首页个人待办公告', () => {
  it('无公共公告时也显示本人稍后提醒中的任务，完成后立即消失', async () => {
    const store = useRemindersStore()
    store.active = [item]
    const view = await render()
    expect(view.text()).toContain('合成员工，您的待办没有完成哦！')
    expect(view.text()).toContain('清洁配件柜')
    expect(view.text()).toContain('2026-11-11 21:00')
    store.complete(11)
    await flushPromises()
    expect(view.find('.dashboard-announcements').exists()).toBe(false)
  })
  it('公告中的标题、内容和执行时间分别遵守待办字段权限', async () => {
    useRemindersStore().active = [item]
    hidden.add('title')
    hidden.add('scheduled_at')
    const view = await render()
    expect(view.text()).not.toContain('合成清洁任务')
    expect(view.text()).not.toContain('2026-11-11 21:00')
    expect(view.text()).toContain('清洁配件柜')
    hidden.add('content')
    // 模拟权限变更后业务状态刷新引起渲染。
    useRemindersStore().active = []
    await flushPromises()
    expect(view.find('.dashboard-announcements').exists()).toBe(false)
  })
})
