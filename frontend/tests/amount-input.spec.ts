import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import AmountInput from '@/components/AmountInput.vue'
import { formatAmount, formatCurrency } from '@/utils/format'

const wrappers: ReturnType<typeof mount>[] = []
const render = (value?: number, attrs: Record<string, unknown> = {}) => {
  const model = ref<number | null | undefined>(value)
  const wrapper = mount(defineComponent({ setup: () => () => h(AmountInput, {
    ...attrs, modelValue: model.value, 'onUpdate:modelValue': next => { model.value = next }
  }) }))
  wrappers.push(wrapper)
  return { wrapper, model }
}
const type = async (wrapper: ReturnType<typeof mount>, value: string) => {
  const input = wrapper.get('input')
  await input.trigger('focus')
  await input.setValue(value)
  await input.trigger('change')
  await input.trigger('blur')
  await flushPromises()
}
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('全局金额格式', () => {
  it.each([
    ['225.00', '225'], ['225.02', '225.02'], ['225.20', '225.2'],
    [0, '0'], [-0.001, '0'], [-225.02, '-225.02'], [225.126, '225.13'],
    [null, '0'], [undefined, '0'], ['', '0'], [Number.NaN, '0']
  ])('%s → %s', (value, expected) => {
    expect(formatAmount(value)).toBe(expected)
    expect(formatCurrency(value)).toBe(`¥${expected}`)
  })

  it('显式零位精度保留整数末尾的零', () => {
    expect(formatAmount(1500, 0)).toBe('1500')
    expect(formatCurrency(1500, '¥', 0)).toBe('¥1500')
  })
})

describe('公共金额输入', () => {
  it.each([225, 225.02, 225.2, 0, -225.02])('初始值 %s 不补零且不在挂载时改写数据', async value => {
    const { wrapper, model } = render(value)
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe(String(value))
    expect(model.value).toBe(value)
  })

  it('从整数逐字输入真实小数，保留两位；完成编辑移除尾零', async () => {
    const { wrapper, model } = render(225)
    for (const value of ['225.0', '225.02']) {
      const input = wrapper.get('input')
      input.element.value = value
      await input.trigger('input')
      await flushPromises()
    }
    await wrapper.get('input').trigger('change')
    await wrapper.get('input').trigger('blur')
    expect(model.value).toBe(225.02)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('225.02')
    await type(wrapper, '225.20')
    expect(model.value).toBe(225.2)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('225.2')
    await type(wrapper, '225.00')
    expect(model.value).toBe(225)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('225')
  })

  it('粘贴超出两位的小数后归一化，清空保留空值', async () => {
    const { wrapper, model } = render()
    await type(wrapper, '225.123')
    expect(model.value).toBe(225.12)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('225.12')
    await type(wrapper, '')
    expect(model.value).toBeNull()
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('')
  })

  it('沿用调用方清空值，并保留小额与负金额的真实小数', async () => {
    const { wrapper, model } = render(225, { 'value-on-clear': 0 })
    await type(wrapper, '')
    expect(model.value).toBe(0)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('0')
    await type(wrapper, '0.02')
    expect(model.value).toBe(0.02)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('0.02')
    await type(wrapper, '-225.20')
    expect(model.value).toBe(-225.2)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('-225.2')
  })

  it('保留边界、只读/禁用、外部更新和 prefix 插槽，禁止步进按钮', async () => {
    const { wrapper, model } = render(225, { min: 0, max: 300 })
    await type(wrapper, '400')
    expect(model.value).toBe(300)
    model.value = 225.02
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('225.02')
    expect(wrapper.find('.el-input-number__increase').exists()).toBe(false)
    const disabled = mount(AmountInput, { props: { modelValue: 225 }, attrs: { disabled: true, readonly: true }, slots: { prefix: '¥' } })
    wrappers.push(disabled)
    expect(disabled.get('input').attributes('disabled')).toBeDefined()
    expect(disabled.get('input').attributes('readonly')).toBeDefined()
    expect(disabled.text()).toContain('¥')
  })
})
