<template>
  <section v-if="allowed">
    <el-divider content-position="left">
      商品购买 / 赠送记录
    </el-divider>
    <p>仅展示有权查看门店的原成交记录，包含已退商品；手机购买记录另列。</p>
    <SectionLoading
      v-if="loading && !rows.length"
      text="正在查询客户商品记录..."
    />
    <DataEmptyState
      v-else-if="failed"
      state="error"
      title="商品记录读取失败"
      :description="failureMessage"
      action-text="重试"
      @action="load"
    />
    <DataEmptyState
      v-else-if="!rows.length"
      description="授权门店内暂无商品购买或赠送记录"
    />
    <div
      v-else
      v-tf-loading="{ active: loading, text: '正在刷新客户商品记录...' }"
      v-table-double-tap="doubleTapOptions"
    >
      <section
        v-for="row in rows"
        :key="row.id"
        data-mobile-record
        @dblclick="handleRowDoubleClick(row, null, $event)"
      >
        <RecordDescriptions
          :column="3"
          border
        >
          <el-descriptions-item
            v-for="field in fields(row).filter(item => item.visible)"
            :key="field.key"
            :label="field.label"
            :span="field.wide ? 3 : 1"
          >
            {{ field.value }}
          </el-descriptions-item>
        </RecordDescriptions>
        <p v-if="!row.has_snapshot">
          历史记录未保存商品快照，商品资料可能为当前档案。
        </p>
        <div
          v-if="!compact && row.has_order"
          class="tf-dialog-toolbar"
        >
          <el-button
            v-permission="{ permission: ['customers:view', 'query:view', 'accessories:view'], mode: 'all' }"
            @click.stop="openOrder(row)"
          >
            整单明细
          </el-button>
        </div>
        <el-divider />
      </section>
    </div>
    <Pagination
      v-if="!failed && total > 0"
      :current="page"
      :page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      size="small"
      :disabled="loading"
      @change="changePage"
    />
    <CheckoutOrderDialog
      v-if="orderSaleId !== null && allowed"
      v-model="orderOpen"
      :sale-id="orderSaleId"
      source="goods"
    />
    <RecordDetailDialog
      v-if="detailVisible && detailRow"
      v-model="detailVisible"
      title="客户商品记录详情"
      :record="detailRow"
      :fields="detailRow ? fields(detailRow) : []"
      :has-actions="Boolean(detailRow?.has_order)"
    >
      <p v-if="detailRow && !detailRow.has_snapshot">
        历史记录未保存商品快照，商品资料可能为当前档案。
      </p>
      <template #actions>
        <el-button
          v-permission="{ permission: ['customers:view', 'query:view', 'accessories:view'], mode: 'all' }"
          type="primary"
          @click.stop="runDetailAction(openOrder)"
        >
          整单明细
        </el-button>
      </template>
    </RecordDetailDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { getCustomerGoodsHistory } from '@/api/query-goods'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canViewAccessoryField as visible } from '@/components/accessory-field-permissions'
import { formatAmount, formatDateTime } from '@/utils/format'
import { getRequestErrorMessage } from '@/utils/api-response'
import { isCustomerGoodsPage } from '@/utils/query-goods'
import type { CustomerGoodsRecord } from '@/types/accessory'
import type { RecordDetailField } from '@/types/component'

const CheckoutOrderDialog = defineAsyncComponent(() => import('@/components/query/CheckoutOrderDialog.vue'))
const props = defineProps<{ customerId: number; active: boolean }>()
const customer = usePagePermissions('customers'), query = usePagePermissions('query'), goods = usePagePermissions('accessories')
const allowed = computed(() => props.active && customer.canView.value && query.canView.value && goods.canView.value &&
  visible('customer_name') && visible('customer_phone'))
const rows = ref<CustomerGoodsRecord[]>([]), page = ref(1), pageSize = ref(10), total = ref(0)
const loading = ref(false), failed = ref(false), failureMessage = ref('')
const { isMobile, isTablet } = useMobile()
const compact = computed(() => isMobile.value || isTablet.value)
const { detailRow, detailVisible, doubleTapOptions, handleRowDoubleClick, runDetailAction, closeDetail } = useMobileTableDetail({
  enabled: () => compact.value && allowed.value && !loading.value && !failed.value,
  rows, getKey: row => row.id, rowSelector: '[data-mobile-record]'
})
const orderSaleId = ref<number | null>(null), orderOpen = ref(false)
const requests = useLatestRequest()
const text = (value: unknown) => value === null || value === undefined || value === '' ? '-' : String(value)
const money = (value: number | string | null) => value === null ? '-' : `¥${formatAmount(value)}`
const amountsVisible = () => (['usage_type', 'total_quantity', 'unit_price', 'total_price'] as const).every(visible)
const fields = (row: CustomerGoodsRecord): RecordDetailField[] => [
  { key: 'sale_no', label: '销售单号', value: text(row.sale_no), wide: true, visible: visible('sequence') },
  { key: 'name', label: '商品名称', value: text(row.name), wide: true, visible: visible('name') },
  { key: 'category', label: '商品类型', value: text(row.category), visible: visible('category') },
  { key: 'brand_name', label: '品牌', value: text(row.brand_name), visible: visible('brand_name') },
  { key: 'product_model', label: '配件型号', value: text(row.product_model), visible: visible('product_model') },
  { key: 'color_name', label: '颜色', value: text(row.color_name), visible: visible('color_name') },
  { key: 'unit', label: '单位', value: text(row.unit), visible: visible('unit') },
  { key: 'sale_type', label: '购买 / 赠送', value: row.sale_type === null ? '-' : row.sale_type === 'gift' ? '赠送' : '购买', visible: visible('usage_type') },
  { key: 'quantity', label: '原数量', value: text(row.quantity), visible: visible('total_quantity') && visible('usage_type') },
  { key: 'returned_quantity', label: '已退数量', value: text(row.returned_quantity), visible: visible('total_quantity') && visible('usage_type') },
  { key: 'remaining_quantity', label: '未退数量', value: text(row.remaining_quantity), visible: visible('total_quantity') && visible('usage_type') },
  { key: 'unit_price', label: '原单价', value: money(row.unit_price), visible: amountsVisible() },
  { key: 'total_price', label: '原成交净额', value: money(row.total_price), visible: amountsVisible() },
  { key: 'deduction_amount', label: '积分抵扣', value: money(row.deduction_amount), visible: amountsVisible() },
  { key: 'points_used', label: '消耗积分', value: text(row.points_used), visible: amountsVisible() },
  { key: 'points_awarded', label: '获得积分', value: text(row.points_awarded), visible: amountsVisible() },
  { key: 'store_name', label: '销售门店', value: text(row.store_name), visible: visible('distribution') },
  { key: 'operator_name', label: '销售员', value: text(row.operator_name), visible: visible('operator_name') },
  { key: 'sale_time', label: '销售时间', value: row.sale_time ? formatDateTime(row.sale_time) : '-', wide: true, visible: visible('created_at') },
  { key: 'linked_phone_invoice', label: '关联手机单号', value: text(row.linked_phone_invoice), wide: true, visible: visible('sequence') },
  { key: 'remarks', label: '原销售备注', value: text(row.remarks), wide: true, visible: visible('remarks') }
]
function openOrder(row: CustomerGoodsRecord) {
  if (!allowed.value || !row.has_order) return
  orderSaleId.value = row.id; orderOpen.value = true
}
async function load() {
  if (!allowed.value) return
  const request = requests.nextRequest(); loading.value = true; failed.value = false
  const currentPage = page.value, currentSize = pageSize.value
  try {
    const result = await getCustomerGoodsHistory(props.customerId, currentPage, currentSize, request.signal)
    if (!request.isLatest()) return
    if (!result.success || !isCustomerGoodsPage(result.data, currentPage, currentSize)) throw new Error('商品记录响应不完整，请重试')
    rows.value = result.data.data; total.value = result.data.pagination.total
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) {
      failed.value = true; failureMessage.value = getRequestErrorMessage(error, '读取客户商品记录失败，请重试')
    }
  } finally { if (request.isLatest()) loading.value = false }
}
function changePage(current: number, size: number) { page.value = size === pageSize.value ? current : 1; pageSize.value = size; load() }
watch(() => [props.customerId, allowed.value, JSON.stringify(fieldPermissions.getHiddenFields('accessories_accessoriesview'))], () => {
  requests.cancelLatest(); rows.value = []; total.value = 0; page.value = 1; loading.value = false; failed.value = false
  closeDetail(); detailRow.value = null
  orderOpen.value = false; orderSaleId.value = null
  load()
}, { immediate: true })
</script>
