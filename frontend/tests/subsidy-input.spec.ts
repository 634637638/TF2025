import { ref } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SubsidyEditDialog from '@/views/subsidy/components/SubsidyEditDialog.vue'
import { getSubsidyInputError } from '@/views/subsidy/subsidy-input'
import type { NationalSubsidyRecord } from '@/types'

const mocks = vi.hoisted(() => ({ put: vi.fn(), warning: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { put: mocks.put } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/mobile', () => ({ useMobile: () => ({ isMobile: ref(false) }) }))
vi.mock('@/composables/useBrandModels', () => ({ useBrandModels: () => ({
  brands: ref([]), brandModels: {}, colors: ref([]), memories: ref([]),
  loadBrands: async () => {}, loadModelsForBrand: async () => {}, loadColors: async () => {}, loadMemories: async () => {}
}) }))

const wrappers: ReturnType<typeof shallowMount>[] = []
const render = async (item: NationalSubsidyRecord, allowed?: string) => {
  const wrapper = shallowMount(SubsidyEditDialog, {
    props: { modelValue: true, item, stores: [], canViewField: field => !allowed || field === allowed,
      canEditField: field => !allowed || field === allowed, canApprove: false, canArrival: false },
    global: { renderStubDefaultSlot: true, stubs: {
      MobileDialog: { template: '<div><slot /><slot name="footer" /></div>' },
      ElButton: { template: '<button><slot /></button>' }
    } }
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const save = async (wrapper: ReturnType<typeof shallowMount>) => {
  await wrapper.findAll('button').find(button => button.text().includes('保存'))!.trigger('click')
  await flushPromises()
}
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })

describe('国补提交资料边界', () => {
  it.each([{ customer_name: '123' }, { customer_phone: '138中00000000' }, { sale_price: '1e3' },
    { subsidy_amount: '12元' }, { handler_info: { handler_name: '张\n三' } }, { handler_idcard: ['card'] },
    { imei1: '123456789012345中' }, { imei2: 123456789012345 }, { serial_number: 'ABC中1234' }, { serial_number: 'S'.repeat(51) }])('拒绝非法资料 %o', input => {
    expect(getSubsidyInputError(input)).toBeTruthy()
  })
  it('保留合法姓名和约定格式手机号，接受零金额', () => {
    expect(getSubsidyInputError({ customer_name: "Anne O'Neil·张", customer_phone: '+86 138-0000-0000', sale_price: 0, serial_number: '00AB/CD-1234', imei1: '012345678901234' })).toBeUndefined()
  })
  it('设备无 IMEI 时允许两个 IMEI 字段留空，但序列号必填', () => {
    expect(getSubsidyInputError({ imei1: null, imei2: '', serial_number: 'SN-0001', sale_price: 0 })).toBeUndefined()
    expect(getSubsidyInputError({ imei1: 'SN-0001', serial_number: 'SN-0001', sale_price: 0 })).toBeUndefined()
    expect(getSubsidyInputError({ imei1: 'SN-OTHER', serial_number: 'SN-0001', sale_price: 0 })).toBe('IMEI须为完整15位数字')
    expect(getSubsidyInputError({ imei1: null, imei2: '', serial_number: '', sale_price: 0 })).toBe('请输入序列号')
    expect(getSubsidyInputError({ serial_number: '   ' })).toBe('请输入序列号')
  })
  it.each([{ customer_name: '123' }, { customer_phone: '138中00000000' }, { sale_price: 1.234 }, { imei1: '123456789012345中' }, { serial_number: 'AB中1234' }])('编辑实际提交的非法字段 %o 不发请求或关闭', async patch => {
    const wrapper = await render({ id: 9, sale_price: 10, ...patch })
    await save(wrapper)
    expect(mocks.put).not.toHaveBeenCalled()
    expect(mocks.warning).toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
  it('只读或隐藏的旧字段不阻止有权编辑的备注提交', async () => {
    mocks.put.mockResolvedValue({ success: true })
    const wrapper = await render({ id: 9, customer_phone: 'legacy', customer_name: '123', sale_price: null, remarks: '备注' }, 'remarks')
    await save(wrapper)
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('/subsidy/9', { remarks: '备注' })
    expect(wrapper.emitted('updated')).toHaveLength(1)
  })
})
