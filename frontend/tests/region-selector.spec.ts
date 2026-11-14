import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ElSelect, ElOption } from 'element-plus'
import CitySelector from '@/components/CitySelector.vue'
import { loadRegionChildren, type RegionSelection } from '@/services/region-options'

vi.mock('@/services/region-options', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/region-options')>(), loadRegionChildren: vi.fn()
}))

const children: Record<string, Array<{ code: string; name: string }>> = {
  '': [{ code: '11', name: '北京市' }], '11': [{ code: '1101', name: '市辖区' }],
  '1101': [{ code: '110101', name: '东城区' }], '110101': [{ code: '110101001', name: '东华门街道' }],
  '110101001': [{ code: '110101001001', name: '多福巷社区居委会' }]
}
const selection: RegionSelection = { province: '11', city: '市辖区', district: '东城区', town: '东华门街道', village: '多福巷社区居委会' }
const global = { components: { ElSelect, ElOption }, stubs: { InlineLoading: true } }

beforeEach(() => {
  vi.mocked(loadRegionChildren).mockReset().mockImplementation(async (parent = '') => ({
    version: '2023-06-30', coverage: '内地31省', options: children[parent] || []
  }))
})

describe('公共五级地址选择器', () => {
  it('存量三级模式不请求五级数据，保持原历史值', async () => {
    const wrapper = mount(CitySelector, { props: { modelValue: { province: '44', city: '深圳市', district: '南山区' }, showDistrict: true }, global })
    await flushPromises()
    expect(wrapper.findAllComponents(ElSelect)).toHaveLength(3)
    expect(loadRegionChildren).not.toHaveBeenCalled()
    expect(wrapper.emitted('change')).toBeUndefined()
    wrapper.unmount()
  })

  it('按父级获取五层并标注版本；变更县区清空乡镇和村', async () => {
    const wrapper = mount(CitySelector, { props: { modelValue: selection, showDistrict: true, showTown: true, showVillage: true }, global })
    try {
      await flushPromises()
      expect(wrapper.findAllComponents(ElSelect)).toHaveLength(5)
      expect(wrapper.text()).toContain('2023-06-30')
      expect(wrapper.emitted('change')).toBeUndefined()
      const selects = wrapper.findAllComponents(ElSelect)
      expect(selects[4].props('modelValue')).toBe(selection.village)
      await selects[2].vm.$emit('update:modelValue', '')
      await selects[2].vm.$emit('change', '')
      await flushPromises()
      const changes = wrapper.emitted('change')!
      expect(changes.at(-1)).toEqual([{ ...selection, district: '', town: '', village: '' }])
      expect(wrapper.findAllComponents(ElSelect)[3].props('disabled')).toBe(true)
    } finally { wrapper.unmount() }
  })

  it('旧直辖市名称继续下钻且不静默改写历史值', async () => {
    const wrapper = mount(CitySelector, { props: { modelValue: { ...selection, city: '北京市' }, showDistrict: true, showTown: true, showVillage: true }, global })
    try {
      await flushPromises()
      expect(loadRegionChildren).toHaveBeenCalledWith('110101001', expect.any(AbortSignal))
      expect(wrapper.findAllComponents(ElSelect)[1].props('modelValue')).toBe('北京市')
      expect(wrapper.emitted('change')).toBeUndefined()
    } finally { wrapper.unmount() }
  })

  it('五级下级只读时不能通过上级选择间接清空', async () => {
    const wrapper = mount(CitySelector, { props: { modelValue: selection, showDistrict: true, showTown: true, showVillage: true, villageDisabled: true }, global })
    try {
      await flushPromises()
      expect(wrapper.findAllComponents(ElSelect).every(select => select.props('disabled'))).toBe(true)
    } finally { wrapper.unmount() }
  })

  it('上级切换后忽略旧请求的迟到响应', async () => {
    let finishOld: ((value: Awaited<ReturnType<typeof loadRegionChildren>>) => void) | undefined
    vi.mocked(loadRegionChildren).mockImplementation(async (parent = '') => {
      if (parent === '110101') return new Promise(resolve => { finishOld = resolve })
      return { version: '2023-06-30', coverage: '内地31省', options: children[parent] || [] }
    })
    const wrapper = mount(CitySelector, { props: { modelValue: selection, showDistrict: true, showTown: true, showVillage: true }, global })
    try {
      await flushPromises()
      expect(finishOld).toBeTypeOf('function')
      await wrapper.setProps({ modelValue: { ...selection, district: '', town: '', village: '' } })
      await flushPromises()
      finishOld!({ version: '过期版本', coverage: '旧响应', options: [{ code: '110101001', name: '过期乡镇' }] })
      await flushPromises()
      expect(wrapper.text()).not.toContain('过期版本')
      expect(wrapper.findAllComponents(ElSelect)[3].findAllComponents(ElOption)).toHaveLength(0)
      expect(wrapper.emitted('change')).toBeUndefined()
    } finally { wrapper.unmount() }
  })

  it('数据失败保留五级历史选择并提供明确提示，不自行发送保存', async () => {
    vi.mocked(loadRegionChildren).mockRejectedValue(new Error('地区服务不可用'))
    const wrapper = mount(CitySelector, { props: { modelValue: selection, showDistrict: true, showTown: true, showVillage: true }, global })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain('历史地址已保留')
      expect(wrapper.findAllComponents(ElSelect)[4].props('modelValue')).toBe(selection.village)
      expect(wrapper.emitted('change')).toBeUndefined()
    } finally { wrapper.unmount() }
  })
})
