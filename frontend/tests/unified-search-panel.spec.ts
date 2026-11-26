import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'

const SearchActionButtonStub = {
  template: '<button :disabled="disabled || loading"><slot /></button>',
  props: ['disabled', 'loading']
}

const ElButtonStub = {
  template: '<button :disabled="disabled"><slot /></button>',
  props: ['disabled']
}

describe('UnifiedSearchPanel 关键词自动检索', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const render = (props: Record<string, unknown> = {}) => mount(UnifiedSearchPanel, {
    props,
    global: {
      stubs: {
        SearchActionButton: SearchActionButtonStub,
        ElButton: ElButtonStub
      }
    },
    slots: {
      primary: '<input aria-label="关键词" /><button class="el-input__clear" />',
      default: '<div class="filter-item"><button class="filter-control">状态</button></div>'
    }
  })

  it('输入停止 350ms 后只触发一次检索', async () => {
    const wrapper = render()
    const input = wrapper.get('input')

    await input.setValue('充客')
    await input.setValue('充客安卓线')
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(349)
    expect(wrapper.emitted('search')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  it('回车立即检索并取消待执行的防抖任务', async () => {
    const wrapper = render()
    const input = wrapper.get('input')

    await input.setValue('关键词')
    await input.trigger('keyup', { key: 'Enter' })
    expect(wrapper.emitted('search')).toHaveLength(1)

    vi.advanceTimersByTime(350)
    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  it('禁用检索时输入和回车都不触发查询', async () => {
    const wrapper = render({ searchDisabled: true })
    const input = wrapper.get('input')

    await input.setValue('关键词')
    await input.trigger('keyup', { key: 'Enter' })
    vi.advanceTimersByTime(350)
    expect(wrapper.emitted('search')).toBeUndefined()
  })

  it('清空关键词后自动检索', async () => {
    const wrapper = render()
    await wrapper.get('.el-input__clear').trigger('click')

    vi.advanceTimersByTime(0)
    vi.advanceTimersByTime(349)
    expect(wrapper.emitted('search')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  it('筛选交互会取消待执行的关键词检索', async () => {
    const wrapper = render()
    await wrapper.get('input').setValue('关键词')
    await wrapper.get('.filter-control').trigger('click')

    vi.advanceTimersByTime(350)
    expect(wrapper.emitted('search')).toBeUndefined()
  })

  it('筛选项中的普通文本输入也使用公共自动检索', async () => {
    const wrapper = mount(UnifiedSearchPanel, {
      global: {
        stubs: {
          SearchActionButton: SearchActionButtonStub,
          ElButton: ElButtonStub
        }
      },
      slots: {
        primary: '<span>主区域</span>',
        default: '<div class="filter-item"><input aria-label="筛选关键词" /></div>'
      }
    })

    const input = wrapper.get('[aria-label="筛选关键词"]')
    await input.setValue('客户')
    await input.trigger('input')
    vi.advanceTimersByTime(350)
    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  it('清空筛选区普通文本后自动检索', async () => {
    const wrapper = mount(UnifiedSearchPanel, {
      global: {
        stubs: {
          SearchActionButton: SearchActionButtonStub,
          ElButton: ElButtonStub
        }
      },
      slots: {
        primary: '<span>主区域</span>',
        default: '<div class="form-group filter-item"><input /><button class="el-input__clear" /></div>'
      }
    })

    await wrapper.get('.el-input__clear').trigger('click')
    vi.advanceTimersByTime(0)
    vi.advanceTimersByTime(350)
    expect(wrapper.emitted('search')).toHaveLength(1)
  })

  it('按搜索按钮回车不会重复触发查询', async () => {
    const wrapper = render()
    const button = wrapper.find('.unified-search-panel__search-button')

    await button.trigger('keyup', { key: 'Enter' })
    expect(wrapper.emitted('search')).toBeUndefined()
  })
})
