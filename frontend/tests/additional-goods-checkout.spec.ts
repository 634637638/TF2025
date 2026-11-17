import { beforeEach, expect, it, vi } from 'vitest'
import { useAdditionalGoodsCheckout } from '@/composables/useAdditionalGoodsCheckout'
import { buildCheckoutInput, checkoutPointsContext } from '@/utils/sales-checkout'
import type { CheckoutAdditionalGoodsDraft, CheckoutCustomerForm, CheckoutPhone } from '@/types/sales-checkout'

const mocks = vi.hoisted(() => ({ checkout: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('@/api/sales-checkout', () => ({ checkoutSale: mocks.checkout }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
const form = (): CheckoutCustomerForm => ({ customer_name: '样本客户', customer_phone: '13900000001', store_id: 1, operator_id: 7, sale_time: '2026-11-13', payment_method: 'cash', payment_channel: '', transaction_no: '', remarks: '' })
const phones: CheckoutPhone[] = [{ phone_id: 12, sale_price: 100, label: '手机' }]
const draft = (): CheckoutAdditionalGoodsDraft => ({ store_id: 1, points_quote: null, points_context: '', goods: [{ key: 'one', option: { id: 2, name: '样本商品', brand_name: null, product_model: null, barcode: null, sale_price: 30, quantity: 3, serial_quantity: 0 }, quantity: 1, unit_price: 30, sale_type: 'sale', linked_phone_id: 12, serial_mode: false, serial_numbers: [], gift_return_unit_price: null }] })
beforeEach(() => { vi.clearAllMocks(); mocks.checkout.mockReset().mockResolvedValue({ success: true, data: { order_id: 1, order_no: 'SO-SAMPLE', points_used: 0, points_earned: 1 } }) })

it('保存及修改附加商品仅更新草稿，最终提交才一次发送手机和商品，并使用最终日期和备注', async () => {
  const state = useAdditionalGoodsCheckout()
  state.save(draft())
  expect(state.hasGoods.value).toBe(true)
  expect(mocks.checkout).not.toHaveBeenCalled()
  expect(mocks.success).not.toHaveBeenCalled()
  expect(state.summary.value).toContain('附加商品金额 ¥30')
  expect(state.summary.value).toContain('点击最终确认后统一结算')
  await state.submit({ ...form(), sale_time: '2026-11-14', remarks: '最终备注', operator_id: 8 }, phones)
  expect(mocks.checkout).toHaveBeenCalledOnce()
  expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ sale_time: '2026-11-14', remarks: '最终备注', operator_id: 8, phones: [{ phone_id: 12, sale_price: 100 }], accessories: [expect.objectContaining({ accessory_id: 2 })], payment_info: expect.objectContaining({ payment_amount: 130 }) }))
  state.reset()
  expect(state.hasGoods.value).toBe(false)
})

it('积分草稿允许外层完善日期，但客户或价格改变须重新核对，不按旧试算落账', async () => {
  const state = useAdditionalGoodsCheckout(), selected = draft()
  selected.goods[0].redeem_points = 10
  selected.points_quote = { available_points: 100, balance: 100, redemption_ready: true, points_per_yuan: 10, points_used: 10, points_awarded: 0, deduction_cents: 100, gross_cents: 13000, payable_cents: 12900, balance_after: 90, lines: [] }
  const quoted = buildCheckoutInput(form(), phones, selected.goods, 'a'.repeat(32))
  // 子弹窗自动分配积分时会重插该字段；相同内容不因JSON属性顺序不同失效。
  quoted.accessories = quoted.accessories.map(({ redeem_points, ...row }) => ({ ...row, redeem_points }))
  selected.points_context = checkoutPointsContext(quoted)
  state.save(selected)
  await state.submit({ ...form(), customer_phone: '13900000002' }, phones)
  expect(mocks.checkout).not.toHaveBeenCalled()
  expect(mocks.error).toHaveBeenCalledWith('积分抵扣依据已变化，请重新确认附加商品')
  await state.submit({ ...form(), store_id: 2 }, phones)
  expect(mocks.checkout).not.toHaveBeenCalled()
  await state.submit({ ...form(), sale_time: '2026-11-14' }, phones)
  expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ payment_info: expect.objectContaining({ payment_amount: 129 }), accessories: [expect.objectContaining({ redeem_points: 10 })] }))
})

it('结果未知保留原请求键及载荷，禁止改稿，重试成功后解除冻结', async () => {
  const state = useAdditionalGoodsCheckout(); state.save(draft())
  mocks.checkout.mockRejectedValueOnce(new Error('network'))
  await state.submit(form(), phones)
  const original = mocks.checkout.mock.calls[0][0]
  expect(state.uncertain.value).toBe(true)
  state.save(null)
  expect(state.hasGoods.value).toBe(true)
  await state.submit({ ...form(), remarks: '不得悄悄改稿' }, phones)
  expect(mocks.checkout).toHaveBeenCalledOnce()
  await state.submit(form(), phones)
  expect(mocks.checkout.mock.calls[1][0]).toEqual(original)
  expect(state.locked.value).toBe(false)
})

it('提交期间防重，明确回滚拒绝后允许修改草稿重试', async () => {
  const state = useAdditionalGoodsCheckout(); state.save(draft())
  let reject!: (value: unknown) => void
  mocks.checkout.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  const pending = state.submit(form(), phones)
  await state.submit(form(), phones)
  expect(mocks.checkout).toHaveBeenCalledOnce()
  reject({ response: { status: 400, data: { success: false, code: 'CHECKOUT_INVALID' } } })
  await pending
  expect(state.uncertain.value).toBe(false)
  const changed = draft(); changed.goods[0].quantity = 2; state.save(changed)
  await state.submit(form(), phones)
  expect(mocks.checkout.mock.calls[1][0].accessories[0].quantity).toBe(2)
})

it('收费或赠送库存均可提交，备注只作为普通整单备注', async () => {
  const state = useAdditionalGoodsCheckout()
  state.save({ ...draft(), goods: [{ ...draft().goods[0], sale_type: 'gift' }] })
  await state.submit(form(), phones)
  expect(state.uncertain.value).toBe(false)
  expect(state.locked.value).toBe(false)
  expect(mocks.checkout).toHaveBeenCalledOnce()
  expect(mocks.checkout.mock.calls[0][0].remarks).toBe('')
})
