import { computed, ref } from 'vue'
import { checkoutSale } from '@/api/sales-checkout'
import { useNotification } from '@/composables/useNotification'
import { buildCheckoutInput, checkoutPointsContext, createCheckoutKey, isCheckoutSubmissionRejected } from '@/utils/sales-checkout'
import { formatAmount } from '@/utils/format'
import type { CheckoutAdditionalGoodsDraft, CheckoutCustomerForm, CheckoutPhone, CheckoutQuickPhone, SalesCheckoutInput } from '@/types/sales-checkout'

/** 手机销售的附加商品仅保留本地草稿，只有外层销售确认调用submit才落账。 */
export const useAdditionalGoodsCheckout = () => {
  const selection = ref<CheckoutAdditionalGoodsDraft | null>(null)
  const saving = ref(false), uncertain = ref(false)
  const notices = useNotification()
  let pending: SalesCheckoutInput | null = null
  const locked = computed(() => saving.value || uncertain.value)
  const hasGoods = computed(() => Boolean(selection.value?.goods.length))
  const summary = computed(() => {
    const draft = selection.value
    if (!draft?.goods.length) return ''
    const count = draft.goods.reduce((sum, row) => sum + row.quantity, 0)
    const cents = draft.goods.reduce((sum, row) => sum + Math.round(Number(row.unit_price || 0) * 100) * row.quantity, 0)
    return `附加商品金额 ¥${formatAmount(cents / 100)} · ${count} 件商品 · 抵扣 ${draft.points_quote?.points_used || 0} 积分；点击最终确认后统一结算。`
  })
  const save = (draft: CheckoutAdditionalGoodsDraft | null) => {
    if (locked.value) return
    selection.value = draft
    pending = null
  }
  const reset = () => {
    if (saving.value) return
    selection.value = null; pending = null; uncertain.value = false
  }
  const submit = async (form: CheckoutCustomerForm, phones: CheckoutPhone[], quickPhone?: CheckoutQuickPhone, visible: (_field: string) => boolean = () => true) => {
    if (saving.value || !selection.value?.goods.length) return null
    saving.value = true
    try {
      const draft = selection.value
      if (Number(form.store_id) !== draft.store_id) throw new Error('销售门店已变化，请重新选择附加商品')
      const input = buildCheckoutInput(form, phones, draft.goods, pending?.request_key || createCheckoutKey(), quickPhone)
      if (!visible('remarks')) delete input.remarks
      if (!visible('transaction_no')) delete input.payment_info.transaction_no
      if (!visible('customer_apple_id')) delete input.customer_info.apple_id
      if (input.accessories.some(row => Number(row.redeem_points) > 0)) {
        if (!draft.points_quote || checkoutPointsContext(input) !== draft.points_context) throw new Error('积分抵扣依据已变化，请重新确认附加商品')
        input.payment_info.payment_amount = draft.points_quote.payable_cents / 100
      }
      if (uncertain.value && JSON.stringify(input) !== JSON.stringify(pending)) {
        notices.warning('提交结果尚未确认，请保留原内容重试，或先到综合查询核对单据')
        return null
      }
      pending = input
      const response = await checkoutSale(input)
      if (!response.success || !response.data) { uncertain.value = true; return null }
      uncertain.value = false; pending = null
      notices.success(`结算成功：${response.data.order_no}，抵扣${response.data.points_used || 0}积分，累计${response.data.points_earned}积分`)
      return response.data
    } catch (error) {
      if (pending) {
        if (!uncertain.value && isCheckoutSubmissionRejected(error)) pending = null
        else uncertain.value = true
      } else if (error instanceof Error) notices.error(error.message)
      return null
    } finally { saving.value = false }
  }
  return { selection, saving, uncertain, locked, hasGoods, summary, save, reset, submit }
}
