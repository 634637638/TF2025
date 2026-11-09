import { computed, defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElInput, ElSwitch } from 'element-plus'
import PublishToH5Modal from '@/components/PublishToH5Modal.vue'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
  success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
  allowed: true, phone: { is_new: 1, is_published: 1, template: null }
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ token: null }) }))
vi.mock('@/composables/usePagePermissions', () => ({
  usePagePermissions: () => ({ canEdit: computed(() => mocks.allowed), handleNoPermission: mocks.warning })
}))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ screenSize: computed(() => ({ width: 390 })) }) }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/utils/format', () => ({ formatImageUrl: (url: string) => url }))

const DialogStub = defineComponent({ template: '<div><slot /><slot name="footer" /></div>' })
const wrappers: ReturnType<typeof mount>[] = []
const render = () => {
  const wrapper = mount(PublishToH5Modal, {
    props: { modelValue: true, phoneId: 12 },
    global: {
      plugins: [ElementPlus], directives: { permission: {} },
      stubs: { MobileDialog: DialogStub, Image: true, MediaPreviewViewer: true, draggable: true }
    }
  })
  wrappers.push(wrapper)
  return wrapper
}
const button = (wrapper: ReturnType<typeof render>, text: string) => wrapper.findAll('button').find(item => item.text() === text)!

beforeEach(() => {
  mocks.allowed = true
  mocks.phone = { is_new: 1, is_published: 1, template: null }
  mocks.get.mockImplementation(async (url: string) => ({ success: true, data: url.endsWith('/images') ? [] : mocks.phone }))
  mocks.put.mockResolvedValue({ success: true })
  mocks.post.mockResolvedValue({ success: true })
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.clearAllMocks()
})

describe('库存商城配置：同一弹窗管理上下架', () => {
  it('全新机只展示模板预览，不提供独立售价、验机或上传；取消不保存上下架', async () => {
    mocks.get.mockResolvedValue({ success: true, data: {
      ...mocks.phone, template: { id: 8, template_name: '统一新机模板', description: '模板介绍', is_published: 0, images: [] }
    } })
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('统一新机模板')
    expect(wrapper.text()).toContain('模板介绍')
    expect(wrapper.text()).not.toContain('全新机使用统一模板；上下架仅控制当前设备，保存后生效。')
    expect(wrapper.findAllComponents(ElSwitch)).toHaveLength(1)
    const statusSwitch = wrapper.find('.el-descriptions').findComponent(ElSwitch)
    expect(wrapper.find('.el-descriptions').text()).toContain('商城状态')
    expect(statusSwitch.props('modelValue')).toBe(1)
    expect(wrapper.findComponent(ElInput).exists()).toBe(false)
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', 0)
    await flushPromises()
    expect(mocks.put).not.toHaveBeenCalled()
    await button(wrapper, '取消').trigger('click')
    await flushPromises()
    expect(mocks.put).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('全新机保存仅更新指定设备上下架，不写模板或验机信息', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('未匹配模板')
    expect(wrapper.find('.el-descriptions').findComponent(ElSwitch).exists()).toBe(true)
    wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', 0)
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/phones/12/h5-product', { is_published: 0 }, expect.any(Object))
    expect(mocks.post).not.toHaveBeenCalled()
    expect(wrapper.emitted('success')).toHaveLength(1)
    expect(mocks.success).toHaveBeenCalledWith('商城配置已保存')
  })

  it('二手机的下架与验机信息一起保存，允许无图片下架', async () => {
    mocks.phone = { is_new: 0, is_published: 1, template: null }
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).toContain('商品成色')
    expect(wrapper.findAllComponents(ElSwitch)).toHaveLength(1)
    const toolbar = wrapper.find('.tf-dialog-toolbar')
    expect(toolbar.text()).toContain('上传图片')
    expect(toolbar.findComponent(ElSwitch).exists()).toBe(true)
    wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', 0)
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/phones/12/inspection', expect.objectContaining({ is_published: 0 }), expect.any(Object))
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('二手机无素材上架仍校验，不能发布空商品', async () => {
    mocks.phone = { is_new: 0, is_published: 0, template: null }
    const wrapper = render()
    await flushPromises()
    wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', 1)
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(mocks.post).not.toHaveBeenCalled()
    expect(mocks.warning).toHaveBeenCalledWith('请至少上传一张商品图片或视频')
  })

  it('读取配置失败时禁止按默认上架值保存，重试成功才恢复', async () => {
    mocks.get.mockRejectedValueOnce(new Error('读取失败'))
    const wrapper = render()
    await flushPromises()
    expect(button(wrapper, '保存').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent(ElSwitch).exists()).toBe(false)
    await button(wrapper, '重新加载').trigger('click')
    await flushPromises()
    expect(wrapper.findComponent(ElSwitch).exists()).toBe(true)
    expect(button(wrapper, '保存').attributes('disabled')).toBeUndefined()
  })

  it('写入失败保留弹窗与修改值，不报告成功', async () => {
    mocks.put.mockResolvedValueOnce({ success: false, message: '保存失败' })
    const wrapper = render()
    await flushPromises()
    wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', 0)
    await button(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('success')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.findComponent(ElSwitch).props('modelValue')).toBe(0)
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('缺少库存编辑权限时禁止保存', async () => {
    mocks.allowed = false
    const wrapper = render()
    await flushPromises()
    expect(button(wrapper, '保存').attributes('disabled')).toBeDefined()
    expect(mocks.put).not.toHaveBeenCalled()
    expect(mocks.post).not.toHaveBeenCalled()
  })
})
