<template>
  <MobileDialog
    v-model="open"
    :title="receipt ? '销售凭证' : '整单明细'"
    dialog-class="crud-dialog-lg"
    :show-default-footer="false"
    destroy-on-close
    append-to-body
  >
    <SectionLoading
      v-if="loading"
      text="正在核对整单成交明细..."
    />
    <DataEmptyState
      v-else-if="failed"
      state="error"
      title="整单明细读取失败"
      :description="failureMessage"
      action-text="重试"
      @action="load"
    />
    <div
      v-else-if="order"
      ref="documentRef"
      class="checkout-order-document"
    >
      <template v-if="receipt">
        <header class="checkout-receipt__header">
          <h2>销售凭证</h2>
          <div class="checkout-receipt__meta">
            <div
              v-for="field in receiptHeaderFields"
              :key="field.key"
            >
              <span class="text-secondary">{{ field.label }}</span><strong>{{ field.value }}</strong>
            </div>
          </div>
        </header>
        <article
          v-for="item in order.items"
          :key="item.id"
          class="checkout-receipt__item print-avoid-break"
        >
          <div class="checkout-receipt__line">
            <strong>{{ itemFields(item).find(field => field.key === 'name' && field.visible)?.value || '商品' }}</strong>
            <el-tag
              v-if="itemFields(item).some(field => field.key === 'sale_type' && field.visible)"
              :type="item.sale_type === 'gift' ? 'warning' : 'success'"
            >
              {{ item.sale_type === 'gift' ? '赠送' : '销售' }}
            </el-tag>
          </div>
          <p class="text-secondary">
            {{ receiptItemFields(item, ['brand_name', 'product_model', 'color_name', 'memory']).map(field => field.value).join(' · ') }}
          </p>
          <div
            v-for="field in receiptItemFields(item, ['sale_no', 'imei', 'serial_numbers', 'linked_phone_sale_no'])"
            :key="field.key"
            class="checkout-receipt__line"
          >
            <span class="text-secondary">{{ field.label }}</span><span>{{ field.value }}</span>
          </div>
          <div class="checkout-receipt__figures">
            <div
              v-for="field in receiptItemFields(item, ['quantity', 'unit', 'unit_price', 'total_amount', 'points_used', 'deduction_amount', 'points_awarded'])"
              :key="field.key"
            >
              <span class="text-secondary">{{ field.label }}</span><strong>{{ field.value }}</strong>
            </div>
          </div>
          <p
            v-for="field in receiptItemFields(item, ['gift_return_agreement'])"
            :key="field.key"
            class="text-secondary"
          >
            {{ field.value }}
          </p>
        </article>
        <footer class="checkout-receipt__totals">
          <div
            v-for="field in receiptTotalFields"
            :key="field.key"
            class="checkout-receipt__line"
          >
            <span>{{ field.label }}</span><strong>{{ field.value }}</strong>
          </div>
          <p
            v-for="field in headerFields.filter(field => field.key === 'remarks' && field.visible && field.value !== '-')"
            :key="field.key"
          >
            备注：{{ field.value }}
          </p>
        </footer>
      </template>
      <template v-else>
        <p>以下为本次结算的原成交记录，退换货及后续退款请查看售后历史。</p>
        <RecordDescriptions
          :column="3"
          border
        >
          <el-descriptions-item
            v-for="field in headerFields.filter(item => item.visible)"
            :key="field.key"
            :label="field.label"
            :span="field.wide ? 3 : 1"
          >
            {{ field.value }}
          </el-descriptions-item>
        </RecordDescriptions>
        <section
          v-for="item in order.items"
          :key="item.id"
        >
          <h3>{{ item.item_type === 'phone' ? '手机' : '配件商品' }}</h3>
          <RecordDescriptions
            :column="3"
            border
          >
            <el-descriptions-item
              v-for="field in itemFields(item).filter(entry => entry.visible)"
              :key="field.key"
              :label="field.label"
              :span="field.wide ? 3 : 1"
            >
              {{ field.value }}
            </el-descriptions-item>
          </RecordDescriptions>
        </section>
      </template>
    </div>
    <template
      v-if="receipt"
      #footer
    >
      <div class="tf-dialog-actions">
        <el-button @click="open = false">
          关闭
        </el-button>
        <el-button
          v-permission="{ permission: ['query:view', 'query:goods-view'], mode: 'all' }"
          type="primary"
          :disabled="loading || failed || !order || !allowed"
          @click="printReceipt"
        >
          打印凭证
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { printElement } from '@/utils/print'
import { useNotification } from '@/composables/useNotification'
import { isCheckoutOrderDetail, giftReturnAgreementText } from '@/utils/query-goods'
import { getCheckoutOrder } from '@/api/query-goods'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canViewQueryGoodsField as goodsVisible } from '@/components/accessory-field-permissions'
import { formatAmount, formatDateTime } from '@/utils/format'
import { getRequestErrorMessage } from '@/utils/api-response'
import type { CheckoutOrderDetail, CheckoutOrderItem, CheckoutOrderSource } from '@/types/sales-checkout'
import type { ModelValueProps, UpdateModelValueEmits, RecordDetailField } from '@/types/component'

interface Props extends ModelValueProps { saleId: number; source: CheckoutOrderSource; receipt?: boolean }
const props = defineProps<Props>()
const emit = defineEmits<UpdateModelValueEmits>()
const query = usePagePermissions('query')
const allowed = computed(() => query.canView.value && query.hasPermission('goods-view'))
const open = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const requests = useLatestRequest()
const documentRef = ref<HTMLElement>()
const notices = useNotification()
const printReceipt = () => {
  if (!props.receipt || !open.value || !allowed.value || loading.value || failed.value || !order.value || !documentRef.value) return
  const printed = printElement(documentRef.value, '销售凭证', `
    @page { size: A4; margin: 12mm; }
    html, body { margin: 0; padding: 0; background: var(--tf-color-document-paper); }
    .checkout-order-document { color: var(--tf-color-slate-900); overflow: visible; }
  `)
  if (!printed) notices.warning('浏览器阻止了打印窗口，请允许弹出窗口后重试')
}
const order = ref<CheckoutOrderDetail | null>(null)
const loading = ref(false), failed = ref(false), failureMessage = ref('')
const phoneVisible = (field: string) => fieldPermissions.isFieldVisible('query_queryview', field)
const containsPhone = computed(() => order.value?.items.some(row => row.item_type === 'phone' || row.linked_phone_sale_no !== null) || false)
const text = (value: unknown) => value === null || value === undefined || value === '' ? '-' : String(value)
const money = (value: number | null | undefined) => value === null || value === undefined ? '-' : `¥${formatAmount(value)}`
const commonVisible = (goodsField: Parameters<typeof goodsVisible>[0], phoneField: string) =>
  goodsVisible(goodsField) && (!containsPhone.value || phoneVisible(phoneField))
const goodsMoneyVisible = () => (['usage_type', 'total_quantity', 'unit_price', 'total_price'] as const).every(goodsVisible)
const headerFields = computed<RecordDetailField[]>(() => {
  const row = order.value
  if (!row) return []
  const amounts = goodsMoneyVisible() && (!containsPhone.value || phoneVisible('basic_info.sale_price'))
  return [
    { key: 'order_no', label: props.receipt ? '销售单号' : '共同单号', value: text(row.order_no), wide: true, visible: goodsVisible('sequence') },
    { key: 'customer_name', label: '客户姓名', value: text(row.customer_name), visible: commonVisible('customer_name', 'customer_info.customer_name') },
    { key: 'customer_phone', label: '客户电话', value: text(row.customer_phone), visible: commonVisible('customer_phone', 'customer_info.customer_phone') },
    { key: 'store_name', label: '销售门店', value: text(row.store_name), visible: commonVisible('distribution', 'store_info.store_name') },
    { key: 'operator_name', label: '销售员', value: text(row.operator_name), visible: commonVisible('operator_name', 'operator_info.sale_operator') },
    { key: 'sale_time', label: '销售时间', value: row.sale_time ? formatDateTime(row.sale_time) : '-', wide: true, visible: commonVisible('created_at', 'time_info.sale_time') },
    { key: 'total_amount', label: '原单金额', value: money(row.total_amount), visible: amounts },
    { key: 'deduction_amount', label: '积分抵扣', value: money(row.deduction_amount), visible: amounts },
    { key: 'final_amount', label: props.receipt ? '实际收款' : '原成交净额', value: money(row.final_amount), visible: amounts },
    { key: 'paid_amount', label: '本单现金入账', value: money(row.paid_amount), visible: amounts },
    { key: 'points_used', label: '消耗积分', value: text(row.points_used), visible: amounts },
    { key: 'points_awarded', label: '获得积分', value: text(row.points_awarded), visible: amounts },
    { key: 'remarks', label: '整批备注', value: text(row.remarks), wide: true, visible: commonVisible('remarks', 'other_info.remarks') }
  ]
})
const itemFields = (row: CheckoutOrderItem): RecordDetailField[] => {
  const phone = row.item_type === 'phone'
  const visible = (goodsField: Parameters<typeof goodsVisible>[0], phoneField: string) => phone ? phoneVisible(phoneField) : goodsVisible(goodsField)
  const amounts = phone ? phoneVisible('basic_info.sale_price') : goodsMoneyVisible()
  return [
    { key: 'sale_no', label: '销售单号', value: text(row.sale_no), wide: true, visible: goodsVisible('sequence') },
    { key: 'name', label: phone ? '手机型号' : '商品名称', value: text(row.name), wide: true, visible: visible('name', 'basic_info.model') },
    { key: 'brand_name', label: '品牌', value: text(row.brand_name), visible: visible('brand_name', 'basic_info.brand') },
    { key: 'product_model', label: '配件型号', value: text(row.product_model), visible: !phone && goodsVisible('product_model') },
    { key: 'color_name', label: '颜色', value: text(row.color_name), visible: visible('color_name', 'basic_info.color') },
    { key: 'memory', label: '内存', value: text(row.memory), visible: phone && phoneVisible('basic_info.memory') },
    { key: 'imei', label: 'IMEI', value: text(row.imei), wide: true, visible: phone && phoneVisible('basic_info.imei') },
    { key: 'serial_numbers', label: '原出库SN', value: row.serial_numbers?.join('、') || '-', wide: true, visible: visible('serial_number', 'basic_info.serial_number') },
    { key: 'linked_phone_sale_no', label: '关联手机单号', value: text(row.linked_phone_sale_no), wide: true, visible: !phone && goodsVisible('sequence') },
    { key: 'sale_type', label: '购买 / 赠送', value: row.sale_type === null ? '-' : row.sale_type === 'gift' ? '赠送' : '购买', visible: phone || goodsVisible('usage_type') },
    { key: 'quantity', label: '数量', value: text(row.quantity), visible: phone || goodsVisible('total_quantity') && goodsVisible('usage_type') },
    { key: 'unit', label: '单位', value: text(row.unit), visible: phone || goodsVisible('unit') },
    { key: 'unit_price', label: props.receipt ? '销售价' : '原单价', value: money(row.unit_price), visible: amounts },
    { key: 'gross_amount', label: '原单金额', value: money(row.gross_amount), visible: amounts },
    { key: 'deduction_amount', label: '积分抵扣', value: money(row.deduction_amount), visible: amounts },
    { key: 'total_amount', label: props.receipt ? '实收小计' : '原成交净额', value: money(row.total_amount), visible: amounts },
    { key: 'points_used', label: '消耗积分', value: text(row.points_used), visible: amounts },
    { key: 'points_awarded', label: '获得积分', value: text(row.points_awarded), visible: amounts },
    { key: 'gift_return_agreement', label: '赠品未退约定', value: giftReturnAgreementText(row), wide: true,
      visible: !phone && amounts && row.sale_type === 'gift' && row.gift_agreement_state !== null }
  ]
}
const receiptHeaderFields = computed(() => headerFields.value.filter(field => field.visible && ['order_no', 'store_name', 'sale_time', 'customer_name', 'customer_phone', 'operator_name'].includes(field.key)))
const receiptTotalFields = computed(() => headerFields.value.filter(field => field.visible && ['total_amount', 'deduction_amount', 'final_amount', 'points_used', 'points_awarded'].includes(field.key)))
const receiptItemFields = (row: CheckoutOrderItem, keys: string[]) => itemFields(row).filter(field => field.visible && keys.includes(field.key) && field.value !== '-' && !(['points_used', 'points_awarded', 'deduction_amount'].includes(field.key) && (field.value === '0' || field.value === '¥0')))
async function load() {
  requests.cancelLatest(); order.value = null; loading.value = false; failed.value = false
  if (!open.value || !allowed.value) return
  const request = requests.nextRequest(); loading.value = true
  try {
    const result = await getCheckoutOrder(props.source, props.saleId, request.signal)
    if (!request.isLatest()) return
    if (!result.success || !isCheckoutOrderDetail(result.data)) throw new Error('原单响应不完整，请重试')
    order.value = result.data
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) {
      failed.value = true; failureMessage.value = getRequestErrorMessage(error, '整单明细读取失败，请重试')
    }
  } finally { if (request.isLatest()) loading.value = false }
}
watch(() => [props.modelValue, props.saleId, props.source, allowed.value,
  JSON.stringify(fieldPermissions.getHiddenFields('query_queryview')),
  JSON.stringify(fieldPermissions.getHiddenFields('query_goods'))], load, { immediate: true })
</script>

<style scoped>
.checkout-order-document { min-width: 0; overflow-wrap: anywhere; }
.checkout-order-document h2 { text-align: center; margin-bottom: var(--tf-space-5); }
.checkout-order-document section { margin-top: var(--tf-space-4); }
.checkout-receipt__header { padding-bottom: var(--tf-space-4); border-bottom: 1px dashed var(--tf-color-border-cool); }
.checkout-receipt__meta, .checkout-receipt__figures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tf-space-3); }
.checkout-receipt__figures { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.checkout-receipt__meta > div, .checkout-receipt__figures > div { display: grid; gap: var(--tf-space-1); min-width: 0; }
.checkout-receipt__item { padding: var(--tf-space-4) 0; border-bottom: 1px dashed var(--tf-color-border-cool); }
.checkout-receipt__line { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--tf-space-3); margin-bottom: var(--tf-space-2); }
.checkout-receipt__line > :first-child { flex-shrink: 0; }
.checkout-receipt__line > :last-child { min-width: 0; text-align: right; overflow-wrap: anywhere; }
.checkout-receipt__line > strong:first-child { min-width: 0; flex-shrink: 1; }
.checkout-receipt__totals { display: grid; gap: var(--tf-space-2); padding-top: var(--tf-space-4); }
@media (max-width: 767px) {
  .checkout-receipt__figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
