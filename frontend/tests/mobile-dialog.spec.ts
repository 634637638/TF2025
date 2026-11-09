import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ElButton, ElDialog } from 'element-plus'
import MobileDialog from '@/components/MobileDialog.vue'

const viewport = vi.hoisted(() => ({ width: 1440 }))
vi.mock('@/composables/mobile', async () => {
  const { computed } = await import('vue')
  return {
    useMobile: () => ({
      isMobile: computed(() => viewport.width < 768),
      isTablet: computed(() => viewport.width >= 768 && viewport.width <= 1024),
      screenSize: computed(() => ({ width: viewport.width, height: 900 }))
    })
  }
})

const wrappers: ReturnType<typeof mount>[] = []
const render = async (props: { width?: string | number, maxWidth?: string | number, dialogClass?: string } = {}) => {
  const wrapper = mount(MobileDialog, {
    attachTo: document.body,
    props: { modelValue: true, title: '客户详情', ...props },
    global: { components: { ElButton, ElDialog } }
  })
  wrappers.push(wrapper)
  await flushPromises()
  const panel = document.querySelector<HTMLElement>('.el-dialog')
  if (!panel) throw new Error('弹窗未打开')
  return { wrapper, panel }
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  viewport.width = 1440
})

describe.each([1440, 768, 390])('MobileDialog %ipx 视口的尺寸参数', width => {
  it('省略 width 时不以内联默认值覆盖全局档位', async () => {
    viewport.width = width
    const { panel } = await render({ dialogClass: 'customers-detail-dialog crud-dialog-lg' })
    expect(panel.classList.contains('crud-dialog-lg')).toBe(true)
    expect(panel.style.getPropertyValue('--el-dialog-width')).toBe('')
    expect(panel.style.getPropertyValue('--tf-dialog-explicit-width')).toBe('')
    expect(panel.style.maxWidth).toBe('')
  })

  it('显式宽度和上限响应更新，清空后恢复档位', async () => {
    viewport.width = width
    const { wrapper, panel } = await render({ width: 900, maxWidth: 700, dialogClass: 'crud-dialog-lg' })
    expect(panel.style.getPropertyValue('--tf-dialog-explicit-width')).toBe('900px')
    expect(panel.style.getPropertyValue('--tf-dialog-explicit-max-width')).toBe('700px')
    await wrapper.setProps({ width: '50%', maxWidth: undefined })
    expect(panel.style.getPropertyValue('--tf-dialog-explicit-width')).toBe('50%')
    expect(panel.style.getPropertyValue('--tf-dialog-explicit-max-width')).toBe('')
    await wrapper.setProps({ width: undefined })
    expect(panel.style.getPropertyValue('--tf-dialog-explicit-width')).toBe('')
    expect(panel.style.getPropertyValue('--tf-dialog-explicit-max-width')).toBe('')
  })
})

it.each(['90%', '90vw', '90dvw', 'calc(100vw - 32px)', 'min(90vw, 1200px)', 'auto', 'fit-content'])('自适应宽度 %s 保留公共上限，允许明确指定更宽上限', async width => {
  const { wrapper, panel } = await render({ width })
  expect(panel.style.getPropertyValue('--tf-dialog-explicit-width')).toBe(width)
  expect(panel.style.getPropertyValue('--tf-dialog-explicit-max-width')).toBe('')
  await wrapper.setProps({ maxWidth: 1240 })
  expect(panel.style.getPropertyValue('--tf-dialog-explicit-max-width')).toBe('1240px')
  await wrapper.setProps({ width: 1240, maxWidth: undefined })
  expect(panel.style.getPropertyValue('--tf-dialog-explicit-max-width')).toBe('1240px')
})

it('内容自适应宽度不会作为无效数值上限传入 min()', async () => {
  const { wrapper, panel } = await render({ width: 'fit-content', maxWidth: '960px' })
  expect(panel.style.getPropertyValue('--tf-dialog-explicit-width')).toBe('fit-content')
  expect(panel.style.getPropertyValue('--tf-dialog-explicit-max-width')).toBe('960px')
  await wrapper.setProps({ maxWidth: undefined })
  expect(panel.style.getPropertyValue('--tf-dialog-explicit-max-width')).toBe('')
})

it('空字符串按未指定处理，仅设置 maxWidth 不会变成期望宽度', async () => {
  const { panel } = await render({ width: '  ', maxWidth: 500 })
  expect(panel.style.getPropertyValue('--tf-dialog-explicit-width')).toBe('')
  expect(panel.style.getPropertyValue('--tf-dialog-explicit-max-width')).toBe('500px')
})
