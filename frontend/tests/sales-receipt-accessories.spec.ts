import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Receipt from '@/components/query/SalesReceipt.vue'
import type { PhoneReceiptAccessory, ReceiptItem } from '@/types/sales-receipt'

const mocks = vi.hoisted(() => ({ get: vi.fn(), hidden: new Set<string>(), capture: vi.fn() }))
mocks.hidden = reactive(mocks.hidden)
const canView = ref(true)
vi.mock('@/api/sales-receipt', () => ({ getPhoneReceiptAccessories: mocks.get }))
vi.mock('@/stores/siteSettings', () => ({ useSiteSettingsStore: () => ({ settings: { siteName: '单据测试' } }) }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({ canView: computed(() => canView.value), hasPermission: (action: string) => action === 'goods-view' && canView.value }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) } }))
vi.mock('@/utils/html2canvas', () => ({ loadHtml2Canvas: async () => mocks.capture }))
const phone = (extra: Partial<ReceiptItem> = {}): ReceiptItem => ({ phone_id: 11, sale_id: 81, brand: '苹果', model: '手机甲',
  color: '黑色', memory: '128G', imei: 'PHONE-A', serialNumber: '', salePrice: 100.01, isNew: 1, ...extra })
const goods = (extra: Partial<PhoneReceiptAccessory> = {}): PhoneReceiptAccessory => ({ id: 51, name: '充电器', brand_name: '配件品牌',
  product_model: 'MWVW3CH', color_name: '白色', unit: '个', quantity: 2, unit_price: 20, total_price: 35.02,
  sale_type: 'sale', points_used: 498, deduction_amount: 4.98, serial_numbers: ['000SN1', '000SN2'],
  gift_return_unit_price: null, gift_return_total: null, gift_agreement_state: extra.sale_type === 'gift' ? 'not_recorded' : null, ...extra })
const Dialog = { props: ['modelValue', 'visible'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' }
const wrappers: ReturnType<typeof mount>[] = []
const render = async (items = [phone()], status = 'sold') => {
  const wrapper = mount(Receipt, { props: { visible: true, items, status }, global: { plugins: [ElementPlus], stubs: { MobileDialog: Dialog },
    mocks: { $getNumberColumnWidth: () => 68 }, directives: { 'tf-loading': {} } } })
  wrappers.push(wrapper); await flushPromises(); return wrapper
}
const button = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find(item => item.text() === text)!
beforeEach(() => { canView.value = true; mocks.hidden.clear(); mocks.get.mockResolvedValue({ success: true, data: [goods(), goods({ id: 52, name: '钢化膜', sale_type: 'gift', quantity: 1, unit_price: 0, total_price: 0, points_used: 0, deduction_amount: 0, serial_numbers: [] })] }) })
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks(); vi.clearAllMocks() })

it('手机凭证显示购买与赠品、数量、SN及积分抵扣，按实际净额合计且赠品零计价', async () => {
  const wrapper = await render()
  for (const text of ['充电器', '钢化膜', '购买', '赠品', '000SN1、000SN2', '498积分', '¥4.98', '实收 ¥35.02', '1台', '3件配件', '¥ 135.03']) expect(wrapper.text()).toContain(text)
  expect(mocks.get).toHaveBeenCalledWith(81, expect.any(AbortSignal))
  expect(wrapper.find('.totals-bar').text()).not.toContain('140.01')
  expect(button(wrapper, '打印').attributes('disabled')).toBeUndefined()
})

it('部分退货后凭证只展示剩余商品和金额，打印使用相同内容', async () => {
  mocks.get.mockResolvedValue({ success: true, data: [goods({ quantity: 1, total_price: 17.51, points_used: 249,
    deduction_amount: 2.49, serial_numbers: ['000SN2'] })] })
  const wrapper = await render()
  for (const text of ['1件配件', '000SN2', '实收 ¥17.51', '¥ 117.52']) expect(wrapper.text()).toContain(text)
  expect(wrapper.text()).not.toContain('000SN1')

  const printed = document.implementation.createHTMLDocument('returned-receipt-test')
  Object.defineProperty(printed, 'fonts', { value: { ready: Promise.resolve() } })
  const print = vi.fn()
  vi.spyOn(window, 'open').mockReturnValue({ document: printed, print } as unknown as Window)
  await button(wrapper, '打印').trigger('click'); await flushPromises()
  for (const text of ['1件配件', '000SN2', '17.51', '117.52']) expect(printed.body.textContent).toContain(text)
  expect(printed.body.textContent).not.toContain('000SN1')
  expect(print).toHaveBeenCalledOnce()
})

it('全部退货后凭证移除商品行和配件数量，只保留手机金额', async () => {
  mocks.get.mockResolvedValue({ success: true, data: [] })
  const wrapper = await render()
  expect(wrapper.text()).not.toContain('充电器')
  expect(wrapper.text()).not.toContain('件配件')
  expect(wrapper.find('.totals-bar').text()).toContain('¥ 100.01')
  const printed = document.implementation.createHTMLDocument('fully-returned-receipt-test')
  Object.defineProperty(printed, 'fonts', { value: { ready: Promise.resolve() } })
  vi.spyOn(window, 'open').mockReturnValue({ document: printed, print: vi.fn() } as unknown as Window)
  await button(wrapper, '打印').trigger('click'); await flushPromises()
  expect(printed.body.textContent).not.toContain('充电器')
  expect(printed.body.textContent).toContain('100.01')
})

it('同客户多台手机按各自销售ID加载，保留配件归属，切换后不能覆盖为旧请求结果', async () => {
  let finishOld: (_value: { success: boolean; data: PhoneReceiptAccessory[] }) => void = () => undefined
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
  const wrapper = await render()
  const oldSignal = mocks.get.mock.calls[0][1]
  mocks.get.mockResolvedValueOnce({ success: true, data: [goods({ name: '手机乙专属配件' })] })
  await wrapper.setProps({ items: [phone({ phone_id: 12, sale_id: 82, model: '手机乙', imei: 'PHONE-B' })] }); await flushPromises()
  expect(oldSignal.aborted).toBe(true)
  finishOld({ success: true, data: [goods({ name: '旧手机配件不应出现' })] }); await flushPromises()
  expect(wrapper.text()).toContain('手机乙专属配件'); expect(wrapper.text()).not.toContain('旧手机配件不应出现')
  const phones = [phone(), phone({ phone_id: 12, sale_id: 82, model: '手机乙' })]
  mocks.get.mockImplementation(async id => ({ success: true, data: [goods({ id, name: id === 81 ? '甲充电器' : '乙赠品', sale_type: id === 81 ? 'sale' : 'gift', total_price: id === 81 ? 35.02 : 0 })] }))
  await wrapper.setProps({ items: phones }); await flushPromises()
  expect(wrapper.text()).toContain('甲充电器'); expect(wrapper.text()).toContain('乙赠品')
  expect(wrapper.find('.totals-bar').text()).toContain('¥ 235.04')
})

it('核对加载或失败禁用打印与图片，成功重试后恢复；关闭会取消请求', async () => {
  let rejectRequest: (_error: Error) => void = () => undefined
  mocks.get.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject }))
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  const wrapper = await render()
  expect(button(wrapper, '打印').attributes('disabled')).toBeDefined()
  expect(button(wrapper, '保存图片').attributes('disabled')).toBeDefined()
  await button(wrapper, '打印').trigger('click'); expect(open).not.toHaveBeenCalled()
  rejectRequest(new Error('isolated read failure')); await flushPromises()
  expect(wrapper.text()).toContain('随单配件核对失败')
  expect(button(wrapper, '保存图片').attributes('disabled')).toBeDefined()
  await button(wrapper, '重新核对').trigger('click'); await flushPromises()
  expect(wrapper.text()).not.toContain('随单配件核对失败')
  expect(button(wrapper, '打印').attributes('disabled')).toBeUndefined()
  const signal = mocks.get.mock.calls.at(-1)![1]
  await wrapper.setProps({ visible: false }); expect(signal.aborted).toBe(true)
})

it('没有配件权限不读取且标注仅含手机；撤权立即清理已读配件', async () => {
  const wrapper = await render()
  canView.value = false; await flushPromises()
  expect(wrapper.text()).toContain('未获配件查看权限，本凭证仅含手机')
  expect(wrapper.text()).not.toContain('充电器'); expect(wrapper.text()).not.toContain('000SN1')
  const count = mocks.get.mock.calls.length
  await wrapper.setProps({ items: [phone({ sale_id: 82 })] }); await flushPromises()
  expect(mocks.get).toHaveBeenCalledTimes(count)
  expect(wrapper.find('.totals-bar').text()).toContain('¥ 100.01')
})

it('隐藏SN、价格和数量不补回数据，也不把未知金额当零形成完整合计', async () => {
  mocks.hidden.add('basic_info.serial_number'); mocks.hidden.add('price_info.total_price'); mocks.hidden.add('stock_info.total_quantity')
  mocks.get.mockResolvedValue({ success: true, data: [goods({ total_price: null, quantity: null, serial_numbers: null })] })
  const wrapper = await render()
  expect(wrapper.text()).not.toContain('000SN1'); expect(wrapper.text()).not.toContain('¥35.02')
  expect(wrapper.find('.totals-bar').text()).toContain('金额未完整展示')
  expect(wrapper.find('.totals-bar').text()).not.toContain('100.01')
})

it('缺失原销售ID禁止出具完整凭证；批发和划拨保留原行为不读取零售配件', async () => {
  const wrapper = await render([phone({ sale_id: undefined })])
  expect(wrapper.text()).toContain('缺少原手机销售记录')
  expect(button(wrapper, '打印').attributes('disabled')).toBeDefined()
  expect(mocks.get).not.toHaveBeenCalled()
  for (const status of ['peer_transfer', 'supplier_proxy']) {
    await wrapper.setProps({ status }); await flushPromises()
    expect(button(wrapper, '打印').attributes('disabled')).toBeUndefined()
  }
  expect(mocks.get).not.toHaveBeenCalled()
})

it('赠品约定区分未记录及零元，按原数量展示但不计入实收；权限隐藏时不显示', async () => {
  for (const price of [null, 0, 12.34]) {
    mocks.get.mockResolvedValueOnce({ success: true, data: [goods({ sale_type: 'gift', unit_price: 0, total_price: 0,
      points_used: 0, deduction_amount: 0, gift_return_unit_price: price, gift_return_total: price === null ? null : price * 2,
      gift_agreement_state: price === null ? 'not_recorded' : 'recorded' })] })
    const wrapper = await render()
    expect(wrapper.text()).toContain(price === null ? '原单未记录约定金额' : `原单约定 ¥${price}/件`)
    expect(wrapper.find('.totals-bar').text()).toContain('¥ 100.01')
    mocks.hidden.add('price_info.total_price'); await flushPromises()
    expect(wrapper.text()).not.toContain('赠品未退约定')
    mocks.hidden.clear()
  }
})

it('损坏的赠品约定不能出具完整凭证，禁止打印和图片导出', async () => {
  mocks.get.mockResolvedValueOnce({ success: true, data: [goods({ sale_type: 'gift', gift_agreement_state: 'recorded',
    gift_return_unit_price: 12.34, gift_return_total: 12.34 })] })
  const wrapper = await render()
  expect(wrapper.text()).toContain('随单配件核对失败')
  expect(button(wrapper, '打印').attributes('disabled')).toBeDefined()
  expect(button(wrapper, '保存图片').attributes('disabled')).toBeDefined()
})

it('打印的新文档包含同一份购买、赠品、原约定、SN及净额，不另取当前商品价格', async () => {
  const wrapper = await render()
  const printed = document.implementation.createHTMLDocument('receipt-test')
  Object.defineProperty(printed, 'fonts', { value: { ready: Promise.resolve() } })
  const print = vi.fn()
  vi.spyOn(window, 'open').mockReturnValue({ document: printed, print } as unknown as Window)
  await button(wrapper, '打印').trigger('click'); await flushPromises()
  for (const text of ['充电器', '钢化膜', '赠品', '原单未记录约定金额', '000SN1', '135.03']) expect(printed.body.textContent).toContain(text)
  const receipt = printed.body.querySelector('.sales-receipt.sales-receipt-theme')
  expect(receipt).not.toBeNull()
  expect(receipt?.querySelectorAll('.receipt-table')).toHaveLength(2)
  expect(print).toHaveBeenCalledOnce()
})

it('保存图片截取包含配件的当前凭证，成功后释放canvas及临时下载资源', async () => {
  mocks.get.mockResolvedValue({ success: true, data: [goods({ quantity: 1, total_price: 17.51, points_used: 249,
    deduction_amount: 2.49, serial_numbers: ['000SN2'] })] })
  const wrapper = await render()
  const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  const create = vi.fn(() => 'blob:isolated-receipt'), revoke = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1 })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'toBlob').mockImplementation(callback => callback(new Blob(['test'], { type: 'image/png' })))
  mocks.capture.mockResolvedValue(canvas)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    await button(wrapper, '保存图片').trigger('click'); await flushPromises()
    expect(mocks.capture).toHaveBeenCalledOnce()
    const content = mocks.capture.mock.calls[0][0] as HTMLElement
    for (const text of ['充电器', '1件配件', '000SN2', '117.52']) expect(content.textContent).toContain(text)
    expect(content.textContent).not.toContain('000SN1')
    expect(create).toHaveBeenCalledOnce(); expect(canvas.width).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(revoke).toHaveBeenCalledWith('blob:isolated-receipt')
    expect(document.querySelector('a[href="blob:isolated-receipt"]')).toBeNull()
  } finally {
    vi.useRealTimers()
    if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor)
    else Reflect.deleteProperty(URL, 'createObjectURL')
    if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor)
    else Reflect.deleteProperty(URL, 'revokeObjectURL')
  }
})
