import { defineComponent, type PropType } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PreorderFormModal from '@/views/preorders/page/PreorderFormModal.vue'
import CustomerNameLockInput from '@/components/common/CustomerNameLockInput.vue'
import CustomerSearchDropdown from '@/components/common/CustomerSearchDropdown.vue'
import { unifiedApi } from '@/utils/unified-api'
import type { PreorderFormDraft } from '@/types'

const feedback = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => feedback }))
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
const wrappers: ReturnType<typeof shallowMount>[] = []
const mountForm = () => {
  const wrapper = shallowMount(PreorderFormModal, {
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
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.resetAllMocks()
})

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
    expect(feedback.success).toHaveBeenCalledWith('客户姓名更新成功')
    expect(feedback.error).not.toHaveBeenCalled()
  })

  it('保存失败提示错误，不报告成功或修改原客户对象', async () => {
    vi.mocked(unifiedApi.put).mockRejectedValue(new Error('更新失败'))
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
    expect(feedback.error).toHaveBeenCalledWith('更新失败')
    expect(feedback.success).not.toHaveBeenCalled()
    expect(option.name).toBe('客户甲')
  })

  it('空姓名不发送更新请求，并给出必填提示', async () => {
    const wrapper = mountForm()
    wrapper.getComponent(CustomerSearchDropdown).vm.$emit('select', { id: 19, name: '客户甲', phone: '13800000000' })
    await flushPromises()
    const input = wrapper.getComponent(CustomerNameLockInput)
    input.vm.$emit('unlock')
    input.vm.$emit('update:modelValue', '')
    await flushPromises()
    input.vm.$emit('save')
    await flushPromises()
    expect(unifiedApi.put).not.toHaveBeenCalled()
    expect(feedback.warning).toHaveBeenCalledWith('客户姓名不能为空')
    expect(feedback.success).not.toHaveBeenCalled()
  })
})
