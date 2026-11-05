import { afterEach, describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ElOption, ElSelect } from 'element-plus'
import CitySelector from '@/components/CitySelector.vue'
import type { RegionSelection } from '@/services/region-options'

const wrappers: ReturnType<typeof mount>[] = []

function render(modelValue: RegionSelection = { province: '', city: '', district: '' }, props = {}) {
  const wrapper = mount(CitySelector, {
    attachTo: document.body,
    props: { modelValue, ...props },
    global: { components: { ElSelect, ElOption } }
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

describe('CitySelector 地区选择', () => {
  it('编辑回显省份名称和城市编码时显示中文，并且不擅自改写记录', async () => {
    const wrapper = render({ province: '广东省', city: '4403', district: '440305' }, { showDistrict: true })
    await flushPromises()
    const selects = wrapper.findAllComponents(ElSelect)
    expect(selects[0].text()).toContain('广东省')
    expect(selects[1].text()).toContain('深圳市')
    expect(selects[2].text()).toContain('南山区')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('点击省份能展示地址选项，选择后清空原城市并提交省份编码', async () => {
    const wrapper = render({ province: '44', city: '深圳市', district: '南山区' })
    await flushPromises()
    await wrapper.find('.el-select__wrapper').trigger('click')
    await flushPromises()
    const option = Array.from(document.querySelectorAll<HTMLElement>('.el-select-dropdown__item'))
      .find(element => element.textContent?.trim() === '浙江省')
    expect(option).toBeDefined()
    option!.click()
    await flushPromises()
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toEqual({ province: '33', city: '', district: '' })
    expect(wrapper.findAllComponents(ElSelect)[0].text()).toContain('浙江省')
  })

  it('未选省份时禁用城市，并显示可理解的占位文字', async () => {
    const wrapper = render()
    await flushPromises()
    const selects = wrapper.findAllComponents(ElSelect)
    expect(selects[0].text()).toContain('搜索或选择省份')
    expect(selects[1].text()).toContain('搜索或选择城市')
    expect(selects[1].props('disabled')).toBe(true)
  })

  it('按省份和城市各自的权限隐藏或禁用控件', async () => {
    const wrapper = render({ province: '44', city: '深圳市', district: '' }, { provinceDisabled: true })
    expect(wrapper.findAllComponents(ElSelect)[0].props('disabled')).toBe(true)
    expect(wrapper.findAllComponents(ElSelect)[1].props('disabled')).toBe(false)
    await wrapper.setProps({ hideCity: true })
    expect(wrapper.findAllComponents(ElSelect)).toHaveLength(1)
    await wrapper.setProps({ hideCity: false, hideProvince: true, cityDisabled: true })
    expect(wrapper.findAllComponents(ElSelect)).toHaveLength(1)
    expect(wrapper.findComponent(ElSelect).props('disabled')).toBe(true)
  })

  it('县区按城市联动，实际点击选项后显示名称，切换城市清空旧县区', async () => {
    const wrapper = render({ province: '44', city: '深圳市', district: '' }, { showDistrict: true })
    await flushPromises()
    await wrapper.findAll('.el-select__wrapper')[2].trigger('click')
    await flushPromises()
    const option = Array.from(document.querySelectorAll<HTMLElement>('.el-select-dropdown__item'))
      .find(element => element.textContent?.trim() === '南山区')
    expect(option).toBeDefined()
    option!.click()
    await flushPromises()
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toEqual({ province: '44', city: '深圳市', district: '南山区' })
    expect(wrapper.findAllComponents(ElSelect)[2].text()).toContain('南山区')

    await wrapper.findAllComponents(ElSelect)[1].vm.$emit('update:modelValue', '广州市')
    await wrapper.findAllComponents(ElSelect)[1].vm.$emit('change', '广州市')
    await flushPromises()
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toEqual({ province: '44', city: '广州市', district: '' })
    expect(wrapper.findAllComponents(ElOption).some(option => option.props('label') === '越秀区')).toBe(true)
    expect(wrapper.findAllComponents(ElOption).some(option => option.props('label') === '南山区')).toBe(false)
  })

  it('城市只读时不允许通过修改省份间接清空城市，县区沿用地址权限', () => {
    const wrapper = render({ province: '44', city: '深圳市', district: '南山区' }, {
      showDistrict: true, cityDisabled: true, districtDisabled: true
    })
    expect(wrapper.findAllComponents(ElSelect).every(select => select.props('disabled'))).toBe(true)
  })
})
