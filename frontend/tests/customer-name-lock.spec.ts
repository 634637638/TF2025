import { mount } from '@vue/test-utils'
import { ElButton, ElInput } from 'element-plus'
import { describe, expect, it } from 'vitest'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'

const mountInput = (props = {}) => mount(CustomerNameLockInput, {
  props: { modelValue: '客户甲', selected: true, ...props },
  global: { components: { ElInput, ElButton } }
})

describe('公共客户姓名锁定输入', () => {
  it('选中客户后只读，双击发出解锁事件，编辑时允许输入并保存', async () => {
    const wrapper = mountInput()
    expect(wrapper.get('input').element.readOnly).toBe(true)
    await wrapper.get('input').trigger('dblclick')
    expect(wrapper.emitted('unlock')).toHaveLength(1)
    await wrapper.setProps({ editing: true })
    expect(wrapper.get('input').element.readOnly).toBe(false)
    await wrapper.get('input').setValue('客户乙')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['客户乙'])
    await wrapper.get('[aria-label="保存姓名并重新锁定"]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    wrapper.unmount()
  })

  it('点击更换客户发出清空事件，硬锁定后不能更换或解锁', async () => {
    const wrapper = mountInput()
    await wrapper.get('[aria-label="更换客户"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    await wrapper.setProps({ locked: true })
    expect(wrapper.find('[aria-label="更换客户"]').exists()).toBe(false)
    await wrapper.get('input').trigger('dblclick')
    expect(wrapper.emitted('unlock')).toBeUndefined()
    wrapper.unmount()
  })

  it('无客户时按新建和允许编辑能力决定只读状态', async () => {
    const wrapper = mountInput({ selected: false })
    expect(wrapper.get('input').element.readOnly).toBe(true)
    await wrapper.setProps({ creating: true })
    expect(wrapper.get('input').element.readOnly).toBe(false)
    await wrapper.setProps({ creating: false, allowUnselectedEdit: true })
    expect(wrapper.get('input').element.readOnly).toBe(false)
    wrapper.unmount()
  })
})
