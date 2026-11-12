import { h, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { ElButton, ElDialog } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InventoryResultDialog from '@/components/InventoryResultDialog.vue'
import MobileDialog from '@/components/MobileDialog.vue'

const mocks = vi.hoisted(() => ({ width: 1440, get: vi.fn() }))
vi.mock('@/composables/mobile', async () => {
  const { computed } = await import('vue')
  return { useMobile: () => ({
    isMobile: computed(() => mocks.width < 768),
    isTablet: computed(() => mocks.width >= 768 && mocks.width <= 1024),
    screenSize: computed(() => ({ width: mocks.width, height: 900 }))
  }) }
})
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get: mocks.get } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ error: vi.fn() }) }))

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

describe.each([1440, 768, 390])('库存明细关闭 %ipx', width => {
  it('打开、标题关闭、再次主动打开只请求两次，不自动重开', async () => {
    mocks.width = width
    mocks.get.mockReset().mockResolvedValue({ success: true, data: [] })
    const visible = ref(false)
    const wrapper = mount({ render: () => h(InventoryResultDialog, {
      modelValue: visible.value,
      product: { brand_id: 1, model_id: 1, color_id: 1, memory_id: 1, brand: '测试', model: '型号' },
      'onUpdate:modelValue': (value: boolean) => { visible.value = value }
    }) }, { attachTo: document.body, global: {
      components: { MobileDialog, ElDialog, ElButton },
      stubs: { DataEmptyState: true, SectionLoading: true, transition: false }
    } })
    wrappers.push(wrapper)
    await flushPromises()
    visible.value = true
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(document.querySelectorAll('.el-dialog.inventory-result-dialog')).toHaveLength(1)
    document.querySelector<HTMLButtonElement>('.el-dialog__headerbtn')!.click()
    await new Promise(resolve => setTimeout(resolve, 100))
    await flushPromises()
    expect(visible.value).toBe(false)
    expect(mocks.get).toHaveBeenCalledTimes(1)
    visible.value = true
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })
})
