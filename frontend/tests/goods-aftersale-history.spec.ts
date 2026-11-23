import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import History from '@/views/query/page/GoodsAftersaleHistory.vue'
import { isGoodsAftersalesPage } from '@/utils/query-goods'
import type { GoodsAftersaleRecord } from '@/types/accessory'

const mocks = vi.hoisted(() => ({ get: vi.fn(), hidden: new Set<string>() }))
const canQuery = ref(true), canGoods = ref(true)
vi.mock('@/utils/unified-api', () => ({ unifiedApi: mocks }))
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: (module: string) => ({ canView: computed(() => module === 'query' ? canQuery.value : canGoods.value), hasPermission: (action: string) => action === 'goods-view' && canGoods.value }) }))
vi.mock('@/composables/useFieldPermissions', () => ({ fieldPermissions: { isFieldVisible: (_module: string, field: string) => !mocks.hidden.has(field) } }))

const row = (extra: Partial<GoodsAftersaleRecord> = {}): GoodsAftersaleRecord => ({ id: 31, quantity: 1, serial_numbers: ['ORIGINAL-SN'],
  operation_type: 'goods_return', replacement: null, replacement_amount: 0, additional_amount: 0, exchange_credit_amount: 0,
  gift_charge_quantity: 0, gift_charge_amount: 0,
  return_reason: '质量问题', base_refund_amount: 10, points_recovery_amount: 0.3, points_compensation_amount: 0,
  refund_amount: 9.7, collection_amount: 0, settlement_offset_amount: 0, points_delta: -2, points_award_returned: 5, points_redemption_returned: 0,
  store_id: 2, store_name: '原单退货接收店', operator_id: 7, operator_name: '办理员', settlement_method: 'mobile', settlement_channel: 'wechat',
  business_time: '2026-11-13 10:00:00', created_at: '2026-11-13 10:01:00', remarks: '独立售后备注', ...extra })
const result = (rows = [row()], total = rows.length, page = 1) => ({ data: { data: rows, pagination: {
  page, page_size: 20, total, total_pages: Math.ceil(total / 20), has_next: page < Math.ceil(total / 20), has_prev: page > 1
} } })
const Pagination = { props: ['current', 'total', 'pageSize'], emits: ['change'], template: '<button @click="$emit(\'change\', 2)">第二页</button>' }
const Empty = { props: ['state', 'title', 'description', 'actionText'], emits: ['action'], template: '<div class="empty" :data-state="state">{{ title }}{{ description }}<button v-if="actionText" @click="$emit(\'action\')">{{ actionText }}</button></div>' }
const wrappers: ReturnType<typeof mount>[] = []
const render = async (saleId = 51) => {
  const wrapper = mount(History, { props: { saleId }, global: { plugins: [ElementPlus],
    stubs: { Pagination, DataEmptyState: Empty, TableLoadingRow: { template: '<div class="loading">正在读取商品售后记录...</div>' } },
    mocks: { $getNumberColumnWidth: () => 80 }, directives: { 'tf-loading': {} } } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}
const deferred = () => {
  let resolve!: (value: ReturnType<typeof result>) => void
  const promise = new Promise<ReturnType<typeof result>>(done => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => {
  canQuery.value = canGoods.value = true
  mocks.hidden.clear()
  mocks.get.mockResolvedValue(result())
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.resetAllMocks() })

it('详情按原商品销售ID读取售后数量/SN/原资金及积分事实，使用公共支付和北京时间展示', async () => {
  const wrapper = await render()
  expect(mocks.get).toHaveBeenCalledWith('/query/goods/51/aftersales', expect.objectContaining({ params: { page: 1, page_size: 20 }, useCache: false, showLoading: false, showError: false }))
  expect(wrapper.text()).not.toContain('仅展示原销售门店与办理门店均在授权范围内的记录')
  expect(wrapper.findAll('th .cell').map(cell => cell.text())).toContain('办理人')
  expect(wrapper.text()).not.toContain('办理人（当前姓名）')
  for (const text of ['ORIGINAL-SN', '原单退货接收店', '办理员', '质量问题', '独立售后备注', '¥9.7', '¥0.3', '-2', '移动支付 / 微信', '2026-11-13 10:00', '2026-11-13 10:01']) expect(wrapper.text()).toContain(text)
  expect(wrapper.find('.table-number-badge').text()).toBe('1')
  expect(wrapper.findComponent(Pagination).props('total')).toBe(1)
})

it('服务端分页显示授权范围总数，第二页不复用首屏并保持序号', async () => {
  mocks.get.mockResolvedValueOnce(result(Array.from({ length: 20 }, (_, index) => row({ id: index + 1 })), 21))
  const wrapper = await render()
  mocks.get.mockResolvedValueOnce(result([row({ id: 21, remarks: '第二页售后' })], 21, 2))
  await wrapper.findComponent(Pagination).vm.$emit('change', 2); await flushPromises()
  expect(mocks.get).toHaveBeenLastCalledWith('/query/goods/51/aftersales', expect.objectContaining({ params: { page: 2, page_size: 20 } }))
  expect(wrapper.find('.table-number-badge').text()).toBe('21')
  expect(wrapper.text()).toContain('第二页售后')
  expect(wrapper.findComponent(Pagination).props('total')).toBe(21)
})

it('加载、正常空记录和未迁移错误分别展示，重试成功后解除错误态', async () => {
  const pending = deferred()
  mocks.get.mockReturnValueOnce(pending.promise)
  const wrapper = await render()
  expect(wrapper.find('.loading').exists()).toBe(true)
  expect(wrapper.text()).not.toContain('暂无商品售后记录')
  pending.resolve(result([], 0)); await flushPromises()
  expect(wrapper.text()).toContain('当前授权范围内暂无商品售后记录')
  mocks.get.mockRejectedValueOnce({ response: { status: 409, data: { code: 'CHECKOUT_RETURN_NOT_READY', message: '售后查询结构尚未就绪' } } })
  await wrapper.setProps({ saleId: 52 }); await flushPromises()
  expect(wrapper.find('.empty').attributes('data-state')).toBe('error')
  expect(wrapper.text()).toContain('售后查询结构尚未就绪')
  expect(wrapper.text()).not.toContain('暂无商品售后记录')
  mocks.get.mockResolvedValueOnce(result([row({ remarks: '重试成功' })]))
  await wrapper.find('.empty button').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('重试成功')
  expect(wrapper.text()).not.toContain('售后记录读取失败')
})

it('隐藏用途/数量/单价/总额任一时不展示资金、积分和方式渠道；脱敏空值不当作0', async () => {
  for (const field of ['basic_info.usage_type', 'stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price']) {
    mocks.hidden.clear(); mocks.hidden.add(field)
    mocks.get.mockResolvedValueOnce(result([row({ quantity: ['stock_info.total_quantity', 'basic_info.usage_type'].includes(field) ? null : 1,
      gift_charge_amount: null, replacement_amount: null, exchange_credit_amount: null, gift_charge_quantity: ['stock_info.total_quantity', 'basic_info.usage_type'].includes(field) ? null : 0,
      base_refund_amount: null, points_recovery_amount: null, points_compensation_amount: null, refund_amount: null, collection_amount: null, settlement_offset_amount: null,
      points_delta: null, points_award_returned: null, points_redemption_returned: null, settlement_method: null, settlement_channel: null })]))
    const wrapper = await render()
    for (const text of ['本商品归属退款', '本商品归属补款', '同单抵扣调整', '账户积分变化', '退款／补款方式', '¥0', '移动支付 / 微信']) expect(wrapper.text()).not.toContain(text)
    wrapper.unmount()
  }
})

it('SN/门店/办理人/原因备注及时间字段在历史表同样受限', async () => {
  for (const field of ['basic_info.serial_number', 'stock_info.distribution', 'operator_info.operator_name', 'other_info.remarks', 'time_info.created_at']) mocks.hidden.add(field)
  const wrapper = await render()
  for (const text of ['ORIGINAL-SN', '原单退货接收店', '办理员', '质量问题', '独立售后备注', '2026-11-13 10:00', '2026-11-13 10:01']) expect(wrapper.text()).not.toContain(text)
})

it('切换商品取消旧读取并重置分页，旧响应不能覆盖当前单据', async () => {
  const old = deferred()
  mocks.get.mockReturnValueOnce(old.promise)
  const wrapper = await render(), signal: AbortSignal = mocks.get.mock.calls[0][1].signal
  mocks.get.mockResolvedValueOnce(result([row({ remarks: '新单售后' })]))
  await wrapper.setProps({ saleId: 52 }); await flushPromises()
  expect(signal.aborted).toBe(true)
  old.resolve(result([row({ remarks: '旧单迟到结果' })])); await flushPromises()
  expect(wrapper.text()).toContain('新单售后')
  expect(wrapper.text()).not.toContain('旧单迟到结果')
})

it.each(['query', 'goods'])('撤销%s查看权限取消在途请求、清除敏感内容且不再读取', async module => {
  const pending = deferred()
  mocks.get.mockReturnValueOnce(pending.promise)
  const wrapper = await render(), signal: AbortSignal = mocks.get.mock.calls[0][1].signal
  if (module === 'query') canQuery.value = false
  else canGoods.value = false
  await flushPromises()
  expect(signal.aborted).toBe(true)
  pending.resolve(result()); await flushPromises()
  expect(wrapper.text()).toBe('')
  expect(mocks.get).toHaveBeenCalledTimes(1)
})

it('卸载时取消请求；异常分页和损坏金额显示错误，不能冒充无历史', async () => {
  const pending = deferred()
  mocks.get.mockReturnValueOnce(pending.promise)
  const wrapper = await render(), signal: AbortSignal = mocks.get.mock.calls[0][1].signal
  wrapper.unmount()
  expect(signal.aborted).toBe(true)
  pending.resolve(result()); await flushPromises()
  mocks.get.mockResolvedValueOnce(result([row({ refund_amount: 999 })]))
  const damaged = await render()
  expect(damaged.text()).toContain('售后记录读取失败')
  expect(damaged.text()).not.toContain('暂无商品售后记录')
})

it('响应守卫拒绝错页、重复主键、坏SN和非整数积分，允许字段脱敏与真实0元退货', () => {
  const valid = result().data
  expect(isGoodsAftersalesPage(valid, 1, 20)).toBe(true)
  expect(isGoodsAftersalesPage(valid, 2, 20)).toBe(false)
  for (const invalid of [result([row(), row()]).data, result([row({ serial_numbers: ['A', 'A'] })]).data, result([row({ points_delta: 1.5 })]).data,
    result([row({ refund_amount: null, base_refund_amount: undefined })]).data, { ...valid, pagination: { ...valid.pagination, total: 0 } }]) {
    expect(isGoodsAftersalesPage(invalid, 1, 20)).toBe(false)
  }
  expect(isGoodsAftersalesPage(result([row({ base_refund_amount: 0, points_recovery_amount: 0, refund_amount: 0, settlement_method: null, settlement_channel: null })]).data, 1, 20)).toBe(true)
})

it('同笔多明细只展示本商品归属金额，正负同单抵扣均清楚解释，不当作另一笔资金', async () => {
  mocks.get.mockResolvedValueOnce(result([row({ base_refund_amount: 100, points_recovery_amount: 0, refund_amount: 80,
    settlement_offset_amount: 20 }), row({ id: 32, base_refund_amount: 10, points_recovery_amount: 30,
    refund_amount: 0, settlement_offset_amount: -20 })]))
  const wrapper = await render()
  for (const text of ['本商品归属退款', '本商品归属补款', '同单抵扣调整', '¥80', '¥-20', '不是另一笔资金往来']) expect(wrapper.text()).toContain(text)
  expect(wrapper.find('.empty[data-state="error"]').exists()).toBe(false)
})

it('归属金额守卫拒绝抵扣调整不守恒、半脱敏、非法精度和溢出；全部隐藏不按0计算', () => {
  const valid = row({ base_refund_amount: 100, points_recovery_amount: 0, refund_amount: 80, settlement_offset_amount: 20 })
  expect(isGoodsAftersalesPage(result([valid]).data, 1, 20)).toBe(true)
  for (const invalid of [row({ settlement_offset_amount: 1 }), row({ settlement_offset_amount: 0.001 }),
    row({ settlement_offset_amount: Number.POSITIVE_INFINITY }), row({ settlement_offset_amount: null }), row({ points_delta: null }),
    row({ base_refund_amount: null }), row({ refund_amount: 0, collection_amount: 1 }),
    row({ base_refund_amount: Number.MAX_SAFE_INTEGER, refund_amount: Number.MAX_SAFE_INTEGER })]) {
    expect(isGoodsAftersalesPage(result([invalid]).data, 1, 20)).toBe(false)
  }
  const masked = row({ gift_charge_amount: null, replacement_amount: null, additional_amount: null, exchange_credit_amount: null, base_refund_amount: null, points_recovery_amount: null, points_compensation_amount: null,
    refund_amount: null, collection_amount: null, settlement_offset_amount: null, points_delta: null,
    points_award_returned: null, points_redemption_returned: null, settlement_method: null, settlement_channel: null })
  expect(isGoodsAftersalesPage(result([masked]).data, 1, 20)).toBe(true)
  expect(isGoodsAftersalesPage(result([{ ...masked, settlement_offset_amount: 20 }]).data, 1, 20)).toBe(false)
})

it('未退赠品扣款与实物返库分列展示，0件返库不伪装成已退，金额包含同单抵扣且守恒', async () => {
  const charged = row({ quantity: 0, serial_numbers: [], gift_charge_quantity: 2, gift_charge_amount: 10,
    base_refund_amount: 0, points_recovery_amount: 0, refund_amount: 0, settlement_offset_amount: -10,
    points_delta: 0, points_award_returned: 0 })
  expect(isGoodsAftersalesPage(result([charged]).data, 1, 20)).toBe(true)
  for (const invalid of [{ ...charged, gift_charge_quantity: 0 }, { ...charged, gift_charge_amount: 9 },
    { ...charged, gift_charge_amount: undefined }, { ...charged, quantity: -1 }]) {
    expect(isGoodsAftersalesPage(result([invalid]).data, 1, 20)).toBe(false)
  }
  mocks.get.mockResolvedValueOnce(result([charged]))
  const wrapper = await render()
  expect(wrapper.text()).toContain('未退赠品扣款数量')
  expect(wrapper.text()).toContain('未退赠品扣款')
  expect(wrapper.text()).toContain('¥10')
})

const exchange = () => row({ operation_type: 'goods_exchange', base_refund_amount: 20, points_recovery_amount: 0,
  refund_amount: 0, collection_amount: 30, replacement_amount: 50, additional_amount: 0, exchange_credit_amount: 20,
  replacement: { order_no: 'NEW-ORDER', sale_no: 'NEW-SALE', name: '新充电器', operator_name: '换货员示例', serial_numbers: ['NEW-SN'] } })

it('换货历史展示原件抵付、新件单号/SN/销售员和净补差，类型与手机联合退货区分', async () => {
  mocks.get.mockResolvedValueOnce(result([exchange(), row({ id: 32, operation_type: 'phone_return' })]))
  const wrapper = await render()
  for (const text of ['商品换货', '手机联合退货', 'NEW-ORDER', 'NEW-SALE', '新充电器', 'NEW-SN', '换货员示例',
    '新件净应付', '原件抵付新件', '¥20', '¥50', '¥30', '实际资金往来仅为退款或补款']) expect(wrapper.text()).toContain(text)
  expect(wrapper.find('.empty[data-state="error"]').exists()).toBe(false)
})

it('换货守卫拒绝丢失替换件/金额、重复SN、抵付错误及将新件全价误当补款', () => {
  const valid = exchange()
  expect(isGoodsAftersalesPage(result([valid]).data, 1, 20)).toBe(true)
  for (const invalid of [{ ...valid, replacement: null }, { ...valid, replacement_amount: undefined },
    { ...valid, replacement: { ...valid.replacement, serial_numbers: ['N', 'N'] } },
    { ...valid, exchange_credit_amount: 19 }, { ...valid, collection_amount: 50 },
    { ...valid, operation_type: 'goods_return' }, { ...valid, quantity: 0 }, { ...valid, operation_type: 'unknown' },
    { ...valid, operation_type: ['goods_exchange'] }]) {
    expect(isGoodsAftersalesPage(result([invalid as GoodsAftersaleRecord]).data, 1, 20)).toBe(false)
  }
})

it('换入资料遵守原单号/名称/SN/销售员权限，隐藏资金时不显示新件净额和抵付', async () => {
  for (const field of ['basic_info.sequence', 'basic_info.name', 'basic_info.serial_number', 'operator_info.operator_name', 'price_info.total_price']) mocks.hidden.add(field)
  const value = exchange()
  mocks.get.mockResolvedValueOnce(result([row({ ...value, replacement: { order_no: null, sale_no: null, name: null, serial_numbers: null, operator_name: null },
    base_refund_amount: null, points_recovery_amount: null, points_compensation_amount: null, gift_charge_amount: null,
    refund_amount: null, collection_amount: null, settlement_offset_amount: null, replacement_amount: null, additional_amount: null, exchange_credit_amount: null,
    points_delta: null, points_award_returned: null, points_redemption_returned: null, settlement_method: null, settlement_channel: null })]))
  const wrapper = await render()
  for (const text of ['NEW-ORDER', 'NEW-SALE', '新充电器', 'NEW-SN', '换货员示例', '新件净应付', '原件抵付新件', '¥0']) expect(wrapper.text()).not.toContain(text)
  expect(wrapper.find('.empty[data-state="error"]').exists()).toBe(false)
})
