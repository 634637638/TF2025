import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { ElButton, ElInput, ElTag } from 'element-plus'
import { describe, expect, it } from 'vitest'
import RoleFormDialog from '@/views/permissions/page/RoleFormDialog.vue'
import StoreBindingDialog from '@/views/permissions/page/StoreBindingDialog.vue'

const DialogHost = defineComponent({ template: '<section><slot /><slot name="footer" /></section>' })
const global = { components: { ElButton, ElInput, ElTag }, stubs: { MobileDialog: DialogHost } }

describe('权限弹窗按钮公共 Loading', () => {
  it.each([false, true])('角色创建/编辑在等待期间禁用重复点击，失败后可重试：编辑=%s', async isEdit => {
    const wrapper = mount(RoleFormDialog, { props: {
      modelValue: true, saving: false, isEdit, name: '角色', code: 'role', description: '职责'
    }, global })
    const button = wrapper.findAll('button').at(-1)!
    await button.trigger('click')
    expect(wrapper.emitted('submit')).toHaveLength(1)
    await wrapper.setProps({ saving: true })
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.findAll('.is-loading')).toHaveLength(1)
    expect(button.text()).toBe(isEdit ? '更新中...' : '创建中...')
    await button.trigger('click')
    expect(wrapper.emitted('submit')).toHaveLength(1)
    await wrapper.setProps({ saving: false })
    expect(button.find('.is-loading').exists()).toBe(false)
    await button.trigger('click')
    expect(wrapper.emitted('submit')).toHaveLength(2)
    wrapper.unmount()
  })

  it('绑定门店保留业务禁用条件及取消事件，等待结束恢复可用', async () => {
    const wrapper = mount(StoreBindingDialog, { props: {
      modelValue: true, saving: false, selectedStoreIds: [], stores: [{ id: 1, name: '门店' }], user: null
    }, global })
    const save = wrapper.findAll('button').at(-1)!
    expect(save.attributes('disabled')).toBeDefined()
    await wrapper.setProps({ selectedStoreIds: [1] })
    await save.trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    await wrapper.setProps({ saving: true })
    expect(save.findAll('.is-loading')).toHaveLength(1)
    await save.trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    await wrapper.findAll('button').at(-2)!.trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
    await wrapper.setProps({ saving: false })
    expect(save.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
