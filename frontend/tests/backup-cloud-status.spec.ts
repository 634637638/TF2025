import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import ElementPlus from 'element-plus'
import BackupView from '@/views/backup/BackupView.vue'
import type { CloudBackupTask } from '@/types/backup'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
const cloud = vi.hoisted(() => ({ tasks: vi.fn(), upload: vi.fn() }))
const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), loading: vi.fn() }))
const permissions = vi.hoisted(() => ({ canDelete: true }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: api }))
vi.mock('@/api/backup', () => ({ backupCloudApi: cloud }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => notifications }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ canView: ref(true), canCreate: ref(true), canDelete: ref(permissions.canDelete), requirePermission: (action: string) => action !== 'delete' || permissions.canDelete }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: () => true }, shouldShowActionColumn: () => true }))
vi.mock('@/components/base', () => ({ PermissionGate: { template: '<div><slot /></div>' }, PageHeader: { template: '<header><slot name="actions" /></header>' } }))
vi.mock('@/views/backup/CloudBackupSettingsDialog.vue', () => ({ default: { template: '<div />' } }))

const filename = 'sql-20261110_120000.sql'
const task = (status: CloudBackupTask['status'], error = ''): CloudBackupTask => ({
  id: 'backup-task', accountId: 'account', filename, status, progress: status === 'success' ? 100 : 0,
  attempts: 1, size: 20, folderId: 'folder', createdAt: '2026-11-10T04:00:00Z', updatedAt: '2026-11-10T04:00:00Z', error
})
const openPage = async () => {
  const wrapper = mount(BackupView, { global: {
    plugins: [ElementPlus], stubs: {
      ElDialog: { props: ['modelValue'], template: '<section v-if="modelValue" class="dialog-test"><slot /><slot name="footer" /></section>' },
      TableLoadingRow: true, DataEmptyState: true
    },
    directives: { permission: {}, 'tf-loading': {} },
    config: { globalProperties: { $getActionColumnWidth: () => 260 } }
  } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  permissions.canDelete = true
  api.get.mockImplementation(async (url: string) => ({ success: true, data: url === '/backup/list'
    ? [{ filename, type: 'database', size: '20 Bytes', created_at: '2026-11-10T04:00:00Z' }]
    : { total_count: 1, total_size: '20 Bytes', backup_dir: '/synthetic/backups', backend_root: '/synthetic', total_size_bytes: 20 } }))
  cloud.tasks.mockResolvedValue({ success: true, data: [task('invalid', '该文件云端已删除，可重新上传！')] })
  cloud.upload.mockResolvedValue({ success: true, data: task('queued') })
})
afterEach(() => { vi.useRealTimers() })

describe('手动清理本地旧备份', () => {
  const backups = (count: number) => Array.from({ length: count }, (_, index) => ({
    filename: `sql-20261110_12000${index}.sql`, type: 'database', size: '20 Bytes', created_at: '2026-11-10T04:00:00Z'
  }))
  const buttonByText = (wrapper: Awaited<ReturnType<typeof openPage>>, text: string) =>
    wrapper.findAll('button').find(button => button.text().includes(text))!

  it.each([2, 4, 5])('%i 份备份时可打开清理弹窗，自选保留数量并提交', async count => {
    api.get.mockImplementation(async (url: string) => ({ success: true, data: url === '/backup/list' ? backups(count) : {} }))
    api.post.mockResolvedValue({ success: true, message: '已删除旧备份' })
    const wrapper = await openPage()
    const entry = buttonByText(wrapper, '清理旧备份')
    expect(entry.attributes('disabled')).toBeUndefined()
    await entry.trigger('click')
    expect(wrapper.text()).toContain('仅清理服务器本地备份，云盘文件不受影响')
    wrapper.findComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', 1)
    await buttonByText(wrapper, '确认清理').trigger('click')
    await flushPromises()
    expect(api.post).toHaveBeenCalledWith('/backup/cleanup', { keep_count: 1 }, { showError: false })
    expect(notifications.success).toHaveBeenCalledWith('已删除旧备份')
    expect(wrapper.find('.dialog-test').exists()).toBe(false)
    wrapper.unmount()
  })

  it('空列表禁用清理，缺少删除权限时不显示清理入口', async () => {
    api.get.mockResolvedValue({ success: true, data: [] })
    const empty = await openPage()
    expect(buttonByText(empty, '清理旧备份').attributes('disabled')).toBeDefined()
    empty.unmount()
    permissions.canDelete = false
    const denied = await openPage()
    expect(denied.findAll('button').some(button => button.text().includes('清理旧备份'))).toBe(false)
    expect(api.post).not.toHaveBeenCalled()
    denied.unmount()
  })

  it('清理失败提示并保留弹窗，可再次提交', async () => {
    api.post.mockRejectedValueOnce(new Error('清理服务暂不可用'))
    const wrapper = await openPage()
    await buttonByText(wrapper, '清理旧备份').trigger('click')
    await buttonByText(wrapper, '确认清理').trigger('click')
    await flushPromises()
    expect(notifications.error).toHaveBeenCalledWith('清理失败: 清理服务暂不可用')
    expect(wrapper.find('.dialog-test').exists()).toBe(true)
    expect(buttonByText(wrapper, '确认清理').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('备份列表云端文件状态', () => {
  it('云端删除显示文件失效及重新上传提示，保留上传入口', async () => {
    const wrapper = await openPage()
    expect(wrapper.text()).toContain('文件失效')
    expect(wrapper.text()).toContain('该文件云端已删除，可重新上传！')
    expect(wrapper.text()).not.toContain('上传失败')
    const warning = wrapper.findAllComponents({ name: 'ElTag' }).find(tag => tag.text() === '文件失效')
    expect(warning?.props('type')).toBe('warning')
    const button = wrapper.findAll('button').find(item => item.text().includes('上传云盘'))!
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(cloud.upload).toHaveBeenCalledWith(filename)
    wrapper.unmount()
  })

  it('云端恢复后轮询更新为已上传并清除失效文案，不再次上传', async () => {
    const wrapper = await openPage()
    cloud.tasks.mockResolvedValueOnce({ success: true, data: [task('success')] })
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(wrapper.text()).toContain('已上传')
    expect(wrapper.text()).not.toContain('文件失效')
    expect(wrapper.text()).not.toContain('该文件云端已删除')
    expect(cloud.upload).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('实际上传出错仍显示上传失败，状态读取失败不改掉已有文件状态', async () => {
    cloud.tasks.mockResolvedValueOnce({ success: true, data: [task('failed', '云盘网络请求失败')] })
    const wrapper = await openPage()
    expect(wrapper.text()).toContain('上传失败')
    expect(wrapper.text()).not.toContain('文件失效')
    cloud.tasks.mockRejectedValueOnce(new Error('状态读取失败'))
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(wrapper.text()).toContain('上传失败')
    expect(wrapper.text()).not.toContain('云端已删除')
    wrapper.unmount()
  })
})
