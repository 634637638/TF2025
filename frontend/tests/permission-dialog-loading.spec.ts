import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { ElButton, ElInput, ElTag, ElRadioGroup, ElRadioButton, ElSwitch } from 'element-plus'
import { describe, expect, it } from 'vitest'
import RoleFormDialog from '@/views/permissions/page/RoleFormDialog.vue'
import StoreBindingDialog from '@/views/permissions/page/StoreBindingDialog.vue'
import RoleFieldPermissionDialog from '@/views/permissions/page/RoleFieldPermissionDialog.vue'

const DialogHost = defineComponent({ template: '<section><slot /><slot name="footer" /></section>' })
const global = { components: { ElButton, ElInput, ElTag, ElRadioGroup, ElRadioButton, ElSwitch }, stubs: { MobileDialog: DialogHost } }

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

it('综合查询字段入口展示手机与商品子范围，使用菜单模块新名称并按范围选择', async () => {
  const module = { key: 'query_queryview', name: '自定义查询名称', icon: 'fas fa-search' }
  const wrapper = mount(RoleFieldPermissionDialog, { props: {
    modelValue: true, configReady: true, saving: false, loadingGroups: false, loadingModules: false,
    modules: [module], selectedModule: module, fieldGroups: [], selectedFieldGroupName: '', selectedFields: [],
    getFieldTypeLabel: () => '', getSensitivityLabel: () => '', isFieldSensitive: () => false
  }, global: { ...global, stubs: { MobileDialog: DialogHost, IconRenderer: true, SectionLoading: true } } })
  try {
    expect(wrapper.text()).toContain('手机模式')
    expect(wrapper.text()).toContain('商品模式')
    const goods = wrapper.findAll('.el-radio-button').find(button => button.text() === '商品模式')!
    await goods.find('input').setValue(true)
    expect(wrapper.emitted('selectModule')?.[0]).toEqual([{ ...module, field_scope: 'goods' }])
    await wrapper.setProps({ selectedModule: { ...module, field_scope: 'goods' } })
    expect(wrapper.find('.field-config-title').text()).toBe('自定义查询名称 / 商品模式')
    expect(goods.classes()).toContain('is-active')
    await wrapper.setProps({ configReady: false })
    expect(wrapper.findAll('button').find(button => button.text() === '保存配置')!.attributes('disabled')).toBeDefined()
  } finally { wrapper.unmount() }
})

it('非库存模块同样显示隐藏、只读、编辑三态，且按字段能力限制编辑', async () => {
  const wrapper = mount(RoleFieldPermissionDialog, { props: {
    modelValue: true, configReady: true, saving: false, loadingGroups: false, loadingModules: false,
    modules: [], selectedModule: { key: 'sales_salesview', name: '销售管理', icon: 'fas fa-cart' },
    fieldGroups: [{ name: '销售信息', sensitivity: 'internal', fields: [
      { id: 'sale.sale_price', name: '销售单价', type: 'currency', sensitivity: 'internal', editable: true },
      { id: 'sale.id', name: '销售记录ID', type: 'number', sensitivity: 'internal' }
    ] }],
    selectedFieldGroupName: '销售信息', selectedFields: [], readonlyFields: [], editableFields: undefined,
    getFieldTypeLabel: value => value, getSensitivityLabel: value => value, isFieldSensitive: () => false
  }, global: { ...global, stubs: { MobileDialog: DialogHost, IconRenderer: true, SectionLoading: true } } })
  try {
    const groups = wrapper.findAllComponents({ name: 'ElRadioGroup' })
    expect(groups).toHaveLength(2)
    expect(groups.map(group => group.props('modelValue'))).toEqual(['editable', 'readonly'])
    expect(groups.map(group => group.findAllComponents({ name: 'ElRadioButton' }).map(button => button.text()))).toEqual([
      ['隐藏', '只读', '编辑'], ['隐藏', '只读', '编辑']
    ])
    expect(groups[1].findAllComponents({ name: 'ElRadioButton' })[2].props('disabled')).toBe(true)
    groups[0].vm.$emit('change', 'readonly')
    expect(wrapper.emitted('update:readonlyFields')?.at(-1)).toEqual([['sale.sale_price']])
    expect(wrapper.emitted('update:editableFields')?.at(-1)).toEqual([[]])
  } finally { wrapper.unmount() }
})
