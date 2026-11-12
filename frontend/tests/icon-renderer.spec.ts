import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import IconRenderer from '@/components/IconRenderer.vue'
import { iconService } from '@/services/icons'
import type { IconRecord } from '@/types/icon'
import { sanitizeIconSvg } from '@/utils/icon-svg'

vi.mock('@/services/icons', () => ({ iconService: { byClass: vi.fn() } }))
afterEach(() => vi.resetAllMocks())
const svg = '<svg viewBox="0 0 24 24"><path d="M1 1L2 2"/></svg>'

describe('公共图标本地渲染', () => {
  it('保留本地渐变引用，移除 CSS 转义和动画注入的外部资源', () => {
    const result = sanitizeIconSvg('<svg><defs><linearGradient id="local"/></defs><path fill="url(#local)"/><path stroke="u\\72l(https://evil.test/a)"/><animate attributeName="href" values="https://evil.test/a"/></svg>')
    expect(result).toContain('fill="url(#local)"')
    expect(result).not.toMatch(/evil|animate|stroke=/)
  })

  it('菜单随接口返回 SVG 时直接渲染，清理脚本和外部资源，不额外请求', () => {
    const wrapper = mount(IconRenderer, { props: {
      icon: 'iconify lucide:home',
      svg: '<svg onload="alert(1)"><script>alert(1)</script><image href="https://evil.test/a"/><path fill="url(https://evil.test/a)" d="M0 0"/></svg>'
    } })
    expect(wrapper.find('svg path').exists()).toBe(true)
    expect(wrapper.html()).not.toMatch(/evil|script|onload/)
    expect(iconService.byClass).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('只有图标名称时精确读取站内库，缺失和读取失败均保留本地占位', async () => {
    vi.mocked(iconService.byClass).mockResolvedValueOnce({ class: 'iconify lucide:home', name: '首页', category: 'menu', svg })
    const wrapper = mount(IconRenderer, { props: { icon: 'iconify lucide:home' } })
    await flushPromises()
    expect(iconService.byClass).toHaveBeenCalledWith('iconify lucide:home')
    expect(wrapper.find('path').exists()).toBe(true)
    vi.mocked(iconService.byClass).mockResolvedValueOnce(null)
    await wrapper.setProps({ icon: 'iconify lucide:missing' })
    await flushPromises()
    expect(wrapper.find('circle').exists()).toBe(true)
    vi.mocked(iconService.byClass).mockRejectedValueOnce(new Error('offline'))
    await wrapper.setProps({ icon: 'iconify lucide:failed' })
    await flushPromises()
    expect(wrapper.find('circle').exists()).toBe(true)
    expect(wrapper.html()).not.toMatch(/api\.iconify\.design|iconify-mask/)
    expect(wrapper.find('[src], [href], image').exists()).toBe(false)
    wrapper.unmount()
  })

  it('快速更换图标时，旧请求和卸载后的响应不覆盖当前结果', async () => {
    let finish: (value: IconRecord) => void = () => { throw new Error('未发起请求') }
    vi.mocked(iconService.byClass).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = mount(IconRenderer, { props: { icon: 'iconify lucide:old' } })
    await wrapper.setProps({ icon: 'iconify lucide:new', svg: '<svg><rect width="2" height="2"/></svg>' })
    finish({ class: 'iconify lucide:old', name: '旧', category: 'menu', svg })
    await flushPromises()
    expect(wrapper.find('rect').exists()).toBe(true)
    expect(wrapper.find('path').exists()).toBe(false)
    wrapper.unmount()
  })

  it('在线候选未有 SVG 时也不访问外网或逐个查询本地库，收到 SVG 后直接显示', async () => {
    const wrapper = mount(IconRenderer, { props: { icon: 'iconify lucide:home', onlinePreview: true } })
    expect(wrapper.find('circle').exists()).toBe(true)
    expect(wrapper.html()).not.toMatch(/https:|mask/)
    expect(iconService.byClass).not.toHaveBeenCalled()
    await wrapper.setProps({ svg })
    expect(wrapper.find('path').exists()).toBe(true)
    await wrapper.setProps({ icon: 'fas fa-home', svg: '', onlinePreview: false })
    expect(wrapper.classes()).toContain('fa-home')
    expect(wrapper.attributes('style')).toBeUndefined()
    wrapper.unmount()
  })
})
