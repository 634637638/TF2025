<template>
  <section v-if="allowed">
    <el-divider
      v-if="!filmOnly"
      content-position="left"
    >
      {{ filmOnly ? '贴膜记录' : '商品购买 / 赠送记录' }}
    </el-divider>
    <SectionLoading
      v-if="loading && !rows.length"
      :text="filmOnly ? '正在查询客户贴膜记录...' : '正在查询客户商品记录...'"
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
      :description="emptyDescription"
    />
    <div
      v-else
      v-tf-loading="{ active: loading, text: '正在刷新客户商品记录...' }"
      class="table-scroll-container"
    >
      <el-table
        v-table-double-tap="{ enabled: compact, getRowKey: getGoodsTapRowKey, onDoubleTap: handleGoodsDoubleTap }"
        :data="rows"
        class="data-table admin-data-table"
        row-key="id"
        table-layout="auto"
        @row-dblclick="openDetail"
      >
        <el-table-column
          v-if="visible('name')"
          prop="name"
          label="商品名称"
          :min-width="nameColumnWidth"
          align="center"
        >
          <template #default="{ row }">
            {{ text(row.name) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('category')"
          prop="category"
          label="类型"
          :min-width="categoryColumnWidth"
          align="center"
        >
          <template #default="{ row }">
            {{ text(row.category) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('usage_type')"
          prop="sale_type"
          label="购买 / 赠送"
          :min-width="saleTypeColumnWidth"
          align="center"
        >
          <template #default="{ row }">
            <span
              class="status-badge"
              :class="row.sale_type === 'gift' ? 'status-warning' : row.sale_type === 'sale' ? 'status-success' : 'status-disabled'"
            >
              {{ saleTypeText(row.sale_type) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('total_quantity') && visible('usage_type')"
          prop="quantity"
          label="数量"
          :min-width="quantityColumnWidth"
          align="center"
        >
          <template #default="{ row }">
            {{ text(row.quantity) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="amountsVisible()"
          prop="total_price"
          label="金额"
          :min-width="amountColumnWidth"
          align="center"
        >
          <template #default="{ row }">
            {{ money(row.total_price) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('distribution')"
          prop="store_name"
          label="门店"
          :min-width="storeColumnWidth"
          align="center"
        >
          <template #default="{ row }">
            {{ text(row.store_name) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visible('created_at')"
          prop="sale_time"
          label="时间"
          :min-width="dateColumnWidth"
          align="center"
        >
          <template #default="{ row }">
            {{ formatDate(row.sale_time) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          class-name="actions-column"
          :width="goodsActionColumnWidth"
          align="center"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                v-permission="{ permission: ['customers:view', 'query:view', 'query:goods-view'], mode: 'all' }"
                @click.stop="openDetail(row)"
              >
                明细
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <DataEmptyState
            :description="emptyDescription"
            size="compact"
          />
        </template>
      </el-table>
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
      :model-value="detailVisible"
      title="客户商品记录详情"
      dialog-class="record-detail-dialog crud-dialog-lg"
      :desktop-columns="4"
      :tablet-columns="3"
      :record="detailRow"
      :fields="detailRow ? fields(detailRow) : []"
      :has-actions="Boolean(detailRow?.has_order)"
      @update:model-value="setDetailVisible"
    >
      <template #field="{ field }">
        <strong v-if="field.key === 'name'">{{ detailValue(field.value) }}</strong>
        <span
          v-else-if="field.key === 'sale_type'"
          class="status-badge"
          :class="detailRow?.sale_type === 'gift' ? 'status-warning' : 'status-success'"
        >
          {{ detailValue(field.value) }}
        </span>
        <el-text
          v-else-if="accentDetailFields.has(field.key)"
          type="primary"
        >
          {{ detailValue(field.value) }}
        </el-text>
        <template v-else>
          {{ detailValue(field.value) }}
        </template>
      </template>
      <p v-if="detailRow && !detailRow.has_snapshot">
        历史记录未保存商品快照，商品资料可能为当前档案。
      </p>
      <template #actions>
        <el-button
          v-permission="{ permission: ['customers:view', 'query:view', 'query:goods-view'], mode: 'all' }"
          type="primary"
          @click.stop="openOrderFromDetail"
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
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { canViewQueryGoodsField as visible } from '@/components/accessory-field-permissions'
import { formatAmount, formatDate, formatDateTime } from '@/utils/format'
import { getActionColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { getRequestErrorMessage } from '@/utils/api-response'
import { isCustomerGoodsPage } from '@/utils/query-goods'
import type { CustomerGoodsRecord } from '@/types/accessory'
import type { RecordDetailField } from '@/types/component'

const CheckoutOrderDialog = defineAsyncComponent(() => import('@/components/query/CheckoutOrderDialog.vue'))
const props = defineProps<{ customerId: number; active: boolean; filmOnly?: boolean }>()
const customer = usePagePermissions('customers'), query = usePagePermissions('query')
const allowed = computed(() => props.active && customer.canView.value && query.canView.value && query.hasPermission('goods-view') &&
  visible('customer_name') && visible('customer_phone'))
const rows = ref<CustomerGoodsRecord[]>([]), page = ref(1), pageSize = ref(10), total = ref(0)
const loading = ref(false), failed = ref(false), failureMessage = ref('')
const { isMobile, isTablet } = useMobile()
const compact = computed(() => isMobile.value || isTablet.value)
const emptyDescription = computed(() => props.filmOnly ? '授权门店内暂无贴膜购买或赠送记录' : '授权门店内暂无商品购买或赠送记录')
const detailRow = ref<CustomerGoodsRecord | null>(null), detailVisible = ref(false)
const orderSaleId = ref<number | null>(null), orderOpen = ref(false)
const text = (value: unknown) => value === null || value === undefined || value === '' ? '-' : String(value)
const money = (value: number | string | null) => value === null ? '-' : `¥${formatAmount(value)}`
const saleTypeText = (value: CustomerGoodsRecord['sale_type']) => value === 'gift' ? '赠送' : value === 'sale' ? '购买' : '-'
const detailValue = (value: RecordDetailField['value']) => value === null || value === undefined || value === '' ? '-' : value
const accentDetailFields = new Set(['sale_no', 'remaining_quantity', 'unit_price', 'total_price', 'deduction_amount', 'points_used'])
const goodsActionColumnWidth = computed(() => getActionColumnMinWidth(['明细']))
const nameColumnWidth = computed(() => getTextColumnMinWidth(['商品名称', ...rows.value.map(row => text(row.name))], { minWidth: 0 }))
const categoryColumnWidth = computed(() => getTextColumnMinWidth(['类型', ...rows.value.map(row => text(row.category))], { minWidth: 0 }))
const saleTypeColumnWidth = computed(() => getTextColumnMinWidth(['购买 / 赠送', ...rows.value.map(row => saleTypeText(row.sale_type))], { minWidth: 0 }))
const quantityColumnWidth = computed(() => getTextColumnMinWidth(['数量', ...rows.value.map(row => text(row.quantity))], { minWidth: 0 }))
const amountColumnWidth = computed(() => getTextColumnMinWidth(['金额', ...rows.value.map(row => money(row.total_price))], { minWidth: 0 }))
const storeColumnWidth = computed(() => getTextColumnMinWidth(['门店', ...rows.value.map(row => text(row.store_name))], { minWidth: 0 }))
const dateColumnWidth = computed(() => getTextColumnMinWidth(['时间', ...rows.value.map(row => formatDate(row.sale_time))], { minWidth: 0 }))
const requests = useLatestRequest()
const amountsVisible = () => (['usage_type', 'total_quantity', 'unit_price', 'total_price'] as const).every(visible)
const fields = (row: CustomerGoodsRecord): RecordDetailField[] => [
  { key: 'sale_no', label: '销售单号', value: text(row.sale_no), wide: true, visible: visible('sequence') },
  { key: 'name', label: '商品名称', value: text(row.name), desktopColumnSpan: 3, visible: visible('name') },
  { key: 'sale_type', label: '购买 / 赠送', value: saleTypeText(row.sale_type), visible: visible('usage_type') },
  { key: 'category', label: '商品类型', value: text(row.category), visible: visible('category') },
  { key: 'brand_name', label: '品牌', value: text(row.brand_name), visible: visible('brand_name') },
  { key: 'product_model', label: '配件型号', value: text(row.product_model), visible: visible('product_model') },
  { key: 'color_name', label: '颜色', value: text(row.color_name), visible: visible('color_name') },
  { key: 'unit', label: '单位', value: text(row.unit), visible: visible('unit') },
  { key: 'quantity', label: '原数量', value: text(row.quantity), visible: visible('total_quantity') && visible('usage_type') },
  { key: 'returned_quantity', label: '已退数量', value: text(row.returned_quantity), visible: visible('total_quantity') && visible('usage_type') },
  { key: 'remaining_quantity', label: '未退数量', value: text(row.remaining_quantity), visible: visible('total_quantity') && visible('usage_type') },
  { key: 'unit_price', label: '原单价', value: money(row.unit_price), section: '金额与积分', visible: amountsVisible() },
  { key: 'total_price', label: '原成交净额', value: money(row.total_price), section: '金额与积分', visible: amountsVisible() },
  { key: 'deduction_amount', label: '积分抵扣', value: money(row.deduction_amount), section: '金额与积分', visible: amountsVisible() },
  { key: 'points_used', label: '消耗积分', value: text(row.points_used), section: '金额与积分', visible: amountsVisible() },
  { key: 'points_awarded', label: '获得积分', value: text(row.points_awarded), section: '金额与积分', visible: amountsVisible() },
  { key: 'store_name', label: '销售门店', value: text(row.store_name), section: '金额与积分', visible: visible('distribution') },
  { key: 'operator_name', label: '销售员', value: text(row.operator_name), section: '金额与积分', visible: visible('operator_name') },
  { key: 'sale_time', label: '销售时间', value: row.sale_time ? formatDateTime(row.sale_time) : '-', section: '金额与积分', visible: visible('created_at') },
  { key: 'linked_phone_invoice', label: '关联手机单号', value: text(row.linked_phone_invoice), section: '关联信息', desktopColumnSpan: 2, visible: visible('sequence') },
  { key: 'remarks', label: '原销售备注', value: text(row.remarks), section: '关联信息', desktopColumnSpan: 2, visible: visible('remarks') }
]
function openOrder(row: CustomerGoodsRecord) {
  if (!allowed.value || !row.has_order) return
  orderSaleId.value = row.id; orderOpen.value = true
}
function openDetail(row: CustomerGoodsRecord) {
  detailRow.value = row
  detailVisible.value = true
}
function getGoodsTapRowKey(index: number) {
  return rows.value[index]?.id
}
function handleGoodsDoubleTap(index: number) {
  const row = rows.value[index]
  if (row) openDetail(row)
}
function setDetailVisible(value: boolean) {
  detailVisible.value = value
  if (!value) detailRow.value = null
}
function openOrderFromDetail() {
  const row = detailRow.value
  if (!row) return
  setDetailVisible(false)
  openOrder(row)
}
async function load() {
  if (!allowed.value) return
  const request = requests.nextRequest(); loading.value = true; failed.value = false
  const currentPage = page.value, currentSize = pageSize.value
  try {
    const result = await getCustomerGoodsHistory(props.customerId, currentPage, currentSize, request.signal, { filmOnly: props.filmOnly })
    if (!request.isLatest()) return
    if (!result.success || !isCustomerGoodsPage(result.data, currentPage, currentSize)) throw new Error('商品记录响应不完整，请重试')
    rows.value = result.data.data; total.value = result.data.pagination.total
  } catch (error) {
    if (request.isLatest() && !requests.isCanceledError(error)) {
      failed.value = true; failureMessage.value = getRequestErrorMessage(error, '读取客户商品记录失败，请重试')
    }
  } finally { if (request.isLatest()) loading.value = false }
}
function changePage(current: number, size: number) {
  setDetailVisible(false)
  page.value = size === pageSize.value ? current : 1
  pageSize.value = size
  load()
}
watch(() => [props.customerId, props.filmOnly, allowed.value, JSON.stringify(fieldPermissions.getHiddenFields('query_goods'))], () => {
  requests.cancelLatest(); rows.value = []; total.value = 0; page.value = 1; loading.value = false; failed.value = false
  setDetailVisible(false)
  orderOpen.value = false; orderSaleId.value = null
  load()
}, { immediate: true })
</script>
