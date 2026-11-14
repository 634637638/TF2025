<template>
  <MobileDialog
    v-model="open"
    title="整单明细"
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
    <template v-else-if="order">
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
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isCheckoutOrderDetail } from '@/utils/query-goods'
import { getCheckoutOrder } from '@/api/query-goods'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canViewAccessoryField as goodsVisible } from '@/components/accessory-field-permissions'
import { formatAmount, formatDateTime } from '@/utils/format'
import { getRequestErrorMessage } from '@/utils/api-response'
import type { CheckoutOrderDetail, CheckoutOrderItem, CheckoutOrderSource } from '@/types/sales-checkout'
import type { ModelValueProps, UpdateModelValueEmits, RecordDetailField } from '@/types/component'

interface Props extends ModelValueProps { saleId: number; source: CheckoutOrderSource }
const props = defineProps<Props>()
const emit = defineEmits<UpdateModelValueEmits>()
const query = usePagePermissions('query'), goods = usePagePermissions('accessories')
const allowed = computed(() => query.canView.value && goods.canView.value)
const open = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const requests = useLatestRequest()
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
    { key: 'order_no', label: '共同单号', value: text(row.order_no), wide: true, visible: goodsVisible('sequence') },
    { key: 'customer_name', label: '客户姓名', value: text(row.customer_name), visible: commonVisible('customer_name', 'customer_info.customer_name') },
    { key: 'customer_phone', label: '客户电话', value: text(row.customer_phone), visible: commonVisible('customer_phone', 'customer_info.customer_phone') },
    { key: 'store_name', label: '销售门店', value: text(row.store_name), visible: commonVisible('distribution', 'store_info.store_name') },
    { key: 'operator_name', label: '销售员', value: text(row.operator_name), visible: commonVisible('operator_name', 'operator_info.sale_operator') },
    { key: 'sale_time', label: '销售时间', value: row.sale_time ? formatDateTime(row.sale_time) : '-', wide: true, visible: commonVisible('created_at', 'time_info.sale_time') },
    { key: 'total_amount', label: '原单金额', value: money(row.total_amount), visible: amounts },
    { key: 'deduction_amount', label: '积分抵扣', value: money(row.deduction_amount), visible: amounts },
    { key: 'final_amount', label: '原成交净额', value: money(row.final_amount), visible: amounts },
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
    { key: 'unit_price', label: '原单价', value: money(row.unit_price), visible: amounts },
    { key: 'gross_amount', label: '原单金额', value: money(row.gross_amount), visible: amounts },
    { key: 'deduction_amount', label: '积分抵扣', value: money(row.deduction_amount), visible: amounts },
    { key: 'total_amount', label: '原成交净额', value: money(row.total_amount), visible: amounts },
    { key: 'points_used', label: '消耗积分', value: text(row.points_used), visible: amounts },
    { key: 'points_awarded', label: '获得积分', value: text(row.points_awarded), visible: amounts }
  ]
}
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
  JSON.stringify(fieldPermissions.getHiddenFields('accessories_accessoriesview'))], load, { immediate: true })
</script>
