import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElOption, ElOptionGroup, ElSelect, ElSwitch } from 'element-plus'
import AmountInput from '@/components/AmountInput.vue'
import AccessoryStockInModal from '@/components/AccessoryStockInModal.vue'
import type { AccessoryRecord, AccessoryStockInInput } from '@/types/accessory'
import type { AccessoryEntryOptions } from '@/services/reference-options'

const mocks = vi.hoisted(() => ({
  options: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn(),
  success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), confirm: vi.fn(),
  hidden: new Set<string>()
}))
vi.mock('@/services/reference-options', () => ({ getAccessoryEntryOptions: mocks.options }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 7, name: '当前入库员', store_id: 2 }, token: null }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  init: async () => {}, isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field)
} }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/utils/temp-file-cleaner', () => ({ deleteTempFiles: async () => true }))

const optionData = (brand?: number): AccessoryEntryOptions => ({
  categories: [{ id: 11, name: '钢化膜', status: 1 }, { id: 12, name: '充电头', status: 1 }],
  units: [{ id: 1, name: '张', status: 1 }, { id: 2, name: '个', status: 1 }],
  brands: [{ id: 1, name: '配件品牌', status: 1 }],
  model_brands: [{ id: 1, name: '手机品牌甲' }, { id: 2, name: '手机品牌乙' }],
  models: brand ? [{ id: brand * 10, name: `机型${brand}`, brand_id: brand }] : [],
  colors: [{ id: 3, name: '白色' }], suppliers: [{ id: 4, name: '公共供应商', status: 1 }],
  stores: [{ id: 2, name: '门店A' }]
})
const DialogStub = defineComponent({ template: '<div><slot /><slot name="footer" /></div>' })
const wrappers: ReturnType<typeof mount>[] = []
const render = (accessory?: AccessoryRecord, archiveOnly = false) => {
  const wrapper = mount(AccessoryStockInModal, {
    props: { modelValue: true, accessory, archiveOnly },
    global: { plugins: [ElementPlus], directives: { 'infinite-scroll': {} }, stubs: { MobileDialog: DialogStub, Image: true } }
  })
  wrappers.push(wrapper)
  return wrapper
}
const select = (wrapper: ReturnType<typeof render>, placeholder: string) => {
  const result = wrapper.findAllComponents(ElSelect).find(item => item.props('placeholder') === placeholder)
  if (!result) throw new Error(`未找到选择器：${placeholder}`)
  return result
}
const selectField = (wrapper: ReturnType<typeof render>, label: string) => {
  const result = wrapper.findAllComponents(ElSelect).find(item =>
    item.element.closest('.el-form-item')?.querySelector('.el-form-item__label')?.textContent?.trim() === label)
  if (!result) throw new Error(`未找到选择字段：${label}`)
  return result
}
const saveButton = (wrapper: ReturnType<typeof render>) => wrapper.findAll('button').find(button => /保存|创建模板|确认入库|重试原入库/.test(button.text()))!
const salePriceInput = (wrapper: ReturnType<typeof render>) => wrapper.findAllComponents(AmountInput)
  .find(input => input.element.closest('.el-form-item')?.textContent?.match(/零售价|销售价/))!

const purchaseForm = async () => {
  const wrapper = mount(AccessoryStockInModal, {
    props: { modelValue: true, stockInOnly: true, accessory: { id: 55, name: '原装充电头', category_id: 12, unit_id: 2, status: 1 } },
    global: { plugins: [ElementPlus], directives: { 'infinite-scroll': {} }, stubs: { MobileDialog: DialogStub, Image: true } }
  })
  wrappers.push(wrapper)
  await flushPromises()
  if (wrapper.findAllComponents(ElSelect).length) selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  mocks.confirm.mockResolvedValue(true)
  mocks.hidden.clear()
  mocks.get.mockReset()
  mocks.options.mockImplementation(async (params: { brand_id?: number } = {}) => ({ success: true, data: optionData(params.brand_id) }))
  mocks.put.mockResolvedValue({ success: true })
  mocks.post.mockImplementation(async (url: string, input: AccessoryStockInInput) => ({ success: true,
    ...(url === '/accessories/stock-in' ? { data: { stock_in_id: 31, batch_no: 'IN-31', accessory_id: 55,
      quantity: input.total_quantity, total_amount: Number(input.purchase_cost) * Number(input.total_quantity),
      inventory_time: '2026-11-14 10:00:00', replayed: false } } : {}) }))
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.clearAllMocks()
})

describe('配件公共资料与独立类型入库', () => {
  it('入库网络失败保留原请求；关闭重开甚至重建状态后，只能显式重试原采购', async () => {
    mocks.post.mockRejectedValueOnce(new Error('Network Error'))
    const wrapper = await purchaseForm()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    const original = mocks.post.mock.calls[0][1]
    expect(original.request_key).toMatch(/^[a-f0-9]{32}$/)
    expect(wrapper.text()).toContain('上次入库结果尚未确认')
    expect(wrapper.find('.accessory-form').exists()).toBe(false)
    expect(wrapper.emitted('success')).toBeUndefined()
    await wrapper.setProps({ modelValue: false }); await wrapper.setProps({ modelValue: true }); await flushPromises()
    expect(saveButton(wrapper).text()).toContain('重试原入库')
    wrapper.unmount()
    setActivePinia(createPinia())
    const reopened = await purchaseForm()
    await saveButton(reopened).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledTimes(2)
    expect(mocks.post.mock.calls[1][1]).toEqual(original)
    expect(reopened.emitted('success')).toHaveLength(1)
    expect(reopened.emitted('update:modelValue')?.at(-1)).toEqual([false])
    expect(sessionStorage.getItem('tf2025_accessory_stock_in_pending_7')).toBeNull()
  })

  it('入库回执不完整不关窗不报成功；明确业务拒绝允许修正后建立新请求', async () => {
    mocks.post.mockResolvedValueOnce({ success: true })
    const wrapper = await purchaseForm()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    const original = mocks.post.mock.calls[0][1]
    expect(wrapper.emitted('success')).toBeUndefined()
    expect(wrapper.text()).toContain('上次入库结果尚未确认')
    mocks.post.mockRejectedValueOnce({ response: { status: 400, data: { code: 'INVALID_REFERENCE', message: '供应商已停用' } } })
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[1][1]).toEqual(original)
    expect(wrapper.find('.accessory-form').exists()).toBe(true)
    expect(saveButton(wrapper).text()).toContain('确认入库')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[2][1].request_key).not.toBe(original.request_key)
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('未确认采购撤回字段权限后禁止原载荷重试；模板编辑仍独立且不携带入库凭据', async () => {
    mocks.post.mockRejectedValueOnce(new Error('Network Error'))
    const wrapper = await purchaseForm()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    wrapper.unmount()
    mocks.hidden.add('price_info.purchase_cost')
    const restricted = await purchaseForm()
    expect(saveButton(restricted).attributes('disabled')).toBeDefined()
    await saveButton(restricted).trigger('click')
    expect(mocks.post).toHaveBeenCalledTimes(1)
    const editor = render({ id: 55, name: '原装充电头', category_id: 12, unit_id: 2 }, true)
    await flushPromises(); await saveButton(editor).trigger('click'); await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.not.objectContaining({ request_key: expect.anything() }))
  })

  it('请求处理中禁用连点及关闭，服务端原回执成功后才释放凭据并刷新', async () => {
    let finish: ((value: { success: boolean; data: object }) => void) | undefined
    mocks.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = await purchaseForm()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    const original = mocks.post.mock.calls[0][1]
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    const cancel = wrapper.findAll('button').find(item => item.text() === '取消')!
    expect(cancel.attributes('disabled')).toBeDefined()
    await saveButton(wrapper).trigger('click')
    expect(mocks.post).toHaveBeenCalledTimes(1)
    finish?.({ success: true, data: { stock_in_id: 31, batch_no: 'IN31', accessory_id: 55, quantity: original.total_quantity,
      total_amount: 0, inventory_time: '2026-11-14 10:00:00', replayed: true } })
    await flushPromises()
    expect(wrapper.emitted('success')).toHaveLength(1)
    expect(mocks.success).toHaveBeenCalledWith('已核对原采购入库，未重复入库！')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('编辑资料的字符串关联编号与下拉选项匹配，显示名称并提交数字编号', async () => {
    const wrapper = render({ id: 55, name: '原装充电头', product_model: 'MWVW3CH',
      category_id: '12', color_id: '3', unit_id: '2', model_brand_id: '2', model_id: '20', model_ids: '20' }, true)
    await flushPromises()
    for (const [label, name, id] of [['商品类型', '充电头', 12], ['颜色', '白色', 3], ['单位', '个', 2],
      ['适配品牌', '手机品牌乙', 2], ['适配型号', '机型2', [20]]] as const) {
      const field = selectField(wrapper, label)
      expect(field.props('modelValue')).toEqual(id)
      expect(field.text()).toContain(name)
    }
    expect(wrapper.get<HTMLInputElement>('input[placeholder="厂家型号，可不填"]').element.value).toBe('MWVW3CH')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({
      category_id: 12, color_id: 3, unit_id: 2, model_id: 20, product_model: 'MWVW3CH'
    }))
  })

  it('顶部入库移除商品模板选择区域，不再请求模板列表', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.text()).not.toContain('选择商品模板')
    expect(wrapper.text()).not.toContain('选择已有模板后自动带出商品信息，只需填写本次采购入库信息。')
    expect(wrapper.findAllComponents(ElSelect).some(item => item.props('placeholder') === '搜索商品名称、条码、品牌或型号')).toBe(false)
    expect(mocks.get).not.toHaveBeenCalled()
    expect(select(wrapper, '搜索商品名称').exists()).toBe(true)
    expect(wrapper.find('.scan-image-section').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('入库分配')
    expect(wrapper.text()).not.toContain('门店分配')
    const operator = wrapper.findAll('.el-form-item').find(item => item.find('.el-form-item__label').text() === '入库员')!
    expect(operator.get<HTMLInputElement>('input').element).toMatchObject({ value: '当前入库员', readOnly: true })
    expect(select(wrapper, '选择品牌').props('disabled')).toBeFalsy()
    expect(wrapper.find('.info-card').findAll('.el-form-item__label').map(item => item.text())).toEqual([
      '供应商', '品牌', '商品名称', '店铺', '商品类型', '配件型号', '颜色', '进价', '销售价', '入库总数', '入库员', '入库用途', 'SN管理'
    ])
  })

  it('切换模板或关闭弹窗后，晚到的旧响应不能覆盖当前商品', async () => {
    let completeFirst: ((response: { data: AccessoryRecord }) => void) | undefined
    mocks.get.mockImplementation((url: string) => url.endsWith('/55')
      ? new Promise(resolve => { completeFirst = resolve })
      : Promise.resolve({ data: { id: 56, name: '新商品', barcode: 'NEW', category_id: 12, unit_id: 2, status: 1 } }))
    const wrapper = render()
    await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 55)
    await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 56)
    await flushPromises()
    completeFirst?.({ data: { id: 55, name: '旧商品', barcode: 'OLD', status: 1 } })
    await flushPromises()
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(56)
    selectField(wrapper, '商品名称').vm.$emit('change', 55)
    await flushPromises()
    await wrapper.setProps({ modelValue: false })
    completeFirst?.({ data: { id: 55, name: '关闭后的旧商品', barcode: 'OLD', status: 1 } })
    await flushPromises()
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(56)
  })

  it('选择停用模板或查询失败时不回填旧资料，也不允许直接入库', async () => {
    mocks.get.mockResolvedValueOnce({ data: { id: 55, name: '停用商品', barcode: 'OFF', status: 0 } })
      .mockRejectedValueOnce(new Error('请求失败'))
    const wrapper = render()
    await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 55)
    await flushPromises()
    expect(mocks.warning).toHaveBeenCalledWith('该商品模板已停用，请选择启用的模板')
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBeUndefined()
    selectField(wrapper, '商品名称').vm.$emit('change', 56)
    await flushPromises()
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBeUndefined()
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('模板回填遵守字段权限，隐藏品牌、规格和颜色不进入表单', async () => {
    mocks.hidden.add('basic_info.brand_name')
    mocks.hidden.add('basic_info.specifications')
    mocks.hidden.add('basic_info.color_name')
    mocks.hidden.add('status_info.status')
    mocks.get.mockResolvedValue({ data: { id: 55, name: '可见名称', barcode: 'VISIBLE', category_id: 11, unit_id: 1,
      brand_id: 1, brand_name: '隐藏品牌', product_model: '隐藏规格', color_id: 3, color_name: '隐藏颜色', status: null } })
    const wrapper = render()
    await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 55)
    await flushPromises()
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(55)
    expect(wrapper.text()).not.toMatch(/隐藏品牌|隐藏规格|隐藏颜色/)
    expect(wrapper.findAll('.el-form-item__label').map(item => item.text())).not.toEqual(expect.arrayContaining(['品牌', '配件规格', '颜色']))
    expect(mocks.warning).not.toHaveBeenCalled()
  })

  it.each(['新增', '编辑'])('%s模板的适配型号留空显示通用，提交空关联而非虚构型号', async mode => {
    const wrapper = render(mode === '编辑' ? { id: 55, name: '通用充电头', model_ids: [] } : undefined, true)
    await flushPromises()
    await wrapper.get('input[placeholder="请输入商品名称"]').setValue('通用充电头')
    select(wrapper, '选择商品类型').vm.$emit('update:modelValue', 12)
    select(wrapper, '选择计量单位').vm.$emit('update:modelValue', 2)
    salePriceInput(wrapper).vm.$emit('update:modelValue', 20)
    expect(wrapper.findComponent(ElSwitch).props('modelValue')).toBe(1)
    expect(wrapper.find('.info-card').findAll('.el-form-item__label').map(item => item.text())).toEqual([
      '商品名称', '商品类型', '适配品牌', '适配型号', '配件型号', '颜色', '单位', '零售价', '预警值', '状态', 'SN管理'
    ])
    expect(selectField(wrapper, '适配品牌').props('placeholder')).toBe('通用')
    expect(selectField(wrapper, '适配品牌').props('modelValue')).toBeNull()
    expect(selectField(wrapper, '适配型号').props('placeholder')).toBe('通用')
    expect(wrapper.findAllComponents(ElSelect).some(item => item.props('placeholder') === '选择品牌')).toBe(false)
    expect(wrapper.text()).not.toContain('适配手机型号（可多选）')
    expect(selectField(wrapper, '适配型号').props('modelValue')).toEqual([])
    selectField(wrapper, '适配品牌').vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(selectField(wrapper, '适配型号').props('modelValue')).toEqual([])
    expect(selectField(wrapper, '适配型号').props('disabled')).toBe(false)
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    const payload = (mode === '编辑' ? mocks.put : mocks.post).mock.calls[0][1]
    expect(payload.model_ids).toEqual([])
    expect(payload.model_id).toBeNull()
    expect(payload.status).toBe(1)
    expect(payload).not.toHaveProperty('brand_id')
    expect(payload).not.toHaveProperty('usage_type')
  })

  it.each([0, null])('适配品牌改为通用（%s）清空全部具体型号并保存通用关联', async universal => {
    const wrapper = render({ id: 55, name: '充电宝', model_brand_id: 2, model_ids: [20], model_id: 20 }, true)
    await flushPromises()
    selectField(wrapper, '适配品牌').vm.$emit('update:modelValue', universal)
    await flushPromises()
    expect(selectField(wrapper, '适配型号').props('modelValue')).toEqual([])
    expect(selectField(wrapper, '适配型号').props('disabled')).toBe(true)
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({ model_ids: [], model_id: null }))
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('brand_id')
  })

  it.each(['新增', '编辑'])('%s模板只展示条码录入，不展示检索按钮或额外提示', async mode => {
    const wrapper = render(mode === '编辑' ? { id: 55, name: '当前模板' } : undefined, true)
    await flushPromises()
    expect(wrapper.find('.barcode-input-wrapper button').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('输入后随模板保存，点击检索可核对已有商品。')
    expect(wrapper.get('input[placeholder="手动输入或扫描条形码"]').exists()).toBe(true)
    expect(wrapper.findAll('.el-form-item__label').map(item => item.text())).toEqual([
      '商品名称', '商品类型', '适配品牌', '适配型号', '配件型号', '颜色', '单位', '零售价', '预警值', '状态', 'SN管理', '条形码', '商品图片', '备注'
    ])
  })

  it.each(['新增', '编辑'])('%s模板录入或扫码后回车只保留条码，随模板保存而不自动查询', async mode => {
    const wrapper = render(mode === '编辑' ? { id: 55, name: '已有模板' } : undefined, true)
    await flushPromises()
    await wrapper.get('input[placeholder="请输入商品名称"]').setValue('通用充电宝')
    select(wrapper, '选择商品类型').vm.$emit('update:modelValue', 12)
    select(wrapper, '选择计量单位').vm.$emit('update:modelValue', 2)
    const barcode = wrapper.get('input[placeholder="手动输入或扫描条形码"]')
    await barcode.setValue(' 0012345678901 ')
    await barcode.trigger('keydown.enter')
    await barcode.trigger('keyup.enter')
    await flushPromises()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.info).not.toHaveBeenCalled()
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mode === '编辑' ? mocks.put : mocks.post).toHaveBeenCalledWith(
      mode === '编辑' ? '/accessories/55' : '/accessories', expect.objectContaining({ barcode: '0012345678901' }))
  })

  it('商品类型按组列出模板，选择后回填资料并保留本次供应商和进价', async () => {
    const template = { id: 55, name: '钢化膜4.7', barcode: '001234', category: '钢化膜', category_id: 11,
      unit_id: 1, product_model: 'FILM-47', sale_price: 20,
      brand_id: 99, model_brand_id: 2, model_ids: [20], supplier_id: 99, purchase_cost: 99, status: 1 }
    mocks.get.mockImplementation(async (url: string) => ({ data: url === '/accessories'
      ? { data: [template, { ...template, id: 56, name: '钢化膜6.1' },
        { ...template, id: 57, name: '65W充电头', category: '充电头', category_id: 12 }], pagination: { total: 121 } }
      : template }))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="销售价"]').element.value).toBe('')
    select(wrapper, '选择供应商').vm.$emit('update:modelValue', 4)
    const cost = wrapper.findComponent(AmountInput)
    cost.vm.$emit('update:modelValue', 3)
    selectField(wrapper, '品牌').vm.$emit('update:modelValue', 1)
    await wrapper.get('input[placeholder="厂家型号，可不填"]').setValue('FILM-47')
    const category = select(wrapper, '搜索商品名称')
    category.vm.$emit('visible-change', true)
    await flushPromises()
    expect(wrapper.findAllComponents(ElOptionGroup).map(group => group.props('label'))).toEqual(['钢化膜', '充电头'])
    expect(wrapper.findAllComponents(ElOption).some(option => String(option.props('label')).includes('钢化膜4.7'))).toBe(true)
    expect(wrapper.findAllComponents(ElOption).some(option => String(option.props('label')).includes('钢化膜6.1'))).toBe(true)
    expect(wrapper.text()).not.toContain('条记录')
    category.vm.$emit('change', 55)
    await flushPromises()
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/55', expect.objectContaining({ useCache: false }))
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(55)
    expect(wrapper.get<HTMLInputElement>('input[placeholder="选择商品后自动填充"]').element.value).toBe('钢化膜')
    expect(wrapper.findAllComponents(ElOption).filter(option => [55, 56, 57].includes(Number(option.props('value')))).map(option => option.props('label'))).toEqual(['钢化膜4.7', '钢化膜6.1', '65W充电头'])
    expect(wrapper.find('input[placeholder="手动输入或扫描条形码"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[placeholder="厂家型号，可不填"]').element.value).toBe('FILM-47')
    expect(wrapper.findAll('.el-form-item__label').map(item => item.text())).not.toContain('适配品牌')
    expect(wrapper.findAll('.el-form-item__label').map(item => item.text())).not.toContain('适配型号')
    expect(selectField(wrapper, '品牌').props('modelValue')).toBe(1)
    expect(selectField(wrapper, '品牌').props('disabled')).toBeFalsy()
    expect(selectField(wrapper, '供应商').props('modelValue')).toBe(4)
    expect(cost.props('modelValue')).toBe(3)
    expect(wrapper.get<HTMLInputElement>('input[aria-label="销售价"]').element).toMatchObject({ value: '20', readOnly: true })
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in', expect.objectContaining({
      accessory_id: 55, brand_id: 1, supplier_id: 4, purchase_cost: 3, store_id: 2, total_quantity: 1
    }))
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('sale_price')
    expect(mocks.put).not.toHaveBeenCalled()
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('用途属于本次采购，切换模板不覆盖赠送用途，关闭重开恢复收费默认', async () => {
    mocks.get.mockImplementation(async (url: string) => ({ data: {
      id: url.endsWith('/56') ? 56 : 55, name: '钢化膜', category_id: 11, unit_id: 1, status: 1
    } }))
    const wrapper = render()
    await flushPromises()
    expect(selectField(wrapper, '入库用途').props('modelValue')).toBe('sale')
    selectField(wrapper, '入库用途').vm.$emit('update:modelValue', 'gift')
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    selectField(wrapper, '商品名称').vm.$emit('change', 55)
    await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 56)
    await flushPromises()
    expect(selectField(wrapper, '入库用途').props('modelValue')).toBe('gift')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in', expect.objectContaining({ usage_type: 'gift', accessory_id: 56 }))
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(selectField(wrapper, '入库用途').props('modelValue')).toBe('sale')
  })

  it('隐藏入库用途时不提供隐式用途入库，模板仍可正常编辑', async () => {
    mocks.hidden.add('basic_info.usage_type')
    const wrapper = render({ id: 55, name: '钢化膜', supplier_id: 4 }, false)
    await flushPromises()
    expect(wrapper.findAll('.el-form-item__label').map(item => item.text())).not.toContain('入库用途')
    // 编辑模式不是入库，不依赖本次采购用途。
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
    const stockIn = render()
    await flushPromises()
    expect(saveButton(stockIn).attributes('disabled')).toBeDefined()
    await saveButton(stockIn).trigger('click')
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('商品类型搜索和选择忽略旧响应，关闭后不回填', async () => {
    let oldList: ((response: unknown) => void) | undefined
    let oldDetail: ((response: unknown) => void) | undefined
    mocks.get.mockImplementation((url: string, config?: { params?: { search?: string } }) => {
      if (url === '/accessories' && config?.params?.search === '旧') return new Promise(resolve => { oldList = resolve })
      if (url === '/accessories/55') return new Promise(resolve => { oldDetail = resolve })
      if (url === '/accessories') return Promise.resolve({ data: { data: [{ id: 56, name: '新模板', category: '钢化膜' }], pagination: { total: 1 } } })
      return Promise.resolve({ data: { id: 56, name: '新模板', barcode: 'NEW', category_id: 11, unit_id: 1, status: 1 } })
    })
    const wrapper = render()
    await flushPromises()
    const category = select(wrapper, '搜索商品名称')
    void category.props('remoteMethod')('旧')
    await flushPromises()
    await category.props('remoteMethod')('新')
    oldList?.({ data: { data: [{ id: 55, name: '旧模板', category: '旧分类' }], pagination: { total: 999 } } })
    await flushPromises()
    expect(wrapper.findAllComponents(ElOption).some(option => option.props('label') === '新模板')).toBe(true)
    expect(wrapper.findAllComponents(ElOption).some(option => option.props('label') === '旧模板')).toBe(false)
    category.vm.$emit('change', 55)
    category.vm.$emit('change', 56)
    await flushPromises()
    oldDetail?.({ data: { id: 55, name: '旧模板' } })
    await flushPromises()
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(56)
    category.vm.$emit('change', 55)
    await wrapper.setProps({ modelValue: false })
    oldDetail?.({ data: { id: 55, name: '关闭后的模板' } })
    await flushPromises()
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(56)
  })

  it('模板编辑移除配件品牌且不提交覆盖旧品牌，跨品牌适配型号保持回显', async () => {
    const wrapper = render({
      id: 55, name: '充电头', category: '充电头', product_model: 'C65',
      brand_id: 1, model_brand_id: 2, model_id: 20, supplier_id: 4, status: 0
    })
    await flushPromises()
    expect(wrapper.findComponent(ElSwitch).props('modelValue')).toBe(0)
    wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', 1)
    expect(wrapper.get<HTMLInputElement>('input[placeholder="厂家型号，可不填"]').element.value).toBe('C65')
    await wrapper.get('input[placeholder="厂家型号，可不填"]').setValue(' MWVW3CH ')
    expect(selectField(wrapper, '适配品牌').props('modelValue')).toBe(2)
    expect(selectField(wrapper, '适配型号').props('modelValue')).toEqual([20])
    expect(wrapper.findAllComponents(ElSelect).some(item => item.props('placeholder') === '选择品牌')).toBe(false)
    expect(wrapper.text()).not.toContain('配件规格')
    salePriceInput(wrapper).vm.$emit('update:modelValue', 35.5)
    const barcode = wrapper.get<HTMLInputElement>('input[placeholder="手动输入或扫描条形码"]')
    expect(barcode.element.disabled).toBe(false)
    await barcode.setValue(' CORRECTED-55 ')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({ model_ids: [20], product_model: 'MWVW3CH', sale_price: 35.5, barcode: 'CORRECTED-55', status: 1 }))
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('brand_id')
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('specifications')
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('切换适配品牌保留已选型号，晚到的旧响应不能覆盖新选项', async () => {
    const wrapper = render(undefined, true)
    await flushPromises()
    let completeOld: ((value: { success: boolean; data: AccessoryEntryOptions }) => void) | undefined
    mocks.options.mockImplementation((params: { brand_id?: number }) => params.brand_id === 1
      ? new Promise(resolve => { completeOld = resolve })
      : Promise.resolve({ success: true, data: optionData(params.brand_id) }))
    const brand = selectField(wrapper, '适配品牌')
    brand.vm.$emit('update:modelValue', 1)
    await flushPromises()
    brand.vm.$emit('update:modelValue', 2)
    await flushPromises()
    const model = selectField(wrapper, '适配型号')
    model.vm.$emit('update:modelValue', [20])
    completeOld?.({ success: true, data: optionData(1) })
    await flushPromises()
    expect(model.props('modelValue')).toEqual([20])
    expect(model.text()).toContain('机型2')
    expect(model.text()).not.toContain('机型1')
    brand.vm.$emit('update:modelValue', null)
    await flushPromises()
    expect(model.props('modelValue')).toEqual([])
    expect(model.props('disabled')).toBe(true)
  })

  it('公共资料加载失败时禁用提交，避免残留选项被保存', async () => {
    mocks.options.mockRejectedValueOnce(new Error('读取失败'))
    const wrapper = render({ id: 55, name: '壳', supplier_id: 4 })
    await flushPromises()
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(mocks.error).toHaveBeenCalled()
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('校验及保存期间重复点击只提交一次', async () => {
    let finish: (() => void) | undefined
    mocks.put.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ success: true }) }))
    const wrapper = render({ id: 55, name: '充电头', supplier_id: 4 })
    await flushPromises()
    const button = saveButton(wrapper)
    await Promise.all([button.trigger('click'), button.trigger('click')])
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledTimes(1)
    finish?.()
    await flushPromises()
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('隐藏配件品牌和规格不影响适配型号回显，提交不携带隐藏字段', async () => {
    mocks.hidden.add('basic_info.brand_name')
    mocks.hidden.add('basic_info.specifications')
    const wrapper = render({ id: 55, name: '充电头', supplier_id: 4, brand_id: 1, product_model: 'C65', model_brand_id: 2, model_id: 20 })
    await flushPromises()
    expect(wrapper.find('input[placeholder="厂家型号，可不填"]').exists()).toBe(false)
    expect(wrapper.find('input[placeholder="选择品牌"]').exists()).toBe(false)
    expect(selectField(wrapper, '适配型号').props('modelValue')).toEqual([20])
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    const payload = mocks.put.mock.calls[0][1]
    expect(payload.model_ids).toEqual([20])
    expect(payload).not.toHaveProperty('brand_id')
    expect(payload).not.toHaveProperty('product_model')
    expect(payload).not.toHaveProperty('specifications')
  })

  it('创建商品模板不显示供应商/成本，只调用档案接口', async () => {
    const wrapper = mount(AccessoryStockInModal, {
      props: { modelValue: true, archiveOnly: true },
      global: { plugins: [ElementPlus], directives: { 'infinite-scroll': {} }, stubs: { MobileDialog: DialogStub, Image: true } }
    })
    wrappers.push(wrapper)
    await flushPromises()
    expect(saveButton(wrapper).text()).toContain('创建模板')
    await wrapper.get('input[placeholder="请输入商品名称"]').setValue('透明手机壳')
    await wrapper.get('input[placeholder="厂家型号，可不填"]').setValue(' MWVW3CH ')
    expect(wrapper.text()).not.toContain('配件规格')
    select(wrapper, '选择商品类型').vm.$emit('update:modelValue', 11)
    select(wrapper, '选择计量单位').vm.$emit('update:modelValue', 2)
    salePriceInput(wrapper).vm.$emit('update:modelValue', 29)
    await wrapper.vm.$nextTick()
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('input[placeholder="选择供应商"]').exists()).toBe(false)
    expect(wrapper.find('input[placeholder="请输入进价"]').exists()).toBe(false)
    expect(mocks.post).toHaveBeenCalledWith('/accessories', expect.objectContaining({ name: '透明手机壳', category_id: 11, unit_id: 2, sale_price: 29 }))
    expect(mocks.post.mock.calls[0][1]).toHaveProperty('product_model', 'MWVW3CH')
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('specifications')
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('supplier_id')
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('purchase_cost')
    expect(mocks.post).not.toHaveBeenCalledWith('/accessories/stock-in', expect.anything())
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('模板补货只读显示模板零售价，提交不同采购成本时不携带售价', async () => {
    mocks.get.mockResolvedValueOnce({ success: true, data: {
      id: 55, barcode: 'FILM-47', name: '钢化膜4.7', category_id: 11, unit_id: 1,
      sale_price: 20, purchase_cost: 2, supplier_id: 4, status: 1
    } })
    const wrapper = render()
    await flushPromises()
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    selectField(wrapper, '商品名称').vm.$emit('change', 55)
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({ useCache: false }))
    const price = wrapper.get<HTMLInputElement>('input[aria-label="销售价"]')
    expect(price.element.readOnly).toBe(true)
    expect(price.element.value).toBe('20')
    expect(salePriceInput(wrapper)).toBeUndefined()
    expect(wrapper.text()).not.toContain('补货沿用模板售价，调价请编辑商品模板。')
    const cost = wrapper.findAllComponents(AmountInput).find(input => input.element.closest('.el-form-item')?.textContent?.includes('进价'))!
    cost.vm.$emit('update:modelValue', 3)
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    const payload = mocks.post.mock.calls[0][1]
    expect(payload).toMatchObject({ accessory_id: 55, supplier_id: 4, purchase_cost: 3 })
    expect(payload).not.toHaveProperty('sale_price')
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('隐藏售价时，模板补货不展示也不提交零售价', async () => {
    mocks.hidden.add('price_info.sale_price')
    mocks.get.mockResolvedValueOnce({ success: true, data: {
      id: 55, barcode: 'FILM-47', name: '钢化膜4.7', category_id: 11, unit_id: 1,
      sale_price: 20, supplier_id: 4, status: 1
    } })
    const wrapper = render()
    await flushPromises()
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    selectField(wrapper, '商品名称').vm.$emit('change', 55)
    await flushPromises()
    expect(wrapper.text()).not.toContain('销售价')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('sale_price')
  })

  it('无条码模板可从列表直接入库并保留售价，编辑允许清空旧条码', async () => {
    const wrapper = mount(AccessoryStockInModal, {
      props: { modelValue: true, stockInOnly: true, accessory: { id: 55, name: '钢化膜', product_model: 'MWVW3CH', category_id: 11, unit_id: 1, sale_price: 20, status: 1 } },
      global: { plugins: [ElementPlus], directives: { 'infinite-scroll': {} }, stubs: { MobileDialog: DialogStub, Image: true } }
    })
    wrappers.push(wrapper)
    await flushPromises()
    expect(saveButton(wrapper).text()).toContain('确认入库')
    expect(selectField(wrapper, '商品名称').props('disabled')).toBe(true)
    expect(wrapper.find('input[placeholder="手动输入或扫描条形码"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('商品图片')
    expect(wrapper.find('.barcode-input-wrapper button').exists()).toBe(false)
    selectField(wrapper, '商品名称').vm.$emit('change', 99)
    selectField(wrapper, '商品名称').vm.$emit('visible-change', true)
    await flushPromises()
    expect(mocks.get).not.toHaveBeenCalled()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="销售价"]').element.readOnly).toBe(true)
    expect(wrapper.get<HTMLInputElement>('input[placeholder="厂家型号，可不填"]').element.value).toBe('MWVW3CH')
    select(wrapper, '选择供应商').vm.$emit('update:modelValue', 4)
    await flushPromises()
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in', expect.objectContaining({ accessory_id: 55 }))
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('sale_price')
    const editor = render({ id: 56, name: '壳', barcode: 'OLD' })
    await flushPromises()
    await editor.get('input[placeholder="手动输入或扫描条形码"]').setValue('')
    await saveButton(editor).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/56', expect.objectContaining({ barcode: null }))
  })
  it('模板保存SN默认开关，入库自动统计数量、统一大小写并阻止重复', async () => {
    const archive = render(undefined, true)
    await flushPromises()
    await archive.get('input[placeholder="请输入商品名称"]').setValue('原装充电头')
    selectField(archive, '商品类型').vm.$emit('update:modelValue', 12)
    selectField(archive, '单位').vm.$emit('update:modelValue', 2)
    archive.findAllComponents(ElSwitch).at(-1)!.vm.$emit('update:modelValue', 1)
    await flushPromises()
    await saveButton(archive).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories', expect.objectContaining({ serial_tracking: 1 }))
    mocks.post.mockClear()
    const wrapper = mount(AccessoryStockInModal, {
      props: { modelValue: true, stockInOnly: true, accessory: { id: 55, name: '原装充电头', serial_tracking: 1, category_id: 12, unit_id: 2, status: 1 } },
      global: { plugins: [ElementPlus], directives: { 'infinite-scroll': {} }, stubs: { MobileDialog: DialogStub, Image: true } }
    })
    wrappers.push(wrapper)
    await flushPromises()
    expect(wrapper.findAllComponents(ElSwitch).at(-1)!.props('disabled')).toBe(false)
    select(wrapper, '选择供应商').vm.$emit('update:modelValue', 4)
    expect(wrapper.find('input[aria-label="入库总数"]').exists()).toBe(false)
    const click = async (text: string) => {
      await wrapper.findAll('button').find(button => button.text() === text)!.trigger('click')
      await flushPromises()
    }
    await click('新增一条')
    const rows = () => wrapper.findAll('.serial-entry-row input')
    expect(rows()).toHaveLength(2)
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    await rows()[0].setValue('00aa')
    expect(selectField(wrapper, '店铺').props('disabled')).toBeFalsy()
    await rows()[1].setValue('00AA')
    expect(wrapper.text()).toContain('本次入库存在重复SN')
    expect(wrapper.text()).toContain('SN序列号录入（2 件）')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    await rows()[1].setValue('00bb')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in', expect.objectContaining({
      total_quantity: 2, store_id: 2, distribution: [],
      serial_numbers: [{ serial_number: '00AA', store_id: 2 }, { serial_number: '00BB', store_id: 2 }]
    }))
  })

  it('总仓优先作为入库默认店铺；录入SN后可直接换店，提交归属最终店铺', async () => {
    mocks.options.mockResolvedValue({ data: { ...optionData(), stores: [{ id: 2, name: '门店A' }, { id: 3, name: '总仓B' }], default_store_id: 3 } })
    const wrapper = mount(AccessoryStockInModal, {
      props: { modelValue: true, stockInOnly: true, accessory: { id: 55, name: '头', serial_tracking: 1, category_id: 12, unit_id: 2, status: 1 } },
      global: { plugins: [ElementPlus], directives: { 'infinite-scroll': {} }, stubs: { MobileDialog: DialogStub, Image: true } }
    })
    wrappers.push(wrapper)
    await flushPromises()
    expect(selectField(wrapper, '店铺').props('modelValue')).toBe(3)
    const click = async (text: string) => { await wrapper.findAll('button').find(item => item.text() === text)!.trigger('click'); await flushPromises() }
    const batch = wrapper.get('textarea[placeholder*="每行一个"]')
    await batch.setValue('00aa\n00AA')
    await click('添加多条SN')
    expect(wrapper.findAll('.serial-entry-row input')).toHaveLength(1)
    expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining('重复'))
    await batch.setValue('00aa\n00bb')
    await click('添加多条SN')
    expect(wrapper.findAll('.serial-entry-row input')).toHaveLength(2)
    expect(selectField(wrapper, '店铺').props('disabled')).toBeFalsy()
    expect(wrapper.text()).toContain('SN序列号录入（2 件）')
    expect(wrapper.text()).not.toContain('本次入库：')
    selectField(wrapper, '店铺').vm.$emit('update:modelValue', 2)
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    await flushPromises()
    expect(wrapper.findAll<HTMLInputElement>('.serial-entry-row input').map(item => item.element.value)).toEqual(['00AA', '00BB'])
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in', expect.objectContaining({
      total_quantity: 2, store_id: 2, serial_numbers: [{ serial_number: '00AA', store_id: 2 }, { serial_number: '00BB', store_id: 2 }]
    }))
    await click('清空SN')
    expect(wrapper.findAll('.serial-entry-row input')).toHaveLength(1)
  })

  it('逐行回车继续新增；切换模板前确认，拒绝后保留SN草稿', async () => {
    mocks.get.mockImplementation(async (url: string) => ({ data: { id: url.endsWith('/55') ? 55 : 56, name: '头', serial_tracking: 1, category_id: 12, unit_id: 2, status: 1 } }))
    const wrapper = render()
    await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 55)
    await flushPromises()
    await wrapper.get('.serial-entry-row input').setValue('0001')
    await wrapper.get('.serial-entry-row input').trigger('keyup.enter')
    await flushPromises()
    expect(wrapper.findAll('.serial-entry-row input')).toHaveLength(2)
    mocks.confirm.mockResolvedValueOnce(false)
    selectField(wrapper, '商品名称').vm.$emit('change', 56)
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledOnce()
    expect(wrapper.get<HTMLInputElement>('.serial-entry-row input').element.value).toBe('0001')
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(55)
  })

  it('模板保存预警值零并回显；采购表单移除单位状态预警且不提交覆盖', async () => {
    const editor = render({ id: 55, name: '原装充电头', min_stock: 0, category_id: 12, unit_id: 2 }, true)
    await flushPromises()
    const warning = editor.findAll('input').find(item => item.element.closest('.el-form-item')?.querySelector('.el-form-item__label')?.textContent?.trim() === '预警值')!
    expect(warning.element.value).toBe('0')
    await saveButton(editor).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({ min_stock: 0 }))
    const wrapper = mount(AccessoryStockInModal, { props: { modelValue: true, stockInOnly: true, accessory: { id: 55, name: '原装充电头', min_stock: 0, category_id: 12, unit_id: 2, status: 1 } }, global: { plugins: [ElementPlus], directives: { 'infinite-scroll': {} }, stubs: { MobileDialog: DialogStub, Image: true } } })
    wrappers.push(wrapper)
    await flushPromises()
    const labels = wrapper.findAll('.el-form-item__label').map(item => item.text())
    for (const field of ['单位', '状态', '预警值', '适配品牌', '适配型号']) expect(labels).not.toContain(field)
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    await flushPromises()
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in', expect.not.objectContaining({ min_stock: expect.anything() }))
  })

})
