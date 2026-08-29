<template>
  <MobileDialog
    :model-value="modelValue"
    title="员工销售明细"
    :width="dialogWidth"
    dialog-class="salary-dialog salary-dialog-large"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div
      v-if="employee"
      class="sales-details admin-page"
    >
      <div class="details-info">
        <div
          v-if="canViewField('salary_salaryrecordsview', 'employee_name')"
          class="info-row"
        >
          <label>员工姓名:</label>
          <span>{{ employee.name }}</span>
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'period_start')"
          class="info-row"
        >
          <label>月份:</label>
          <span>{{ salaryMonth }}</span>
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
          class="info-row"
        >
          <label>销售数量:</label>
          <span class="highlight">{{ summary.total_count }} 台</span>
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
          class="info-row"
        >
          <label>销售额:</label>
          <span class="amount">¥{{ formatAmount(summary.total_sales) }}</span>
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
          class="info-row"
        >
          <label>总利润:</label>
          <span class="profit">¥{{ formatAmount(summary.total_profit) }}</span>
        </div>
      </div>

      <div class="sales-details-table">
        <h4 class="section-title">
          销售明细列表
        </h4>
        <SectionLoading
          v-if="loading"
          text="加载中..."
        />

        <div
          v-else-if="details.length > 0"
          class="table-responsive salary-detail-table-wrap"
          :style="{ '--salary-detail-table-width': `${tableWidth}px` }"
          @pointerdown="startTableDrag"
          @pointermove="moveTableDrag"
          @pointerup="stopTableDrag"
          @pointercancel="stopTableDrag"
          @wheel="handleTableWheel"
        >
          <el-table
            :data="details"
            border
            stripe
            class="data-table devices-table base-data-table salary-sales-detail-table"
            table-layout="fixed"
            :fit="false"
          >
            <el-table-column
              label="序号"
              width="60"
              align="center"
            >
              <template #default="{ $index }">
                <span class="id-badge">{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
              label="机型"
              width="72"
              align="center"
            >
              <template #default="{ row }">
                <el-tag
                  :type="row.is_new ? 'success' : 'warning'"
                  size="small"
                >
                  {{ row.is_new ? '全新' : '二手' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
              prop="model"
              label="型号"
              :width="modelColumnWidth"
              align="center"
            >
              <template #default="{ row }">
                {{ row.model || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
              prop="color"
              label="颜色"
              width="78"
              align="center"
            >
              <template #default="{ row }">
                {{ row.color || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
              label="IMEI"
              :width="imeiColumnWidth"
              align="center"
              class-name="identifier-column"
            >
              <template #default="{ row }">
                <span class="imei-text">{{ row.imei || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'employee_name')"
              prop="customer_name"
              label="客户"
              :width="customerColumnWidth"
              align="center"
            >
              <template #default="{ row }">
                {{ row.customer_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
              label="销售价"
              width="96"
              align="center"
            >
              <template #default="{ row }">
                <span class="price">¥{{ formatAmount(row.sale_price) }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
              label="利润"
              width="92"
              align="center"
            >
              <template #default="{ row }">
                <span :class="row.profit >= 0 ? 'profit-positive' : 'profit-negative'">
                  ¥{{ formatAmount(row.profit) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'paid_at')"
              label="销售时间"
              width="132"
              align="center"
            >
              <template #default="{ row }">
                <span class="time-cell">{{ formatSaleTime(row.sale_time) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <DataEmptyState
          v-else
          size="compact"
          description="暂无销售明细数据"
        />
      </div>
    </div>

    <template #footer>
      <el-button
        type="default"
        @click="emit('update:modelValue', false)"
      >
        关闭
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import MobileDialog from '@/components/MobileDialog.vue'
import SectionLoading from '@/components/SectionLoading.vue'

interface EmployeeSalesRecord {
  name?: string | null
  [key: string]: unknown
}

interface EmployeeSalesDetail {
  color?: string | null
  customer_name?: string | null
  imei?: string | null
  is_new?: boolean
  model?: string | null
  profit: number
  sale_price?: number | string | null
  sale_time?: string | null
  [key: string]: unknown
}

interface EmployeeSalesSummary {
  total_count: number
  total_profit: number | string
  total_sales: number | string
}

defineProps<{
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  customerColumnWidth: number
  details: EmployeeSalesDetail[]
  dialogWidth: string
  employee: EmployeeSalesRecord | null
  formatAmount: (_amount: unknown) => string
  formatSaleTime: (_time: string) => string
  imeiColumnWidth: number
  loading: boolean
  modelColumnWidth: number
  modelValue: boolean
  salaryMonth: string
  summary: EmployeeSalesSummary
  tableWidth: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const dragState = {
  element: null as HTMLElement | null,
  pointerId: null as number | null,
  startX: 0,
  startScrollLeft: 0
}

const startTableDrag = (event: PointerEvent) => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return
  const element = event.currentTarget as HTMLElement
  if (element.scrollWidth <= element.clientWidth) return
  dragState.element = element
  dragState.pointerId = event.pointerId
  dragState.startX = event.clientX
  dragState.startScrollLeft = element.scrollLeft
  element.setPointerCapture(event.pointerId)
  element.classList.add('is-dragging')
}

const moveTableDrag = (event: PointerEvent) => {
  if (!dragState.element || dragState.pointerId !== event.pointerId) return
  event.preventDefault()
  dragState.element.scrollLeft = dragState.startScrollLeft - (event.clientX - dragState.startX)
}

const stopTableDrag = (event: PointerEvent) => {
  if (!dragState.element || dragState.pointerId !== event.pointerId) return
  if (dragState.element.hasPointerCapture(event.pointerId)) {
    dragState.element.releasePointerCapture(event.pointerId)
  }
  dragState.element.classList.remove('is-dragging')
  dragState.element = null
  dragState.pointerId = null
}

const handleTableWheel = (event: WheelEvent) => {
  if (!event.shiftKey) return
  const element = event.currentTarget as HTMLElement
  if (element.scrollWidth <= element.clientWidth) return
  event.preventDefault()
  element.scrollLeft += event.deltaY || event.deltaX
}
</script>

<style lang="scss" scoped>
.sales-details {
  .details-info {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 24px;
    padding: 12px 16px;
    background: linear-gradient(135deg, var(--tf-color-surface) 0%, var(--tf-color-border-cool-alt) 100%);
    border: 1px solid var(--tf-color-border-element);
    border-radius: 12px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
  }

  .info-row {
    display: flex;
    flex-shrink: 0;
    align-items: baseline;
    gap: 6px;
    min-width: fit-content;
    padding: 6px 12px;
    background: var(--tf-color-white);
    border: 1px solid var(--color-border-light);
    border-radius: 8px;

    label {
      color: var(--color-info);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }

    span {
      color: var(--color-text-primary);
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
    }

    .amount {
      color: var(--color-warning);
      font-family: 'Monaco', 'Consolas', monospace;
    }

    .profit {
      color: var(--color-success);
      font-family: 'Monaco', 'Consolas', monospace;
    }

    .highlight {
      color: var(--color-primary);
      font-size: 16px;
    }
  }

  .sales-details-table {
    .section-title {
      margin: 0 0 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--tf-color-border-element);
      color: var(--color-text-primary);
      font-size: 15px;
      font-weight: 600;
    }

    .price,
    .profit-positive,
    .profit-negative,
    .time-cell,
    .imei-text {
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
      font-variant-numeric: tabular-nums;
    }

    .price,
    .profit-positive {
      color: var(--color-success);
      font-weight: 600;
    }

    .profit-negative {
      color: var(--color-danger);
      font-weight: 600;
    }

    .time-cell {
      color: var(--color-text-regular);
    }

    .imei-text {
      color: var(--el-text-color-primary);
      font-weight: 600;
      white-space: nowrap;
    }
  }
}

.salary-detail-table-wrap {
  width: min(100%, var(--salary-detail-table-width));
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  touch-action: pan-x pan-y;
}

.salary-sales-detail-table {
  width: var(--salary-detail-table-width);
  min-width: var(--salary-detail-table-width);
  max-width: none;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-info);

  i {
    margin-bottom: 16px;
    font-size: 48px;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

@media (hover: hover) and (pointer: fine) {
  .salary-detail-table-wrap {
    cursor: grab;

    &.is-dragging {
      cursor: grabbing;
      user-select: none;
    }
  }
}

@media (max-width: 767px) {
  .sales-details .details-info {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 12px 10px;
  }

  .sales-details .info-row {
    justify-content: space-between;
  }
}
</style>
