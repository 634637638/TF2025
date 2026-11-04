import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DateRangePicker from '@/components/DateRangePicker.vue'

const DatePickerStub = defineComponent({
  name: 'ElDatePicker',
  inheritAttrs: false,
  props: {
    modelValue: {
      type: String,
      default: null
    }
  },
  emits: ['update:modelValue', 'change'],
  template: '<input :value="modelValue || \'\'" />'
})

describe('DateRangePicker', () => {
  it('只有起止日期完整时才触发查询 change', async () => {
    const wrapper = mount(DateRangePicker, {
      props: { modelValue: null },
      global: { stubs: { ElDatePicker: DatePickerStub } }
    })
    const pickers = wrapper.findAllComponents(DatePickerStub)

    pickers[0].vm.$emit('update:modelValue', '2026-11-01')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('change')).toBeUndefined()

    const firstRange = wrapper.emitted('update:modelValue')![0][0]
    await wrapper.setProps({ modelValue: firstRange })
    pickers[1].vm.$emit('update:modelValue', '2026-11-04')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('change')?.at(-1)?.[0]).toEqual(['2026-11-01', '2026-11-04'])
  })

  it('清除完整范围时发出 null 以重置筛选', async () => {
    const wrapper = mount(DateRangePicker, {
      props: { modelValue: ['2026-11-01', '2026-11-04'] },
      global: { stubs: { ElDatePicker: DatePickerStub } }
    })

    wrapper.findAllComponents(DatePickerStub)[0].vm.$emit('update:modelValue', null)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toBeNull()
  })
})
