import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import IconPicker from '@/components/IconPicker.vue'
import { iconService } from '@/services/icons'
import type { IconRecord } from '@/types/icon'

const { warning } = vi.hoisted(() => ({ warning: vi.fn() }))
vi.mock('@/services/icons', () => ({ iconService: { cache: vi.fn(), list: vi.fn(), categories: vi.fn(), searchOnline: vi.fn(), preview: vi.fn(), byClass: vi.fn() } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ warning, confirm: vi.fn() }) }))

const candidate: IconRecord = { class: 'iconify lucide:home', name: '首页', category: 'menu', source: 'online' }
const saved: IconRecord = { ...candidate, id: 1, source: 'iconify', svg: '<svg></svg>', is_valid: 1 }
const stubs = {
  IconRenderer: true, SectionLoading: true, InlineLoading: true, DataEmptyState: true,
  ElAlert: { props: ['title'], template: '<div role="alert">{{ title }}</div>' },
  ElSelect: true, ElOption: true,
  ElButton: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
  ElSegmented: { emits: ['update:modelValue', 'change'], template: '<button data-online @click="$emit(\'update:modelValue\', \'online\'); $emit(\'change\', \'online\')">在线</button>' },
  ElInput: { props: { modelValue: String }, emits: ['update:modelValue', 'input'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'input\', $event.target.value)" />' }
}

async function openPicker(candidates: IconRecord[] = [candidate]) {
  vi.useFakeTimers()
  vi.mocked(iconService.list).mockResolvedValue({ success: true, message: '', data: [] })
  vi.mocked(iconService.categories).mockResolvedValue({ success: true, message: '', data: ['menu'] })
  vi.mocked(iconService.searchOnline).mockResolvedValue({ success: true, message: '', data: candidates })
  vi.mocked(iconService.preview).mockImplementation(async names => ({ success: true, message: '', data: names.map(name => ({ class: `iconify ${name}`, svg: '<svg><path d="M0 0"/></svg>' })) }))
  vi.mocked(iconService.byClass).mockResolvedValue(null)
  const wrapper = mount(IconPicker, { props: { modelValue: 'fas fa-user', defaultCollapsed: false }, global: { stubs, directives: { 'tf-loading': {} } } })
  await flushPromises()
  await wrapper.get('[data-online]').trigger('click')
  await wrapper.get('input').setValue('首页')
  await vi.advanceTimersByTimeAsync(500)
  await flushPromises()
  return wrapper
}
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })

describe('在线图标选择保存边界', () => {
  it('在线预览走站内批量接口，在线翻页保留结果且不加载本地库', async () => {
    const candidates = Array.from({ length: 30 }, (_, index) => ({ ...candidate, id: `online-${index}`, class: `iconify lucide:phone-${index}` }))
    const wrapper = await openPicker(candidates)
    expect(wrapper.findAll('.icon-item')).toHaveLength(24)
    expect(iconService.preview).toHaveBeenCalledWith(candidates.slice(0, 24).map(icon => icon.class.slice(8)), expect.any(AbortSignal))
    const localCalls = vi.mocked(iconService.list).mock.calls.length
    await wrapper.findAll('.pagination button')[1].trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.icon-item')).toHaveLength(6)
    expect(iconService.list).toHaveBeenCalledTimes(localCalls)
    expect(iconService.byClass).not.toHaveBeenCalledWith(expect.stringContaining('iconify '))
    expect(iconService.preview).toHaveBeenLastCalledWith(candidates.slice(24).map(icon => icon.class.slice(8)), expect.any(AbortSignal))
    wrapper.unmount()
  })

  it('预览失败展示原因并允许重试，不把未入库候选查成本地图标', async () => {
    const wrapper = await openPicker()
    vi.mocked(iconService.searchOnline).mockResolvedValueOnce({ success: true, message: '', data: [{ ...candidate, class: 'iconify lucide:phone' }] })
    vi.mocked(iconService.preview).mockRejectedValueOnce(new Error('预览服务限流'))
    await wrapper.get('input').setValue('phone')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(wrapper.text()).toContain('预览服务限流')
    expect(wrapper.get('.icon-item').text()).toContain('预览失败')
    expect(iconService.byClass).not.toHaveBeenCalledWith(expect.stringContaining('iconify '))
    await wrapper.findAll('button').find(button => button.text() === '重试图标预览')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('.icon-item').text()).not.toContain('预览失败')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('新搜索取消旧请求，迟到结果和预览不能覆盖新关键词', async () => {
    const wrapper = await openPicker()
    let complete: (value: { success: boolean; message: string; data: IconRecord[] }) => void = () => { throw new Error('未请求') }
    vi.mocked(iconService.searchOnline).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    await wrapper.get('input').setValue('old')
    await vi.advanceTimersByTimeAsync(500)
    const oldSignal = vi.mocked(iconService.searchOnline).mock.calls.at(-1)![1]
    await wrapper.get('input').setValue('phone')
    expect(oldSignal?.aborted).toBe(true)
    complete({ success: true, message: '', data: [{ ...candidate, class: 'iconify lucide:old' }] })
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(wrapper.get('.icon-item').attributes('title')).not.toContain('lucide:old')
    wrapper.unmount()
  })

  it('新关键词返回相同候选时仍重新预览，旧预览迟到不覆盖新 SVG', async () => {
    const wrapper = await openPicker()
    let complete: (value: { success: boolean; message: string; data: { class: string; svg: string }[] }) => void = () => { throw new Error('未请求') }
    vi.mocked(iconService.preview).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    await wrapper.get('input').setValue('phone')
    await vi.advanceTimersByTimeAsync(500)
    const signal = vi.mocked(iconService.preview).mock.calls.at(-1)![1]
    await wrapper.get('input').setValue('mobile')
    await vi.advanceTimersByTimeAsync(500)
    await flushPromises()
    expect(signal?.aborted).toBe(true)
    complete({ success: true, message: '', data: [{ class: candidate.class, svg: '<svg><rect/></svg>' }] })
    await flushPromises()
    const preview = wrapper.get('.icon-item').findComponent({ name: 'IconRenderer' })
    expect(preview.props('svg')).toContain('<path')
    expect(preview.props('svg')).not.toContain('<rect')
    wrapper.unmount()
  })

  it('保存完成前保留旧选择，连续点击只写一次；成功后向菜单传回数据库 SVG', async () => {
    const wrapper = await openPicker()
    let complete: (icon: IconRecord) => void = () => { throw new Error('未保存') }
    vi.mocked(iconService.cache).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    await wrapper.get('.icon-item').trigger('pointerdown')
    await wrapper.get('.icon-item').trigger('keydown', { key: 'Enter' })
    expect(iconService.cache).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('saving-change')).toEqual([[true]])
    complete(saved)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[saved.class]])
    expect(wrapper.emitted('select')).toEqual([[saved.class, saved]])
    const preview = wrapper.get('.icon-item').findComponent({ name: 'IconRenderer' })
    expect(preview.props('svg')).toBe(saved.svg)
    expect(preview.props('onlinePreview')).toBe(false)
    expect(wrapper.emitted('saving-change')).toEqual([[true], [false]])
    wrapper.unmount()
  })

  it('保存失败保持原值，显示统一提示并允许重试', async () => {
    const wrapper = await openPicker()
    vi.mocked(iconService.cache).mockRejectedValueOnce(new Error('图标保存失败'))
    await wrapper.get('.icon-item').trigger('pointerdown')
    await flushPromises()
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(warning).toHaveBeenCalledWith('图标保存失败')
    vi.mocked(iconService.cache).mockResolvedValueOnce(saved)
    await wrapper.get('.icon-item').trigger('pointerdown')
    await flushPromises()
    expect(wrapper.emitted('select')).toEqual([[saved.class, saved]])
    wrapper.unmount()
  })

  it('关闭选择器后迟到的保存结果不再修改表单', async () => {
    const wrapper = await openPicker()
    let complete: (icon: IconRecord) => void = () => { throw new Error('未保存') }
    vi.mocked(iconService.cache).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    await wrapper.get('.icon-item').trigger('pointerdown')
    wrapper.unmount()
    complete(saved)
    await flushPromises()
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
