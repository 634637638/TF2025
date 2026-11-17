import { computed, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { ElButton, ElInput } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'

const customerRights = reactive({ create: true, edit: true })
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canCreate: computed(() => customerRights.create), canEdit: computed(() => customerRights.edit),
  requirePermission: (action: 'create' | 'edit') => customerRights[action]
}) }))
beforeEach(() => { customerRights.create = customerRights.edit = true })

const mountInput = (props = {}) => mount(CustomerNameLockInput, {
  props: { modelValue: '客户甲', selected: true, ...props },
  global: { components: { ElInput, ElButton }, directives: { permission: {} } }
})

describe('公共客户姓名锁定输入', () => {
  it('仅客户新增权限时，新姓名确认走创建流程，不要求已有客户编辑权限', async () => {
    customerRights.edit = false
    const wrapper = mountInput({ selected: false, creating: true, editing: true })
    await wrapper.get('input').setValue('新客户')
    await wrapper.get('[aria-label="保存姓名并重新锁定"]').trigger('click')
    expect(wrapper.emitted('blur')).toHaveLength(1)
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['新客户'])
    wrapper.unmount()
  })

  it('没有客户编辑权限时不能解锁、触摸编辑或保存，但可以更换已有客户', async () => {
    customerRights.edit = false
    const wrapper = mountInput({ editing: true })
    expect(wrapper.get('input').element.readOnly).toBe(true)
    expect(wrapper.find('[aria-label="保存姓名并重新锁定"]').exists()).toBe(false)
    await wrapper.get('input').trigger('dblclick')
    await wrapper.get('input').trigger('touchend')
    await wrapper.get('input').trigger('keyup.enter')
    expect(wrapper.emitted('unlock')).toBeUndefined()
    expect(wrapper.emitted('touchend')).toBeUndefined()
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get('[aria-label="更换客户"]').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    wrapper.unmount()
  })

  it('撤销编辑权限后立即恢复只读，新建权限不能解锁已有客户', async () => {
    const wrapper = mountInput({ editing: true })
    expect(wrapper.get('input').element.readOnly).toBe(false)
    customerRights.edit = false
    await wrapper.vm.$nextTick()
    expect(wrapper.get('input').element.readOnly).toBe(true)
    await wrapper.get('input').trigger('keyup.enter')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.setProps({ selected: false, creating: true })
    expect(wrapper.get('input').element.readOnly).toBe(false)
    customerRights.create = false
    await wrapper.vm.$nextTick()
    expect(wrapper.get('input').element.readOnly).toBe(true)
    wrapper.unmount()
  })

  it('候选选择不要求客户新增，完整手机号只有授权后才提供创建', async () => {
    customerRights.create = false
    const wrapper = mount(CustomerSearchDropdown, {
      props: { items: [{ id: 1, name: '已有客户', phone: '13800000000' }], visible: true, keyword: '13800000000', createMinQueryLength: 11 },
      global: { components: { ElButton }, directives: { permission: {} } }
    })
    await wrapper.get('.customer-search-dropdown__item').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    await wrapper.setProps({ items: [] })
    expect(wrapper.find('.customer-search-dropdown__create').exists()).toBe(false)
    customerRights.create = true
    await wrapper.vm.$nextTick()
    await wrapper.get('.customer-search-dropdown__create').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
    wrapper.unmount()
  })

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
