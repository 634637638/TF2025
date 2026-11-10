import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import CloudBackupSettingsDialog from '@/views/backup/CloudBackupSettingsDialog.vue'
import { backupCloudApi } from '@/api/backup'
import type { CloudAccount } from '@/types/backup'
import { ref } from 'vue'

const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => notifications }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ canDelete: ref(permissions.canDelete) }) }))
const permissions = vi.hoisted(() => ({ canDelete: true }))
vi.mock('@/api/backup', () => ({ backupCloudApi: { accounts: vi.fn(), saveAccount: vi.fn(), settings: vi.fn(), save: vi.fn(), test: vi.fn(), connect: vi.fn(), drives: vi.fn() } }))

const account: CloudAccount = { id: 'account-a', name: '自己的网盘', hasToken: true, folderId: 'existing-folder', folderName: '业务备份', driveId: 'drive', driveName: '资源库' }
const second: CloudAccount = { ...account, id: 'account-b', name: '第二个网盘', folderId: 'second-folder', folderName: '第二个目录' }
const stored = { enabled: true, ...account, accountId: account.id, accounts: [account, second], lastError: '',
  schedule: { enabled: false, intervalHours: 24, type: 'full' as const, nextRunAt: null, lastRunAt: null, lastStatus: 'idle' as const, lastError: '', lastFilename: '' },
  retention: { enabled: false, sqlCount: 10, zipCount: 10, lastRunAt: null, lastDeleted: 0, lastError: '' } }
const connection = (id = account.id) => ({ accountId: id, settings: stored, directory: id === second.id ? { ...second } : { ...account },
  directoryError: '', drives: [{ id: 'drive', name: '资源库' }], defaultDriveId: 'drive' })

beforeEach(() => {
  vi.clearAllMocks()
  permissions.canDelete = true
  vi.mocked(backupCloudApi.accounts).mockImplementation(async () => ({ success: true, data: { accountId: account.id, accounts: structuredClone([account, second]) } }))
  vi.mocked(backupCloudApi.settings).mockImplementation(async () => ({ success: true, data: structuredClone(stored) }))
  vi.mocked(backupCloudApi.save).mockImplementation(async () => ({ success: true, data: structuredClone(stored) }))
  vi.mocked(backupCloudApi.saveAccount).mockResolvedValue({ success: true, data: { ...account, id: 'new-account', name: '家庭网盘', folderId: '', folderName: '' } })
  vi.mocked(backupCloudApi.test).mockResolvedValue({ success: true, data: { folderName: '业务备份' } })
  vi.mocked(backupCloudApi.connect).mockImplementation(async id => ({ success: true, data: connection(id) }))
  vi.mocked(backupCloudApi.drives).mockImplementation(async id => ({ success: true, data: connection(id) }))
})

const openDialog = async (manageOnly = false) => {
  const wrapper = mount(CloudBackupSettingsDialog, {
    props: { modelValue: false, manageOnly },
    global: {
      plugins: [ElementPlus],
      stubs: {
        MobileDialog: { name: 'MobileDialog', props: ['showClose', 'closeOnPressEscape'], template: '<div><slot /><slot name="footer" /></div>' },
        SectionLoading: true,
        DataEmptyState: true,
        CloudDriveBrowser: true
      },
      directives: { permission: {} }
    }
  })
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  return wrapper
}

type DialogWrapper = Awaited<ReturnType<typeof openDialog>>
const click = async (wrapper: DialogWrapper, text: string) => {
  await wrapper.findAll('button').find(button => button.text() === text)!.trigger('click')
  await flushPromises()
}
const selectAccount = async (wrapper: DialogWrapper, id: string) => {
  const select = wrapper.findComponent({ name: 'ElSelect' })
  select.vm.$emit('update:modelValue', id)
  select.vm.$emit('change', id)
  await flushPromises()
}

describe('命名云盘账户及备份设置', () => {
  it('文案按要求调整，无旧提示、Token 回显及底部关闭按钮；保存选中的账户', async () => {
    const wrapper = await openDialog()
    expect(wrapper.text()).toContain('开启自动备份backups内所有文件。')
    expect(wrapper.text()).toContain('自动备份')
    expect(wrapper.text()).toContain('当前备份目录：资源库/业务备份')
    expect(wrapper.text()).not.toContain('本地文件继续保留')
    expect(wrapper.text()).not.toContain('填写网页登录 Token')
    expect(wrapper.find('input[type=password]').exists()).toBe(false)
    expect(wrapper.findAll('button').some(button => button.text() === '关闭')).toBe(false)
    await click(wrapper, '保存设置')
    expect(backupCloudApi.save).toHaveBeenCalledWith({ accountId: account.id, enabled: true, driveId: 'drive', folderId: 'existing-folder', folderName: '业务备份', driveName: '资源库',
      schedule: { enabled: false, intervalHours: 24, type: 'full' }, retention: { enabled: false, sqlCount: 10, zipCount: 10 } })
    expect(wrapper.emitted('saved')).toHaveLength(1)
    wrapper.unmount()
  })

  it('新增账户先校验名称和 Token，保存后可选择其目录且不立即更改上传目标', async () => {
    const wrapper = await openDialog()
    await click(wrapper, '新增账户')
    await click(wrapper, '保存账户')
    expect(backupCloudApi.saveAccount).not.toHaveBeenCalled()
    expect(wrapper.findAllComponents({ name: 'ElFormItem' })[0].props('error')).toBe('请输入账户名称')
    const inputs = wrapper.findAll('input.el-input__inner')
    await inputs[0].setValue('家庭网盘')
    await inputs[1].setValue('synthetic-form-refresh-token')
    await click(wrapper, '保存账户')
    expect(backupCloudApi.saveAccount).toHaveBeenCalledWith({ name: '家庭网盘', token: 'synthetic-form-refresh-token' }, undefined)
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    expect(wrapper.find('input[type=password]').exists()).toBe(false)
    await click(wrapper, '浏览云盘 / 选择目录')
    expect(backupCloudApi.connect).toHaveBeenCalledWith('new-account', expect.any(AbortSignal))
    const browser = wrapper.findComponent({ name: 'CloudDriveBrowser' })
    expect(browser.props('accountId')).toBe('new-account')
    browser.vm.$emit('update:modelValue', { driveId: 'drive', folderId: 'picked', folderName: '家庭备份' })
    await flushPromises()
    await click(wrapper, '使用此目录')
    await click(wrapper, '保存设置')
    expect(backupCloudApi.save).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'new-account', folderId: 'picked', folderName: '家庭备份' }))
    wrapper.unmount()
  })

  it('编辑账户不回显 Token，留空保存不丢失已有授权；取消后清空凭据', async () => {
    const wrapper = await openDialog()
    await click(wrapper, '编辑账户')
    const inputs = wrapper.findAll('input.el-input__inner')
    expect((inputs[0].element as HTMLInputElement).value).toBe('自己的网盘')
    expect((inputs[1].element as HTMLInputElement).value).toBe('')
    vi.mocked(backupCloudApi.saveAccount).mockResolvedValueOnce({ success: true, data: { ...account, name: '常用网盘' } })
    await inputs[0].setValue('常用网盘')
    await click(wrapper, '保存账户')
    expect(backupCloudApi.saveAccount).toHaveBeenCalledWith({ name: '常用网盘', token: undefined }, account.id)
    await click(wrapper, '新增账户')
    await wrapper.find('input[type=password]').setValue('synthetic-not-saved-token')
    await click(wrapper, '返回设置')
    await click(wrapper, '新增账户')
    expect((wrapper.find('input[type=password]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('切换账户时目录对应当前账户；预览不保存上传目标，迟到响应不能串到其他账户', async () => {
    let resolveConnection: (value: Awaited<ReturnType<typeof backupCloudApi.connect>>) => void = () => {}
    const wrapper = await openDialog()
    await click(wrapper, '浏览云盘 / 选择目录')
    vi.mocked(backupCloudApi.connect).mockImplementationOnce(() => new Promise(resolve => { resolveConnection = resolve }))
    await selectAccount(wrapper, second.id)
    await selectAccount(wrapper, account.id)
    resolveConnection({ success: true, data: connection(second.id) })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'CloudDriveBrowser' }).props('accountId')).toBe(account.id)
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    await click(wrapper, '返回设置')
    await selectAccount(wrapper, second.id)
    expect(wrapper.text()).toContain('第二个目录')
    await click(wrapper, '保存并测试')
    expect(backupCloudApi.save).toHaveBeenCalledWith(expect.objectContaining({ accountId: second.id, folderId: 'second-folder' }))
    expect(backupCloudApi.test).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('管理入口只查询所选账户，编辑文件时锁定账户切换及父弹窗关闭', async () => {
    const wrapper = await openDialog(true)
    expect(backupCloudApi.accounts).toHaveBeenCalledOnce()
    expect(backupCloudApi.settings).not.toHaveBeenCalled()
    expect(backupCloudApi.drives).toHaveBeenCalledWith(account.id, expect.any(AbortSignal))
    await selectAccount(wrapper, second.id)
    expect(backupCloudApi.drives).toHaveBeenLastCalledWith(second.id, expect.any(AbortSignal))
    wrapper.findComponent({ name: 'CloudDriveBrowser' }).vm.$emit('busy', true)
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElSelect' }).props('disabled')).toBe(true)
    expect(wrapper.findComponent({ name: 'MobileDialog' }).props('showClose')).toBe(false)
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    expect(wrapper.findAll('button').some(button => button.text() === '关闭')).toBe(false)
    wrapper.unmount()
  })

  it('首次连接尚未返回时切换账户，重新连接新账户并解除旧请求的加载状态', async () => {
    let finishFirst: (value: Awaited<ReturnType<typeof backupCloudApi.connect>>) => void = () => {}
    const wrapper = await openDialog()
    vi.mocked(backupCloudApi.connect).mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
    await click(wrapper, '浏览云盘 / 选择目录')
    await selectAccount(wrapper, second.id)
    expect(backupCloudApi.connect).toHaveBeenLastCalledWith(second.id, expect.any(AbortSignal))
    finishFirst({ success: true, data: connection() })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'CloudDriveBrowser' }).props('accountId')).toBe(second.id)
    await click(wrapper, '返回设置')
    expect(wrapper.findAll('button').find(button => button.text() === '保存设置')!.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('历史目录缺少盘名时识别实际盘名，并在同一行展示，不修改上传设置', async () => {
    vi.mocked(backupCloudApi.settings).mockResolvedValueOnce({ success: true, data: {
      ...stored, accounts: [{ ...account, driveName: undefined }]
    } })
    const wrapper = await openDialog()
    expect(backupCloudApi.connect).toHaveBeenCalledWith(account.id, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('当前备份目录：资源库/业务备份')
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'CloudDriveBrowser' }).exists()).toBe(false)
    wrapper.unmount()
  })

  it('每次打开设置都按原目录刷新云端名称，保存仍使用原目录 ID', async () => {
    vi.mocked(backupCloudApi.connect).mockResolvedValueOnce({ success: true, data: {
      ...connection(), directory: { ...account, folderName: '云端新名字' }
    } })
    const wrapper = await openDialog()
    expect(wrapper.text()).toContain('当前备份目录：资源库/云端新名字')
    expect(wrapper.findComponent({ name: 'CloudDriveBrowser' }).exists()).toBe(false)
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    await wrapper.setProps({ modelValue: false })
    vi.mocked(backupCloudApi.connect).mockResolvedValueOnce({ success: true, data: {
      ...connection(), directory: { ...account, folderName: '再次改名' }
    } })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.text()).toContain('当前备份目录：资源库/再次改名')
    await click(wrapper, '保存设置')
    expect(backupCloudApi.save).toHaveBeenCalledWith(expect.objectContaining({
      accountId: account.id, driveId: account.driveId, folderId: account.folderId, folderName: '再次改名', enabled: true
    }))
    wrapper.unmount()
  })

  it('设置生成间隔和类型，SQL/ZIP 分别保留数量；切换账户不重置全局规则', async () => {
    const wrapper = await openDialog()
    const switches = wrapper.findAllComponents({ name: 'ElSwitch' })
    switches[0].vm.$emit('update:modelValue', true)
    switches[2].vm.$emit('update:modelValue', true)
    await flushPromises()
    const fields = wrapper.findAllComponents({ name: 'ElInputNumber' })
    fields[0].vm.$emit('update:modelValue', 6)
    fields[1].vm.$emit('update:modelValue', 10)
    fields[2].vm.$emit('update:modelValue', 12)
    wrapper.findAllComponents({ name: 'ElSelect' })[1].vm.$emit('update:modelValue', 'database')
    await selectAccount(wrapper, second.id)
    expect(wrapper.text()).toContain('下次执行（北京时间）：保存后计算')
    expect(wrapper.text()).toContain('仅清理服务器本地备份，云盘文件保留。')
    await click(wrapper, '保存设置')
    expect(backupCloudApi.save).toHaveBeenCalledWith(expect.objectContaining({ accountId: second.id,
      schedule: { enabled: true, intervalHours: 6, type: 'database' }, retention: { enabled: true, sqlCount: 10, zipCount: 12 } }))
    wrapper.unmount()
  })

  it('加载持久化规则和北京时间状态，保存失败保留输入及错误提示', async () => {
    vi.mocked(backupCloudApi.settings).mockResolvedValueOnce({ success: true, data: { ...structuredClone(stored),
      schedule: { ...stored.schedule, enabled: true, nextRunAt: '2026-11-11T00:00:00.000Z' },
      retention: { ...stored.retention, enabled: true, sqlCount: 8, zipCount: 9, lastRunAt: '2026-11-10T12:00:00.000Z', lastDeleted: 2 } } })
    const wrapper = await openDialog()
    expect(wrapper.text()).toContain('下次执行（北京时间）：2026-11-11 08:00:00')
    expect(wrapper.text()).toContain('最近清理：2026-11-10 20:00:00 · 删除 2 份')
    vi.mocked(backupCloudApi.save).mockRejectedValueOnce(new Error('上传任务正在执行，请稍后修改云盘配置'))
    await click(wrapper, '保存设置')
    expect(notifications.error).toHaveBeenCalledWith('上传任务正在执行，请稍后修改云盘配置')
    expect(wrapper.findAllComponents({ name: 'ElInputNumber' }).map(field => field.props('modelValue'))).toEqual([24, 8, 9])
    wrapper.unmount()
  })

  it('无删除权限时不提交清理规则，仍可保存定时备份', async () => {
    permissions.canDelete = false
    const wrapper = await openDialog()
    expect(wrapper.findAllComponents({ name: 'ElSwitch' })[2].props('disabled')).toBe(true)
    await click(wrapper, '保存设置')
    const input = vi.mocked(backupCloudApi.save).mock.calls[0][0]
    expect(input.retention).toBeUndefined()
    expect(input.schedule).toEqual({ enabled: false, intervalHours: 24, type: 'full' })
    wrapper.unmount()
  })

  it('规则范围校验失败不提交请求，修正后正常保存', async () => {
    const wrapper = await openDialog()
    wrapper.findAllComponents({ name: 'ElSwitch' })[0].vm.$emit('update:modelValue', true)
    wrapper.findAllComponents({ name: 'ElSwitch' })[2].vm.$emit('update:modelValue', true)
    await flushPromises()
    wrapper.findAllComponents({ name: 'ElInputNumber' })[0].vm.$emit('update:modelValue', undefined)
    await click(wrapper, '保存设置')
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    expect(notifications.error).toHaveBeenLastCalledWith('备份间隔须为 1–720 小时')
    wrapper.findAllComponents({ name: 'ElInputNumber' })[0].vm.$emit('update:modelValue', 24)
    wrapper.findAllComponents({ name: 'ElInputNumber' })[1].vm.$emit('update:modelValue', undefined)
    await click(wrapper, '保存设置')
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    expect(notifications.error).toHaveBeenLastCalledWith('SQL 和 ZIP 保留数量须分别为 1–1000 份')
    wrapper.findAllComponents({ name: 'ElInputNumber' })[1].vm.$emit('update:modelValue', 10)
    await click(wrapper, '保存设置')
    expect(backupCloudApi.save).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('自动刷新中切换账户会读取新账户目录，迟到的旧名称不覆盖也不打开浏览器', async () => {
    let finish: (value: Awaited<ReturnType<typeof backupCloudApi.connect>>) => void = () => {}
    vi.mocked(backupCloudApi.connect).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = await openDialog()
    vi.mocked(backupCloudApi.connect).mockResolvedValueOnce({ success: true, data: {
      ...connection(second.id), directory: { ...second, folderName: '第二账户已改名' }
    } })
    await selectAccount(wrapper, second.id)
    finish({ success: true, data: { ...connection(), directory: { ...account, folderName: '迟到旧账户' } } })
    await flushPromises()
    expect(wrapper.text()).toContain('当前备份目录：资源库/第二账户已改名')
    expect(wrapper.text()).not.toContain('迟到旧账户')
    expect(wrapper.findComponent({ name: 'CloudDriveBrowser' }).exists()).toBe(false)
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('重新浏览时刷新已保存目录名称，不覆盖本次尚未保存的目录选择', async () => {
    const wrapper = await openDialog()
    await click(wrapper, '浏览云盘 / 选择目录')
    wrapper.findComponent({ name: 'CloudDriveBrowser' }).vm.$emit('update:modelValue', {
      driveId: 'drive', driveName: '资源库', folderId: 'new-folder', folderName: '本次选择'
    })
    await flushPromises()
    await click(wrapper, '使用此目录')
    vi.mocked(backupCloudApi.connect).mockResolvedValueOnce({ success: true, data: {
      ...connection(), directory: { ...account, folderName: '旧目标已改名' }
    } })
    await click(wrapper, '浏览云盘 / 选择目录')
    await click(wrapper, '返回设置')
    expect(wrapper.text()).toContain('当前备份目录：资源库/本次选择')
    await click(wrapper, '保存设置')
    expect(backupCloudApi.save).toHaveBeenCalledWith(expect.objectContaining({ folderId: 'new-folder', folderName: '本次选择' }))
    wrapper.unmount()
  })

  it('名称读取失败保留已保存目录并提示，可继续浏览重新选择', async () => {
    const message = '读取备份目录失败，当前显示上次保存的名称，请重试或重新选择目录'
    vi.mocked(backupCloudApi.connect).mockResolvedValueOnce({ success: true, data: {
      ...connection(), directory: null, directoryError: message
    } })
    const wrapper = await openDialog()
    expect(wrapper.text()).toContain('当前备份目录：资源库/业务备份')
    expect(notifications.error).toHaveBeenCalledExactlyOnceWith(message)
    await click(wrapper, '浏览云盘 / 选择目录')
    expect(wrapper.findComponent({ name: 'CloudDriveBrowser' }).exists()).toBe(true)
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('无账户时阻止保存，保存失败保留输入，关闭弹窗忽略迟到连接响应', async () => {
    vi.mocked(backupCloudApi.settings).mockResolvedValueOnce({ success: true, data: { ...stored, accounts: [], accountId: '', hasToken: false } })
    const empty = await openDialog()
    await click(empty, '保存设置')
    expect(backupCloudApi.save).not.toHaveBeenCalled()
    expect(notifications.error).toHaveBeenCalledWith('请先新增并选择云盘账户')
    await click(empty, '新增账户')
    await empty.findAll('input.el-input__inner')[0].setValue('测试名称')
    await empty.find('input[type=password]').setValue('synthetic-token')
    vi.mocked(backupCloudApi.saveAccount).mockRejectedValueOnce(new Error('账户名称已存在'))
    await click(empty, '保存账户')
    expect(notifications.error).toHaveBeenCalledWith('账户名称已存在')
    expect((empty.find('input[type=password]').element as HTMLInputElement).value).toBe('synthetic-token')
    empty.unmount()
    let resolveConnection: (value: Awaited<ReturnType<typeof backupCloudApi.connect>>) => void = () => {}
    const wrapper = await openDialog()
    vi.mocked(backupCloudApi.connect).mockImplementationOnce(() => new Promise(resolve => { resolveConnection = resolve }))
    await click(wrapper, '浏览云盘 / 选择目录')
    await wrapper.setProps({ modelValue: false })
    resolveConnection({ success: true, data: connection() })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'CloudDriveBrowser' }).exists()).toBe(false)
    wrapper.unmount()
  })
})
