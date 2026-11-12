import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useRemindersStore } from '@/stores/reminders'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import ReminderHost from '@/components/ReminderHost.vue'

const routeGuard = vi.hoisted(() => ({ register: vi.fn<(guard: () => boolean) => () => void>(() => vi.fn()) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ beforeEach: routeGuard.register }) }))
const pendingGet = vi.hoisted(() => vi.fn())
const activeGet = vi.hoisted(() => vi.fn())
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
const notifications = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: api }))
vi.mock('@/utils/logger', () => ({ logger: { debug: vi.fn(), error: vi.fn() } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => notifications }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { init: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('@/views/reminders/reminder-field-permissions', () => ({ canViewReminderField: () => true }))
vi.mock('@/stores/auth', async () => {
  const { ref } = await import('vue')
  const { defineStore } = await import('pinia')
  return { useAuthStore: defineStore('test-auth', () => ({ isAuthenticated: ref(true), exitLock: ref(false), hasAnyPermission: () => false })) }
})
vi.mock('@/stores/app', async () => {
  const { ref } = await import('vue')
  const { defineStore } = await import('pinia')
  return { useAppStore: defineStore('test-app', () => ({ notificationsEnabled: ref(true) })) }
})

const dialog = {
  props: { modelValue: Boolean, showClose: Boolean, beforeClose: Function },
  template: '<section v-if="modelValue"><slot /><footer><slot name="footer" /></footer></section>'
}
const button = { template: '<button><slot /></button>' }
const reminder = (extra = {}) => ({
  occurrence_id: 11, reminder_id: 8, title: '合成待办', priority: 'normal',
  scheduled_at: '2026-11-11 21:00:00', remind_at: '2026-11-09 21:00:00', ...extra
})
let testPinia: ReturnType<typeof createPinia>
const wrappers: ReturnType<typeof mount>[] = []
async function render() {
  const wrapper = mount(ReminderHost, {
    global: { plugins: [testPinia], stubs: { MobileDialog: dialog, ElButton: button, ElDropdown: true, ElDropdownMenu: true, ElDropdownItem: true, ElDatePicker: true } }
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  vi.resetAllMocks()
  testPinia = createPinia()
  setActivePinia(testPinia)
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date('2026-11-11T10:00:00+08:00'))
  useAppStore().notificationsEnabled = true
  activeGet.mockResolvedValue({ success: true, data: [] })
  api.get.mockImplementation((url: string, ...args: unknown[]) => url === '/reminders/my/active' ? activeGet() : pendingGet(url, ...args))
  api.post.mockResolvedValue({ success: true })
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.useRealTimers()
})

describe('全局提醒改期与完成回归', () => {
  it('改期后尚未到提醒时间或已被处理的旧弹窗在轮询时撤下', async () => {
    pendingGet.mockResolvedValueOnce({ success: true, data: [reminder()] })
      .mockResolvedValue({ success: true, data: [] })
    const wrapper = await render()
    expect(wrapper.text()).toContain('合成待办')
    await vi.advanceTimersByTimeAsync(60000)
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
    expect(pendingGet).toHaveBeenLastCalledWith('/reminders/my/pending', {
      showLoading: false, useCache: false, params: { queued_occurrence_ids: '11' }
    })
  })

  it('同一记录重新校验时更新标题和执行时间，保留单个弹窗', async () => {
    pendingGet.mockResolvedValueOnce({ success: true, data: [reminder({ scheduled_at: '2026-11-11 00:00:00' })] })
      .mockResolvedValue({ success: true, data: [reminder({ title: '修改后的待办' })] })
    const wrapper = await render()
    await vi.advanceTimersByTimeAsync(60000)
    await flushPromises()
    expect(wrapper.text()).toContain('修改后的待办')
    expect(wrapper.text()).toContain('2026-11-11 21:00')
    expect(wrapper.findAll('section')).toHaveLength(1)
    expect(wrapper.text()).toContain('1 / 1')
  })

  it('完成后旧轮询响应晚返回也不能恢复弹窗', async () => {
    let finish!: (response: { success: boolean; data: ReturnType<typeof reminder>[] }) => void
    pendingGet.mockResolvedValueOnce({ success: true, data: [reminder()] })
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = await render()
    await vi.advanceTimersByTimeAsync(60000)
    await wrapper.findAll('button').find(item => item.text().includes('已完成'))!.trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/reminders/occurrences/11/complete', {})
    finish({ success: true, data: [reminder()] })
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('保存完成失败时保留原提醒供重试', async () => {
    pendingGet.mockResolvedValue({ success: true, data: [reminder()] })
    api.post.mockRejectedValueOnce(new Error('合成网络错误'))
    const wrapper = await render()
    await wrapper.findAll('button').find(item => item.text().includes('已完成'))!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('合成待办')
    expect(notifications.error).toHaveBeenCalledWith('更新待办状态失败')
  })

  it('完成回包前轮询已移除旧记录时，不误删队列中的下一条任务', async () => {
    let finish!: (response: { success: boolean }) => void
    const next = reminder({ occurrence_id: 12, reminder_id: 9, title: '下一条待办' })
    pendingGet.mockResolvedValueOnce({ success: true, data: [reminder(), next] })
      .mockResolvedValue({ success: true, data: [next] })
    api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = await render()
    await wrapper.findAll('button').find(item => item.text().includes('已完成'))!.trigger('click')
    await vi.advanceTimersByTimeAsync(60000)
    await flushPromises()
    expect(wrapper.text()).toContain('下一条待办')
    finish({ success: true })
    await flushPromises()
    expect(wrapper.text()).toContain('下一条待办')
    expect(wrapper.text()).toContain('1 / 1')
  })
})

describe('最后3小时强制提醒', () => {
  it('时间自然跨入窗口后，即使普通通知关闭也弹出且禁止关闭与退出', async () => {
    useAppStore().notificationsEnabled = false
    activeGet.mockResolvedValue({ success: true, data: [reminder({ scheduled_at: '2026-11-11 13:01:00', recipient_status: 'snoozed' })] })
    const wrapper = await render()
    expect(wrapper.find('section').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(60000)
    await flushPromises()
    expect(wrapper.text()).toContain('最后3小时')
    expect(wrapper.findComponent(dialog).props('showClose')).toBe(false)
    const done = vi.fn()
    wrapper.findComponent(dialog).props('beforeClose')(done)
    expect(done).not.toHaveBeenCalled()
    expect(useAuthStore().exitLock).toBe(true)
    expect(routeGuard.register.mock.calls[0][0]()).toBe(false)
    await wrapper.findAll('button').find(item => item.text().includes('已完成'))!.trigger('click')
    await flushPromises()
    expect(useRemindersStore().active).toHaveLength(0)
    expect(wrapper.find('section').exists()).toBe(false)
    expect(routeGuard.register.mock.calls[0][0]()).toBe(true)
    expect(useAuthStore().exitLock).toBe(false)
  })

  it('强制窗口前可关闭弹窗，未完成公告数据继续保留', async () => {
    activeGet.mockResolvedValue({ success: true, data: [reminder()] })
    pendingGet.mockResolvedValue({ success: true, data: [reminder()] })
    const wrapper = await render()
    expect(wrapper.findComponent(dialog).props('showClose')).toBe(true)
    const done = vi.fn()
    wrapper.findComponent(dialog).props('beforeClose')(done)
    await flushPromises()
    expect(done).toHaveBeenCalledOnce()
    expect(useRemindersStore().active).toHaveLength(1)
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('多个强制任务按执行时间处理，全部完成后才放行', async () => {
    const first = reminder({ scheduled_at: '2026-11-11 12:00:00' })
    const second = reminder({ occurrence_id: 12, title: '第二条强制任务', scheduled_at: '2026-11-11 13:00:00' })
    activeGet.mockResolvedValue({ success: true, data: [first, second] })
    pendingGet.mockResolvedValue({ success: true, data: [] })
    const wrapper = await render()
    for (const title of ['合成待办', '第二条强制任务']) {
      expect(wrapper.text()).toContain(title)
      expect(routeGuard.register.mock.calls[0][0]()).toBe(false)
      await wrapper.findAll('button').find(item => item.text().includes('已完成'))!.trigger('click')
      await flushPromises()
    }
    expect(routeGuard.register.mock.calls[0][0]()).toBe(true)
  })
})


it.each([null, '2026-11-11 21:00:00'])('服务端强制状态优先于隐藏时间或客户端时钟，普通弹窗接口失败也不影响', async scheduled_at => {
  activeGet.mockResolvedValue({ success: true, data: [reminder({ scheduled_at, is_mandatory: 1 })] })
  pendingGet.mockRejectedValue(new Error('合成普通提醒错误'))
  const wrapper = await render()
  expect(wrapper.text()).toContain('最后3小时')
  expect(wrapper.findComponent(dialog).props('showClose')).toBe(false)
  expect(wrapper.find('el-dropdown-stub').exists()).toBe(false)
})

it('完成后迟到的个人未完成清单不能恢复公告和强制弹窗', async () => {
  let finishActive!: (value: { success: boolean; data: ReturnType<typeof reminder>[] }) => void
  const task = reminder({ scheduled_at: '2026-11-11 12:00:00' })
  activeGet.mockResolvedValueOnce({ success: true, data: [task] })
    .mockImplementationOnce(() => new Promise(resolve => { finishActive = resolve }))
  pendingGet.mockResolvedValue({ success: true, data: [] })
  const wrapper = await render()
  await vi.advanceTimersByTimeAsync(60000)
  await wrapper.findAll('button').find(item => item.text().includes('已完成'))!.trigger('click')
  await flushPromises()
  finishActive({ success: true, data: [task] })
  await flushPromises()
  expect(useRemindersStore().active).toHaveLength(0)
  expect(wrapper.find('section').exists()).toBe(false)
})
