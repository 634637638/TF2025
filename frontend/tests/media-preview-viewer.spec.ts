import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ElButton, ElDialog } from 'element-plus'
import MediaPreviewViewer from '@/components/MediaPreviewViewer.vue'
import MobileDialog from '@/components/MobileDialog.vue'

vi.mock('@/utils/format', () => ({ formatImageUrl: (value: string) => value }))
vi.mock('@/composables/mobile', async () => {
  const { ref } = await import('vue')
  return { useMobile: () => ({ isMobile: ref(true), isTablet: ref(false), screenSize: ref({ width: 390, height: 844 }) }) }
})

const wrappers: ReturnType<typeof mount>[] = []
const items = [{ url: '/synthetic/first.png', label: '第一张' }, { url: '/synthetic/second.png', label: '第二张' }]
const render = async (initialIndex = 0) => {
  const wrapper = mount(MediaPreviewViewer, {
    attachTo: document.body,
    props: { modelValue: true, items, initialIndex, deletable: true, downloadable: true },
    global: { components: { ElButton } }
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const key = async (value: string) => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
  await flushPromises()
}
afterEach(() => {
  wrappers.splice(0).reverse().forEach(wrapper => wrapper.unmount())
  document.body.style.overflow = ''
})

describe('公共媒体预览交互契约', () => {
  it('空素材列表不产生不可见的滚动锁', async () => {
    const wrapper = await render()
    await wrapper.setProps({ items: [] })
    expect(document.body.style.overflow).toBe('')
    expect(document.querySelector('.media-preview-overlay')).toBeNull()
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('保留初始索引，键盘切换循环，删除及下载回传当前素材', async () => {
    const wrapper = await render(1)
    expect(document.querySelector('img')?.getAttribute('src')).toBe(items[1].url)
    await key('ArrowRight')
    expect(document.querySelector('img')?.getAttribute('src')).toBe(items[0].url)
    await key('ArrowLeft')
    await (document.querySelector('[aria-label="删除当前素材"]') as HTMLButtonElement).click()
    await (document.querySelector('[aria-label="下载当前素材"]') as HTMLButtonElement).click()
    expect(wrapper.emitted('delete')).toEqual([[items[1], 1]])
    expect(wrapper.emitted('download')).toEqual([[items[1], 1]])
  })

  it('嵌套媒体只有顶层响应键盘，退出后仍锁住底层弹窗', async () => {
    const dialog = mount(MobileDialog, {
      attachTo: document.body, props: { modelValue: true },
      global: { components: { ElButton, ElDialog } }
    })
    wrappers.push(dialog)
    const first = await render(), second = await render()
    await key('Escape')
    expect(second.emitted('update:modelValue')).toEqual([[false]])
    expect(first.emitted('update:modelValue')).toBeUndefined()
    expect(dialog.emitted('update:modelValue')).toBeUndefined()
    await second.setProps({ modelValue: false })
    await key('ArrowRight')
    expect(first.emitted('change')?.at(-1)).toEqual([items[1], 1])
    await first.setProps({ modelValue: false })
    expect(document.body.style.overflow).toBe('hidden')
    await dialog.setProps({ modelValue: false })
    expect(document.body.style.overflow).toBe('')
  })

  it('上层确认框存在时不关闭预览或切换图片', async () => {
    const wrapper = await render()
    const message = document.createElement('div')
    message.className = 'el-message-box'
    document.body.append(message)
    vi.spyOn(message, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList)
    try {
      await key('Escape')
      await key('ArrowRight')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.emitted('change')).toEqual([[items[0], 0]])
    } finally { message.remove() }
  })
})
