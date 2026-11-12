import { afterEach, describe, expect, it, vi } from 'vitest'
const notification = vi.hoisted(() => ({ prompt: vi.fn(), warning: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => notification }))
import { useCustomerNamePrompt } from '@/composables/useCustomerNamePrompt'

afterEach(() => vi.resetAllMocks())
describe('公共姓名输入', () => {
  it('沿用公共输入服务并规范化后只提交一次', async () => {
    const save = vi.fn()
    notification.prompt.mockResolvedValue({ value: ' 张三  Test123 ' })
    const { promptCustomerName, promptingCustomerName } = useCustomerNamePrompt()
    await promptCustomerName('原姓名', save)
    expect(notification.prompt).toHaveBeenCalledWith('请输入客户姓名', '编辑客户姓名', expect.objectContaining({ inputValue: '原姓名' }))
    expect(save).toHaveBeenCalledExactlyOnceWith('张三 Test')
    expect(promptingCustomerName.value).toBe(false)
  })
  it.each([null, { value: '123! ' }])('取消或规范化后为空时不提交：%j', async result => {
    const save = vi.fn()
    notification.prompt.mockResolvedValue(result)
    await useCustomerNamePrompt().promptCustomerName('原姓名', save)
    expect(save).not.toHaveBeenCalled()
  })
  it('打开输入框和等待保存期间拒绝其他入口的重复触发', async () => {
    let resolvePrompt!: (result: { value: string }) => void
    let resolveSave!: () => void
    notification.prompt.mockReturnValue(new Promise(resolve => { resolvePrompt = resolve }))
    const save = vi.fn(() => new Promise<void>(resolve => { resolveSave = resolve }))
    const first = useCustomerNamePrompt(), second = useCustomerNamePrompt()
    const pending = first.promptCustomerName('旧姓名', save)
    await second.promptCustomerName('其他姓名', save)
    expect(notification.prompt).toHaveBeenCalledTimes(1)
    resolvePrompt({ value: '新姓名' })
    await Promise.resolve()
    await second.promptCustomerName('其他姓名', save)
    expect(save).toHaveBeenCalledTimes(1)
    resolveSave()
    await pending
    expect(first.promptingCustomerName.value).toBe(false)
  })
  it('异常后保留调用方草稿且允许重新输入', async () => {
    const editor = useCustomerNamePrompt(), save = vi.fn()
    notification.prompt.mockRejectedValueOnce(new Error('输入服务失败'))
    await editor.promptCustomerName('草稿', save)
    expect(save).not.toHaveBeenCalled()
    expect(notification.error).toHaveBeenCalledTimes(1)
    notification.prompt.mockResolvedValue({ value: '重试' })
    await editor.promptCustomerName('草稿', save)
    expect(save).toHaveBeenCalledExactlyOnceWith('重试')
  })
})
