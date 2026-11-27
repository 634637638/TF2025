<template>
  <div class="inventory-analytics admin-page-content">
    <Teleport
      :to="props.overviewTarget || 'body'"
      :disabled="!props.overviewTarget"
    >
      <div
        class="stats-cards"
        role="region"
        aria-label="库存分析统计"
        tabindex="0"
      >
        <AnalyticsStatCard
          v-if="canViewInventoryField('total_products')"
          class="stat-card stat-card--primary"
          label="在库总数"
          :value="`${formatNumber(inventoryData.total_products)}台`"
          :icon="Box"
          :details="[
            { label: '健康评分', value: inventoryData.inventory_health?.score ?? 0 },
            { label: '健康等级', value: healthLevelText },
            { label: '周转', value: formatDecimal(inventoryData.stock_turnover) }
          ]"
        />

        <AnalyticsStatCard
          v-if="canViewInventoryField('total_value')"
          class="stat-card stat-card--income"
          label="在库价值"
          :value="`¥${formatAmount(inventoryData.total_value)}`"
          :icon="Money"
          :details="[
            { label: '单台均值', value: `¥${formatAmount(averageUnitCost)}` },
            { label: '近10台成交', value: `¥${formatAmount(recentSalesSummary.totalSales)}` },
            { label: '最近门店', value: recentSalesSummary.latestStore }
          ]"
        />

        <AnalyticsStatCard
          v-if="canViewInventoryField('warning_summary')"
          class="stat-card stat-card--warning"
          label="库存预警"
          :value="formatNumber(warningSummary.total)"
          :icon="Warning"
          :details="[
            { label: '售罄', value: formatNumber(warningSummary.criticalCount) },
            { label: '缺口', value: `${formatNumber(warningSummary.shortageUnits)}台` }
          ]"
          :interactive="canViewInventoryField('low_stock_dialog')"
          @activate="showLowStockDialog = true"
        />

        <AnalyticsStatCard
          v-if="canViewInventoryField('supplier_count')"
          class="stat-card stat-card--info"
          label="有货供应商"
          :value="`${formatNumber(supplierCount)}家`"
          :icon="ShoppingCart"
          :details="[
            { label: '均分', value: formatDecimal(supplierQualityAverage) },
            { label: '首位', value: topSupplierName },
            { label: '覆盖价值', value: `¥${formatAmount(topSupplierValue)}` }
          ]"
        />
      </div>
    </Teleport>

    <MobileDialog
      v-if="canViewInventoryField('low_stock_dialog')"
      v-model="showLowStockDialog"
      title="库存不足详情（按预警配置）"
      width="80%"
      dialog-class="inventory-low-stock-dialog"
      :show-default-footer="false"
    >
      <el-table
        v-tf-loading="{ active: loading, text: '正在刷新库存分析...' }"
        v-table-double-tap="warningDetailTapOptions"
        class="data-table"
        :data="filteredLowStockItems"
        stripe
        table-layout="fixed"
        :fit="true"
        @row-dblclick="warningDetailDoubleClick"
      >
        <template #empty>
          <TableLoadingRow
            v-if="loading"
            mode="block"
            text="正在读取库存分析..."
          />
          <DataEmptyState
            v-else
            description="暂无库存预警商品"
          />
        </template>

        <el-table-column
          v-for="column in lowStockSpecColumns"
          :key="column.key"
          :prop="column.key"
          :label="column.label"
          :min-width="column.width"
          class-name="complete-text-column"
        >
          <template #default="{ row }">
            <span :class="column.key === 'condition_label' ? getLowStockConditionBadge(row.condition_label) : undefined">
              {{ row[column.key] || '—' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="current_stock"
          label="当前库存"
          width="100"
          align="center"
        >
          <template #default="scope">
            <el-tag
              :type="scope.row.current_stock === 0 ? 'danger' : 'warning'"
              size="small"
            >
              {{ scope.row.current_stock }}台
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="reorder_point"
          label="预警库存"
          width="110"
          align="center"
        />
        <el-table-column
          prop="unit_cost"
          label="成本价"
          :min-width="lowStockColumnWidths.unit_cost"
        >
          <template #default="scope">
            ¥{{ formatAmount(scope.row.unit_cost) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="total_value"
          label="库存价值"
          :min-width="lowStockColumnWidths.total_value"
        >
          <template #default="scope">
            ¥{{ formatAmount(scope.row.total_value) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="last_sale_time"
          label="最近销售"
          :min-width="lowStockColumnWidths.last_sale_time"
        >
          <template #default="scope">
            {{ formatDate(scope.row.last_sale_time) }}
          </template>
        </el-table-column>
      </el-table>
    </MobileDialog>

    <RecordDetailDialog
      v-model="warningDetailVisible"
      title="库存预警详情"
      :record="warningDetailRow"
      :fields="warningDetailFields"
      :has-actions="false"
    />

    <section
      v-if="canViewInventoryField('recent_sales_table')"
      class="table-section admin-panel admin-table-panel"
      aria-labelledby="inventory-recent-sales-title"
    >
      <div class="section-title flex-wrap justify-between">
        <span id="inventory-recent-sales-title">
          最热品牌
        </span>
        <span class="text-sm font-normal text-secondary">
          成交 ¥{{ formatAmount(recentSalesSummary.totalSales) }} · {{ recentSalesSummary.latestSaleDate }}
        </span>
      </div>
      <el-table
        v-table-double-tap="soldDetailTapOptions"
        v-tf-loading="{ active: loading, text: '正在刷新库存分析...' }"
        class="data-table"
        :data="recentSoldModels"
        stripe
        table-layout="fixed"
        :fit="true"
        @row-dblclick="soldDetailDoubleClick"
      >
        <template #empty>
          <TableLoadingRow
            v-if="loading"
            mode="block"
            text="正在读取库存分析..."
          />
          <DataEmptyState
            v-else
            description="暂无最近销售记录"
          />
        </template>

        <el-table-column
          prop="brand"
          label="品牌"
          :min-width="recentSaleColumnWidths.brand"
        />
        <el-table-column
          prop="model"
          label="型号"
          :min-width="recentSaleColumnWidths.model"
        />
        <el-table-column
          prop="color"
          label="颜色"
          :min-width="recentSaleColumnWidths.color"
        />
        <el-table-column
          prop="sale_price"
          label="销售价"
          :min-width="recentSaleColumnWidths.sale_price"
        >
          <template #default="scope">
            ¥{{ formatAmount(scope.row.sale_price) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="sale_time"
          label="销售时间"
          :min-width="recentSaleColumnWidths.sale_time"
        />
        <el-table-column
          prop="store"
          label="销售门店"
          :min-width="recentSaleColumnWidths.store"
        />
      </el-table>
      <RecordDetailDialog
        v-model="soldDetailVisible"
        title="近期销售详情"
        :record="soldDetailRow"
        :fields="soldDetailFields"
        :has-actions="false"
      />
    </section>

    <div
      v-if="showInventoryChartsRow"
      class="analytics-panel-grid analytics-panel-grid--wide"
    >
      <div
        v-if="canViewInventoryField('category_distribution_chart')"
      >
        <el-card class="panel-card chart-card">
          <template #header>
            <div class="panel-header">
              <div class="panel-title">
                库存分析
              </div>
              <el-button
                @click="toggleCategoryChartType"
              >
                切换{{ categoryChartType === 'bar' ? '饼图' : '柱状图' }}
              </el-button>
            </div>
          </template>
          <div class="chart-container">
            <div
              ref="categoryChartRef"
              class="chart"
            />
          </div>
        </el-card>
      </div>

      <div
        v-if="canViewInventoryField('turnover_trend_chart')"
      >
        <el-card class="panel-card chart-card">
          <template #header>
            <div class="panel-header">
              <div class="panel-title">
                库存周转趋势
              </div>
              <el-select
                v-model="turnoverPeriod"
                size="small"
                class="period-select"
              >
                <el-option
                  label="近30天"
                  value="30d"
                />
                <el-option
                  label="近90天"
                  value="90d"
                />
                <el-option
                  label="近180天"
                  value="180d"
                />
              </el-select>
            </div>
          </template>
          <div class="chart-container">
            <div
              ref="turnoverChartRef"
              class="chart"
            />
          </div>
        </el-card>
      </div>
    </div>

    <div
      v-if="showInventoryTableRow"
      class="analytics-panel-grid analytics-panel-grid--wide analytics-panel-grid--7-5"
    >
      <div
        v-if="canViewInventoryField('low_stock_table')"
      >
        <section
          class="table-card low-stock-card admin-panel admin-table-panel"
          aria-labelledby="inventory-low-stock-title"
        >
          <div class="section-title flex-wrap justify-between">
            <div id="inventory-low-stock-title">
              库存预警
            </div>
            <el-space wrap>
              <el-select
                v-model="alertLevel"
                placeholder="预警级别"
                size="small"
                clearable
                class="alert-select"
              >
                <el-option
                  label="全部"
                  value=""
                />
                <el-option
                  label="严重"
                  value="critical"
                />
                <el-option
                  label="警告"
                  value="warning"
                />
              </el-select>
              <el-button
                type="success"
                @click="exportLowStock"
              >
                导出
              </el-button>
            </el-space>
          </div>

          <div
            class="stats-cards"
            role="region"
            aria-label="库存补货统计"
            tabindex="0"
          >
            <div class="stat-card stat-card--warning">
              <div class="stat-content">
                <div class="stat-label">
                  预警总数
                </div>
                <div class="stat-value">
                  {{ formatNumber(warningSummary.total) }}
                </div>
              </div>
            </div>
            <div class="stat-card stat-card--danger">
              <div class="stat-content">
                <div class="stat-label">
                  售罄型号
                </div>
                <div class="stat-value">
                  {{ formatNumber(warningSummary.criticalCount) }}
                </div>
              </div>
            </div>
            <div class="stat-card stat-card--info">
              <div class="stat-content">
                <div class="stat-label">
                  补货缺口
                </div>
                <div class="stat-value">
                  {{ formatNumber(warningSummary.shortageUnits) }} 台
                </div>
              </div>
            </div>
            <div class="stat-card stat-card--money">
              <div class="stat-content">
                <div class="stat-label">
                  建议补货值
                </div>
                <div class="stat-value">
                  ¥{{ formatAmount(warningSummary.replenishmentValue) }}
                </div>
              </div>
            </div>
          </div>

          <el-table
            v-table-double-tap="stockDetailTapOptions"
            v-tf-loading="{ active: loading, text: '正在刷新库存分析...' }"
            class="data-table"
            :data="filteredLowStockItems"
            stripe
            table-layout="fixed"
            :fit="true"
            @row-dblclick="stockDetailDoubleClick"
          >
            <template #empty>
              <TableLoadingRow
                v-if="loading"
                mode="block"
                text="正在读取库存分析..."
              />
              <DataEmptyState
                v-else
                description="暂无库存预警商品"
              />
            </template>

            <el-table-column
              type="index"
              label="序号"
              :width="$getNumberColumnWidth((filteredLowStockItems || []).map((_row, $index) => $index + 1), 50)"
            >
              <template #default="{ $index }">
                <span class="table-number-badge">{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-for="column in lowStockSpecColumns"
              :key="column.key"
              :prop="column.key"
              :label="column.label"
              :min-width="column.width"
              class-name="complete-text-column"
            >
              <template #default="{ row }">
                <span :class="column.key === 'condition_label' ? getLowStockConditionBadge(row.condition_label) : undefined">
                  {{ row[column.key] || '—' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              prop="current_stock"
              label="当前库存"
              width="100"
              align="center"
            >
              <template #default="{ row }">
                <el-tag
                  :type="getStockTagType(row.current_stock, row.reorder_point)"
                  size="small"
                >
                  {{ row.current_stock }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="reorder_point"
              label="预警库存"
              width="100"
              align="center"
            />
            <el-table-column
              prop="unit_cost"
              label="单价"
              :min-width="lowStockColumnWidths.unit_cost"
            >
              <template #default="{ row }">
                ¥{{ formatAmount(row.unit_cost) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="total_value"
              label="总值"
              :min-width="lowStockColumnWidths.total_value"
            >
              <template #default="{ row }">
                ¥{{ formatAmount(row.total_value) }}
              </template>
            </el-table-column>
            <el-table-column
              label="状态"
              width="100"
              align="center"
            >
              <template #default="{ row }">
                <el-tag
                  :type="getStockStatusTagType(row.stock_status)"
                  size="small"
                >
                  {{ getStockStatusText(row.stock_status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="!isMobile"
              label="操作"
              :width="$getActionColumnWidth(1)"
              align="center"
              class-name="actions-column"
            >
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button
                    type="primary"
                    @click.stop="handleReplenish(row)"
                  >
                    补货
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <RecordDetailDialog
            v-model="stockDetailVisible"
            title="库存预警详情"
            :record="stockDetailRow"
            :fields="stockDetailFields"
            :has-actions="true"
          >
            <template #actions="{ row }">
              <el-button
                type="primary"
                @click.stop="stockDetailRunAction(() => handleReplenish(row))"
              >
                补货
              </el-button>
            </template>
          </RecordDetailDialog>
        </section>
      </div>

      <div
        v-if="canViewInventoryField('supplier_count')"
      >
        <el-card class="panel-card supplier-card">
          <template #header>
            <div class="panel-header">
              <div class="panel-title">
                供应商分析
              </div>
              <el-button
                @click="toggleSupplierChartType"
              >
                切换{{ supplierChartType === 'bar' ? '雷达图' : '柱状图' }}
              </el-button>
            </div>
          </template>

          <div
            class="stats-cards"
            role="region"
            aria-label="供应商表现摘要"
            tabindex="0"
          >
            <div class="stat-card stat-card--primary">
              <div class="stat-content">
                <div class="stat-label">
                  活跃供应商
                </div>
                <div class="stat-value">
                  {{ formatNumber(supplierCount) }}
                </div>
              </div>
            </div>
            <div class="stat-card stat-card--success">
              <div class="stat-content">
                <div class="stat-label">
                  平均质量分
                </div>
                <div class="stat-value">
                  {{ formatDecimal(supplierQualityAverage) }}
                </div>
              </div>
            </div>
          </div>

          <div class="supplier-chart-container">
            <div
              ref="supplierChartRef"
              class="chart"
            />
          </div>

          <div class="supplier-highlights">
            <div
              v-for="supplier in supplierHighlights"
              :key="supplier.id"
              class="supplier-highlight"
            >
              <div>
                <div class="supplier-highlight__name">
                  {{ supplier.name }}
                </div>
                <div class="supplier-highlight__meta">
                  {{ formatNumber(supplier.total_products) }} 台 · 质量 {{ formatDecimal(supplier.quality_score) }}
                </div>
              </div>
              <div class="supplier-highlight__value">
                ¥{{ formatAmount(supplier.total_value) }}
              </div>
            </div>
            <div
              v-if="supplierHighlights.length === 0"
              class="supplier-empty"
            >
              暂无供应商分析数据
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AnalyticsStatCard from './AnalyticsStatCard.vue'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import { ref, computed, onBeforeUnmount, watch, nextTick } from 'vue'
import {
  Box,
  Money,
  Warning,
  ShoppingCart
} from '@element-plus/icons-vue'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { useImportExport } from '@/composables/useImportExport'
import { analyticsService } from '@/api/analytics'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import type {
  InventoryAnalytics,
  InventoryLowStockItem,
  InventoryRecentSoldItem,
  InventoryTurnoverPoint
} from '@/types/analytics'
import type { InventoryAnalyticsProps, LoadingChangeEmits } from '@/types/component'
import { useAnalyticsFieldVisibility } from './useAnalyticsFieldVisibility'
import echarts, { ECharts, type EChartsOption, type TopLevelFormatterParams } from '@/utils/echarts'
import { buildCsvContent } from '@/utils/csv-export'
import { logger } from '@/utils/logger'
import { formatDate, formatAmount } from '@/utils/format'
import { getTextColumnMinWidth } from '@/utils/table-layout'

const props = withDefaults(defineProps<InventoryAnalyticsProps>(), {
  loading: false,
  isActive: false,
  startDate: '',
  endDate: '',
  storeId: '',
  supplierId: '',
  searchTrigger: 0
})

const emit = defineEmits<LoadingChangeEmits>()

const { success: _success, error, warning } = useNotification()
const { canViewField: canViewInventoryField, canViewAnyField: canViewAnyInventoryField } = useAnalyticsFieldVisibility('inventory')
const { exportTextFile, buildDateFilename } = useImportExport()

// 响应式数据
const inventoryData = ref<InventoryAnalytics>({
  total_products: 0,
  total_value: 0,
  low_stock_items: 0,
  out_of_stock_items: 0,
  overstock_items: 0,
  stock_turnover: 0,
  inventory_health: {
    score: 0,
    level: 'good',
    issues: [],
    recommendations: []
  },
  category_analysis: [],
  supplier_analysis: []
})

const showInventoryChartsRow = computed(() => canViewAnyInventoryField(['category_distribution_chart', 'turnover_trend_chart']))
const showInventoryTableRow = computed(() => canViewAnyInventoryField(['low_stock_table', 'supplier_count']))

const { loading } = useLoadingState()
const categoryChartType = ref<'bar' | 'pie'>('bar')
const supplierChartType = ref<'bar' | 'radar'>('bar')
const turnoverPeriod = ref<'30d' | '90d' | '180d'>('30d')
const alertLevel = ref('')

// 低库存数据
const lowStockItems = ref<InventoryLowStockItem[]>([])
const turnoverTrendData = ref<InventoryTurnoverPoint[]>([])

// 弹窗控制
const showLowStockDialog = ref(false)

// 供应商数量
const supplierCount = ref(0)

// 最近销售的型号
const recentSoldModels = ref<InventoryRecentSoldItem[]>([])

// 图表引用
const categoryChartRef = ref<HTMLElement>()
const turnoverChartRef = ref<HTMLElement>()
const supplierChartRef = ref<HTMLElement>()

// 图表实例
let categoryChart: ECharts | null = null
let turnoverChart: ECharts | null = null
let supplierChart: ECharts | null = null

// 图表初始化标记
let chartsInitialized = false

const healthLevelText = computed(() => {
  const textMap: Record<string, string> = {
    excellent: '优秀',
    good: '良好',
    warning: '预警',
    critical: '紧急'
  }

  return textMap[inventoryData.value.inventory_health?.level || 'good'] || '良好'
})

const averageUnitCost = computed(() => {
  if (!inventoryData.value.total_products) return 0
  return inventoryData.value.total_value / inventoryData.value.total_products
})

const filteredLowStockItems = computed(() => {
  if (!alertLevel.value) {
    return lowStockItems.value
  }

  if (alertLevel.value === 'critical') {
    return lowStockItems.value.filter((item) => item.stock_status === 'out_of_stock')
  }

  if (alertLevel.value === 'warning') {
    return lowStockItems.value.filter((item) => item.stock_status === 'low_stock')
  }

  return lowStockItems.value
})

const warningSummary = computed(() => {
  return lowStockItems.value.reduce((summary, item) => {
    const currentStock = Number(item.current_stock) || 0
    const reorderPoint = Number(item.reorder_point) || 0
    const shortage = Math.max(reorderPoint - currentStock, 0)
    const unitCost = Number(item.unit_cost) || 0

    summary.total += 1
    summary.shortageUnits += shortage
    summary.replenishmentValue += shortage * unitCost

    if (item.stock_status === 'out_of_stock') {
      summary.criticalCount += 1
    } else if (item.stock_status === 'low_stock') {
      summary.warningCount += 1
    }

    return summary
  }, {
    total: 0,
    criticalCount: 0,
    warningCount: 0,
    shortageUnits: 0,
    replenishmentValue: 0
  })
})

const recentSaleColumnWidths = computed(() => {
  const sales = recentSoldModels.value
  return {
    brand: getTextColumnMinWidth(['品牌', ...sales.map(row => row.brand)], { minWidth: 120 }),
    model: getTextColumnMinWidth(['型号', ...sales.map(row => row.model)], { minWidth: 180 }),
    color: getTextColumnMinWidth(['颜色', ...sales.map(row => row.color)], { minWidth: 100 }),
    sale_price: getTextColumnMinWidth(['销售价', ...sales.map(row => `¥${formatAmount(row.sale_price)}`)], { minWidth: 120 }),
    sale_time: getTextColumnMinWidth(['销售时间', ...sales.map(row => row.sale_time)], { minWidth: 180 }),
    store: getTextColumnMinWidth(['销售门店', ...sales.map(row => row.store)], { minWidth: 120 })
  }
})

const lowStockSpecFields = [
  { key: 'brand', label: '品牌', minWidth: 80 },
  { key: 'model', label: '型号', minWidth: 120 },
  { key: 'color', label: '颜色', minWidth: 80 },
  { key: 'memory', label: '内存', minWidth: 80 },
  { key: 'condition_label', label: '成色', minWidth: 80 }
] as const

const lowStockSpecColumns = computed(() => lowStockSpecFields.map(field => ({
  ...field,
  width: getTextColumnMinWidth(
    [field.label, ...filteredLowStockItems.value.map(row => row[field.key])],
    { minWidth: field.minWidth }
  )
})))

const getLowStockConditionBadge = (condition: string) => {
  if (condition === '全新') return 'condition-badge condition-new'
  if (condition === '二手') return 'condition-badge condition-used'
  return undefined
}

const getLowStockSpecDetail = (row: InventoryLowStockItem, visible: boolean): RecordDetailField[] =>
  lowStockSpecFields.map(({ key, label }) => ({ key, label, value: row[key] || '—', visible }))

const lowStockColumnWidths = computed(() => {
  const items = filteredLowStockItems.value
  return {
    unit_cost: getTextColumnMinWidth(['成本价', ...items.map(row => `¥${formatAmount(row.unit_cost)}`)], { minWidth: 120 }),
    total_value: getTextColumnMinWidth(['库存价值', ...items.map(row => `¥${formatAmount(row.total_value)}`)], { minWidth: 120 }),
    last_sale_time: getTextColumnMinWidth(['最近销售', ...items.map(row => formatDate(row.last_sale_time))], { minWidth: 140 })
  }
})

const recentSalesSummary = computed(() => {
  const totalSales = recentSoldModels.value.reduce((sum, item) => sum + (Number(item.sale_price) || 0), 0)
  const latestRecord = recentSoldModels.value[0]

  return {
    totalSales,
    latestStore: latestRecord?.store || '暂无',
    latestSaleDate: latestRecord?.sale_time || '暂无记录'
  }
})

const supplierHighlights = computed(() => {
  return [...(inventoryData.value?.supplier_analysis || [])]
    .sort((a, b) => (Number(b.total_value) || 0) - (Number(a.total_value) || 0))
    .slice(0, 3)
})

const topSupplierName = computed(() => supplierHighlights.value[0]?.name || '暂无')

const topSupplierValue = computed(() => {
  return Number(supplierHighlights.value[0]?.total_value) || 0
})

const supplierQualityAverage = computed(() => {
  const supplierList = inventoryData.value?.supplier_analysis || []
  if (supplierList.length === 0) return 0

  const total = supplierList.reduce((sum, item) => sum + (Number(item.quality_score) || 0), 0)
  return total / supplierList.length
})

// 方法

// 缓存键
const CACHE_KEYS = {
  inventory: (params: Record<string, unknown>) => `/analytics/inventory:${JSON.stringify(params)}`,
  lowStock: (params: Record<string, unknown>) => `/analytics/inventory/low-stock:${JSON.stringify(params)}`,
  turnover: (params: Record<string, unknown>) => `/analytics/inventory/turnover:${JSON.stringify(params)}`,
  supplierStats: (params: InventoryFilterParams) => `/analytics/inventory/supplier-stats:${JSON.stringify(params)}`,
  recentSold: (params: InventoryFilterParams) => `/analytics/inventory/recent-sold:${JSON.stringify(params)}`
}

type InventoryFilterParams = {
  store_id?: number
  supplier_id?: number
}

const buildInventoryFilters = (): InventoryFilterParams => {
  const filters: InventoryFilterParams = {}
  const storeId = Number(props.storeId)
  const supplierId = Number(props.supplierId)

  if (Number.isSafeInteger(storeId) && storeId > 0) {
    filters.store_id = storeId
  }
  if (Number.isSafeInteger(supplierId) && supplierId > 0) {
    filters.supplier_id = supplierId
  }

  return filters
}

const loadInventoryData = async (showLoadingState = true) => {
  try {
    if (showLoadingState) {
      loading.value = true
      emit('loading-change', true)
    }

    // 库存快照和预警接口按门店/供应商筛选；日期筛选不适用于当前库存快照。
    const params = buildInventoryFilters()

    const cacheKeyInventory = CACHE_KEYS.inventory(params)
    const cacheKeyLowStock = CACHE_KEYS.lowStock({ ...params, page_size: 200 })
    const cacheKeyTurnover = CACHE_KEYS.turnover({ period: turnoverPeriod.value, ...params })

    // 并行获取数据（使用缓存）
    const [inventoryResponse, lowStockDetailResponse, turnoverResponse] = await Promise.all([
      useCachedRequest(cacheKeyInventory, () => analyticsService.getInventoryAnalytics(params), DEFAULT_CACHE_TTL.STATIC),
      useCachedRequest(cacheKeyLowStock, () => analyticsService.getLowStockItems({ ...params, page_size: 200 }), DEFAULT_CACHE_TTL.DYNAMIC),
      useCachedRequest(cacheKeyTurnover, () => analyticsService.getInventoryTurnover({ period: turnoverPeriod.value, ...params }), DEFAULT_CACHE_TTL.DYNAMIC)
    ])

    if (inventoryResponse.success && inventoryResponse.data) {
      inventoryData.value = inventoryResponse.data
    }

    // 获取低库存详情
    if (lowStockDetailResponse.success) {
      lowStockItems.value = lowStockDetailResponse.data || []
    }

    // 计算供应商数量（有货的供应商）
    await calculateSupplierCount(params)

    // 获取最近销售的10个型号
    await loadRecentSoldModels(params)

    // 获取周转率数据
    if (turnoverResponse.success) {
      turnoverTrendData.value = turnoverResponse.data || []
    }

    updateCharts()
  } catch (err) {
    logger.error('获取库存数据失败:', err)
    error('获取库存数据失败')
  } finally {
    if (showLoadingState) {
      loading.value = false
      emit('loading-change', false)
    }
  }
}

defineExpose({
  refreshSilently: () => loadInventoryData(false)
})

// 计算有货的供应商数量
const calculateSupplierCount = async (filters: InventoryFilterParams = buildInventoryFilters()) => {
  try {
    // 查询有库存的商品，按供应商分组统计
    const response = await useCachedRequest(CACHE_KEYS.supplierStats(filters), () =>
      analyticsService.getInventorySupplierStats(filters), DEFAULT_CACHE_TTL.STATIC)
    if (response.success && response.data) {
      supplierCount.value = Number(response.data.supplier_count) || 0
    } else {
      supplierCount.value = 0
    }
  } catch (err) {
    logger.error('获取供应商统计失败:', err)
    supplierCount.value = 0
  }
}

// 加载最近销售的型号
const loadRecentSoldModels = async (filters: InventoryFilterParams = buildInventoryFilters()) => {
  try {
    const params = { ...filters, page_size: 10 }

    const response = await useCachedRequest(CACHE_KEYS.recentSold(filters), () =>
      analyticsService.getRecentSoldInventory(params), DEFAULT_CACHE_TTL.DYNAMIC)
    if (response.success && response.data) {
      recentSoldModels.value = response.data || []
    }
  } catch (err) {
    logger.error('获取最近销售型号失败:', err)
  }
}

const formatNumber = (num?: number | null) => {
  if (num === undefined || num === null) return '0'
  return num.toLocaleString('zh-CN')
}

const formatDecimal = (num?: number | null) => {
  if (num === undefined || num === null || Number.isNaN(num)) return '0.0'
  return Number(num).toFixed(1)
}

const getStockTagType = (stock: number, reorderPoint: number) => {
  if (stock === 0) return 'danger'
  if (stock <= reorderPoint) return 'warning'
  return 'success'
}

const getStockStatusTagType = (status?: string): 'success' | 'warning' | 'danger' | 'info' => {
  const typeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    in_stock: 'success',
    low_stock: 'warning',
    out_of_stock: 'danger',
    overstock: 'info'
  }
  return typeMap[status || 'in_stock'] || 'info'
}

const getStockStatusText = (status?: string) => {
  const textMap: Record<string, string> = {
    in_stock: '正常',
    low_stock: '库存不足',
    out_of_stock: '缺货',
    overstock: '积压'
  }
  return textMap[status || 'in_stock'] || '正常'
}

const handleReplenish = (row: InventoryLowStockItem) => {
  // 当前页面没有写入补货单的后端接口，不能提示虚假的“创建成功”。
  warning(`请在库存管理中为 ${row.brand} ${row.model} 创建补货单`)
}

const exportLowStock = () => {
  try {
    if (!filteredLowStockItems.value.length) {
      warning('当前没有可导出的库存预警数据')
      return
    }

    const csvContent = generateLowStockCSV()
    void exportTextFile({
      content: csvContent,
      filename: buildDateFilename('库存预警', 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      successMessage: '导出成功',
      errorMessage: '导出失败'
    })
  } catch (err) {
    error('导出失败')
  }
}

const generateLowStockCSV = () => {
  return buildCsvContent(
    ['产品ID', ...lowStockSpecFields.map(field => field.label), '当前库存', '预警库存', '单价', '总值', '状态'],
    filteredLowStockItems.value.map((item) => ([
      item.id,
      ...lowStockSpecFields.map(field => item[field.key]),
      item.current_stock,
      item.reorder_point,
      item.unit_cost,
      item.total_value,
      getStockStatusText(item.stock_status)
    ]))
  )
}

const initCharts = () => {
  // 销毁旧实例
  if (categoryChart) {
    categoryChart.dispose()
    categoryChart = null
  }
  if (turnoverChart) {
    turnoverChart.dispose()
    turnoverChart = null
  }
  if (supplierChart) {
    supplierChart.dispose()
    supplierChart = null
  }

  // 初始化分类分析图
  if (categoryChartRef.value) {
    categoryChart = echarts.init(categoryChartRef.value)
  }

  // 初始化周转趋势图
  if (turnoverChartRef.value) {
    turnoverChart = echarts.init(turnoverChartRef.value)
  }

  // 初始化供应商分析图
  if (supplierChartRef.value) {
    supplierChart = echarts.init(supplierChartRef.value)
  }

  // 所有图表初始化完成
  chartsInitialized = true
  updateCharts()
}

const updateCategoryChart = () => {
  if (!categoryChart) return

  if (!inventoryData.value?.category_analysis) return

  const data = (inventoryData.value.category_analysis || []).map(item => ({
    name: item.category,
    value: item.total_value || 0,
    turnover_rate: item.turnover_rate || 0
  }))

  const option: EChartsOption = {
    color: ['#205781', '#4F959D', '#98D2C0', '#F6B17A', '#E07A5F', '#3D405B'],
    tooltip: {
      trigger: 'item',
      formatter: (params: TopLevelFormatterParams) => {
        const item = Array.isArray(params) ? params[0] : params
        const data = item.data && typeof item.data === 'object' ? item.data as { turnover_rate?: number } : {}
        return `${item.name}<br/>库存价值: ¥${formatAmount(Number(item.value) || 0)}<br/>周转率: ${formatDecimal(Number(data.turnover_rate) || 0)}`
      }
    },
    grid: {
      left: 48,
      right: 16,
      top: 40,
      bottom: 36
    },
    legend: {
      bottom: 0,
      left: 'center'
    }
  }

  if (data.length === 0) {
    option.graphic = {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: '暂无分类库存数据',
        fill: '#8b98a7',
        fontSize: 14
      }
    }
  }

  if (categoryChartType.value === 'pie') {
    option.series = [{
      name: '库存价值',
      type: 'pie',
      radius: ['40%', '70%'],
      data: data,
      label: {
        formatter: '{b}\n{d}%'
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 18,
          shadowOffsetX: 0,
          shadowColor: 'rgba(32, 87, 129, 0.28)'
        }
      }
    }]
  } else {
    option.xAxis = {
      type: 'category',
      data: data.map(item => item.name),
      axisLine: { lineStyle: { color: '#d6dde5' } },
      axisLabel: { color: '#5b6572' }
    }
    option.yAxis = {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#edf1f5' } },
      axisLabel: { color: '#7a8794' }
    }
    option.series = [{
      name: '库存价值',
      type: 'bar',
      data: data.map(item => item.value),
      barWidth: 22,
      itemStyle: {
        borderRadius: [10, 10, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#4F959D' },
          { offset: 1, color: '#205781' }
        ])
      }
    }]
  }

  categoryChart.setOption(option, true)
}

const updateTurnoverChart = () => {
  if (!turnoverChart) return

  // 使用实际的周转率趋势数据
  const periods = turnoverTrendData.value.map(item => item.date)
  const turnoverData = turnoverTrendData.value.map(item => item.actual_turnover)
  const targetData = turnoverTrendData.value.map(item => item.target_turnover)

  const option: EChartsOption = {
    color: ['#205781', '#F6B17A'],
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['实际周转率', '目标周转率'],
      top: 0
    },
    xAxis: {
      type: 'category',
      data: periods,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#d6dde5' } },
      axisLabel: { color: '#5b6572' }
    },
    yAxis: {
      type: 'value',
      name: '周转率',
      splitLine: { lineStyle: { color: '#edf1f5' } },
      axisLabel: { color: '#7a8794' }
    },
    grid: {
      left: 48,
      right: 24,
      top: 48,
      bottom: 36
    },
    series: [
      {
        name: '实际周转率',
        type: 'line',
        data: turnoverData,
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3 },
        itemStyle: { color: '#205781' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(32, 87, 129, 0.22)' },
            { offset: 1, color: 'rgba(32, 87, 129, 0.02)' }
          ])
        }
      },
      {
        name: '目标周转率',
        type: 'line',
        data: targetData,
        symbol: 'none',
        lineStyle: { type: 'dashed', width: 2, color: '#F6B17A' }
      }
    ]
  }

  if (periods.length === 0) {
    option.graphic = {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: '暂无周转趋势数据',
        fill: '#8b98a7',
        fontSize: 14
      }
    }
  }

  turnoverChart.setOption(option, true)
}

const updateSupplierChart = () => {
  if (!supplierChart) return

  // 使用实际的供应商分析数据
  const supplierData = inventoryData.value?.supplier_analysis || []

  const option: EChartsOption = {
    color: ['#4F959D', '#F6B17A', '#98D2C0', '#205781'],
    tooltip: {
      trigger: 'item'
    },
    grid: {
      left: 32,
      right: 12,
      top: 36,
      bottom: 30
    }
  }

  if (supplierData.length === 0) {
    option.graphic = {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: '暂无供应商分析数据',
        fill: '#8b98a7',
        fontSize: 14
      }
    }
  }

  if (supplierChartType.value === 'bar') {
    option.xAxis = {
      type: 'category',
      data: supplierData.map(item => item.name),
      axisLine: { lineStyle: { color: '#d6dde5' } },
      axisLabel: { color: '#5b6572', interval: 0, rotate: supplierData.length > 4 ? 20 : 0 }
    }
    option.yAxis = {
      type: 'value',
      splitLine: { lineStyle: { color: '#edf1f5' } },
      axisLabel: { color: '#7a8794' }
    }
    option.series = [{
      name: '库存价值',
      type: 'bar',
      data: supplierData.map(item => ({
        value: item.total_value,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#F6B17A' },
            { offset: 1, color: '#E07A5F' }
          ]),
          borderRadius: [10, 10, 0, 0]
        }
      }))
    }]
  } else {
    const maxValue = Math.max(...supplierData.map(item => Number(item.total_value) || 0), 1)
    const maxProducts = Math.max(...supplierData.map(item => Number(item.total_products) || 0), 1)
    const maxQuality = Math.max(...supplierData.map(item => Number(item.quality_score) || 0), 100)

    option.radar = {
      indicator: [
        { name: '库存价值', max: maxValue },
        { name: '商品数量', max: maxProducts },
        { name: '质量评分', max: maxQuality }
      ],
      radius: 88
    }
    option.series = [{
      name: '供应商表现',
      type: 'radar',
      data: supplierData.map(item => ({
        value: [
          item.total_value,
          item.total_products,
          item.quality_score
        ],
        name: item.name
      })),
      areaStyle: {
        color: 'rgba(32, 87, 129, 0.18)'
      },
      lineStyle: {
        color: '#205781'
      }
    }]
  }

  supplierChart.setOption(option, true)
}

const toggleCategoryChartType = () => {
  categoryChartType.value = categoryChartType.value === 'bar' ? 'pie' : 'bar'
  updateCategoryChart()
}

const toggleSupplierChartType = () => {
  supplierChartType.value = supplierChartType.value === 'bar' ? 'radar' : 'bar'
  updateSupplierChart()
}

const updateCharts = () => {
  nextTick(() => {
    setTimeout(() => {
      updateCategoryChart()
      updateTurnoverChart()
      updateSupplierChart()

      if (categoryChart) categoryChart.resize()
      if (turnoverChart) turnoverChart.resize()
      if (supplierChart) supplierChart.resize()
    }, 100)
  })
}

// 监听器
watch(() => props.isActive, (isActive) => {
  if (isActive && !chartsInitialized) {
    nextTick(() => {
      setTimeout(() => {
        initCharts()
        loadInventoryData()
      }, 100)
    })
  }
}, { immediate: true })

// 监听搜索触发
watch(() => props.searchTrigger, () => {
  if (props.isActive) {
    // 搜索触发，重新加载数据
    loadInventoryData()
  }
})

watch(turnoverPeriod, () => {
  if (chartsInitialized) {
    loadInventoryData()
  }
})

// 销毁时清理图表实例
onBeforeUnmount(() => {
  if (categoryChart) {
    categoryChart.dispose()
    categoryChart = null
  }
  if (turnoverChart) {
    turnoverChart.dispose()
    turnoverChart = null
  }
  if (supplierChart) {
    supplierChart.dispose()
    supplierChart = null
  }
})

const { isMobile } = useMobile()
const { detailRow: soldDetailRow, detailVisible: soldDetailVisible, doubleTapOptions: soldDetailTapOptions, handleRowDoubleClick: soldDetailDoubleClick } = useMobileTableDetail<(typeof recentSoldModels.value)[number]>({
  enabled: () => isMobile.value, rows: () => recentSoldModels.value, getKey: row => JSON.stringify([row.brand, row.model, row.color, row.sale_time, row.store])
})
const soldDetailFields = computed<RecordDetailField[]>(() => {
  const row = soldDetailRow.value
  if (!row) return []
  return [
    { key: 'brand', label: '品牌', value: row.brand, visible: canViewInventoryField('recent_sales_table') },
    { key: 'model', label: '型号', value: row.model, visible: canViewInventoryField('recent_sales_table'), wide: true },
    { key: 'color', label: '颜色', value: row.color, visible: canViewInventoryField('recent_sales_table') },
    { key: 'sale_price', label: '销售价', value: formatAmount(row.sale_price), visible: canViewInventoryField('recent_sales_table') },
    { key: 'sale_time', label: '销售时间', value: row.sale_time, visible: canViewInventoryField('recent_sales_table'), wide: true },
    { key: 'store', label: '销售门店', value: row.store, visible: canViewInventoryField('recent_sales_table') }
  ]
})


const { detailRow: stockDetailRow, detailVisible: stockDetailVisible, doubleTapOptions: stockDetailTapOptions, handleRowDoubleClick: stockDetailDoubleClick, runDetailAction: stockDetailRunAction } = useMobileTableDetail<(typeof filteredLowStockItems.value)[number]>({
  enabled: () => isMobile.value && canViewInventoryField('low_stock_table'), rows: () => filteredLowStockItems.value, getKey: row => row.id
})
const stockDetailFields = computed<RecordDetailField[]>(() => {
  const row = stockDetailRow.value
  if (!row) return []
  return [
    ...getLowStockSpecDetail(row, canViewInventoryField('low_stock_table')),
    { key: 'current_stock', label: '当前库存', value: row.current_stock, visible: canViewInventoryField('low_stock_table') },
    { key: 'reorder_point', label: '预警库存', value: row.reorder_point, visible: canViewInventoryField('low_stock_table') },
    { key: 'unit_cost', label: '单价', value: formatAmount(row.unit_cost), visible: canViewInventoryField('low_stock_table') },
    { key: 'total_value', label: '总值', value: formatAmount(row.total_value), visible: canViewInventoryField('low_stock_table') },
    { key: 'field5', label: '状态', value: getStockStatusText(row.stock_status), visible: canViewInventoryField('low_stock_table') }
  ]
})
const { detailRow: warningDetailRow, detailVisible: warningDetailVisible, doubleTapOptions: warningDetailTapOptions, handleRowDoubleClick: warningDetailDoubleClick } = useMobileTableDetail({
  enabled: () => isMobile.value && showLowStockDialog.value && canViewInventoryField('low_stock_dialog'),
  rows: filteredLowStockItems, getKey: row => row.id
})
const warningDetailFields = computed<RecordDetailField[]>(() => {
  const row = warningDetailRow.value
  const visible = canViewInventoryField('low_stock_dialog')
  return row ? [
    ...getLowStockSpecDetail(row, visible),
    { key: 'current_stock', label: '当前库存', value: row.current_stock, visible },
    { key: 'reorder_point', label: '预警库存', value: row.reorder_point, visible },
    { key: 'unit_cost', label: '成本价', value: formatAmount(row.unit_cost), visible },
    { key: 'total_value', label: '库存价值', value: formatAmount(row.total_value), visible },
    { key: 'last_sale_time', label: '最近销售', value: formatDate(row.last_sale_time), visible }
  ] : []
})

</script>

<style lang="scss" scoped src="./styles/inventory-analytics/overview.scss"></style>
<style lang="scss" scoped src="./styles/inventory-analytics/supplier-summary.scss"></style>
