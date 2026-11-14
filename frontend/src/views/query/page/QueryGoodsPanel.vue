<template>
  <div class="admin-page-content">
    <UnifiedSearchPanel
      v-model:expanded="expanded"
      :loading="loading"
      @search="search"
      @reset="reset"
    >
      <template #primary>
        <el-input
          v-model="keyword"
          placeholder="搜索商品、单号、SN或客户"
          clearable
          aria-label="商品销售关键词"
          @keyup.enter="search"
          @clear="search"
        />
      </template>
      <div
        v-if="visible('usage_type')"
        class="form-group filter-item"
      >
        <el-select
          v-model="saleType"
          placeholder="销售 / 赠送"
          clearable
          aria-label="出库类型"
          @change="search"
        >
          <el-option
            label="销售"
            value="sale"
          />
          <el-option
            label="赠送"
            value="gift"
          />
        </el-select>
      </div>
      <div
        v-if="visible('distribution')"
        class="form-group filter-item"
      >
        <el-select
          v-model="storeId"
          filterable
          clearable
          placeholder="销售门店"
          aria-label="销售门店"
          @change="search"
        >
          <el-option
            v-for="store in stores"
            :key="Number(store.id)"
            :label="store.name"
            :value="Number(store.id)"
          />
        </el-select>
      </div>
      <div
        v-if="visible('created_at')"
        class="form-group filter-item filter-item--date-range"
      >
        <DateRangePicker
          v-model="dateRange"
          :value-format="TIME_FORMATS.DATE"
          @change="search"
        />
      </div>
    </UnifiedSearchPanel>
    <el-alert
      v-if="failed"
      title="商品销售记录读取失败，请刷新重试"
      type="error"
      :closable="false"
    />
    <div class="table-section table-card admin-panel">
      <div class="table-scroll-container">
        <el-table
          v-tf-loading="{ active: loading, text: '正在查询商品销售记录...' }"
          v-table-double-tap="{ enabled: isMobile || isTablet, getRowKey: getGoodsTapRowKey, onDoubleTap: handleGoodsDoubleTap }"
          :data="rows"
          class="data-table admin-data-table"
          row-key="id"
          @row-dblclick="openDetail"
        >
          <el-table-column
            v-if="visible('sequence')"
            label="序号"
            :width="$getNumberColumnWidth(rows.map((_, index) => (page - 1) * pageSize + index + 1), 72)"
            align="center"
          >
            <template #default="{ $index }">
              <span class="table-number-badge">{{ (page - 1) * pageSize + $index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-for="column in columns"
            :key="column.key"
            :label="column.label"
            :min-width="column.width"
            align="center"
          >
            <template #default="{ row }">
              {{ display(row[column.key], column.format) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && !isTablet"
            label="操作"
            class-name="actions-column"
            :width="goodsActionColumnWidth"
            align="center"
          >
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button
                  v-permission="'query:view'"
                  type="primary"
                  size="small"
                  @click.stop="openDetail(row)"
                >
                  详情
                </el-button>
                <el-button
                  v-if="canExchangeRow(row)"
                  v-permission="'query:exchange'"
                  type="primary"
                  size="small"
                  @click.stop="openReturn(row, 'exchange')"
                >
                  换货
                </el-button>
                <el-button
                  v-if="canReturnRow(row)"
                  v-permission="'query:return-to-stock'"
                  type="danger"
                  size="small"
                  @click.stop="openReturn(row)"
                >
                  退货
                </el-button>
              </div>
            </template>
          </el-table-column>
          <template #empty>
            <TableLoadingRow
              v-if="loading"
              mode="block"
              text="正在查询商品销售记录..."
            />
            <DataEmptyState
              v-else
              description="暂无商品销售或赠送记录"
              size="compact"
            />
          </template>
        </el-table>
      </div>
      <Pagination
        :current="page"
        :page-size="pageSize"
        :total="total"
        :disabled="loading"
        :show-page-sizes="false"
        @change="changePage"
      />
    </div>
    <MobileDialog
      v-model="detailOpen"
      title="商品销售详情"
      dialog-class="crud-dialog-lg"
      :show-default-footer="false"
      destroy-on-close
    >
      <SectionLoading
        v-if="detailLoading"
        text="正在读取原单及出库批次..."
      />
      <el-alert
        v-else-if="detailFailed"
        type="error"
        title="单据读取失败，请关闭后重试"
        :closable="false"
      />
      <template v-else-if="detail">
        <RecordDescriptions
          :column="3"
          border
        >
          <el-descriptions-item label="商品资料">
            {{ detail.has_snapshot ? '销售时资料' : '当前档案（原单无资料快照）' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-for="column in columns"
            :key="column.key"
            :label="column.label"
            :span="['sale_no', 'name', 'customer_phone'].includes(column.key) ? 2 : 1"
          >
            {{ display(detail[column.key], column.format) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('sequence')"
            label="共同单号"
            :span="2"
          >
            {{ detail.order_no || '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('sequence')"
            label="关联手机单号"
            :span="2"
          >
            {{ detail.linked_phone_invoice || '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('barcode')"
            label="条形码"
          >
            {{ detail.barcode || '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('color_name')"
            label="颜色"
          >
            {{ detail.color_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('unit')"
            label="单位"
          >
            {{ detail.unit || '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('serial_number')"
            label="SN"
            :span="2"
          >
            {{ detail.serial_numbers?.join('、') || '-' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="visible('remarks')"
            :span="2"
            label="备注"
          >
            {{ detail.remarks || '-' }}
          </el-descriptions-item>
        </RecordDescriptions>
        <h3>实际出库批次</h3>
        <el-table
          :data="detail.batches"
          class="data-table"
          row-key="id"
        >
          <el-table-column
            v-if="visible('batch_no')"
            prop="batch_no"
            label="入库批次"
            min-width="160"
          />
          <el-table-column
            v-if="visible('supplier_name')"
            prop="supplier_name"
            label="供应商"
            min-width="130"
          />
          <el-table-column
            v-if="visible('total_quantity')"
            prop="quantity"
            label="出库数量"
            min-width="100"
          />
          <el-table-column
            v-if="visible('purchase_cost')"
            label="批次进价"
            min-width="100"
          >
            <template #default="{ row }">
              {{ display(row.purchase_cost, 'money') }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="visible('usage_type')"
            label="入库用途"
            min-width="100"
          >
            <template #default="{ row }">
              {{ display(row.usage_type, 'type') }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="visible('operator_name')"
            prop="inventory_operator_name"
            label="入库员"
            min-width="100"
          />
          <el-table-column
            v-if="visible('inventory_time')"
            label="入库时间"
            min-width="160"
          >
            <template #default="{ row }">
              {{ display(row.inventory_time, 'time') }}
            </template>
          </el-table-column>
          <template #empty>
            <DataEmptyState
              description="原单暂无可追溯批次"
              size="compact"
            />
          </template>
        </el-table>
        <GoodsAftersaleHistory
          v-if="detail.order_id && detail.order_item_id"
          :sale-id="detail.id"
        />
      </template>
      <template
        v-if="detail && !detailLoading && !detailFailed && (detail.order_id || canReturnRow(detail) || canExchangeRow(detail))"
        #footer
      >
        <div class="tf-dialog-actions">
          <el-button
            v-if="detail.order_id"
            v-permission="{ permission: ['query:view', 'accessories:view'], mode: 'all' }"
            type="primary"
            @click.stop="openOrder(detail.id)"
          >
            整单明细
          </el-button>
          <el-button
            v-if="canExchangeRow(detail)"
            v-permission="'query:exchange'"
            type="primary"
            @click.stop="runGoodsDetailAction('exchange')"
          >
            换货
          </el-button>
          <el-button
            v-if="canReturnRow(detail)"
            v-permission="'query:return-to-stock'"
            type="danger"
            @click.stop="runGoodsDetailAction('return')"
          >
            退货
          </el-button>
        </div>
      </template>
    </MobileDialog>
    <CheckoutOrderDialog
      v-if="orderSaleId"
      v-model="orderOpen"
      :sale-id="orderSaleId"
      source="goods"
    />
    <GoodsReturnDialog
      v-if="returnSale"
      v-model="returnOpen"
      :sale="returnSale"
      :mode="returnMode"
      @success="afterReturn"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { getCachedStores, type ReferenceRecord } from '@/services/reference-options'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useMobile } from '@/composables/mobile'
import { canViewAccessoryField as visible, type AccessoryFieldName } from '@/components/accessory-field-permissions'
import { getAdaptiveActionColumnWidth } from '@/utils/table-layout'
import { formatAmount, formatDateTime } from '@/utils/format'
import { TIME_FORMATS } from '@/utils/time'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import CheckoutOrderDialog from '@/components/query/CheckoutOrderDialog.vue'
import GoodsReturnDialog from './GoodsReturnDialog.vue'
import GoodsAftersaleHistory from './GoodsAftersaleHistory.vue'
import type { AccessorySaleRecord, AccessorySaleDetail } from '@/types/accessory'
import type { PaginatedResponse } from '@/types'
import type { DateRangeValue } from '@/types/date-range'

const { canView: canQuery, hasPermission } = usePagePermissions('query')
const { canView: canGoods } = usePagePermissions('accessories')
const { isMobile, isTablet } = useMobile()
const allowed = computed(() => canQuery.value && canGoods.value)
const requests = useLatestRequest(), details = useLatestRequest(), optionRequests = useLatestRequest()
const rows = ref<AccessorySaleRecord[]>([])
const stores = ref<ReferenceRecord[]>([])
const page = ref(1), pageSize = 20, total = ref(0)
const expanded = ref(false), keyword = ref(''), storeId = ref<number>(), saleType = ref('')
const dateRange = ref<DateRangeValue>([])
const loading = ref(false), failed = ref(false)
const detailOpen = ref(false), detailLoading = ref(false), detailFailed = ref(false)
const detail = ref<AccessorySaleDetail | null>(null)
const orderOpen = ref(false), orderSaleId = ref<number | null>(null)
const openOrder = (id: number) => {
  if (!allowed.value) return
  orderSaleId.value = id; detailOpen.value = false; orderOpen.value = true
}
watch(allowed, value => { if (!value) { orderOpen.value = false; orderSaleId.value = null } })
const returnOpen = ref(false), returnSale = ref<AccessorySaleRecord | null>(null)
const returnMode = ref<'return' | 'exchange'>('return')
const canReturnRow = (row: AccessorySaleRecord) => allowed.value && hasPermission('return-to-stock') && Boolean(row.order_id && row.order_item_id) &&
  (row.remaining_quantity === undefined || row.remaining_quantity === null || Number(row.remaining_quantity) > 0)
const canExchangeRow = (row: AccessorySaleRecord) => allowed.value && hasPermission('exchange') && Boolean(row.order_id && row.order_item_id) &&
  (row.remaining_quantity === undefined || row.remaining_quantity === null || Number(row.remaining_quantity) > 0)
const openReturn = (row: AccessorySaleRecord, mode: 'return' | 'exchange' = 'return') => {
  if (!(mode === 'exchange' ? canExchangeRow(row) : canReturnRow(row))) return
  returnMode.value = mode; returnSale.value = row; returnOpen.value = true
}
const runGoodsDetailAction = (mode: 'return' | 'exchange') => {
  const row = detail.value
  if (!row || !detailOpen.value || detailLoading.value || detailFailed.value) return
  if (mode === 'exchange' ? !canExchangeRow(row) : !canReturnRow(row)) return
  detailOpen.value = false
  openReturn(row, mode)
}
const afterReturn = async () => { detailOpen.value = false; await load().catch(() => {}) }
type CellFormat = 'money' | 'time' | 'type'
interface Column { key: keyof AccessorySaleRecord; label: string; field: AccessoryFieldName; width: number; format?: CellFormat }
const allColumns: Column[] = [
  { key: 'sale_no', label: '商品单号', field: 'sequence', width: 180 },
  { key: 'name', label: '商品名称', field: 'name', width: 160 },
  { key: 'category', label: '商品类型', field: 'category', width: 110 },
  { key: 'brand_name', label: '品牌', field: 'brand_name', width: 100 },
  { key: 'product_model', label: '配件型号', field: 'product_model', width: 130 },
  { key: 'sale_type', label: '销售 / 赠送', field: 'usage_type', width: 110, format: 'type' },
  { key: 'store_name', label: '销售门店', field: 'distribution', width: 120 },
  { key: 'customer_name', label: '客户姓名', field: 'customer_name', width: 110 },
  { key: 'customer_phone', label: '客户手机号', field: 'customer_phone', width: 140 },
  { key: 'quantity', label: '原数量', field: 'total_quantity', width: 90 },
  { key: 'returned_quantity', label: '已退数量', field: 'total_quantity', width: 100 },
  { key: 'remaining_quantity', label: '未退数量', field: 'total_quantity', width: 100 },
  { key: 'unit_price', label: '销售单价', field: 'unit_price', width: 110, format: 'money' },
  { key: 'total_price', label: '原成交净额', field: 'total_price', width: 110, format: 'money' },
  { key: 'purchase_cost', label: '原单总成本', field: 'purchase_cost', width: 120, format: 'money' },
  { key: 'profit', label: '毛利', field: 'profit', width: 110, format: 'money' },
  { key: 'points_used', label: '抵扣积分', field: 'total_price', width: 100 },
  { key: 'deduction_amount', label: '积分抵扣金额', field: 'total_price', width: 120, format: 'money' },
  { key: 'points_awarded', label: '累计积分', field: 'total_price', width: 100 },
  { key: 'operator_name', label: '销售员', field: 'operator_name', width: 110 },
  { key: 'sale_time', label: '销售时间', field: 'created_at', width: 170, format: 'time' }
]
const columns = computed(() => allColumns.filter(column => visible(column.field)))
const goodsActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(rows.value, [
  { label: '详情', visible: allowed.value }, { label: '退货', visible: canReturnRow }, { label: '换货', visible: canExchangeRow }
]))
const display = (value: unknown, format?: CellFormat) => {
  if (value === null || value === undefined || value === '') return '-'
  if (format === 'money') return `¥${formatAmount(String(value))}`
  if (format === 'time') return formatDateTime(String(value), TIME_FORMATS.DATETIME_MINUTE)
  if (format === 'type') return value === 'gift' ? '赠送' : value === 'sale' ? '销售' : '-'
  return String(value)
}
const load = async () => {
  if (!allowed.value) return
  const request = requests.nextRequest()
  loading.value = true
  failed.value = false
  try {
    const response = await unifiedApi.get<Pick<PaginatedResponse<AccessorySaleRecord>, 'data' | 'pagination'>>('/query/goods', {
      params: { page: page.value, page_size: pageSize, keyword: keyword.value.trim() || undefined,
        store_id: visible('distribution') ? storeId.value : undefined,
        sale_type: visible('usage_type') ? saleType.value || undefined : undefined,
        start_date: visible('created_at') ? dateRange.value?.[0] || undefined : undefined,
        end_date: visible('created_at') ? dateRange.value?.[1] || undefined : undefined },
      signal: request.signal, useCache: false, showLoading: false, showError: false
    })
    if (!request.isLatest()) return
    if (!response.data || !Array.isArray(response.data.data) || !Number.isSafeInteger(response.data.pagination?.total)) throw new Error('商品销售分页响应不完整')
    rows.value = response.data.data
    total.value = response.data.pagination.total
  } catch (error) {
    if (!request.isLatest() || requests.isCanceledError(error)) return
    failed.value = true
    throw error
  } finally { if (request.isLatest()) loading.value = false }
}
const search = () => { page.value = 1; void load().catch(() => {}) }
const reset = () => { keyword.value = ''; storeId.value = undefined; saleType.value = ''; dateRange.value = []; search() }
const changePage = (value: number) => { page.value = value; void load().catch(() => {}) }
const openDetail = async (row: AccessorySaleRecord) => {
  if (!allowed.value) return
  const request = details.nextRequest()
  detailOpen.value = true
  detail.value = null
  detailLoading.value = true
  detailFailed.value = false
  try {
    const response = await unifiedApi.get<AccessorySaleDetail>(`/query/goods/${row.id}`, { signal: request.signal, useCache: false, showLoading: false, showError: false })
    if (!request.isLatest()) return
    if (!response.data) throw new Error('商品详情响应不完整')
    detail.value = response.data
  } catch (error) { if (request.isLatest() && !details.isCanceledError(error)) detailFailed.value = true }
  finally { if (request.isLatest()) detailLoading.value = false }
}
const getGoodsTapRowKey = (index: number) => rows.value[index]?.id
const handleGoodsDoubleTap = (index: number) => {
  const row = rows.value[index]
  if (row) void openDetail(row)
}
watch(detailOpen, value => { if (!value) { details.cancelLatest(); detail.value = null; detailLoading.value = false } })
watch(returnOpen, value => { if (!value) returnSale.value = null })
watch(allowed, value => {
  requests.cancelLatest(); details.cancelLatest(); optionRequests.cancelLatest()
  rows.value = []; stores.value = []; total.value = 0; detailOpen.value = false; returnOpen.value = false; loading.value = false
  if (!value) return
  void load().catch(() => {})
  if (visible('distribution')) {
    const request = optionRequests.nextRequest()
    void getCachedStores(true).then(response => { if (request.isLatest()) stores.value = response.data || [] }).catch(() => {})
  }
}, { immediate: true })
defineExpose({ load })
</script>
