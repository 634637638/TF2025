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
        v-if="visible('operator_name')"
        class="form-group filter-item"
      >
        <el-select
          v-model="operatorId"
          filterable
          remote
          clearable
          reserve-keyword
          :remote-method="searchOperatorOptions"
          :loading="operatorLoading"
          placeholder="销售员"
          aria-label="销售员"
          @change="search"
        >
          <el-option
            v-for="operator in operators"
            :key="Number(operator.id)"
            :label="String(operator.name || operator.username || '')"
            :value="Number(operator.id)"
          />
        </el-select>
      </div>
      <div
        v-if="visible('brand_name')"
        class="form-group filter-item"
      >
        <el-select
          v-model="brandId"
          filterable
          clearable
          placeholder="品牌"
          aria-label="品牌"
          @change="search"
        >
          <el-option
            v-for="brand in brands"
            :key="Number(brand.id)"
            :label="brand.name || ''"
            :value="Number(brand.id)"
          />
        </el-select>
      </div>
      <div
        v-if="visible('name')"
        class="form-group filter-item"
      >
        <el-select
          v-model="productName"
          filterable
          remote
          allow-create
          placeholder="商品名称"
          clearable
          reserve-keyword
          default-first-option
          :remote-method="searchProductNameOptions"
          :loading="productNameLoading"
          aria-label="商品名称"
          @focus="searchProductNameOptions(productName || '')"
          @change="search"
        >
          <el-option
            v-for="name in productNames"
            :key="name"
            :label="name"
            :value="name"
          />
        </el-select>
      </div>
      <div
        v-if="visible('category')"
        class="form-group filter-item"
      >
        <el-select
          v-model="categoryId"
          filterable
          clearable
          placeholder="商品类型"
          aria-label="商品类型"
          @change="search"
        >
          <el-option
            v-for="category in categories"
            :key="Number(category.id)"
            :label="category.name || ''"
            :value="Number(category.id)"
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
            v-for="column in tableColumns"
            :key="column.key"
            :label="tableColumnLabel(column)"
            :min-width="column.width"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="column.key === 'sale_type'"
                :class="['status-badge', saleTypeBadgeClass(row.sale_type)]"
              >
                {{ saleTypeLabel(row.sale_type) }}
              </span>
              <template v-else>
                {{ display(row[column.key], column.format) }}
              </template>
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
                  @click.stop="openDetail(row)"
                >
                  详情
                </el-button>
                <el-button
                  v-if="canExchangeRow(row)"
                  v-permission="'query:exchange'"
                  type="primary"
                  @click.stop="openReturn(row, 'exchange')"
                >
                  换货
                </el-button>
                <el-button
                  v-if="canReturnRow(row)"
                  v-permission="'query:return-to-stock'"
                  type="danger"
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
        :page-sizes="pageSizes"
        :show-page-sizes="true"
        @change="changePage"
      />
    </div>
    <MobileDialog
      v-model="detailOpen"
      title="商品销售详情"
      dialog-class="goods-sale-detail-dialog"
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
        <div class="goods-detail">
          <section class="goods-detail__overview">
            <div class="goods-detail__identity">
              <h2 v-if="visible('name')">
                {{ detail.name || '-' }}
              </h2>
              <div class="goods-detail__meta">
                <span v-if="visible('category')">{{ detail.category || '-' }}</span>
                <span v-if="visible('brand_name')">{{ detail.brand_name || '-' }}</span>
                <span v-if="visible('product_model')">{{ detail.product_model || '-' }}</span>
              </div>
              <span
                v-if="!detail.has_snapshot"
                class="goods-detail__snapshot-note"
              >
                当前档案（原单无资料快照）
              </span>
            </div>
            <span
              v-if="visible('usage_type')"
              :class="['status-badge', saleTypeBadgeClass(detail.sale_type)]"
            >
              {{ saleTypeLabel(detail.sale_type) }}
            </span>
          </section>

          <section
            class="goods-detail__metrics"
            aria-label="交易摘要"
          >
            <div
              v-if="visible('total_price')"
              class="goods-detail__metric goods-detail__metric--primary"
            >
              <span>实收</span>
              <strong>{{ display(detail.total_price, 'money') }}</strong>
            </div>
            <div
              v-if="visible('profit')"
              class="goods-detail__metric goods-detail__metric--success"
            >
              <span>利润</span>
              <strong>{{ display(detail.profit, 'money') }}</strong>
            </div>
            <div
              v-if="visible('total_quantity')"
              class="goods-detail__metric"
            >
              <span>数量</span>
              <strong>{{ display(detail.quantity) }}</strong>
            </div>
            <div
              v-if="visible('total_price')"
              class="goods-detail__metric"
            >
              <span>获得积分</span>
              <strong>{{ display(detail.points_awarded) }}</strong>
            </div>
          </section>

          <section class="goods-detail__section">
            <div class="goods-detail__section-heading">
              <h3>销售与客户</h3>
            </div>
            <div class="goods-detail__compact-panel goods-detail__compact-panel--sale-customer">
              <div class="goods-detail__compact-grid">
                <div
                  v-for="column in columns.filter(item => ['store_name', 'returned_quantity', 'remaining_quantity', 'unit_price', 'purchase_cost', 'points_used', 'deduction_amount', 'operator_name'].includes(item.key))"
                  :key="column.key"
                  class="goods-detail__compact-field"
                >
                  <span>{{ column.label }}</span>
                  <strong :class="{ 'goods-detail__long-value': ['store_name', 'operator_name'].includes(column.key) }">
                    {{ display(detail[column.key], column.format) }}
                  </strong>
                </div>
              </div>
              <div
                v-if="columns.some(item => ['customer_name', 'customer_phone'].includes(item.key))"
                class="goods-detail__compact-grid goods-detail__compact-grid--customer"
              >
                <div
                  v-for="column in columns.filter(item => ['customer_name', 'customer_phone'].includes(item.key))"
                  :key="column.key"
                  class="goods-detail__compact-field"
                >
                  <span>{{ column.label }}</span>
                  <strong class="goods-detail__long-value">{{ display(detail[column.key], column.format) }}</strong>
                </div>
              </div>
            </div>
          </section>

          <section class="goods-detail__section">
            <div class="goods-detail__section-heading goods-detail__section-heading--accent">
              <h3>商品与规格</h3>
            </div>
            <div class="goods-detail__compact-panel goods-detail__compact-panel--product">
              <div class="goods-detail__compact-grid goods-detail__compact-grid--product">
                <div
                  v-if="visible('name')"
                  class="goods-detail__compact-field"
                >
                  <span>商品名称</span>
                  <strong class="goods-detail__long-value">{{ detail.name || '-' }}</strong>
                </div>
                <div
                  v-for="column in columns.filter(item => ['category', 'brand_name', 'product_model'].includes(item.key))"
                  :key="column.key"
                  class="goods-detail__compact-field"
                >
                  <span>{{ column.label }}</span>
                  <strong>{{ display(detail[column.key], column.format) }}</strong>
                </div>
                <div
                  v-if="visible('barcode')"
                  class="goods-detail__compact-field"
                >
                  <span>条形码</span>
                  <strong class="goods-detail__long-value">{{ detail.barcode || '-' }}</strong>
                </div>
                <div
                  v-if="visible('color_name')"
                  class="goods-detail__compact-field"
                >
                  <span>颜色</span>
                  <strong>{{ detail.color_name || '-' }}</strong>
                </div>
              </div>
            </div>
          </section>

          <section class="goods-detail__section">
            <div class="goods-detail__section-heading">
              <div>
                <span class="goods-detail__eyebrow">原始凭据</span>
                <h3>关联单据</h3>
              </div>
            </div>
            <div class="goods-detail__compact-grid goods-detail__compact-grid--documents">
              <div
                v-if="visible('sequence')"
                class="goods-detail__compact-field"
              >
                <span>商品单号</span>
                <strong class="goods-detail__long-value">{{ detail.sale_no || '-' }}</strong>
              </div>
              <div
                v-if="visible('sequence')"
                class="goods-detail__compact-field"
              >
                <span>共同单号</span>
                <strong class="goods-detail__long-value">{{ detail.order_no || '-' }}</strong>
              </div>
              <div
                v-if="visible('remarks')"
                class="goods-detail__compact-field"
              >
                <span>备注</span>
                <strong class="goods-detail__long-value">{{ detail.remarks || '-' }}</strong>
              </div>
              <div
                v-if="visible('sequence')"
                class="goods-detail__compact-field"
              >
                <span>关联手机单号</span>
                <strong class="goods-detail__long-value">{{ detail.linked_phone_invoice || '-' }}</strong>
              </div>
              <div
                v-if="visible('serial_number')"
                class="goods-detail__compact-field"
              >
                <span>SN</span>
                <strong class="goods-detail__long-value">{{ detail.serial_numbers?.join('、') || '-' }}</strong>
              </div>
              <div
                v-if="visible('created_at')"
                class="goods-detail__compact-field"
              >
                <span>销售时间</span>
                <strong class="goods-detail__long-value">{{ display(detail.sale_time, 'time') }}</strong>
              </div>
            </div>
          </section>

          <section class="goods-detail__section">
            <div class="goods-detail__section-heading">
              <div>
                <span class="goods-detail__eyebrow">库存追溯</span>
                <h3>实际出库批次</h3>
              </div>
              <span class="goods-detail__section-hint">按实际出库批次记录</span>
            </div>
            <div class="goods-detail__table-wrap">
              <el-table
                :data="detail.batches"
                class="data-table admin-data-table goods-detail__table"
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
                  label="数量"
                  min-width="100"
                />
                <el-table-column
                  v-if="visible('purchase_cost')"
                  label="进价"
                  min-width="100"
                >
                  <template #default="{ row }">
                    {{ display(row.purchase_cost, 'money') }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="visible('usage_type')"
                  label="用户"
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
            </div>
          </section>

          <GoodsAftersaleHistory
            v-if="detail.order_id && detail.order_item_id"
            :sale-id="detail.id"
          />
        </div>
      </template>
      <template
        v-if="detail && !detailLoading && !detailFailed && (detail.order_id || canReturnRow(detail) || canExchangeRow(detail))"
        #footer
      >
        <div class="tf-dialog-actions">
          <el-button
            v-if="detail.order_id"
            v-permission="{ permission: ['query:view', 'query:goods-view'], mode: 'all' }"
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
    <SalesGoodsCheckoutDialog
      v-if="saleOpen && canSellGoods"
      v-model="saleOpen"
      field-source="query"
      @success="afterSale"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { getGoodsFilterOptions, getGoodsProductNameOptions, getStores, searchOperators, type ReferenceRecord } from '@/services/reference-options'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useMobile } from '@/composables/mobile'
import { canViewQueryGoodsField as visible, ACCESSORY_FIELD_IDS, type AccessoryFieldName } from '@/components/accessory-field-permissions'
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
const canGoods = computed(() => hasPermission('goods-view'))
const { isMobile, isTablet } = useMobile()
const allowed = computed(() => canQuery.value && canGoods.value)
const SalesGoodsCheckoutDialog = defineAsyncComponent(() => import('@/views/sales/page/SalesGoodsCheckoutDialog.vue'))
const canSellGoods = computed(() => allowed.value && (hasPermission('goods-sell') || hasPermission('goods-gift')))
const saleOpen = ref(false)
const openSale = () => { if (canSellGoods.value) saleOpen.value = true }
const afterSale = async () => { page.value = 1; await load().catch(() => {}) }
watch(canSellGoods, value => { if (!value) saleOpen.value = false })
const requests = useLatestRequest(), details = useLatestRequest(), optionRequests = useLatestRequest(), filterOptionRequests = useLatestRequest(), operatorRequests = useLatestRequest(), productNameRequests = useLatestRequest()
const rows = ref<AccessorySaleRecord[]>([])
const stores = ref<ReferenceRecord[]>([])
const operators = ref<ReferenceRecord[]>([]), brands = ref<ReferenceRecord[]>([]), categories = ref<ReferenceRecord[]>([])
const productNames = ref<string[]>([])
const pageSizes = [20, 50, 100]
const page = ref(1), pageSize = ref(pageSizes[0]), total = ref(0)
const expanded = ref(false), keyword = ref(''), storeId = ref<number>(), saleType = ref('')
const operatorId = ref<number>(), brandId = ref<number>(), categoryId = ref<number>(), productName = ref<string | null>('')
const operatorLoading = ref(false)
const productNameLoading = ref(false)
const dateRange = ref<DateRangeValue>([])
const loading = ref(false), failed = ref(false)
const detailOpen = ref(false), detailLoading = ref(false), detailFailed = ref(false)
const detail = ref<AccessorySaleDetail | null>(null)
const detailSaleId = ref<number | null>(null)
const orderOpen = ref(false), orderSaleId = ref<number | null>(null)
const openOrder = (id: number) => {
  if (!allowed.value) return
  orderSaleId.value = id; detailOpen.value = false; orderOpen.value = true
}
watch(() => [allowed.value, ...Object.keys(ACCESSORY_FIELD_IDS).map(key => visible(key as AccessoryFieldName))], ([value]) => { if (!value) { orderOpen.value = false; orderSaleId.value = null } })
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
  { key: 'sale_time', label: '销售时间', field: 'created_at', width: 170, format: 'time' },
  { key: 'name', label: '商品名称', field: 'name', width: 160 },
  { key: 'category', label: '商品类型', field: 'category', width: 110 },
  { key: 'brand_name', label: '品牌', field: 'brand_name', width: 100 },
  { key: 'product_model', label: '配件型号', field: 'product_model', width: 130 },
  { key: 'sale_type', label: '销售', field: 'usage_type', width: 110, format: 'type' },
  { key: 'store_name', label: '销售门店', field: 'distribution', width: 120 },
  { key: 'customer_name', label: '客户姓名', field: 'customer_name', width: 110 },
  { key: 'customer_phone', label: '客户手机号', field: 'customer_phone', width: 140 },
  { key: 'quantity', label: '数量', field: 'total_quantity', width: 90 },
  { key: 'returned_quantity', label: '已退数量', field: 'total_quantity', width: 100 },
  { key: 'remaining_quantity', label: '未退数量', field: 'total_quantity', width: 100 },
  { key: 'unit_price', label: '销售价', field: 'unit_price', width: 110, format: 'money' },
  { key: 'total_price', label: '实收', field: 'total_price', width: 110, format: 'money' },
  { key: 'purchase_cost', label: '成本', field: 'purchase_cost', width: 120, format: 'money' },
  { key: 'profit', label: '利润', field: 'profit', width: 110, format: 'money' },
  { key: 'points_used', label: '抵扣积分', field: 'total_price', width: 100 },
  { key: 'deduction_amount', label: '抵扣金额', field: 'total_price', width: 120, format: 'money' },
  { key: 'points_awarded', label: '获得积分', field: 'total_price', width: 100 },
  { key: 'operator_name', label: '销售员', field: 'operator_name', width: 110 }
]
const columns = computed(() => allColumns.filter(column => visible(column.field)))
const tableColumnOrder: Column['key'][] = ['store_name', 'sale_time', 'brand_name', 'name', 'category', 'sale_type', 'customer_name', 'customer_phone']
const hiddenTableColumnKeys: Column['key'][] = ['sale_no', 'remaining_quantity', 'product_model', 'profit', 'points_used']
const tableColumns = computed(() => {
  const visibleColumns = columns.value.filter(column => !hiddenTableColumnKeys.includes(column.key))
  const prioritizedColumns = tableColumnOrder
    .map(key => visibleColumns.find(column => column.key === key))
    .filter((column): column is Column => column !== undefined)
  return [...prioritizedColumns, ...visibleColumns.filter(column => !tableColumnOrder.includes(column.key))]
})
const tableColumnLabel = (column: Column) => column.key === 'store_name' ? '销售店铺' : column.key === 'customer_phone' ? '手机号' : column.label
const goodsActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(rows.value, [
  { label: '详情', visible: allowed.value }, { label: '退货', visible: canReturnRow }, { label: '换货', visible: canExchangeRow }
]))
const display = (value: unknown, format?: CellFormat) => {
  if (value === null || value === undefined || value === '') return '-'
  if (format === 'money') return `¥${formatAmount(String(value))}`
  if (format === 'time') return formatDateTime(String(value), TIME_FORMATS.DATETIME)
  if (format === 'type') return value === 'gift' ? '赠送' : value === 'sale' ? '销售' : '-'
  return String(value)
}
const saleTypeLabel = (value: unknown) => value === 'gift' ? '赠送' : value === 'sale' ? '销售' : '-'
const saleTypeBadgeClass = (value: unknown) => value === 'gift' ? 'status-warning' : value === 'sale' ? 'status-success' : 'status-disabled'
const load = async () => {
  if (!allowed.value) return
  const request = requests.nextRequest()
  loading.value = true
  failed.value = false
  try {
    const response = await unifiedApi.get<Pick<PaginatedResponse<AccessorySaleRecord>, 'data' | 'pagination'>>('/query/goods', {
      params: { page: page.value, page_size: pageSize.value, keyword: keyword.value.trim() || undefined,
        store_id: visible('distribution') ? storeId.value : undefined,
        sale_type: visible('usage_type') ? saleType.value || undefined : undefined,
        sale_operator_id: visible('operator_name') ? operatorId.value : undefined,
        brand_id: visible('brand_name') ? brandId.value : undefined,
        product_name: visible('name') ? productName.value?.trim() || undefined : undefined,
        category_id: visible('category') ? categoryId.value : undefined,
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
const reset = () => { keyword.value = ''; storeId.value = undefined; saleType.value = ''; operatorId.value = undefined; brandId.value = undefined; categoryId.value = undefined; productName.value = ''; dateRange.value = []; search() }
let operatorSearchTimer: ReturnType<typeof setTimeout> | undefined
let productNameSearchTimer: ReturnType<typeof setTimeout> | undefined
const searchOperatorOptions = (value: string) => {
  if (!visible('operator_name')) return
  if (operatorSearchTimer) clearTimeout(operatorSearchTimer)
  const request = operatorRequests.nextRequest()
  operatorLoading.value = true
  operatorSearchTimer = setTimeout(async () => {
    try {
      const response = await searchOperators({ keyword: value.trim() || undefined, page: 1, page_size: 100 }, { signal: request.signal })
      if (request.isLatest()) operators.value = response.data || []
    } catch (error) {
      if (request.isLatest() && !operatorRequests.isCanceledError(error)) operators.value = []
    } finally { if (request.isLatest()) operatorLoading.value = false }
  }, 200)
}
const searchProductNameOptions = (value: string) => {
  if (!visible('name')) return
  if (productNameSearchTimer) clearTimeout(productNameSearchTimer)
  const request = productNameRequests.nextRequest()
  productNameLoading.value = true
  productNameSearchTimer = setTimeout(async () => {
    try {
      const response = await getGoodsProductNameOptions({ keyword: value.trim(), store_id: visible('distribution') ? storeId.value : undefined }, request.signal)
      if (request.isLatest()) productNames.value = Array.isArray(response.data) ? response.data : []
    } catch (error) {
      if (request.isLatest() && !productNameRequests.isCanceledError(error)) productNames.value = []
    } finally { if (request.isLatest()) productNameLoading.value = false }
  }, 200)
}
const changePage = (value: number, nextPageSize = pageSize.value) => {
  const sizeChanged = nextPageSize !== pageSize.value
  pageSize.value = nextPageSize
  page.value = sizeChanged ? 1 : value
  void load().catch(() => {})
}
const openDetail = async (row: Pick<AccessorySaleRecord, 'id'>) => {
  if (!allowed.value) return
  const request = details.nextRequest()
  detailOpen.value = true
  detailSaleId.value = row.id
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
watch(detailOpen, value => { if (!value) { details.cancelLatest(); detail.value = null; detailSaleId.value = null; detailLoading.value = false } })
watch(returnOpen, value => { if (!value) returnSale.value = null })
watch(() => [allowed.value, ...Object.keys(ACCESSORY_FIELD_IDS).map(key => visible(key as AccessoryFieldName))], ([value]) => {
  const activeDetailId = detailOpen.value ? detailSaleId.value : null
  if (operatorSearchTimer) clearTimeout(operatorSearchTimer)
  if (productNameSearchTimer) clearTimeout(productNameSearchTimer)
  requests.cancelLatest(); details.cancelLatest(); optionRequests.cancelLatest(); filterOptionRequests.cancelLatest(); operatorRequests.cancelLatest(); productNameRequests.cancelLatest()
  rows.value = []; stores.value = []; operators.value = []; brands.value = []; categories.value = []; productNames.value = []; total.value = 0; detail.value = null; returnOpen.value = false; saleOpen.value = false; loading.value = false; operatorLoading.value = false; productNameLoading.value = false
  if (!value) { detailOpen.value = false; return }
  void load().catch(() => {})
  if (activeDetailId !== null) void openDetail({ id: activeDetailId })
  if (visible('distribution')) {
    const request = optionRequests.nextRequest()
    void getStores({ strictScope: true }).then(response => { if (request.isLatest()) stores.value = response.data || [] }).catch(() => {})
  }
  if (visible('operator_name')) searchOperatorOptions('')
  if (visible('brand_name') || visible('category')) {
    const request = filterOptionRequests.nextRequest()
    void getGoodsFilterOptions().then(response => {
      if (!request.isLatest()) return
      brands.value = response.data?.brands || []
      categories.value = response.data?.categories || []
    }).catch(() => {})
  }
}, { immediate: true })
onBeforeUnmount(() => {
  if (operatorSearchTimer) clearTimeout(operatorSearchTimer)
  if (productNameSearchTimer) clearTimeout(productNameSearchTimer)
  productNameRequests.cancelLatest()
})
defineExpose({ load, openSale })
</script>

<style scoped lang="scss" src="./styles/query-goods-detail/base.scss"></style>
<style scoped lang="scss" src="./styles/query-goods-detail/responsive.scss"></style>
