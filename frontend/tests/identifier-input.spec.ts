import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref, withDirectives } from 'vue'
import { mount } from '@vue/test-utils'
import { vIdentifierInput } from '@/directives/identifier-input'
import type { IdentifierInputKind } from '@/utils/identifier-input'

const wrappers: ReturnType<typeof mount>[] = []
const render = (kind: IdentifierInputKind, initial = '') => {
  const model = ref(initial)
  const component = defineComponent({
    setup: () => () => withDirectives(h('input', {
      value: model.value,
      onInput: (event: Event) => { model.value = (event.target as HTMLInputElement).value }
    }), [[vIdentifierInput, kind]])
  })
  const wrapper = mount(component)
  wrappers.push(wrapper)
  return { wrapper, model }
}

afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('编码输入公共守卫', () => {
  it.each([
    ['device-serial', 'SN01', 'A中B'],
    ['imei', '12345', '123中456'],
    ['accessory-serial', 'SN01', 'SN中01'],
    ['accessory-serial-list', 'SN01', 'SN01\nSN中02'],
    ['serial-text', 'AB-01', '维修中文编码']
  ] as const)('%s 在输入阶段阻止非法字符，保留原值', (kind, initial, invalid) => {
    const { wrapper, model } = render(kind, initial)
    const input = wrapper.get('input').element as HTMLInputElement
    const beforeInput = new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: '中', inputType: 'insertText' })
    input.dispatchEvent(beforeInput)
    expect(beforeInput.defaultPrevented).toBe(true)

    input.value = invalid
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: invalid }))
    expect(input.value).toBe(initial)
    expect(model.value).toBe(initial)
  })

  it('拒绝含汉字的整段粘贴，但接受合法多行SN', () => {
    const { wrapper, model } = render('accessory-serial-list')
    const input = wrapper.get('input').element as HTMLInputElement
    const invalidPaste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(invalidPaste, 'clipboardData', { value: { getData: () => 'SN01\n配件SN02' } })
    input.dispatchEvent(invalidPaste)
    expect(invalidPaste.defaultPrevented).toBe(true)

    const validPaste = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(validPaste, 'clipboardData', { value: { getData: () => 'SN01\nSN02' } })
    input.dispatchEvent(validPaste)
    expect(validPaste.defaultPrevented).toBe(false)
    expect(model.value).toBe('')
  })

  it('拖放含汉字的编码时阻止插入', () => {
    const { wrapper } = render('accessory-serial')
    const input = wrapper.get('input').element
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'SN汉字' } })
    input.dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
  })

  it('中文输入法组合期间暂不改值，提交汉字后恢复组合前内容', async () => {
    const { wrapper, model } = render('device-serial', 'AB12')
    const input = wrapper.get('input').element as HTMLInputElement
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    input.value = 'AB中文'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, data: '文' }))
    expect(model.value).toBe('AB12')
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '文' }))
    await Promise.resolve()
    expect(input.value).toBe('AB12')
    expect(model.value).toBe('AB12')
  })

  it('已有不合规范的历史值仍可通过删除逐步修正', () => {
    const { wrapper, model } = render('serial-text', '旧编码A')
    const input = wrapper.get('input').element as HTMLInputElement
    input.value = '旧编码'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))
    expect(input.value).toBe('旧编码')
    expect(model.value).toBe('旧编码')
  })

  it('IMEI 保留数字，配件SN允许规定分隔符及前导零', () => {
    const imei = render('imei', '00123')
    const imeiInput = imei.wrapper.get('input').element as HTMLInputElement
    imeiInput.value = '001234'
    imeiInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: '4' }))
    expect(imei.model.value).toBe('001234')

    const accessory = render('accessory-serial', '00SN-01')
    const accessoryInput = accessory.wrapper.get('input').element as HTMLInputElement
    accessoryInput.value = '00SN-01'
    accessoryInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: '1' }))
    expect(accessory.model.value).toBe('00SN-01')
  })
})
