import { afterEach, describe, expect, it, vi } from 'vitest'
import { simpleNotification } from '@/services/notification-simple'

const mocks = vi.hoisted(() => ({ message: vi.fn(), confirm: vi.fn(), alert: vi.fn(), prompt: vi.fn() }))
vi.mock('@/utils/element-feedback', () => ({
  showElementMessage: mocks.message,
  loadElementPlus: async () => ({ ElMessageBox: { confirm: mocks.confirm, alert: mocks.alert, prompt: mocks.prompt } })
}))

const defaults = simpleNotification.getDefaultConfig()
afterEach(() => { simpleNotification.setDefaultConfig(defaults); vi.resetAllMocks() })

describe('公共通知展示与关闭清理', () => {
  it('四类消息使用相同公共样式，错误保留较长时长，显式选项优先', () => {
    simpleNotification.setDefaultConfig({ duration: 4500, showClose: true })
    for (const type of ['success', 'error', 'warning', 'info'] as const) {
      simpleNotification[type]('操作结果')
      expect(mocks.message).toHaveBeenLastCalledWith(expect.objectContaining({
        type, message: '操作结果', duration: type === 'error' ? 6000 : 4500,
        customClass: 'tf-global-message', appendTo: document.body, showClose: true
      }))
    }
    simpleNotification.error('错误', { duration: 1200, showClose: false, offset: 35 })
    expect(mocks.message).toHaveBeenLastCalledWith(expect.objectContaining({ duration: 1200, showClose: false, offset: 35 }))
  })
  it.each([true, false])('确认接受=%s、提示及输入接受/取消后恢复页面表格', async accepted => {
    for (const mock of [mocks.confirm, mocks.alert, mocks.prompt]) {
      if (accepted) mock.mockResolvedValue({ value: '姓名' })
      else mock.mockRejectedValue('cancel')
    }
    expect(await simpleNotification.confirm('确认')).toBe(accepted)
    await simpleNotification.alert('提示')
    expect(await simpleNotification.prompt('姓名')).toEqual(accepted ? { value: '姓名' } : null)
    expect(document.body.classList.contains('el-message-box-open')).toBe(false)
    expect(document.getElementById('message-box-hide-tables')).toBeNull()
  })
})
