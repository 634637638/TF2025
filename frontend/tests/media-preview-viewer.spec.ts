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
const clickTool = async (label: string) => {
  const button = document.querySelector(`[aria-label="${label}"]`)
  if (!(button instanceof HTMLButtonElement)) throw new Error(`缺少预览工具：${label}`)
  button.click()
  await flushPromises()
}
const touch = async (type: string, points: { clientX: number; clientY: number }[], target = document.querySelector('.media-preview-stage')) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : points },
    changedTouches: { value: points }
  })
  target?.dispatchEvent(event)
  await flushPromises()
}
const swipe = async (target?: Element | null, y = 100) => {
  await touch('touchstart', [{ clientX: 250, clientY: y }], target)
  await touch('touchend', [{ clientX: 80, clientY: y }], target)
}
afterEach(() => {
  wrappers.splice(0).reverse().forEach(wrapper => wrapper.unmount())
  document.body.style.overflow = ''
})

describe('公共媒体预览交互契约', () => {
  it('横滑循环切换，纵滑、短触和取消不误切换', async () => {
    const wrapper = await render()
    await swipe()
    expect(wrapper.emitted('change')?.at(-1)).toEqual([items[1], 1])
    await swipe()
    expect(wrapper.emitted('change')?.at(-1)).toEqual([items[0], 0])
    const count = wrapper.emitted('change')?.length
    for (const end of [{ clientX: 230, clientY: 100 }, { clientX: 150, clientY: 350 }]) {
      await touch('touchstart', [{ clientX: 250, clientY: 100 }])
      await touch('touchend', [end])
    }
    await touch('touchstart', [{ clientX: 250, clientY: 100 }])
    await touch('touchcancel', [])
    await touch('touchend', [{ clientX: 80, clientY: 100 }])
    expect(wrapper.emitted('change')).toHaveLength(count ?? 0)
  })

  it('放大和平移不翻页，连续拖动累计位移，关闭再开清除旧触摸状态', async () => {
    const wrapper = await render()
    const stage = document.querySelector('.media-preview-stage')
    if (!stage) throw new Error('缺少媒体舞台')
    Object.defineProperties(stage, { clientWidth: { value: 390 }, clientHeight: { value: 844 } })
    await clickTool('放大图片')
    for (let i = 0; i < 2; i++) {
      await touch('touchstart', [{ clientX: 100, clientY: 100 }])
      await touch('touchmove', [{ clientX: 130, clientY: 100 }])
      await touch('touchend', [{ clientX: 130, clientY: 100 }])
    }
    expect(document.querySelector('img')?.style.transform).toContain('translate3d(60px, 0px, 0)')
    expect(wrapper.emitted('change')).toHaveLength(1)
    await touch('touchstart', [{ clientX: 250, clientY: 100 }])
    await clickTool('关闭预览')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    const count = wrapper.emitted('change')?.length
    await touch('touchend', [{ clientX: 80, clientY: 100 }])
    expect(wrapper.emitted('change')).toHaveLength(count ?? 0)
    expect(document.querySelector('img')?.style.transform).toContain('scale(1)')
  })

  it('视频主体可横滑，原生控件区域不触发翻页，切图时暂停视频', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const wrapper = await render()
    const videoItem = { url: '/synthetic/video.mp4', type: 'video' }
    await wrapper.setProps({ items: [videoItem, items[1]], autoPlayVideos: false })
    const video = document.querySelector('video')
    if (!video) throw new Error('缺少视频元素')
    vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 500, height: 500 } as DOMRect)
    const count = wrapper.emitted('change')?.length
    await swipe(video, 480)
    expect(wrapper.emitted('change')).toHaveLength(count ?? 0)
    await swipe(video, 200)
    expect(wrapper.emitted('change')?.at(-1)).toEqual([items[1], 1])
    expect(pause).toHaveBeenCalled()
  })

  it('双指缩放后的抬手不误切图，恢复大小后可继续滑动', async () => {
    const wrapper = await render()
    await touch('touchstart', [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }])
    await touch('touchmove', [{ clientX: 80, clientY: 100 }, { clientX: 230, clientY: 100 }])
    expect(document.querySelector('img')?.style.transform).toContain('scale(1.5)')
    await touch('touchend', [{ clientX: 80, clientY: 100 }])
    expect(wrapper.emitted('change')).toHaveLength(1)
    await clickTool('恢复原始大小')
    await swipe()
    expect(wrapper.emitted('change')?.at(-1)).toEqual([items[1], 1])
  })

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
    await clickTool('删除当前素材')
    await clickTool('下载当前素材')
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
