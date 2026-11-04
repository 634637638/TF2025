import { defineComponent, type PropType } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PreorderFormModal from '@/views/preorders/page/PreorderFormModal.vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'
import { unifiedApi } from '@/utils/unified-api'
import type { PreorderFormDraft } from '@/types'

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: null }) }))
vi.mock('@/views/preorders/preorder-field-permissions', () => ({
  canViewPreorderField: () => true,
  pickVisiblePreorderFields: (value: Record<string, unknown>) => value
}))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { put: vi.fn() } }))

const FormStub = defineComponent({
  props: { model: { type: Object as PropType<PreorderFormDraft>, required: true } },
  methods: { clearValidate() {}, resetFields() {} },
  template: '<form><slot /></form>'
})
const mountForm = () => shallowMount(PreorderFormModal, {
  props: { visible: false },
  global: {
    renderStubDefaultSlot: true,
    stubs: {
      MobileDialog: { template: '<div><slot /></div>' },
      ElForm: FormStub,
      CustomerNameLockInput: {
        extends: CustomerNameLockInput,
        template: '<div />',
        methods: { focus() {} }
      },
      ElRow: true, ElCol: true, ElFormItem: true, ElInput: true,
      ElSelect: true, ElOption: true, ElRadioGroup: true, ElRadioButton: true,
      ElDatePicker: true, ElInputNumber: true, ElButton: true
    }
  }
})

afterEach(() => vi.resetAllMocks())

describe('预订单客户选择与更换', () => {
  it('选择后写入客户 ID、姓名、手机号，更换后全部清空并退出编辑', async () => {
    const wrapper = mountForm()
    wrapper.getComponent(CustomerSearchDropdown).vm.$emit('select', { id: 19, name: '客户甲', phone: '13800000000' })
    await flushPromises()
    expect(wrapper.getComponent(FormStub).props('model')).toMatchObject({ customer_id: 19, customer_name: '客户甲', customer_phone: '13800000000' })
    const input = wrapper.getComponent(CustomerNameLockInput)
    expect(input.props('selected')).toBe(true)
    input.vm.$emit('unlock')
    await flushPromises()
    expect(input.props('editing')).toBe(true)
    input.vm.$emit('clear')
    await flushPromises()
    expect(wrapper.getComponent(FormStub).props('model')).toMatchObject({ customer_id: null, customer_name: '', customer_phone: '' })
    expect(input.props()).toMatchObject({ selected: false, editing: false })
    wrapper.unmount()
  })

  it('姓名保存调用统一 API 并锁定，不改变原下拉选项对象', async () => {
    vi.mocked(unifiedApi.put).mockResolvedValue({ success: true, message: '', data: null })
    const wrapper = mountForm()
    const option = Object.freeze({ id: 19, name: '客户甲', phone: '13800000000' })
    wrapper.getComponent(CustomerSearchDropdown).vm.$emit('select', option)
    await flushPromises()
    const input = wrapper.getComponent(CustomerNameLockInput)
    input.vm.$emit('unlock')
    input.vm.$emit('update:modelValue', '客户乙')
    await flushPromises()
    input.vm.$emit('save')
    await flushPromises()
    expect(unifiedApi.put).toHaveBeenCalledWith('/customers/19', { name: '客户乙' })
    expect(input.props()).toMatchObject({ modelValue: '客户乙', editing: false })
    expect(option.name).toBe('客户甲')
    wrapper.unmount()
  })
})
