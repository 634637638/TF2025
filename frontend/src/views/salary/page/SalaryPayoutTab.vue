<template>
  <el-tab-pane
    data-view-permission="salary-records:view"
    label="工资计算"
    name="payout"
    class="tf-tab-panel salary-payout-tab"
  >
    <UnifiedSearchPanel
      :expanded="searchExpanded"
      :loading="loading"
      @update:expanded="emit('update:searchExpanded', $event)"
      @search="emit('search')"
      @reset="emit('reset')"
    >
      <template #primary>
        <el-input
          :model-value="searchText"
          placeholder="搜索员工姓名或工号"
          clearable
          @update:model-value="emit('update:searchText', $event)"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-user" />
          </template>
        </el-input>
      </template>
      <template #actions="{ loading: searchLoading }">
        <el-button
          type="primary"
          size="small"
          :loading="searchLoading"
          :aria-busy="searchLoading"
          @click="emit('search')"
        >
          <i class="fas fa-search" />搜索
        </el-button>
        <el-button
          type="default"
          size="small"
          :disabled="searchLoading"
          @click="emit('reset')"
        >
          <i class="fas fa-redo" />重置
        </el-button>
      </template>

      <div
        v-if="canViewField('salary_salaryrecordsview', 'period_start')"
        class="form-group filter-item"
        data-field="month"
      >
        <el-date-picker
          :model-value="month"
          type="month"
          placeholder="选择月份"
          value-format="YYYY-MM"
          @update:model-value="emit('update:month', $event)"
          @change="emit('monthChange')"
        />
      </div>
      <div
        v-if="canViewField('salary_salaryrecordsview', 'salary_status')"
        class="form-group filter-item"
        data-field="status"
      >
        <el-select
          :model-value="statusFilter"
          placeholder="状态"
          clearable
          @update:model-value="emit('update:statusFilter', $event)"
          @change="emit('statusChange')"
        >
          <el-option
            label="未结算"
            value="unpaid"
          />
          <el-option
            label="已结算"
            value="paid"
          />
        </el-select>
      </div>
    </UnifiedSearchPanel>

    <div class="table-section admin-panel admin-table-panel">
      <div class="section-header">
        <div class="section-title">
          <i class="fas fa-list" />工资计算<span class="record-count">共 {{ total }} 条记录</span>
        </div>
      </div>
      <div class="table-responsive">
        <el-table
          ref="tableRef"
          :data="loading ? [] : rows"
          border
          stripe
          table-layout="fixed"
          :fit="true"
          row-key="id"
          class="data-table devices-table base-data-table salary-payout-table"
          @row-click="handleRowTap"
        >
          <template #empty>
            <TableLoadingRow
              v-if="loading"
              mode="block"
              text="加载中..."
            />
            <DataEmptyState
              v-else
              description="暂无工资发放数据"
            />
          </template>

          <el-table-column
            v-if="isMobile && showActionColumn"
            type="expand"
            width="1"
            class-name="mobile-expand-column"
            label-class-name="mobile-expand-header"
          >
            <template #default="{ row }">
              <div class="mobile-row-actions">
                <el-button
                  v-if="canCreate"
                  v-permission="'salary-records:create'"
                  size="small"
                  :type="row.payoutRecord ? 'warning' : 'primary'"
                  class="mobile-action-btn mobile-action-btn-status"
                  @click.stop="row.payoutRecord ? emit('recalculate', row) : emit('settle', row)"
                >
                  <i :class="row.payoutRecord ? 'fas fa-rotate' : 'fas fa-check'" />
                  <span>{{ row.payoutRecord ? '重算' : '结算' }}</span>
                </el-button>
                <el-button
                  v-if="row.payoutRecord && canEdit"
                  v-permission="'salary-records:edit'"
                  size="small"
                  type="success"
                  class="mobile-action-btn mobile-action-btn-status"
                  @click.stop="emit('edit', row)"
                >
                  <span>编辑</span>
                </el-button>
                <el-button
                  v-if="row.payoutRecord && canDelete"
                  v-permission="'salary-records:delete'"
                  size="small"
                  type="danger"
                  class="mobile-action-btn mobile-action-btn-delete"
                  @click.stop="emit('delete', row)"
                >
                  <span>删除</span>
                </el-button>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            v-if="!isMobile"
            label="序号"
            min-width="50"
            align="center"
          >
            <template #default="{ $index }">
              {{ getIndex($index) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'employee_username')"
            label="员工工号"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <span>{{ row.username }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_salaryrecordsview', 'employee_name')"
            :label="isMobile ? '姓名' : '员工姓名'"
            :min-width="isMobile ? 86 : 90"
            align="center"
          >
            <template #default="{ row }">
              <span>{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'base_salary')"
            label="底薪"
            min-width="80"
            align="center"
          >
            <template #default="{ row }">
              <span class="amount-text">¥{{ getBaseSalary(row.id) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'sales_count')"
            label="数量"
            min-width="70"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-regular font-semibold">{{ getSalesStats(row.id).sales_count }}台</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
            label="提成"
            :min-width="isMobile ? 80 : 90"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getSalesStats(row.id).sales_count > 0"
                class="text-danger font-semibold salary-mobile-commission"
              >
                {{ isMobile ? calculateCommission(row.id) : `¥${calculateCommission(row.id)}` }}
              </span>
              <span
                v-else
                class="text-secondary salary-mobile-commission"
              >0</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'actual_work_days')"
            label="工作天数"
            min-width="85"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-success font-semibold">{{ calculateWorkDays(row.id) }}天</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'monthly_leave_days')"
            label="休假"
            min-width="80"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-success">
                {{ getAttendanceStats(row.id).monthly_leave_days_used || 0 }}/{{ getAttendanceStats(row.id).monthly_leave_days_available || 0 }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'leave_days')"
            label="请假"
            min-width="70"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getAttendanceStats(row.id).leave_days > 0"
                class="text-danger font-semibold"
              >
                {{ getAttendanceStats(row.id).leave_days }}天
              </span>
              <span
                v-else
                class="text-secondary"
              >0</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'leave_deduction')"
            label="请假扣款"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getAttendanceStats(row.id).leave_days > 0"
                class="text-danger font-semibold"
              >
                -¥{{ calculateLeave(row.id, getAttendanceStats(row.id).leave_days) }}
              </span>
              <span
                v-else
                class="text-secondary"
              >0</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'overtime_hours')"
            label="加班"
            min-width="80"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getAttendanceStats(row.id).overtime_hours > 0"
                class="text-blue font-semibold"
              >
                {{ Math.round(getAttendanceStats(row.id).overtime_hours) }}小时
              </span>
              <span
                v-else
                class="text-secondary"
              >0</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_salaryrecordsview', 'overtime_pay')"
            :label="isMobile ? '加班' : '加班费'"
            :min-width="isMobile ? 80 : 90"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getAttendanceStats(row.id).overtime_hours > 0"
                class="text-blue font-semibold salary-mobile-overtime"
              >
                {{ isMobile ? calculateOvertime(row.id, getAttendanceStats(row.id).overtime_hours) : `¥${calculateOvertime(row.id, getAttendanceStats(row.id).overtime_hours)}` }}
              </span>
              <span
                v-else
                class="text-secondary salary-mobile-overtime"
              >0</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_salaryrecordsview', 'net_salary')"
            :label="isMobile ? '预计工资' : '应发工资'"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <span class="payout-salary-amount text-blue salary-mobile-net">
                {{ isMobile ? calculateEstimated(row.id) : `¥${calculateEstimated(row.id)}` }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'net_salary')"
            label="已发工资"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="row.payoutRecord"
                class="payout-salary-amount text-success"
              >
                ¥{{ Number(row.payoutRecord.net_salary || 0).toFixed(2) }}
              </span>
              <span
                v-else
                class="text-secondary"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="showStatusColumn"
            label="状态"
            min-width="108"
            align="center"
          >
            <template #default="{ row }">
              <div
                v-if="canViewField('salary_salaryrecordsview', 'salary_status') && row.payoutRecord"
                class="salary-status-cell"
              >
                <el-tag
                  type="success"
                  size="small"
                >
                  已结算
                </el-tag>
                <el-tooltip
                  v-if="getRecalculationNotice(row.id)"
                  :content="getRecalculationNotice(row.id)?.message"
                  placement="top"
                >
                  <el-tag
                    type="warning"
                    effect="plain"
                    size="small"
                  >
                    需重算
                  </el-tag>
                </el-tooltip>
              </div>
              <el-tag
                v-else-if="canViewField('salary_salaryrecordsview', 'salary_status')"
                type="info"
                size="small"
              >
                未结算
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'paid_at')"
            label="结算时间"
            min-width="95"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="row.payoutRecord?.status === 'paid' && row.payoutRecord?.paid_at"
                class="text-regular"
              >
                {{ formatPayoutTime(row.payoutRecord.paid_at) }}
              </span>
              <span
                v-else
                class="text-secondary"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'payment_method')"
            label="支付方式"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="row.payoutRecord?.payment_method"
                class="text-regular"
              >
                {{ getPaymentMethodName(row.payoutRecord.payment_method) }}
              </span>
              <span
                v-else
                class="text-secondary"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && showActionColumn"
            label="操作"
            :width="actionColumnWidth"
            align="center"
            class-name="actions-column"
          >
            <template #default="{ row }">
              <div class="payout-action-buttons action-buttons">
                <el-button
                  v-if="canCreate"
                  v-permission="'salary-records:create'"
                  class="payout-action-button"
                  size="small"
                  :type="row.payoutRecord ? 'warning' : 'primary'"
                  plain
                  @click.stop="row.payoutRecord ? emit('recalculate', row) : emit('settle', row)"
                >
                  <i :class="row.payoutRecord ? 'fas fa-rotate' : 'fas fa-check'" />
                  {{ row.payoutRecord ? '重算' : '结算' }}
                </el-button>
                <el-button
                  v-if="row.payoutRecord && canEdit"
                  v-permission="'salary-records:edit'"
                  class="payout-action-button"
                  size="small"
                  type="success"
                  plain
                  @click.stop="emit('edit', row)"
                >
                  编辑
                </el-button>
                <el-button
                  v-if="row.payoutRecord && canDelete"
                  v-permission="'salary-records:delete'"
                  class="payout-action-button"
                  size="small"
                  type="danger"
                  plain
                  @click.stop="emit('delete', row)"
                >
                  删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <Pagination
        v-if="total > 0"
        :current="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        :show-total="true"
        :show-range="true"
        :show-page-sizes="true"
        :show-quick-jumper="true"
        :disabled="loading"
        @update:current="emit('update:page', $event)"
        @update:page-size="emit('update:pageSize', $event)"
        @change="handlePaginationChange"
      />
    </div>
  </el-tab-pane>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import type {
  SalaryEmployeeAttendanceStats,
  SalaryEmployeeSalesStats
} from '../salary-employee-data'
import type { SalaryPayoutRow } from '../useSalaryPayoutTable'

type PayoutStatus = 'paid' | 'unpaid'

interface RecalculationNotice {
  message: string
}

interface PayoutTableInstance {
  toggleRowExpansion: (_row: SalaryPayoutRow, _expanded: boolean) => void
}

const props = defineProps<{
  actionColumnWidth: number
  calculateCommission: (_employeeId: number) => string | number
  calculateEstimated: (_employeeId: number) => string | number
  calculateLeave: (_employeeId: number, _days: number) => string | number
  calculateOvertime: (_employeeId: number, _hours: number) => string | number
  calculateWorkDays: (_employeeId: number) => string | number
  canCreate: boolean
  canDelete: boolean
  canEdit: boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  formatPayoutTime: (_time: string) => string
  getAttendanceStats: (_employeeId: number) => SalaryEmployeeAttendanceStats
  getBaseSalary: (_employeeId: number) => string | number
  getIndex: (_index: number) => number
  getPaymentMethodName: (_method: string) => string
  getRecalculationNotice: (_employeeId: number) => RecalculationNotice | null | undefined
  getSalesStats: (_employeeId: number) => SalaryEmployeeSalesStats
  isMobile: boolean
  loading: boolean
  month: string
  page: number
  pageSize: number
  rows: SalaryPayoutRow[]
  searchExpanded: boolean
  searchText: string
  statusFilter?: PayoutStatus
  total: number
}>()

const showActionColumn = computed(() => shouldShowActionColumn(
  props.canViewField('salary_salaryrecordsview', 'actions'),
  [props.canCreate, props.canEdit, props.canDelete]
))
const showStatusColumn = computed(() => shouldShowActionColumn(
  props.canViewField('salary_salaryrecordsview', 'salary_status'),
  []
))

const emit = defineEmits<{
  delete: [row: SalaryPayoutRow]
  edit: [row: SalaryPayoutRow]
  monthChange: []
  paginationChange: [page: number, pageSize: number]
  recalculate: [row: SalaryPayoutRow]
  reset: []
  search: []
  settle: [row: SalaryPayoutRow]
  statusChange: []
  'update:month': [value: string]
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'update:searchExpanded': [value: boolean]
  'update:searchText': [value: string]
  'update:statusFilter': [value: PayoutStatus | undefined]
}>()

const tableRef = ref<PayoutTableInstance>()
const expandedRowId = ref<number | null>(null)
const lastTappedRowId = ref<number | null>(null)
const lastTapTimestamp = ref(0)

const resetInteraction = () => {
  if (expandedRowId.value) {
    const previous = props.rows.find(row => row.id === expandedRowId.value)
    if (previous) tableRef.value?.toggleRowExpansion(previous, false)
  }
  expandedRowId.value = null
  lastTappedRowId.value = null
  lastTapTimestamp.value = 0
}

const handleRowTap = (row: SalaryPayoutRow) => {
  if (!props.isMobile) return

  const now = Date.now()
  if (lastTappedRowId.value === row.id && now - lastTapTimestamp.value <= 320) {
    const shouldExpand = expandedRowId.value !== row.id
    if (expandedRowId.value && expandedRowId.value !== row.id) {
      const previous = props.rows.find(item => item.id === expandedRowId.value)
      if (previous) tableRef.value?.toggleRowExpansion(previous, false)
    }
    tableRef.value?.toggleRowExpansion(row, shouldExpand)
    expandedRowId.value = shouldExpand ? row.id : null
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = row.id
  lastTapTimestamp.value = now
}

const handlePaginationChange = (page: number, pageSize: number) => {
  resetInteraction()
  emit('paginationChange', page, pageSize)
}

defineExpose({ resetInteraction })
</script>

<style scoped>
.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.salary-status-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}

.payout-salary-amount {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
}

.amount-text {
  color: var(--color-success);
  font-weight: 600;
}

@media (max-width: 768px) {
  .table-section > .section-header {
    display: none;
  }

  .salary-mobile-commission {
    color: var(--salary-mobile-commission-color);
    font-variant-numeric: tabular-nums;
  }

  .salary-mobile-overtime {
    color: var(--salary-mobile-overtime-color);
    font-variant-numeric: tabular-nums;
  }

  .salary-mobile-net {
    color: var(--salary-mobile-net-color);
    font-variant-numeric: tabular-nums;
  }
}
</style>
