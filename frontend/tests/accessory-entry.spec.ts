import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElButton, ElDatePicker, ElInputNumber, ElOption, ElOptionGroup, ElSelect, ElSwitch } from 'element-plus'
import { vIdentifierInput } from '@/directives/identifier-input'
import AmountInput from '@/components/AmountInput.vue'
import AccessoryStockInModal from '@/components/AccessoryStockInModal.vue'
import type { AccessoryRecord, AccessoryStockInInput, AccessoryStockInRequest, AccessoryStockCorrectionContext } from '@/types/accessory'
import type { AccessoryEntryOptions } from '@/services/reference-options'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'

const mocks = vi.hoisted(() => ({
  options: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn(),
  success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), confirm: vi.fn(),
  hidden: new Set<string>(), initFields: vi.fn()
}))
const access = reactive({ edit: true, actorId: 7, fieldRevision: 0 })
vi.mock('@/services/reference-options', () => ({ getAccessoryEntryOptions: mocks.options }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ get user() { return { id: access.actorId, name: '当前入库员', store_id: 2 } }, token: null }) }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: {
  init: () => mocks.initFields(), isFieldVisible: (_module: string, field: string) => access.fieldRevision >= 0 && !mocks.hidden.has(field)
} }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ canEdit: computed(() => access.edit), canView: computed(() => true), requirePermission: () => access.edit }) }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/utils/temp-file-cleaner', () => ({ deleteTempFiles: async () => true }))

const optionData = (brand?: number): AccessoryEntryOptions => ({
  categories: [{ id: 11, name: '钢化膜', status: 1 }, { id: 12, name: '充电头', status: 1 }],
  units: [{ id: 1, name: '张', status: 1 }, { id: 2, name: '个', status: 1 }],
  brands: [{ id: 1, name: '配件品牌', status: 1 }],
  model_brands: [{ id: 1, name: '手机品牌甲' }, { id: 2, name: '手机品牌乙' }],
  models: brand ? [{ id: brand * 10, name: `机型${brand}`, brand_id: brand }] : [],
  colors: [{ id: 3, name: '白色' }, { id: 4, name: '黑色' }, { id: 5, name: '蓝色' }], suppliers: [{ id: 4, name: '公共供应商', status: 1 }],
  stores: [{ id: 2, name: '门店A' }]
})
const DialogStub = defineComponent({ template: '<div><slot /><slot name="footer" /></div>' })
const wrappers: ReturnType<typeof mount>[] = []
const render = (accessory?: AccessoryRecord, archiveOnly = false) => {
  const wrapper = mount(AccessoryStockInModal, {
    props: { modelValue: true, accessory, archiveOnly },
    global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true } }
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
const saveButton = (wrapper: ReturnType<typeof render>) => wrapper.findAll('button').find(button => /保存|创建模板|确认入库|重试原入库|重试原更正/.test(button.text()))!
const quantityInput = (wrapper: ReturnType<typeof render>) => wrapper.findAllComponents(ElInputNumber)
  .find(input => input.element.closest('.el-form-item')?.querySelector('.el-form-item__label')?.textContent?.trim() === '入库总数')
const salePriceInput = (wrapper: ReturnType<typeof render>) => wrapper.findAllComponents(AmountInput)
  .find(input => input.element.closest('.el-form-item')?.textContent?.match(/零售价|销售价/))!

const purchaseForm = async () => {
  const wrapper = mount(AccessoryStockInModal, {
    props: { modelValue: true, stockInOnly: true, accessory: { id: 55, name: '原装充电头', category_id: 12, unit_id: 2, status: 1 } },
    global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true } }
  })
  wrappers.push(wrapper)
  await flushPromises()
  if (wrapper.findAllComponents(ElSelect).length) selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
  await flushPromises()
  return wrapper
}

const correctionContext = (purchaseId = 10): AccessoryStockCorrectionContext => ({
  purchase_id: purchaseId, batch_no: `IN-${purchaseId}`, accessory: { id: 55, name: '原装充电头', category: '充电头', category_id: 12,
    unit_id: 2, brand_id: 1, color_id: 3, sale_price: 39, product_model: 'OLD', status: 1 },
  supplier_id: 4, supplier_name: '公共供应商', store_id: 2, store_name: '门店A', total_quantity: 50, purchase_cost: 10,
  usage_type: 'sale', serial_tracking: 0, serial_numbers: [], remarks: '原备注', inventory_time: '2026-11-13 10:00:00', operator_name: '原入库员'
})
const stockEditor = async (count = 1, context = correctionContext()) => {
  mocks.get.mockImplementation(async (url: string) => url.endsWith('/stock-in-options')
    ? { success: true, data: { data: Array.from({ length: count }, (_, index) => ({ purchase_id: index + 10, batch_no: `IN-${index + 10}`,
      supplier_name: '公共供应商', store_name: '门店A', quantity: 50, purchase_cost: 10 })), pagination: { total: count } } }
    : { success: true, data: context })
  const wrapper = mount(AccessoryStockInModal, {
    props: { modelValue: true, stockEditOnly: true, accessory: { id: 55, name: '原装充电头' } },
    global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true, SectionLoading: true } }
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  mocks.confirm.mockResolvedValue(true)
  mocks.hidden = reactive(new Set<string>())
  access.edit = true
  access.actorId = 7
  access.fieldRevision = 0
  mocks.initFields.mockResolvedValue(undefined)
  mocks.get.mockReset()
  mocks.options.mockImplementation(async (params: { brand_id?: number } = {}) => ({ success: true, data: optionData(params.brand_id) }))
  mocks.put.mockResolvedValue({ success: true })
  mocks.post.mockImplementation(async (url: string, input: AccessoryStockInRequest) => {
    const receipt = (entry: Omit<AccessoryStockInInput, 'request_key'>, index = 0) => ({ stock_in_id: 31 + index,
      batch_no: `IN-${31 + index}`, accessory_id: entry.accessory_id || 55, quantity: entry.total_quantity,
      total_amount: Number(entry.purchase_cost) * Number(entry.total_quantity), inventory_time: '2026-11-14 10:00:00', replayed: false })
    return { success: true, ...(url === '/accessories/stock-in' || url.endsWith('/corrections')
      ? { data: 'entries' in input ? { batches: input.entries.map(receipt), replayed: false } : receipt(input) } : {}) }
  })
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.clearAllMocks()
})

describe('配件公共资料与独立类型入库', () => {
  const colorTemplate: AccessoryRecord = { id: 100, name: '多色充电头', category_id: 12, unit_id: 2, sale_price: 39, status: 1,
    color_template_id: 100, color_variants: [{ accessory_id: 101, color_id: 3, color_name: '白色', barcode: 'WHITE-1' },
      { accessory_id: 102, color_id: 4, color_name: '黑色', barcode: 'BLACK-1' }] }

  const newColorTemplate = async () => {
    const wrapper = render(undefined, true)
    await flushPromises()
    await wrapper.get('input[placeholder="请输入商品名称"]').setValue('多色充电头')
    selectField(wrapper, '商品类型').vm.$emit('update:modelValue', 12)
    selectField(wrapper, '单位').vm.$emit('update:modelValue', 2)
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [3, 4])
    await flushPromises()
    return wrapper
  }

  const enableFilmOptions = () => mocks.options.mockImplementation(async (params: { brand_id?: number } = {}) => ({
    success: true, data: { ...optionData(params.brand_id), film_ready: true }
  }))
  const filmSwitch = (wrapper: ReturnType<typeof render>, label: string) => wrapper.findAllComponents(ElSwitch)
    .find(item => item.element.closest('.el-form-item')?.querySelector('.el-form-item__label')?.textContent?.trim() === label)!

  it('新增模板仅配置免费专用，可直接开启并随原模板一次保存', async () => {
    enableFilmOptions()
    const wrapper = await newColorTemplate()
    expect(filmSwitch(wrapper, '用于贴膜')).toBeUndefined()
    expect(filmSwitch(wrapper, '免费专用').props('disabled')).toBe(false)
    filmSwitch(wrapper, '免费专用').vm.$emit('update:modelValue', 1)
    await flushPromises()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post).toHaveBeenCalledWith('/accessories', expect.objectContaining({ free_film: 1 }))
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('film_enabled')
  })

  it('编辑回显免费专用，可独立关闭并保存', async () => {
    enableFilmOptions()
    const wrapper = render({ ...colorTemplate, free_film: 1 }, true)
    await flushPromises()
    expect(filmSwitch(wrapper, '用于贴膜')).toBeUndefined()
    expect(filmSwitch(wrapper, '免费专用').props('modelValue')).toBe(1)
    filmSwitch(wrapper, '免费专用').vm.$emit('update:modelValue', 0)
    await flushPromises()
    expect(filmSwitch(wrapper, '免费专用').props('modelValue')).toBe(0)
    expect(filmSwitch(wrapper, '免费专用').props('disabled')).toBe(false)
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/100', expect.objectContaining({ free_film: 0 }), { showError: false })
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('film_enabled')
  })

  it.each(['结构未就绪', '用途字段隐藏'])('%s时普通模板仍可保存且不提交贴膜规则', async mode => {
    if (mode === '用途字段隐藏') {
      enableFilmOptions()
      mocks.hidden.add('basic_info.usage_type')
    }
    const wrapper = await newColorTemplate()
    expect(filmSwitch(wrapper, '用于贴膜')).toBeUndefined()
    expect(filmSwitch(wrapper, '免费专用')).toBeUndefined()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(JSON.stringify(mocks.post.mock.calls[0][1]))
    expect(payload).not.toHaveProperty('film_enabled')
    expect(payload).not.toHaveProperty('free_film')
  })

  it('采购入库不展示或提交模板贴膜规则', async () => {
    enableFilmOptions()
    const wrapper = await purchaseForm()
    expect(filmSwitch(wrapper, '用于贴膜')).toBeUndefined()
    expect(filmSwitch(wrapper, '免费专用')).toBeUndefined()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post.mock.calls[0][0]).toBe('/accessories/stock-in')
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('film_enabled')
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('free_film')
  })

  it('新增模板多选颜色逐色填写条码，取消重选保留仍选中的条码且一次保存整个模板', async () => {
    const wrapper = await newColorTemplate()
    expect(selectField(wrapper, '颜色').props('multiple')).toBe(true)
    await wrapper.get('input[aria-label="白色条形码"]').setValue(' WHITE-1 ')
    await wrapper.get('input[aria-label="黑色条形码"]').setValue('BLACK-1')
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [3])
    await flushPromises()
    expect(wrapper.find('input[aria-label="黑色条形码"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="颜色与条形码"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[aria-label="条形码"]').element.value).toBe(' WHITE-1 ')
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [3, 4])
    await flushPromises()
    await wrapper.get('input[aria-label="黑色条形码"]').setValue('BLACK-1')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.post).toHaveBeenCalledWith('/accessories', expect.objectContaining({ name: '多色充电头', color_id: undefined, barcode: undefined,
      color_variants: [{ color_id: 3, barcode: 'WHITE-1' }, { color_id: 4, barcode: 'BLACK-1' }] }))
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('request_key')
  })

  it('单颜色使用普通条码输入，扩色和取消颜色时保留已填写条码', async () => {
    const wrapper = render(undefined, true)
    await flushPromises()
    await wrapper.get('input[aria-label="条形码"]').setValue('001-WHITE')
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [3])
    await flushPromises()
    expect(wrapper.find('[aria-label="颜色与条形码"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[aria-label="条形码"]').element.value).toBe('001-WHITE')
    await wrapper.get('input[aria-label="条形码"]').setValue('002-WHITE')
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [3, 4])
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="白色条形码"]').element.value).toBe('002-WHITE')
    expect(wrapper.find('input[aria-label="条形码"]').exists()).toBe(false)
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [3])
    await flushPromises()
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [])
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="条形码"]').element.value).toBe('002-WHITE')
  })

  it('单颜色组模板仍按原颜色规格保存，不把条码写到父模板', async () => {
    const wrapper = render({ ...colorTemplate, color_variants: colorTemplate.color_variants!.slice(0, 1) }, true)
    await flushPromises()
    expect(wrapper.find('[aria-label="颜色与条形码"]').exists()).toBe(false)
    await wrapper.get('input[aria-label="条形码"]').setValue('001-WHITE-EDITED')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/100', expect.objectContaining({
      color_id: undefined, barcode: undefined, color_variants: [{ color_id: 3, barcode: '001-WHITE-EDITED' }]
    }), { showError: false })
  })

  it('颜色条码忽略大小写和两端空格检查重复，修正后解除提交拦截', async () => {
    const wrapper = await newColorTemplate()
    await wrapper.get('input[aria-label="白色条形码"]').setValue('WHITE-1')
    await wrapper.get('input[aria-label="黑色条形码"]').setValue(' white-1 ')
    expect(wrapper.text()).toContain('不同颜色不能使用相同条形码')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(mocks.post).not.toHaveBeenCalled()
    await wrapper.get('input[aria-label="黑色条形码"]').setValue('BLACK-1')
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('多颜色模板编辑回显对应条码，可追加颜色，保存不改变既有颜色身份', async () => {
    const wrapper = render(colorTemplate, true)
    await flushPromises()
    expect(selectField(wrapper, '颜色').props('modelValue')).toEqual([3, 4])
    expect(wrapper.get<HTMLInputElement>('input[aria-label="白色条形码"]').element.value).toBe('WHITE-1')
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [3, 4, 5])
    await flushPromises()
    await wrapper.get('input[aria-label="蓝色条形码"]').setValue('BLUE-1')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/100', expect.objectContaining({ color_variants: [
      { color_id: 3, barcode: 'WHITE-1' }, { color_id: 4, barcode: 'BLACK-1' }, { color_id: 5, barcode: 'BLUE-1' }] }), { showError: false })
  })

  it.each(['模板编辑', '商品档案'])('旧单色%s也显示多选，追加颜色后提交完整颜色条码，保留原商品ID', async mode => {
    const wrapper = render({ id: 55, name: '旧白色充电器', color_id: 3, color_name: '白色', barcode: 'WHITE-OLD', category_id: 12, unit_id: 2 }, mode === '模板编辑')
    if (mode === '商品档案') await wrapper.setProps({ profileEditOnly: true })
    await flushPromises()
    expect(selectField(wrapper, '颜色').props('multiple')).toBe(true)
    expect(selectField(wrapper, '颜色').props('modelValue')).toEqual([3])
    expect(wrapper.find('[aria-label="颜色与条形码"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[aria-label="条形码"]').element.value).toBe('WHITE-OLD')
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [3, 4]); await flushPromises()
    await wrapper.get('input[aria-label="黑色条形码"]').setValue('BLACK-NEW')
    expect(wrapper.text()).toContain('现有商品保留为白色')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({ color_variants: [
      { color_id: 3, barcode: 'WHITE-OLD' }, { color_id: 4, barcode: 'BLACK-NEW' }] }), { showError: false })
    expect(mocks.put.mock.calls[0][1].color_id).toBeUndefined()
    expect(mocks.put.mock.calls[0][1].barcode).toBeUndefined()
  })

  it('旧模板只维护现有一个颜色时保持原单色写入，不新增颜色关系', async () => {
    const wrapper = render({ id: 55, name: '原模板', color_id: 3, color_name: '白色', barcode: 'OLD', category_id: 12, unit_id: 2 }, true)
    await flushPromises()
    await wrapper.get('input[aria-label="条形码"]').setValue('WHITE-UPDATED')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({ color_id: 3, barcode: 'WHITE-UPDATED' }), { showError: false })
    expect(mocks.put.mock.calls[0][1].color_variants).toBeUndefined()
  })

  it.each([101, 555])('多色商品%s编辑档案回显全部颜色并可修改其他颜色条码与追加颜色', async id => {
    const wrapper = render({ ...colorTemplate, id, ...(id === 555 ? { template_id: 101 } : {}), brand_id: 1, color_id: 3, color_name: '白色', barcode: 'WHITE-1' })
    await wrapper.setProps({ profileEditOnly: true }); await flushPromises()
    expect(selectField(wrapper, '颜色').props('multiple')).toBe(true)
    expect(selectField(wrapper, '颜色').props('modelValue')).toEqual([3, 4])
    selectField(wrapper, '颜色').vm.$emit('update:modelValue', [3, 4, 5]); await flushPromises()
    await wrapper.get('input[aria-label="黑色条形码"]').setValue('BLACK-EDITED')
    await wrapper.get('input[aria-label="蓝色条形码"]').setValue('BLUE-NEW')
    expect(wrapper.find('[aria-label="商品档案修改前后对照"]').text()).toContain('白色、黑色、蓝色')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith(`/accessories/${id}`, expect.objectContaining({ brand_id: 1, color_variants: [
      { color_id: 3, barcode: 'WHITE-1' }, { color_id: 4, barcode: 'BLACK-EDITED' }, { color_id: 5, barcode: 'BLUE-NEW' }] }), { showError: false })
    expect(mocks.put.mock.calls[0][1].color_id).toBeUndefined()
    expect(mocks.put.mock.calls[0][1].barcode).toBeUndefined()
  })

  it('隐藏条码不下载到输入或回传嵌套字段，隐藏颜色不提交颜色规格', async () => {
    mocks.hidden.add('basic_info.barcode')
    const wrapper = render(colorTemplate, true)
    await flushPromises()
    expect(wrapper.find('input[aria-label="白色条形码"]').exists()).toBe(false)
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.put.mock.calls[0][1].color_variants).toEqual([{ color_id: 3 }, { color_id: 4 }])
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('barcode')
    wrapper.unmount(); wrappers.splice(wrappers.indexOf(wrapper), 1); mocks.put.mockClear()
    mocks.hidden.add('basic_info.color_name')
    const hidden = render(colorTemplate, true)
    await flushPromises(); await saveButton(hidden).trigger('click'); await flushPromises()
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('color_variants')
  })

  it.each(['顶部', '模板行内', '库存补货'])('%s单颜色在上方填写数量并展示对应条码，保留正确采购身份', async entry => {
    const template = { ...colorTemplate, color_variants: colorTemplate.color_variants!.slice(0, 1) }
    const accessory = entry === '库存补货' ? { ...template, id: 155, template_id: 101, brand_id: 1 } : template
    mocks.get.mockResolvedValue({ success: true, data: template })
    const wrapper = entry === '顶部' ? render() : mount(AccessoryStockInModal, {
      props: { modelValue: true, stockInOnly: true, accessory },
      global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true } }
    })
    if (entry !== '顶部') wrappers.push(wrapper)
    await flushPromises()
    if (entry === '顶部') { selectField(wrapper, '商品名称').vm.$emit('change', 100); await flushPromises() }
    expect(wrapper.find('[aria-label="按颜色填写入库数量"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="模板全部颜色规格"]').exists()).toBe(false)
    expect(selectField(wrapper, '颜色').props('modelValue')).toBe(3)
    const barcode = wrapper.get<HTMLInputElement>('input[aria-label="商品条形码"]')
    expect(barcode.element.value).toBe('WHITE-1')
    expect(barcode.attributes('readonly')).toBeDefined()
    quantityInput(wrapper)!.vm.$emit('update:modelValue', 8)
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    await flushPromises()
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in', expect.objectContaining({
      accessory_id: entry === '库存补货' ? 155 : 101, color_id: 3, barcode: 'WHITE-1', total_quantity: 8
    }))
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('entries')
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('单颜色SN入库沿用普通SN录入并自动计数，不展开分色区', async () => {
    mocks.get.mockResolvedValue({ success: true, data: {
      ...colorTemplate, color_variants: colorTemplate.color_variants!.slice(0, 1), serial_tracking: 1
    } })
    const wrapper = render(); await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 100); await flushPromises()
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    expect(wrapper.find('[aria-label="按颜色填写入库数量"]').exists()).toBe(false)
    expect(quantityInput(wrapper)).toBeUndefined()
    await wrapper.get('input[placeholder="扫描或手动输入SN，回车继续下一条"]').setValue('00WHITE-1')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in', expect.objectContaining({
      accessory_id: 101, total_quantity: 1, serial_numbers: [{ serial_number: '00WHITE-1', store_id: 2 }]
    }))
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it.each(['顶部', '模板行内'])('%s入库逐色填写数量，共用进价，一次提交具体颜色采购ID和条码', async entry => {
    mocks.get.mockResolvedValue({ success: true, data: colorTemplate })
    const wrapper = entry === '顶部' ? render() : mount(AccessoryStockInModal, {
      props: { modelValue: true, stockInOnly: true, accessory: colorTemplate },
      global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true } }
    })
    if (entry !== '顶部') wrappers.push(wrapper)
    await flushPromises()
    if (entry === '顶部') { selectField(wrapper, '商品名称').vm.$emit('change', 100); await flushPromises() }
    expect(wrapper.get('[aria-label="按颜色填写入库数量"]').text()).toContain('WHITE-1')
    expect(wrapper.get('[aria-label="按颜色填写入库数量"]').text()).toContain('BLACK-1')
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    selectField(wrapper, '配件品牌').vm.$emit('update:modelValue', 1)
    await flushPromises()
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.get('input[aria-label="白色入库数量"]').setValue('10')
    await wrapper.get('input[aria-label="黑色入库数量"]').setValue('20')
    wrapper.findComponent(AmountInput).vm.$emit('update:modelValue', 5)
    wrapper.findComponent(ElDatePicker).vm.$emit('update:modelValue', '2026-11-14 15:30:25')
    await flushPromises()
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(100)
    expect(wrapper.get('[aria-label="颜色入库合计"]').text()).toContain('合计 30')
    expect(wrapper.get('[aria-label="颜色入库合计"]').text()).toContain('¥150')
    expect(quantityInput(wrapper)).toBeUndefined()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    const request = mocks.post.mock.calls[0][1]
    expect(request.entries).toEqual([
      expect.objectContaining({ accessory_id: 101, color_id: 3, barcode: 'WHITE-1', total_quantity: 10, purchase_cost: 5, supplier_id: 4, brand_id: 1, store_id: 2, inventory_time: '2026-11-14 15:30:25' }),
      expect.objectContaining({ accessory_id: 102, color_id: 4, barcode: 'BLACK-1', total_quantity: 20, purchase_cost: 5, supplier_id: 4, brand_id: 1, store_id: 2, inventory_time: '2026-11-14 15:30:25' })
    ])
    expect(request.entries.every((row: Record<string, unknown>) => !('color_variants' in row) && !('request_key' in row))).toBe(true)
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('0数量颜色不入库，入库表单保留隐藏条码录入，各色全为0或清空数量时禁止提交', async () => {
    mocks.hidden.add('basic_info.barcode')
    mocks.get.mockResolvedValue({ success: true, data: colorTemplate })
    const wrapper = render()
    await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 100)
    await flushPromises()
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    await flushPromises()
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('WHITE-1')
    await wrapper.get('input[aria-label="黑色入库数量"]').setValue('')
    await flushPromises()
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('各颜色数量须为0至999999的整数')
    expect(mocks.post).not.toHaveBeenCalled()
    await wrapper.get('input[aria-label="黑色入库数量"]').setValue('2')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[0][1].entries).toEqual([expect.objectContaining({ accessory_id: 102, total_quantity: 2 })])
    expect(mocks.post.mock.calls[0][1].entries[0]).toHaveProperty('barcode', 'BLACK-1')
  })

  it('SN按颜色分别录入并自动计数，跨颜色重复SN拦截，不混入普通数量', async () => {
    mocks.get.mockResolvedValue({ success: true, data: { ...colorTemplate, serial_tracking: 1 } })
    const wrapper = render(); await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 100); await flushPromises()
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    await wrapper.get('textarea[aria-label="白色SN"]').setValue('00white-1\n00white-2')
    await wrapper.get('textarea[aria-label="黑色SN"]').setValue('00white-1')
    expect(wrapper.text()).toContain('本次入库存在重复SN，请核对各颜色')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.get('textarea[aria-label="黑色SN"]').setValue('00black-1')
    expect(wrapper.get('[aria-label="颜色入库合计"]').text()).toContain('合计 3')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    const entries = mocks.post.mock.calls[0][1].entries
    expect(entries[0]).toMatchObject({ accessory_id: 101, total_quantity: 2, serial_numbers: [
      { serial_number: '00WHITE-1', store_id: 2 }, { serial_number: '00WHITE-2', store_id: 2 }] })
    expect(entries[1]).toMatchObject({ accessory_id: 102, total_quantity: 1, serial_numbers: [{ serial_number: '00BLACK-1', store_id: 2 }] })
  })

  it('多颜色结果未确认时关闭重开仍用原整组请求，恢复成功才清理并刷新', async () => {
    mocks.get.mockResolvedValue({ success: true, data: colorTemplate })
    const wrapper = render(); await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 100); await flushPromises()
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    await wrapper.get('input[aria-label="白色入库数量"]').setValue('2')
    await wrapper.get('input[aria-label="黑色入库数量"]').setValue('3')
    const success = mocks.post.getMockImplementation()!
    mocks.post.mockRejectedValueOnce(new Error('结果未知'))
    await saveButton(wrapper).trigger('click'); await flushPromises()
    const original = structuredClone(mocks.post.mock.calls[0][1])
    expect(wrapper.emitted('success')).toBeUndefined()
    expect(wrapper.find('[aria-label="按颜色填写入库数量"]').exists()).toBe(false)
    await wrapper.setProps({ modelValue: false }); await wrapper.setProps({ modelValue: true }); await flushPromises()
    mocks.post.mockImplementation(success)
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[1][1]).toEqual(original)
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('多颜色品牌商品的原批次更正显示所属颜色，保留原商品ID与50件数量，不强迫重选', async () => {
    const context = correctionContext()
    context.accessory = { ...context.accessory, template_id: 101, color_template_id: 100, color_variants: colorTemplate.color_variants }
    const wrapper = await stockEditor(1, context)
    expect(selectField(wrapper, '颜色').props('modelValue')).toBe(101)
    expect(quantityInput(wrapper)!.props('modelValue')).toBe(50)
    expect(wrapper.get<HTMLInputElement>('input[aria-label="原入库时间"]').element.value).toBe('2026-11-13 10:00:00')
    expect(wrapper.findComponent(ElDatePicker).exists()).toBe(false)
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in/10/corrections', expect.objectContaining({ accessory_id: 55, total_quantity: 50 }), expect.any(Object))
  })

  it('入库显示秒级北京时间默认值，可调整实际到货时间；隐藏时间不影响入库录入', async () => {
    const wrapper = await purchaseForm()
    const picker = wrapper.findComponent(ElDatePicker)
    expect(picker.props('type')).toBe('datetime')
    const time = picker.props('modelValue')
    expect(typeof time === 'string' && TimeUtil.isValid(time, TIME_FORMATS.DATETIME)).toBe(true)
    picker.vm.$emit('update:modelValue', '2026-11-14 09:20:30')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[0][1].inventory_time).toBe('2026-11-14 09:20:30')
    expect(wrapper.findComponent(ElDatePicker).props('format')).toBe(TIME_FORMATS.DATETIME)
    mocks.hidden.add('time_info.inventory_time'); mocks.post.mockClear()
    const hidden = await purchaseForm()
    expect(hidden.findComponent(ElDatePicker).exists()).toBe(true)
    await saveButton(hidden).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[0][1]).toHaveProperty('inventory_time')
  }, 15_000)

  it.each(['', '2026-02-30 10:00:00', '2026-11-14 24:00:00', '2026-11-14'])('入库时间无效时不能提交：%s', async value => {
    const wrapper = await purchaseForm()
    wrapper.findComponent(ElDatePicker).vm.$emit('update:modelValue', value)
    await flushPromises()
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it.each(['顶部', '行内'])('%s入库使用公共贴边正文与分区标题，保留基本信息和备注', async entry => {
    const wrapper = entry === '顶部' ? render() : await purchaseForm()
    await flushPromises()
    const dialog = wrapper.findComponent(DialogStub)
    expect(dialog.attributes('title')).toBe('入库')
    expect(dialog.attributes('dialog-class').split(' ')).toContain('tf-dialog-body-flush')
    expect(wrapper.findAll('.tf-query-modal-section-title').map(heading => heading.text())).toEqual(['基本信息', '备注信息'])
    expect(wrapper.findAll('.tf-query-modal-section')).toHaveLength(2)
    expect(wrapper.find('.card-header').exists()).toBe(false)
    expect(wrapper.get('textarea[placeholder="请输入备注信息（可选）"]').exists()).toBe(true)
  })

  it.each(['新增模板', '编辑模板', '编辑档案'])('%s与入库共用贴边正文和分区，保留独立字段与提交入口', async mode => {
    const wrapper = render(mode === '新增模板' ? undefined : { id: 55, name: '充电头', category_id: 12, unit_id: 2 }, mode !== '编辑档案')
    if (mode === '编辑档案') await wrapper.setProps({ profileEditOnly: true })
    await flushPromises()
    expect(wrapper.findComponent(DialogStub).attributes('dialog-class').split(' ')).toContain('tf-dialog-body-flush')
    expect(wrapper.findAll('.tf-query-modal-section-title').map(heading => heading.text())).toEqual(['基本信息', '备注信息'])
    expect(wrapper.findAll('.tf-query-modal-section')).toHaveLength(2)
    expect(wrapper.find('.card-header').exists()).toBe(false)
    expect(wrapper.find('.profile-correction-preview').exists()).toBe(mode === '编辑档案')
    expect(saveButton(wrapper).text()).toContain(mode === '新增模板' ? '创建模板' : mode === '编辑模板' ? '保存模板' : '保存档案')
    expect(mocks.post).not.toHaveBeenCalled()
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('字段权限重复读取但内容未变时仍能修改进价并保存原批次，不误清更正凭据', async () => {
    mocks.initFields.mockImplementation(async () => { access.fieldRevision += 1 })
    const wrapper = await stockEditor()
    const cost = wrapper.findAllComponents(AmountInput).find(input => input.element.closest('.el-form-item')?.textContent?.includes('进价'))!
    cost.vm.$emit('update:modelValue', 12.5)
    await flushPromises(); await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in/10/corrections', expect.objectContaining({ purchase_cost: 12.5 }), expect.any(Object))
    expect(mocks.error).not.toHaveBeenCalled()
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('商品库存编辑沿用入库字段及布局，回填原批次50件和原成本，保存更正不调用模板编辑', async () => {
    const wrapper = await stockEditor()
    expect(wrapper.findComponent(DialogStub).attributes('title')).toBe('编辑商品库存')
    expect(wrapper.findComponent(DialogStub).attributes('dialog-class')).toContain('tf-dialog-body-flush')
    expect(wrapper.findAll('.tf-query-modal-section-title').map(heading => heading.text())).toEqual(['基本信息', '备注信息'])
    const labels = wrapper.findAll('.accessory-form .el-form-item__label').map(item => item.text())
    expect(labels).toEqual(['供应商', '配件品牌', '商品名称', '店铺', '商品类型', '配件型号', '颜色', '条形码', '进价', '销售价', '入库总数', '入库员', '入库用途', 'SN管理', '入库时间', '备注'])
    expect(quantityInput(wrapper)!.props('modelValue')).toBe(50)
    expect(selectField(wrapper, '供应商').props('modelValue')).toBe(4)
    expect(wrapper.find('input[readonly]').exists()).toBe(true)
    quantityInput(wrapper)!.vm.$emit('update:modelValue', 5)
    wrapper.findComponent(AmountInput).vm.$emit('update:modelValue', 12.5)
    await flushPromises(); await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in/10/corrections', expect.objectContaining({
      accessory_id: 55, supplier_id: 4, store_id: 2, total_quantity: 5, purchase_cost: 12.5, request_key: expect.stringMatching(/^[a-f0-9]{32}$/)
    }), expect.objectContaining({ showError: false }))
    const payload = mocks.post.mock.calls[0][1]
    expect(Object.keys(payload).sort()).toEqual(['accessory_id', 'brand_id', 'product_model', 'purchase_cost', 'remarks', 'request_key', 'serial_numbers', 'serial_tracking', 'store_id', 'supplier_id', 'total_quantity', 'usage_type'].sort())
    expect(mocks.put).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('tf2025_accessory_stock_in_pending_7')).toBeNull()
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('多次采购必须选择原批次；不会把库存汇总或模板默认值当成待改入库数量', async () => {
    const wrapper = await stockEditor(2)
    expect(wrapper.find('.accessory-form').exists()).toBe(false)
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    const selector = select(wrapper, '选择需要更正的入库批次')
    selector.vm.$emit('update:modelValue', 11)
    mocks.get.mockResolvedValueOnce({ success: true, data: correctionContext(11) })
    selector.vm.$emit('change', 11)
    await flushPromises()
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/stock-in/11/edit', expect.objectContaining({ useCache: false }))
    expect(quantityInput(wrapper)!.props('modelValue')).toBe(50)
  })

  it('入库更正失败保留冻结原请求，重试相同键；400明确拒绝后可改表单重新提交', async () => {
    const wrapper = await stockEditor()
    mocks.post.mockRejectedValueOnce(new Error('Network Error'))
    await saveButton(wrapper).trigger('click'); await flushPromises()
    const original = mocks.post.mock.calls[0][1]
    expect(saveButton(wrapper).text()).toContain('重试原更正')
    expect(wrapper.find('.accessory-form').exists()).toBe(false)
    expect(wrapper.emitted('success')).toBeUndefined()
    mocks.post.mockRejectedValueOnce({ response: { status: 400, data: { code: 'INVALID_REFERENCE', message: '供应商已停用' } } })
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[1][1]).toEqual(original)
    expect(wrapper.find('.accessory-form').exists()).toBe(true)
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[2][1].request_key).not.toBe(original.request_key)
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('更正与未确认新采购状态隔离；隐藏厂家型号/备注不会回传默认空值', async () => {
    const pending = await purchaseForm()
    mocks.post.mockRejectedValueOnce(new Error('Network Error'))
    await saveButton(pending).trigger('click'); await flushPromises()
    const saved = sessionStorage.getItem('tf2025_accessory_stock_in_pending_7')
    mocks.hidden.add('basic_info.specifications'); mocks.hidden.add('other_info.remarks')
    const editor = await stockEditor()
    expect(editor.text()).not.toContain('上次入库结果尚未确认')
    await saveButton(editor).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls.at(-1)?.[1]).not.toHaveProperty('product_model')
    expect(mocks.post.mock.calls.at(-1)?.[1]).not.toHaveProperty('remarks')
    expect(sessionStorage.getItem('tf2025_accessory_stock_in_pending_7')).toBe(saved)
  })

  it('SN批次回填逐件编码，编辑后数量跟随SN列表，普通数量输入隐藏', async () => {
    const context = { ...correctionContext(), total_quantity: 2, serial_tracking: 1 as const,
      serial_numbers: [{ serial_number: 'SN-A', store_id: 2 }, { serial_number: 'SN-B', store_id: 2 }] }
    const wrapper = await stockEditor(1, context)
    expect(quantityInput(wrapper)).toBeUndefined()
    expect(wrapper.findAll('[data-serial-row] input').map(item => (item.element as HTMLInputElement).value)).toEqual(['SN-A', 'SN-B'])
    await wrapper.findAll('button').find(button => button.text() === '移除')!.trigger('click')
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[0][1]).toMatchObject({ total_quantity: 1, serial_tracking: 1, serial_numbers: [{ serial_number: 'SN-B', store_id: 2 }] })
  })

  it('已销售/划拨/付款批次读取失败显示服务端原因，并禁止保存；无编辑权限不能提交', async () => {
    const wrapper = await stockEditor(2)
    const selector = select(wrapper, '选择需要更正的入库批次')
    mocks.get.mockRejectedValueOnce({ response: { status: 409, data: {
      success: false, code: 'STOCK_CORRECTION_USED', message: '该批次已有销售、赠送、划拨或其他后续业务，不能直接更正原入库'
    } } })
    selector.vm.$emit('update:modelValue', 10); selector.vm.$emit('change', 10)
    await flushPromises()
    expect(wrapper.text()).toContain('该批次已有销售、赠送、划拨或其他后续业务')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(mocks.post).not.toHaveBeenCalled()
    access.edit = false
    const forbidden = await stockEditor()
    expect(saveButton(forbidden).attributes('disabled')).toBeDefined()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('换批次时过期响应不能覆盖当前选择，保存只提交当前原单', async () => {
    const wrapper = await stockEditor(2)
    const selector = select(wrapper, '选择需要更正的入库批次')
    let resolveOld!: (value: unknown) => void
    mocks.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    selector.vm.$emit('update:modelValue', 10); selector.vm.$emit('change', 10)
    await flushPromises()
    mocks.get.mockResolvedValueOnce({ success: true, data: { ...correctionContext(11), total_quantity: 8 } })
    selector.vm.$emit('update:modelValue', 11); selector.vm.$emit('change', 11)
    await flushPromises()
    expect(quantityInput(wrapper)!.props('modelValue')).toBe(8)
    resolveOld({ success: true, data: correctionContext(10) })
    await flushPromises()
    expect(quantityInput(wrapper)!.props('modelValue')).toBe(8)
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.post.mock.calls[0][0]).toBe('/accessories/stock-in/11/corrections')
    await wrapper.setProps({ modelValue: false })
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it.each(['action', 'actor', 'field'] as const)('已加载资料在%s变化时清理，不能提交旧更正', async kind => {
    const wrapper = await stockEditor()
    expect(quantityInput(wrapper)!.props('modelValue')).toBe(50)
    if (kind === 'action') access.edit = false
    else if (kind === 'actor') access.actorId = 8
    else mocks.hidden.add('price_info.purchase_cost')
    await flushPromises()
    expect(wrapper.text()).toContain('账号或字段权限已变化')
    expect(wrapper.find('.accessory-form').exists()).toBe(false)
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(mocks.post).not.toHaveBeenCalled()
  })

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
    const success = mocks.post.getMockImplementation()!
    let finishRetry: (() => void) | undefined
    mocks.post.mockImplementationOnce((url: string, input: AccessoryStockInRequest) => new Promise(resolve => {
      finishRetry = () => resolve(success(url, input))
    }))
    await saveButton(reopened).trigger('click'); await flushPromises()
    expect(reopened.text()).toContain('正在提交并核对入库结果，请稍候...')
    expect(reopened.text()).not.toContain('上次入库结果尚未确认')
    finishRetry?.(); await flushPromises()
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

  it('字段隐藏不阻断采购原载荷重试；模板编辑仍独立且不携带入库凭据', async () => {
    mocks.post.mockRejectedValueOnce(new Error('Network Error'))
    const wrapper = await purchaseForm()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    wrapper.unmount()
    mocks.hidden.add('price_info.purchase_cost')
    const restricted = await purchaseForm()
    expect(saveButton(restricted).attributes('disabled')).toBeUndefined()
    await saveButton(restricted).trigger('click')
    expect(mocks.post).toHaveBeenCalledTimes(2)
    const editor = render({ id: 55, name: '原装充电头', category_id: 12, unit_id: 2 }, true)
    await flushPromises(); await saveButton(editor).trigger('click'); await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.not.objectContaining({ request_key: expect.anything() }), { showError: false })
  })

  it('请求处理中禁用连点及关闭，服务端原回执成功后才释放凭据并刷新', async () => {
    let finish: ((value: { success: boolean; data: object }) => void) | undefined
    mocks.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = await purchaseForm()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    const original = mocks.post.mock.calls[0][1]
    expect(wrapper.text()).toContain('正在提交并核对入库结果，请稍候...')
    expect(wrapper.text()).not.toContain('上次入库结果尚未确认')
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
    for (const [label, name, id] of [['商品类型', '充电头', 12], ['颜色', '白色', [3]], ['单位', '个', 2],
      ['适配品牌', '手机品牌乙', 2], ['适配型号', '机型2', [20]]] as const) {
      const field = selectField(wrapper, label)
      expect(field.props('modelValue')).toEqual(id)
      expect(field.text()).toContain(name)
    }
    expect(wrapper.get<HTMLInputElement>('input[placeholder="厂家型号，可不填"]').element.value).toBe('MWVW3CH')
    expect(wrapper.get<HTMLInputElement>('input[placeholder="厂家型号，可不填"]').element.disabled).toBe(false)
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({
      category_id: 12, color_id: 3, unit_id: 2, model_id: 20, product_model: 'MWVW3CH'
    }), { showError: false })
  })

  it('商品档案更正显示原品牌对照并提交实际商品ID；隐藏售价不显示也不回传', async () => {
    mocks.hidden.add('price_info.sale_price')
    const wrapper = render({ id: 56, template_id: 55, brand_id: 1, brand_name: '原品牌', name: '充电头',
      category_id: 12, unit_id: 2, sale_price: 20, purchase_cost: 8, supplier_id: 4 })
    await wrapper.setProps({ profileEditOnly: true })
    await flushPromises()
    const preview = wrapper.get('.profile-correction-preview')
    expect(preview.text()).toContain('原品牌')
    expect(preview.text()).toContain('配件品牌')
    expect(preview.text()).not.toContain('零售价')
    expect(preview.text()).not.toContain('¥20')
    await wrapper.get<HTMLInputElement>('input[placeholder="请输入商品名称"]').setValue('更正充电头')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/56', expect.objectContaining({ name: '更正充电头', brand_id: 1 }), { showError: false })
    const payload = mocks.put.mock.calls[0][1]
    for (const field of ['purchase_cost', 'supplier_id', 'sale_price', 'total_quantity', 'serial_numbers']) expect(payload).not.toHaveProperty(field)
    expect(mocks.post).not.toHaveBeenCalled()
    expect(wrapper.emitted('success')).toHaveLength(1)
  })

  it('同色品牌更正遇业务冲突时只显示提示，重试合并成功后刷新商品列表', async () => {
    const wrapper = render({ id: 101, color_id: 3, name: '充电头', category_id: 12, unit_id: 2,
      color_template_id: 100, color_variants: colorTemplate.color_variants })
    await wrapper.setProps({ profileEditOnly: true })
    await flushPromises()
    selectField(wrapper, '配件品牌').vm.$emit('update:modelValue', 1)
    const message = '该品牌商品关联了销售记录，不能合并'
    mocks.put.mockRejectedValueOnce({ response: { status: 409, data: { code: 'ACCESSORY_DELETE_HAS_ACTIVITY', message } } })
      .mockResolvedValueOnce({ success: true, data: { id: 103 } })
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.warning).toHaveBeenCalledExactlyOnceWith(message)
    expect(mocks.error).not.toHaveBeenCalled()
    expect(wrapper.emitted('success')).toBeUndefined()
    await saveButton(wrapper).trigger('click'); await flushPromises()
    expect(mocks.put).toHaveBeenLastCalledWith('/accessories/101', expect.objectContaining({ brand_id: 1 }), { showError: false })
    expect(mocks.success).toHaveBeenCalledWith('品牌已更正，原采购记录已归入正确品牌')
    expect(wrapper.emitted('success')).toHaveLength(1)
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
    expect(select(wrapper, '选择配件品牌').props('disabled')).toBeFalsy()
    expect(wrapper.find('.tf-query-modal-section .el-row').findAll('.el-form-item__label').map(item => item.text())).toEqual([
      '供应商', '配件品牌', '商品名称', '店铺', '商品类型', '配件型号', '颜色', '条形码', '进价', '销售价', '入库总数', '入库员', '入库用途', 'SN管理', '入库时间'
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

  it('入库模板回填允许使用列表隐藏的品牌、规格和颜色字段', async () => {
    mocks.hidden.add('basic_info.brand_name')
    mocks.hidden.add('basic_info.specifications')
    mocks.hidden.add('basic_info.color_name')
    mocks.hidden.add('status_info.status')
    mocks.get.mockResolvedValue({ data: { id: 55, name: '可见名称', barcode: 'VISIBLE', category_id: 11, unit_id: 1,
      brand_id: 1, brand_name: '隐藏品牌', product_model: '隐藏规格', color_id: 3, color_name: '隐藏颜色', status: 1 } })
    const wrapper = render()
    await flushPromises()
    selectField(wrapper, '商品名称').vm.$emit('change', 55)
    await flushPromises()
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(55)
    expect(wrapper.findAll('.el-form-item__label').map(item => item.text())).toEqual(expect.arrayContaining(['配件品牌', '配件型号', '颜色']))
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
    expect(wrapper.find('.tf-query-modal-section .el-row').findAll('.el-form-item__label').map(item => item.text())).toEqual([
      '商品名称', '商品类型', '适配品牌', '适配型号', '配件型号', '颜色', '单位', '零售价', '预警值', '状态', 'SN管理'
    ])
    expect(selectField(wrapper, '适配品牌').props('placeholder')).toBe('通用')
    expect(selectField(wrapper, '适配品牌').props('modelValue')).toBeNull()
    expect(selectField(wrapper, '适配型号').props('placeholder')).toBe('通用')
    expect(wrapper.findAllComponents(ElSelect).some(item => item.props('placeholder') === '选择配件品牌')).toBe(false)
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
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({ model_ids: [], model_id: null }), { showError: false })
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
      mode === '编辑' ? '/accessories/55' : '/accessories', expect.objectContaining({ barcode: '0012345678901' }),
      ...(mode === '编辑' ? [{ showError: false }] : []))
  })

  it('同名候选展示型号、颜色、适配、零售价和SN默认值，隐藏字段不展示或泄露', async () => {
    const item = { id: 55, name: '原装充电头', category: '充电头', product_model: 'USB-C 20W',
      color_name: '白色', compatible_model_names: '手机品牌 iPhone 17', sale_price: '39', unit: '个', serial_tracking: 1 }
    mocks.get.mockResolvedValue({ success: true, data: { data: [item, { ...item, id: 56, product_model: 'USB-C 35W' }], pagination: { total: 2 } } })
    const wrapper = render()
    await flushPromises()
    const selector = selectField(wrapper, '商品名称')
    await selector.props('remoteMethod')('充电头 20w')
    await flushPromises()
    const options = selector.findAllComponents(ElOption)
    expect(options.map(option => option.props('label'))).toEqual(['原装充电头', '原装充电头'])
    expect(options[0].text()).toContain('型号 USB-C 20W')
    expect(options[1].text()).toContain('型号 USB-C 35W')
    for (const text of ['白色', '适配 手机品牌 iPhone 17', '零售 ¥39/个', '默认SN管理']) expect(options[0].text()).toContain(text)
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/stock-in/templates', expect.objectContaining({
      params: expect.objectContaining({ search: '充电头 20w', page: 1 }), useCache: false, showError: false
    }))
    for (const field of ['basic_info.specifications', 'basic_info.color_name', 'basic_info.model_name', 'price_info.sale_price', 'basic_info.serial_tracking']) mocks.hidden.add(field)
    await flushPromises()
    for (const text of ['USB-C', '白色', 'iPhone', '零售', '39', '默认SN管理']) expect(options[0].text()).toContain(text)
  })

  it('下拉在加载中或结果挂载后再次可见时不重复查询，也不清空关键词和已加载结果', async () => {
    let resolveList: ((response: unknown) => void) | undefined
    mocks.get.mockImplementation(() => new Promise(resolve => { resolveList = resolve }))
    const wrapper = render()
    await flushPromises()
    const selector = selectField(wrapper, '商品名称')
    const pending = selector.props('remoteMethod')('充电头 20W')
    selector.vm.$emit('visible-change', true)
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(1)
    resolveList?.({ success: true, data: { data: [{ id: 55, name: '充电头', product_model: '20W' }], pagination: { total: 1 } } })
    await pending
    await flushPromises()
    selector.vm.$emit('visible-change', false)
    selector.vm.$emit('visible-change', true)
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/stock-in/templates', expect.objectContaining({ params: expect.objectContaining({ search: '充电头 20W' }) }))
    expect(selector.findAllComponents(ElOption).map(option => option.props('value'))).toEqual([55])
  })

  it('模板超过100条可以加载全部，下一页失败保留已有候选，重试仍请求原页且去重', async () => {
    const items = Array.from({ length: 125 }, (_, index) => ({ id: index + 1, name: `充电头${index + 1}`, category: '充电头' }))
    let failSecondPage = true
    const requestedPages: number[] = []
    mocks.get.mockImplementation(async (_url: string, config: { params: { page: number; page_size: number; search: string } }) => {
      const { page, page_size, search } = config.params
      expect(search).toBe('充电头')
      requestedPages.push(page)
      if (page === 2 && failSecondPage) { failSecondPage = false; throw new Error('模拟第二页连接失败') }
      const data = items.slice((page - 1) * page_size, page * page_size)
      return { success: true, data: { data: page === 2 ? [items[19], ...data] : data, pagination: { total: items.length } } }
    })
    const wrapper = render()
    await flushPromises()
    const selector = selectField(wrapper, '商品名称')
    await selector.props('remoteMethod')('充电头')
    const action = () => selector.findAllComponents(ElButton).find(button => /加载更多|重试/.test(button.text()))!
    await action().trigger('click')
    await flushPromises()
    expect(selector.findAllComponents(ElOption)).toHaveLength(20)
    expect(action().text()).toBe('重试')
    await action().trigger('click')
    await flushPromises()
    expect(selector.findAllComponents(ElOption)).toHaveLength(40)
    for (let page = 3; page <= 7; page++) { await action().trigger('click'); await flushPromises() }
    expect(requestedPages).toEqual([1, 2, 2, 3, 4, 5, 6, 7])
    expect(selector.findAllComponents(ElOption)).toHaveLength(125)
    expect(selector.findAllComponents(ElOption).at(-1)!.props('label')).toBe('充电头125')
    expect(action()).toBeUndefined()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('新关键词只显示实际命中候选，不把已选旧商品混入搜索结果；字符串编号可正常选择', async () => {
    const current = { id: 55, name: '已选充电头', category: '充电头', category_id: 12, unit_id: 2, status: 1 }
    mocks.get.mockImplementation(async (url: string) => url === '/accessories/stock-in/templates'
      ? { success: true, data: { data: [{ id: '56', name: '新数据线', category: '数据线' }], pagination: { total: 1 } } }
      : { success: true, data: url.endsWith('/55') ? current : { ...current, id: 56, name: '新数据线' } })
    const wrapper = render()
    await flushPromises()
    const selector = selectField(wrapper, '商品名称')
    selector.vm.$emit('change', 55)
    await flushPromises()
    await selector.props('remoteMethod')('数据线')
    await flushPromises()
    const options = selector.findAllComponents(ElOption)
    expect(options.map(option => option.props('label'))).toEqual(['新数据线'])
    expect(options[0].props('value')).toBe(56)
    expect(selector.props('modelValue')).toBe(55)
    selector.vm.$emit('change', options[0].props('value'))
    await flushPromises()
    expect(selector.props('modelValue')).toBe(56)
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/stock-in/templates/56', expect.objectContaining({ useCache: false }))
  })

  it('商品类型按组列出模板，选择后回填资料并保留本次供应商和进价', async () => {
    const template = { id: 55, name: '钢化膜4.7', barcode: '001234', category: '钢化膜', category_id: 11,
      unit_id: 1, product_model: 'FILM-47', sale_price: 20,
      brand_id: 99, model_brand_id: 2, model_ids: [20], supplier_id: 99, purchase_cost: 99, status: 1 }
    mocks.get.mockImplementation(async (url: string) => ({ data: url === '/accessories/stock-in/templates'
      ? { data: [template, { ...template, id: 56, name: '钢化膜6.1' },
        { ...template, id: 57, name: '65W充电头', category: '充电头', category_id: 12 }], pagination: { total: 121 } }
      : template }))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="销售价"]').element.value).toBe('')
    select(wrapper, '选择供应商').vm.$emit('update:modelValue', 4)
    const cost = wrapper.findComponent(AmountInput)
    cost.vm.$emit('update:modelValue', 3)
    selectField(wrapper, '配件品牌').vm.$emit('update:modelValue', 1)
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
    expect(mocks.get).toHaveBeenLastCalledWith('/accessories/stock-in/templates/55', expect.objectContaining({ useCache: false }))
    expect(selectField(wrapper, '商品名称').props('modelValue')).toBe(55)
    expect(wrapper.get<HTMLInputElement>('input[placeholder="选择商品后自动填充"]').element.value).toBe('钢化膜')
    expect(wrapper.findAllComponents(ElOption).filter(option => [55, 56, 57].includes(Number(option.props('value')))).map(option => option.props('label'))).toEqual(['钢化膜4.7', '钢化膜6.1', '65W充电头'])
    expect(wrapper.find('input[placeholder="手动输入或扫描条形码"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input[placeholder="厂家型号，可不填"]').element.value).toBe('FILM-47')
    expect(wrapper.findAll('.el-form-item__label').map(item => item.text())).not.toContain('适配品牌')
    expect(wrapper.findAll('.el-form-item__label').map(item => item.text())).not.toContain('适配型号')
    expect(selectField(wrapper, '配件品牌').props('modelValue')).toBe(1)
    expect(selectField(wrapper, '配件品牌').props('disabled')).toBeFalsy()
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

  it('隐藏入库用途不影响新采购录入，模板仍可正常编辑', async () => {
    mocks.hidden.add('basic_info.usage_type')
    const wrapper = render({ id: 55, name: '钢化膜', supplier_id: 4 }, false)
    await flushPromises()
    expect(wrapper.findAll('.el-form-item__label').map(item => item.text())).not.toContain('入库用途')
    // 编辑模式不是入库，不依赖本次采购用途。
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
    const stockIn = await purchaseForm()
    expect(stockIn.findAll('.el-form-item__label').map(item => item.text())).toContain('入库用途')
    quantityInput(stockIn)?.vm.$emit('update:modelValue', 1)
    await flushPromises()
    expect(saveButton(stockIn).attributes('disabled')).toBeUndefined()
  })

  it('商品类型搜索和选择忽略旧响应，关闭后不回填', async () => {
    let oldList: ((response: unknown) => void) | undefined
    let oldDetail: ((response: unknown) => void) | undefined
    mocks.get.mockImplementation((url: string, config?: { params?: { search?: string } }) => {
      if (url === '/accessories/stock-in/templates' && config?.params?.search === '旧') return new Promise(resolve => { oldList = resolve })
      if (url === '/accessories/stock-in/templates/55') return new Promise(resolve => { oldDetail = resolve })
      if (url === '/accessories/stock-in/templates') return Promise.resolve({ data: { data: [{ id: 56, name: '新模板', category: '钢化膜' }], pagination: { total: 1 } } })
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
    expect(wrapper.findAllComponents(ElSelect).some(item => item.props('placeholder') === '选择配件品牌')).toBe(false)
    expect(wrapper.text()).not.toContain('配件规格')
    salePriceInput(wrapper).vm.$emit('update:modelValue', 35.5)
    const barcode = wrapper.get<HTMLInputElement>('input[placeholder="手动输入或扫描条形码"]')
    expect(barcode.element.disabled).toBe(false)
    await barcode.setValue(' CORRECTED-55 ')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({ model_ids: [20], product_model: 'MWVW3CH', sale_price: 35.5, barcode: 'CORRECTED-55', status: 1 }), { showError: false })
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
    expect(wrapper.find('input[placeholder="选择配件品牌"]').exists()).toBe(false)
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
      global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true } }
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
    expect(mocks.get).toHaveBeenCalledWith('/accessories/stock-in/templates/55', expect.objectContaining({ useCache: false }))
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
    expect(wrapper.text()).toContain('销售价')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('sale_price')
  })

  it('无条码模板可从列表直接入库并保留售价，编辑允许清空旧条码', async () => {
    const wrapper = mount(AccessoryStockInModal, {
      props: { modelValue: true, stockInOnly: true, accessory: { id: 55, name: '钢化膜', product_model: 'MWVW3CH', category_id: 11, unit_id: 1, sale_price: 20, status: 1 } },
      global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true } }
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
    expect(wrapper.get<HTMLInputElement>('input[placeholder="厂家型号，可不填"]').element.disabled).toBe(true)
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
    expect(mocks.put).toHaveBeenCalledWith('/accessories/56', expect.objectContaining({ barcode: null }), { showError: false })
  }, 15_000)
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
      global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true } }
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
      global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true } }
    })
    wrappers.push(wrapper)
    await flushPromises()
    expect(selectField(wrapper, '店铺').props('modelValue')).toBe(3)
    const click = async (text: string) => { await wrapper.findAll('button').find(item => item.text() === text)!.trigger('click'); await flushPromises() }
    const batch = wrapper.get('textarea[placeholder*="每行一个"]')
    await batch.setValue('00aa\n00AA')
    await click('添加多条SN')
    expect(wrapper.findAll('.serial-entry-row input')).toHaveLength(1)
    expect(mocks.warning).toHaveBeenCalledWith('本次入库存在重复SN，请核对后再添加')
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
  }, 15_000)

  it('首次扫码复用空行，连续扫码置顶，重扫指定行只替换这一条', async () => {
    const ScannerStub = defineComponent({
      name: 'OptimizedScanner',
      props: { serialBrand: String },
      emits: ['success', 'update:visible'],
      template: '<div />'
    })
    mocks.options.mockResolvedValue({ data: { ...optionData(), brands: [{ id: 1, name: '苹果' }] } })
    const wrapper = mount(AccessoryStockInModal, {
      props: { modelValue: true, stockInOnly: true, accessory: { id: 55, name: '头', serial_tracking: 1, category_id: 12, unit_id: 2, status: 1 } },
      global: {
        plugins: [ElementPlus],
        directives: { permission: {}, 'identifier-input': vIdentifierInput },
        stubs: { MobileDialog: DialogStub, Image: true, OptimizedScanner: ScannerStub }
      }
    })
    wrappers.push(wrapper)
    await flushPromises()
    selectField(wrapper, '配件品牌').vm.$emit('update:modelValue', 1)
    const rows = () => wrapper.findAll<HTMLInputElement>('.serial-entry-row input')
    const scan = async (value: string, row?: number) => {
      const button = row === undefined
        ? wrapper.findAll('button').find(item => item.text().trim() === '扫码SN')!
        : wrapper.findAll('.serial-entry-row')[row].findAll('button').find(item => item.text().trim() === '扫码')!
      await button.trigger('click')
      await flushPromises()
      const scanner = wrapper.findComponent(ScannerStub)
      expect(scanner.props('serialBrand')).toBe('苹果')
      scanner.vm.$emit('success', value)
      scanner.vm.$emit('update:visible', false)
      await flushPromises()
    }
    await scan('OLD-SN')
    expect(rows().map(input => input.element.value)).toEqual(['OLD-SN'])
    await scan('NEW-SN')
    expect(rows().map(input => input.element.value)).toEqual(['NEW-SN', 'OLD-SN'])
    await scan('CORRECTED-SN', 1)
    expect(rows().map(input => input.element.value)).toEqual(['CORRECTED-SN', 'NEW-SN'])
  })

  it('模板保存预警值零并回显；采购表单移除单位状态预警且不提交覆盖', async () => {
    const editor = render({ id: 55, name: '原装充电头', min_stock: 0, category_id: 12, unit_id: 2 }, true)
    await flushPromises()
    const warning = editor.findAll('input').find(item => item.element.closest('.el-form-item')?.querySelector('.el-form-item__label')?.textContent?.trim() === '预警值')!
    expect(warning.element.value).toBe('0')
    await saveButton(editor).trigger('click')
    await flushPromises()
    expect(mocks.put).toHaveBeenCalledWith('/accessories/55', expect.objectContaining({ min_stock: 0 }), { showError: false })
    const wrapper = mount(AccessoryStockInModal, { props: { modelValue: true, stockInOnly: true, accessory: { id: 55, name: '原装充电头', min_stock: 0, category_id: 12, unit_id: 2, status: 1 } }, global: { plugins: [ElementPlus], directives: { permission: {}, 'identifier-input': vIdentifierInput }, stubs: { MobileDialog: DialogStub, Image: true } } })
    wrappers.push(wrapper)
    await flushPromises()
    const labels = wrapper.findAll('.el-form-item__label').map(item => item.text())
    for (const field of ['单位', '状态', '预警值', '适配品牌', '适配型号']) expect(labels).not.toContain(field)
    selectField(wrapper, '供应商').vm.$emit('update:modelValue', 4)
    await flushPromises()
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accessories/stock-in', expect.not.objectContaining({ min_stock: expect.anything() }))
  }, 15_000)

})
