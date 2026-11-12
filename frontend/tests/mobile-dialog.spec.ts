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
const render = async (props: { width?: string | number, maxWidth?: string | number, dialogClass?: string, closeOnClickModal?: boolean, beforeClose?: (done: (cancel?: boolean) => void) => void } = {}) => {
  const wrapper = mount(MobileDialog, {
    attachTo: document.body,
    props: { modelValue: true, title: '客户详情', ...props },
    global: { components: { ElButton, ElDialog }, stubs: { transition: false } }
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

const pointer = (target: Element, type: string, x = 1, y = 1) => {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
  target.dispatchEvent(event)
}

const clickBackdrop = (width: number, startOn?: Element) => {
  const overlay = document.querySelector(width <= 1024 ? '.mobile-dialog-sheet-overlay' : '.el-overlay-dialog')!
  if (width <= 1024) {
    pointer(startOn || overlay, 'pointerdown')
    pointer(overlay, 'pointerup')
  } else {
    const downTarget = startOn || overlay
    downTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    overlay.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  }
  overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe.each([390, 768, 1440])('MobileDialog %ipx 的遮罩关闭', width => {
  it('查看弹窗默认允许点击外部关闭，正文点击与从正文拖到外部不关闭', async () => {
    viewport.width = width
    const { wrapper, panel } = await render()
    panel.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    clickBackdrop(width, panel)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    clickBackdrop(width)
    await vi.waitFor(() => expect(wrapper.emitted('update:modelValue')).toEqual([[false]]))
  })

  it('创建/编辑表单禁用遮罩关闭，内部草稿保持不变', async () => {
    viewport.width = width
    const { wrapper } = await render({ closeOnClickModal: false })
    clickBackdrop(width)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('查看弹窗的遮罩关闭仍尊重 beforeClose 拦截', async () => {
    viewport.width = width
    const beforeClose = vi.fn((done: (cancel?: boolean) => void) => done(true))
    const { wrapper } = await render({ beforeClose })
    clickBackdrop(width)
    await flushPromises()
    expect(beforeClose).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

it('手机滑动、指针取消及没有完整指针过程的兼容点击均不关闭查看弹窗', async () => {
  viewport.width = 390
  const { wrapper } = await render()
  const overlay = document.querySelector('.mobile-dialog-sheet-overlay')!
  pointer(overlay, 'pointerdown', 1, 1)
  pointer(overlay, 'pointermove', 1, 30)
  pointer(overlay, 'pointerup', 1, 30)
  overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  pointer(overlay, 'pointerdown')
  pointer(overlay, 'pointercancel')
  pointer(overlay, 'pointerup')
  overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
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

it('手机初始打开也发出生命周期事件；关闭与卸载不解除另一个弹窗的滚动锁', async () => {
  viewport.width = 390
  const first = await render(), second = await render()
  expect(first.wrapper.emitted('open')).toHaveLength(1)
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(first.wrapper.emitted('opened')).toHaveLength(1)
  expect(document.body.style.overflow).toBe('hidden')
  await second.wrapper.setProps({ modelValue: false })
  expect(second.wrapper.emitted('close')).toHaveLength(1)
  second.wrapper.unmount()
  wrappers.splice(wrappers.indexOf(second.wrapper), 1)
  expect(document.body.style.overflow).toBe('hidden')
  await first.wrapper.setProps({ modelValue: false })
  expect(document.body.style.overflow).toBe('')
})

it('嵌套手机弹窗只允许最上层响应 Escape；禁止关闭的提醒保留原契约', async () => {
  viewport.width = 390
  const first = await render(), second = await render()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
  await flushPromises()
  expect(first.wrapper.emitted('update:modelValue')).toBeUndefined()
  expect(second.wrapper.emitted('update:modelValue')).toEqual([[false]])
  await second.wrapper.setProps({ closeOnPressEscape: false })
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
  expect(second.wrapper.emitted('update:modelValue')).toHaveLength(1)
})

it('自定义 footer 和 destroyOnClose 在手机端保留内容及关闭回调', async () => {
  viewport.width = 390
  const wrapper = mount(MobileDialog, {
    attachTo: document.body,
    props: { modelValue: false, destroyOnClose: true, showDefaultFooter: false },
    slots: { default: '<input value="编辑草稿" />', footer: '<button>自定义保存</button>' },
    global: { components: { ElButton, ElDialog }, stubs: { transition: false } }
  })
  wrappers.push(wrapper)
  await wrapper.setProps({ modelValue: true })
  expect(document.querySelector('.mobile-dialog-sheet-body input')).not.toBeNull()
  expect(document.querySelector('.mobile-dialog-sheet-footer')?.textContent).toBe('自定义保存')
  await wrapper.setProps({ modelValue: false })
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(wrapper.emitted('closed')).toHaveLength(1)
  await flushPromises()
  expect(document.querySelector('.mobile-dialog-sheet-body input')).toBeNull()
})

it('手机标题关闭与 Escape 均等待 beforeClose，取消回调不关闭', async () => {
  viewport.width = 390
  let finish!: (cancel?: boolean) => void
  const beforeClose = vi.fn((done: (cancel?: boolean) => void) => { finish = done })
  const { wrapper } = await render({ beforeClose })
  const close = document.querySelector<HTMLButtonElement>('.mobile-dialog-sheet-close')!
  close.click()
  expect(beforeClose).toHaveBeenCalledTimes(1)
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  finish(true)
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
  expect(beforeClose).toHaveBeenCalledTimes(2)
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  finish()
  expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
})
