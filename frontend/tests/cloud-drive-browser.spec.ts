import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed } from 'vue'
import ElementPlus from 'element-plus'
import CloudDriveBrowser from '@/views/backup/CloudDriveBrowser.vue'
import { backupCloudApi } from '@/api/backup'
import { confirmAction } from '@/utils/message-box'
import type { CloudDrive } from '@/types/backup'

const state = vi.hoisted(() => ({ canDelete: true, canCreate: true, canEdit: true }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/api/backup', () => ({ backupCloudApi: { files: vi.fn(), trash: vi.fn(), restore: vi.fn(), purge: vi.fn(), createFolder: vi.fn(), rename: vi.fn() } }))
vi.mock('@/utils/message-box', () => ({ confirmAction: vi.fn(), isMessageBoxCanceled: (value: unknown) => value === 'cancel' }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => notify }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canDelete: computed(() => state.canDelete), canCreate: computed(() => state.canCreate), canEdit: computed(() => state.canEdit),
  requirePermission: (action: string) => action === 'create' ? state.canCreate : action === 'edit' ? state.canEdit : state.canDelete
}) }))

const page = {
  folder: { driveId: 'drive', folderId: 'root', folderName: '根目录' }, nextMarker: '',
  items: [{ id: 'folder', name: '业务备份', type: 'folder' as const, size: 0 }, { id: 'file', name: '备份.zip', type: 'file' as const, size: 1024 }]
}
beforeEach(() => {
  vi.clearAllMocks()
  state.canDelete = true
  state.canCreate = true
  state.canEdit = true
  vi.mocked(backupCloudApi.files).mockResolvedValue({ success: true, data: page })
  vi.mocked(backupCloudApi.trash).mockResolvedValue({ success: true })
  vi.mocked(backupCloudApi.restore).mockResolvedValue({ success: true })
  vi.mocked(backupCloudApi.purge).mockResolvedValue({ success: true })
  vi.mocked(backupCloudApi.createFolder).mockResolvedValue({ success: true, data: { driveId: 'drive', folderId: 'new', folderName: '新目录' } })
  vi.mocked(backupCloudApi.rename).mockResolvedValue({ success: true })
  vi.mocked(confirmAction).mockResolvedValue('confirm')
})

const openBrowser = async (drives: CloudDrive[] = [{ id: 'drive', name: '云盘' }], initialDriveId = 'drive') => {
  const wrapper = mount(CloudDriveBrowser, {
    props: { accountId: 'account', modelValue: null, initialDriveId, drives },
    global: {
      plugins: [ElementPlus],
      directives: { permission: {}, 'tf-loading': {} },
      stubs: {
        DataEmptyState: { name: 'DataEmptyState', props: ['description'], emits: ['action'], template: '<div>{{ description }}</div>' },
        MobileDialog: { props: ['modelValue', 'title'], template: '<div v-if="modelValue">{{ title }}<slot /><slot name="footer" /></div>' }
      },
      config: { globalProperties: { $getActionColumnWidth: () => 160 } }
    }
  })
  await flushPromises()
  return wrapper
}

describe('云盘文件浏览', () => {
  const drives = [{ id: 'resource', name: '资源库' }, { id: 'backup', name: '备份盘' }]

  it('首次打开空备份盘时显示有文件的资源库并提示，手动切回空盘仍保留用户选择', async () => {
    vi.mocked(backupCloudApi.files).mockImplementation(async ({ driveId }) => ({ success: true, data: {
      folder: { driveId, folderId: 'root', folderName: '根目录' }, nextMarker: '',
      items: driveId === 'resource' ? page.items : []
    } }))
    const wrapper = await openBrowser(drives, 'backup')
    expect(wrapper.text()).toContain('业务备份')
    expect(wrapper.text()).toContain('备份盘根目录为空，已显示资源库')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ driveId: 'resource', driveName: '资源库', folderId: 'root', folderName: '根目录' }])
    const select = wrapper.findComponent({ name: 'ElSelect' })
    select.vm.$emit('update:modelValue', 'backup')
    select.vm.$emit('change', 'backup')
    await flushPromises()
    expect(backupCloudApi.files).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).toContain('备份盘的根目录暂无文件或文件夹')
    expect(wrapper.text()).not.toContain('已显示资源库')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ driveId: 'backup', driveName: '备份盘', folderId: 'root', folderName: '根目录' }])
    wrapper.unmount()
  })

  it('各盘均为空时保留原盘；其他盘读取失败显示错误，不误报整个云盘为空', async () => {
    vi.mocked(backupCloudApi.files).mockImplementation(async ({ driveId }) => ({ success: true, data: {
      folder: { driveId, folderId: 'root', folderName: '根目录' }, items: [], nextMarker: ''
    } }))
    const wrapper = await openBrowser(drives, 'backup')
    expect(wrapper.text()).toContain('备份盘的根目录暂无文件或文件夹')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ driveId: 'backup', driveName: '备份盘', folderId: 'root', folderName: '根目录' }])
    wrapper.unmount()
    vi.mocked(backupCloudApi.files).mockImplementation(async ({ driveId }) => {
      if (driveId === 'resource') throw new Error('资源库读取失败，请重试')
      return { success: true, data: { folder: page.folder, items: [], nextMarker: '' } }
    })
    const failed = await openBrowser(drives, 'backup')
    expect(failed.text()).toContain('资源库读取失败，请重试')
    expect(failed.text()).not.toContain('暂无文件或文件夹')
    expect(failed.props('modelValue')).toBeNull()
    expect(failed.emitted('update:modelValue')).toBeUndefined()
    vi.mocked(backupCloudApi.files).mockImplementation(async ({ driveId }) => ({ success: true, data: {
      folder: { ...page.folder, driveId }, items: driveId === 'resource' ? page.items : [], nextMarker: ''
    } }))
    failed.findComponent({ name: 'DataEmptyState' }).vm.$emit('action')
    await flushPromises()
    expect(failed.text()).toContain('业务备份')
    expect(failed.emitted('update:modelValue')?.at(-1)).toEqual([{ ...page.folder, driveId: 'resource', driveName: '资源库' }])
    failed.unmount()
  })

  it('自动检查其他盘期间手动切盘，较晚的自动结果不能覆盖用户选择', async () => {
    let resolveResource: (value: Awaited<ReturnType<typeof backupCloudApi.files>>) => void = () => {}
    vi.mocked(backupCloudApi.files).mockImplementation(async ({ driveId }) => {
      if (driveId === 'resource') return new Promise(resolve => { resolveResource = resolve })
      return { success: true, data: { folder: { ...page.folder, driveId }, items: [], nextMarker: '' } }
    })
    const wrapper = await openBrowser(drives, 'backup')
    const select = wrapper.findComponent({ name: 'ElSelect' })
    select.vm.$emit('update:modelValue', 'backup')
    select.vm.$emit('change', 'backup')
    await flushPromises()
    resolveResource({ success: true, data: { ...page, folder: { ...page.folder, driveId: 'resource' } } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('已显示资源库')
    expect(wrapper.text()).not.toContain('业务备份')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ driveId: 'backup', driveName: '备份盘', folderId: 'root', folderName: '根目录' }])
    wrapper.unmount()
  })

  it('根目录可选，进入子目录后更新保存位置，回收站不能作为备份目录', async () => {
    const wrapper = await openBrowser()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ ...page.folder, driveName: '云盘' }])
    vi.mocked(backupCloudApi.files).mockResolvedValueOnce({ success: true, data: { ...page, folder: { ...page.folder, folderId: 'folder', folderName: '业务备份' } } })
    await wrapper.findAll('button').find(button => button.text() === '打开')!.trigger('click')
    await flushPromises()
    expect(backupCloudApi.files).toHaveBeenLastCalledWith(expect.objectContaining({ folderId: 'folder', trash: false }), expect.any(AbortSignal))
    await wrapper.findAll('[role=tab]').find(tab => tab.text() === '回收站')!.trigger('click')
    await flushPromises()
    expect(backupCloudApi.files).toHaveBeenLastCalledWith(expect.objectContaining({ trash: true }), expect.any(AbortSignal))
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
    wrapper.unmount()
  })

  it('取消不删除，确认后调用回收站接口并刷新；权限不足不显示删除', async () => {
    const wrapper = await openBrowser()
    const button = () => wrapper.findAll('button').filter(item => item.text() === '删除').at(-1)!
    vi.mocked(confirmAction).mockRejectedValueOnce('cancel')
    await button().trigger('click')
    await flushPromises()
    expect(backupCloudApi.trash).not.toHaveBeenCalled()
    await button().trigger('click')
    await flushPromises()
    expect(backupCloudApi.trash).toHaveBeenCalledWith('account', 'drive', 'file')
    expect(wrapper.emitted('changed')).toHaveLength(1)
    expect(backupCloudApi.files).toHaveBeenCalledTimes(2)
    wrapper.unmount()
    state.canDelete = false
    const denied = await openBrowser()
    expect(denied.findAll('button').some(item => item.text() === '删除')).toBe(false)
    denied.unmount()
  })

  it('列表失败保留错误且取消目录选择，不将失败显示为空目录', async () => {
    const wrapper = await openBrowser()
    vi.mocked(backupCloudApi.files).mockRejectedValueOnce(new Error('云盘授权失效'))
    await wrapper.findAll('button').find(button => button.text() === '刷新')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('云盘授权失效')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
    expect(wrapper.text()).not.toContain('这个文件夹还没有文件')
    wrapper.unmount()
  })

  it('新建文件夹校验名称，成功刷新列表；重名失败保留表单可修正', async () => {
    const wrapper = await openBrowser()
    await wrapper.findAll('button').find(b => b.text() === '新建文件夹')!.trigger('click')
    const save = () => wrapper.findAll('button').find(b => b.text() === '保存')!
    await wrapper.find('input.el-input__inner').setValue('../目录')
    await save().trigger('click')
    await flushPromises()
    expect(backupCloudApi.createFolder).not.toHaveBeenCalled()
    await wrapper.find('input.el-input__inner').setValue(' 新目录 ')
    vi.mocked(backupCloudApi.createFolder).mockRejectedValueOnce(new Error('已有同名目录'))
    await save().trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('已有同名目录')
    expect(wrapper.find('input.el-input__inner').exists()).toBe(true)
    await save().trigger('click')
    await flushPromises()
    expect(backupCloudApi.createFolder).toHaveBeenLastCalledWith('account', 'drive', 'root', '新目录')
    expect(backupCloudApi.files).toHaveBeenCalledTimes(2)
    expect(wrapper.find('input.el-input__inner').exists()).toBe(false)
    expect(notify.success).toHaveBeenCalledWith('文件夹创建成功')
    expect(notify.error).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('文件和目录均可重命名，使用原文件 ID，目录改名通知父级更新名称', async () => {
    const wrapper = await openBrowser()
    const rename = () => wrapper.findAll('button').filter(b => b.text() === '编辑')
    await rename()[0].trigger('click')
    expect((wrapper.find('input.el-input__inner').element as HTMLInputElement).value).toBe('业务备份')
    await wrapper.find('input.el-input__inner').setValue('新的业务目录')
    await wrapper.findAll('button').find(b => b.text() === '保存')!.trigger('click')
    await flushPromises()
    expect(backupCloudApi.rename).toHaveBeenLastCalledWith('account', 'drive', 'folder', '新的业务目录')
    expect(wrapper.emitted('changed')?.at(-1)).toEqual([{ driveId: 'drive', folderId: 'folder', folderName: '新的业务目录' }])
    await rename()[1].trigger('click')
    await wrapper.find('input.el-input__inner').setValue('新备份.zip')
    await wrapper.findAll('button').find(b => b.text() === '保存')!.trigger('click')
    await flushPromises()
    expect(backupCloudApi.rename).toHaveBeenLastCalledWith('account', 'drive', 'file', '新备份.zip')
    expect(notify.success).toHaveBeenCalledTimes(2)
    expect(notify.success).toHaveBeenLastCalledWith('重命名成功')
    wrapper.unmount()
  })

  it('创建或改名已经成功后，列表刷新失败只显示读取错误，不能误报保存失败', async () => {
    for (const label of ['新建文件夹', '编辑']) {
      vi.clearAllMocks()
      vi.mocked(backupCloudApi.files).mockResolvedValue({ success: true, data: page })
      const wrapper = await openBrowser()
      await wrapper.findAll('button').find(button => button.text() === label)!.trigger('click')
      await wrapper.find('input.el-input__inner').setValue('新的目录名称')
      vi.mocked(backupCloudApi.files).mockRejectedValueOnce(new Error('目录刷新暂时失败'))
      await wrapper.findAll('button').find(button => button.text() === '保存')!.trigger('click')
      await flushPromises()
      expect(notify.success).toHaveBeenCalledOnce()
      expect(notify.error).not.toHaveBeenCalled()
      expect(wrapper.find('input.el-input__inner').exists()).toBe(false)
      expect(wrapper.text()).toContain('目录刷新暂时失败')
      wrapper.unmount()
    }
  })

  it('删除目录明确确认其全部内容，后端保护失败时保留列表并显示原因', async () => {
    const wrapper = await openBrowser()
    vi.mocked(backupCloudApi.trash).mockRejectedValueOnce(new Error('请先更换备份目录'))
    await wrapper.findAll('button').find(b => b.text() === '删除')!.trigger('click')
    await flushPromises()
    expect(confirmAction).toHaveBeenCalledWith(expect.stringContaining('及其中所有文件'), expect.any(String), expect.any(Object))
    expect(backupCloudApi.trash).toHaveBeenCalledWith('account', 'drive', 'folder')
    expect(notify.error).toHaveBeenCalledWith('请先更换备份目录')
    expect(wrapper.text()).toContain('业务备份')
    wrapper.unmount()
  })

  it('无写权限只保留浏览，回收站按编辑和删除权限显示恢复及彻底删除', async () => {
    state.canCreate = false
    state.canEdit = false
    state.canDelete = false
    const readOnly = await openBrowser()
    for (const label of ['新建文件夹', '编辑', '删除']) expect(readOnly.findAll('button').some(b => b.text() === label)).toBe(false)
    await readOnly.findAll('[role=tab]').find(tab => tab.text() === '回收站')!.trigger('click')
    await flushPromises()
    for (const label of ['删除', '恢复']) expect(readOnly.findAll('button').some(b => b.text() === label)).toBe(false)
    readOnly.unmount()
    state.canCreate = state.canEdit = state.canDelete = true
    const wrapper = await openBrowser()
    await wrapper.findAll('[role=tab]').find(tab => tab.text() === '回收站')!.trigger('click')
    await flushPromises()
    for (const label of ['新建文件夹', '编辑', '打开']) expect(wrapper.findAll('button').some(b => b.text() === label)).toBe(false)
    for (const label of ['删除', '恢复']) expect(wrapper.findAll('button').some(b => b.text() === label)).toBe(true)
    wrapper.unmount()
  })

  it('重命名失败只提示一次并保留输入，修正后成功关闭编辑框并提示', async () => {
    const wrapper = await openBrowser()
    await wrapper.findAll('button').find(b => b.text() === '编辑')!.trigger('click')
    await wrapper.find('input.el-input__inner').setValue('已有名称')
    vi.mocked(backupCloudApi.rename).mockRejectedValueOnce(new Error('当前目录已有同名文件或文件夹，请换一个名称'))
    await wrapper.findAll('button').find(b => b.text() === '保存')!.trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledOnce()
    expect(notify.error).toHaveBeenCalledWith('当前目录已有同名文件或文件夹，请换一个名称')
    expect(notify.success).not.toHaveBeenCalled()
    expect((wrapper.find('input.el-input__inner').element as HTMLInputElement).value).toBe('已有名称')
    expect(backupCloudApi.files).toHaveBeenCalledOnce()
    await wrapper.find('input.el-input__inner').setValue('修改后名称')
    await wrapper.findAll('button').find(b => b.text() === '保存')!.trigger('click')
    await flushPromises()
    expect(notify.success).toHaveBeenCalledWith('重命名成功')
    expect(wrapper.find('input.el-input__inner').exists()).toBe(false)
    expect(backupCloudApi.files).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('业务错误响应也提示失败，不关闭新建或重命名输入，不误报成功', async () => {
    const wrapper = await openBrowser()
    for (const [button, method] of [['新建文件夹', 'createFolder'], ['编辑', 'rename']] as const) {
      await wrapper.findAll('button').find(b => b.text() === button)!.trigger('click')
      await wrapper.find('input.el-input__inner').setValue('测试名称')
      vi.mocked(backupCloudApi[method]).mockResolvedValueOnce({ success: false, message: '云盘授权已失效，请更新 Token' })
      await wrapper.findAll('button').find(b => b.text() === '保存')!.trigger('click')
      await flushPromises()
      expect(notify.error).toHaveBeenLastCalledWith('云盘授权已失效，请更新 Token')
      expect(notify.success).not.toHaveBeenCalled()
      expect(wrapper.find('input.el-input__inner').exists()).toBe(true)
      await wrapper.findAll('button').find(b => b.text() === '取消')!.trigger('click')
      await flushPromises()
    }
    wrapper.unmount()
  })

  it('回收站恢复成功刷新、失败保留列表并提示；恢复锁定导航和父窗口', async () => {
    const wrapper = await openBrowser()
    await wrapper.findAll('[role=tab]').find(tab => tab.text() === '回收站')!.trigger('click')
    await flushPromises()
    const restore = () => wrapper.findAll('button').find(b => b.text() === '恢复')!
    let finish: (value: Awaited<ReturnType<typeof backupCloudApi.restore>>) => void = () => {}
    vi.mocked(backupCloudApi.restore).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await restore().trigger('click')
    expect(wrapper.emitted('busy')?.at(-1)).toEqual([true])
    expect(wrapper.findComponent({ name: 'ElSelect' }).props('disabled')).toBe(true)
    finish({ success: true })
    await flushPromises()
    expect(backupCloudApi.restore).toHaveBeenCalledWith('account', 'drive', 'folder')
    expect(notify.success).toHaveBeenCalledWith('云盘文件已恢复')
    expect(backupCloudApi.files).toHaveBeenCalledTimes(3)
    vi.mocked(backupCloudApi.restore).mockRejectedValueOnce(new Error('恢复目录已不存在'))
    await restore().trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('恢复目录已不存在')
    expect(wrapper.text()).toContain('业务备份')
    expect(wrapper.emitted('busy')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('彻底删除须确认且提示无法恢复，取消不调用接口，失败不清空列表', async () => {
    const wrapper = await openBrowser()
    await wrapper.findAll('[role=tab]').find(tab => tab.text() === '回收站')!.trigger('click')
    await flushPromises()
    const purge = () => wrapper.findAll('button').find(b => b.text() === '删除')!
    vi.mocked(confirmAction).mockRejectedValueOnce('cancel')
    await purge().trigger('click')
    await flushPromises()
    expect(backupCloudApi.purge).not.toHaveBeenCalled()
    expect(notify.error).not.toHaveBeenCalled()
    await purge().trigger('click')
    await flushPromises()
    expect(confirmAction).toHaveBeenLastCalledWith(expect.stringContaining('无法恢复'), '彻底删除云盘文件', { confirmButtonText: '彻底删除' })
    expect(backupCloudApi.purge).toHaveBeenCalledWith('account', 'drive', 'folder')
    expect(notify.success).toHaveBeenCalledWith('云盘文件已彻底删除，本地文件保留')
    vi.mocked(backupCloudApi.purge).mockResolvedValueOnce({ success: false, message: '仅能彻底删除回收站中的文件或文件夹' })
    await purge().trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('仅能彻底删除回收站中的文件或文件夹')
    expect(wrapper.text()).toContain('业务备份')
    wrapper.unmount()
  })

})
