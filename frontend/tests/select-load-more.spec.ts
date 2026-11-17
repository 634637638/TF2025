import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { ElOption, ElSelect } from 'element-plus'
import { useSelectLoadMore } from '@/composables/useSelectLoadMore'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

const render = async (inFieldLoop = false) => {
  const loadMore = vi.fn()
  const disabled = ref(false)
  const Host = defineComponent({
    setup() {
      const { selectRef, onPopupScroll } = useSelectLoadMore(loadMore, () => disabled.value)
      return () => h(ElSelect, { ref: selectRef, ref_for: inFieldLoop, onPopupScroll }, {
        default: () => Array.from({ length: 20 }, (_, index) => h(ElOption, { key: index, value: index, label: `商品${index}` }))
      })
    }
  })
  const wrapper = mount(Host)
  wrappers.push(wrapper)
  await flushPromises()
  const select = wrapper.findComponent(ElSelect)
  const wrap = select.vm.scrollbarRef?.wrapRef
  if (!wrap) throw new Error('Select 内置滚动容器未挂载')
  const resize = (height: number, contentHeight: number) => Object.defineProperties(wrap, {
    clientHeight: { configurable: true, value: height },
    scrollHeight: { configurable: true, value: contentHeight }
  })
  resize(200, 1000)
  const scroll = async (scrollTop: number, scrollLeft = 0) => {
    select.vm.$emit('popup-scroll', { scrollTop, scrollLeft })
    await flushPromises()
  }
  return { loadMore, disabled, resize, scroll }
}

describe('Select 公共滚动分页', () => {
  it('字段配置由循环渲染时，仍能读取正确的下拉滚动容器', async () => {
    const { loadMore, scroll } = await render(true)
    await scroll(800)
    expect(loadMore).toHaveBeenCalledTimes(1)
  })
  it('打开、回到顶部、横向滚动及未到列表底部时不加载，触底才读取下一页', async () => {
    const { loadMore, scroll } = await render()
    expect(loadMore).not.toHaveBeenCalled()
    await scroll(0)
    await scroll(0, 200)
    await scroll(400)
    await scroll(798)
    expect(loadMore).not.toHaveBeenCalled()
    await scroll(800)
    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('容忍滚动位置的小数误差，并使用追加候选后的真实高度判断下一次触底', async () => {
    const { loadMore, scroll, resize } = await render()
    await scroll(799.5)
    expect(loadMore).toHaveBeenCalledTimes(1)
    resize(200, 1500)
    await scroll(800)
    expect(loadMore).toHaveBeenCalledTimes(1)
    await scroll(1300)
    expect(loadMore).toHaveBeenCalledTimes(2)
  })

  it.each(['加载中', '请求失败', '已到末页'])('%s 时禁止自动翻页，恢复后允许继续', async () => {
    const { loadMore, disabled, scroll } = await render()
    disabled.value = true
    await scroll(800)
    await scroll(800)
    expect(loadMore).not.toHaveBeenCalled()
    disabled.value = false
    await scroll(800)
    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('下拉容器隐藏或尚未形成纵向滚动时不自动读取', async () => {
    const { loadMore, scroll, resize } = await render()
    resize(0, 1000)
    await scroll(1000)
    resize(200, 200)
    await scroll(0)
    expect(loadMore).not.toHaveBeenCalled()
  })
})
