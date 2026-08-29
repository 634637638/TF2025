<template>
  <el-tab-pane
    data-view-permission="my-salary:view"
    label="工资发放"
    name="my"
    class="tf-tab-panel salary-my-records-tab"
  >
    <UnifiedSearchPanel
      :expanded="recordsSearchExpanded"
      :loading="loading"
      @update:expanded="emit('update:recordsSearchExpanded', $event)"
      @search="emit('search')"
      @reset="emit('reset')"
    >
      <template #primary>
        <el-input
          :placeholder="canViewTeamRecords && selectedViewEmployeeId ? `${selectedEmployeeName}的工资发放记录` : '工资发放记录'"
          disabled
          class="cursor-default"
        >
          <template #prefix>
            <i class="fas fa-money-bill-wave" />
          </template>
        </el-input>
      </template>

      <div
        v-if="canViewTeamRecords && canViewField('salary_mysalaryview', 'employee_name')"
        class="form-group filter-item"
      >
        <el-select
          :model-value="selectedViewEmployeeId"
          placeholder="选择员工查看工资"
          filterable
          clearable
          @update:model-value="emit('update:selectedViewEmployeeId', $event)"
          @change="emit('employeeChange')"
        >
          <el-option
            v-for="employee in employees"
            :key="employee.id"
            :label="employee.name || employee.username"
            :value="employee.id"
          >
            <span class="float-left">{{ employee.name || employee.username }}</span>
            <span class="float-right text-secondary text-xs">{{ employee.username }}</span>
          </el-option>
        </el-select>
      </div>

      <div
        v-if="canViewField('salary_mysalaryview', 'period_start')"
        class="form-group filter-item"
        data-field="period"
      >
        <el-date-picker
          :model-value="periodRange"
          type="monthrange"
          range-separator="至"
          start-placeholder="开始月份"
          end-placeholder="结束月份"
          value-format="YYYY-MM"
          @update:model-value="emit('update:periodRange', $event)"
          @change="emit('periodChange')"
        />
      </div>
    </UnifiedSearchPanel>

    <div class="table-section admin-panel admin-table-panel">
      <div class="section-header">
        <div class="section-title">
          <i class="fas fa-list" />工资发放记录<span class="record-count">共 {{ total }} 条记录</span>
        </div>
      </div>
      <div class="table-responsive my-salary-table">
        <el-table
          ref="tableRef"
          :data="loading ? [] : records"
          border
          stripe
          table-layout="fixed"
          :fit="true"
          row-key="id"
          class="data-table devices-table base-data-table salary-records-table"
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
              description="暂无工资记录"
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
                  type="primary"
                  size="small"
                  @click.stop="emit('viewRecord', row)"
                >
                  <i class="fas fa-eye" /><span>详情</span>
                </el-button>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'paid_at')"
            label="发放时间"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <span class="period-text">{{ formatSalaryPayoutTime(row.paid_at) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewTeamRecords && canViewField('salary_mysalaryview', 'employee_name')"
            label="员工姓名"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-regular font-medium">
                {{ row.employee_name || getEmployeeName(row.employee_id) || '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'period_start')"
            label="月份工资"
            min-width="95"
            align="center"
          >
            <template #default="{ row }">
              <span class="period-text">{{ formatSalaryMonth(row.period_start) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'payment_method')"
            label="支付方式"
            min-width="95"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="row.payment_method"
                class="text-regular"
              >
                {{ getSalaryPaymentMethodName(row.payment_method) }}
              </span>
              <span
                v-else
                class="text-secondary"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'actual_work_days')"
            label="工作天数"
            min-width="85"
            align="center"
          >
            <template #default="{ row }">
              <span class="work-days">{{ formatSalaryWorkDays(row.actual_work_days) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'base_salary')"
            label="底薪"
            min-width="85"
            align="center"
          >
            <template #default="{ row }">
              <span class="amount-text">¥{{ row.base_salary }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'sales_count')"
            label="销售数量"
            min-width="85"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-regular font-semibold">{{ getSalesCount(row) }}台</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'sales_count')"
            label="销售明细"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <el-button
                v-if="getSalesCount(row) > 0"
                size="small"
                type="primary"
                plain
                @click.stop="emit('viewSalesDetail', row)"
              >
                <i class="fas fa-list" />
                <span class="btn-text">明细</span>
              </el-button>
              <span
                v-else
                class="text-secondary"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'commission_amount')"
            label="提成金额"
            min-width="95"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-danger font-semibold">¥{{ formatSalaryAmount(row.commission_amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'overtime_hours')"
            label="加班时间"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-secondary">{{ formatSalaryOvertimeHours(row.overtime_hours) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'overtime_pay')"
            label="加班费"
            min-width="85"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-blue font-semibold">¥{{ formatSalaryAmount(row.overtime_pay) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'leave_days')"
            label="请假天数"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-warning font-semibold">{{ formatSalaryLeaveDays(row.leave_days) }}天</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'leave_deduction')"
            label="请假扣除"
            min-width="95"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-danger">-¥{{ formatSalaryAmount(row.leave_deduction) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_mysalaryview', 'net_salary')"
            label="实发工资"
            min-width="110"
            align="center"
          >
            <template #default="{ row }">
              <span class="net-salary">¥{{ formatSalaryAmount(row.net_salary) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && showActionColumn"
            label="操作"
            :width="$getActionColumnWidth(1)"
            align="center"
            class-name="actions-column"
          >
            <template #default="{ row }">
              <div class="my-salary-action-buttons action-buttons">
                <el-button
                  size="small"
                  type="primary"
                  plain
                  @click.stop="emit('viewRecord', row)"
                >
                  <i class="fas fa-eye" />
                  <span class="btn-text">详情</span>
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
        :page-sizes="[10, 20, 50, 100]"
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
import {
  formatSalaryAmount,
  formatSalaryLeaveDays,
  formatSalaryMonth,
  formatSalaryOvertimeHours,
  formatSalaryPayoutTime,
  formatSalaryWorkDays,
  getSalaryPaymentMethodName
} from '../salary-formatters'

interface SalaryEmployeeOption {
  id: number
  name?: string | null
  username?: string | null
}

interface SalaryRecordRow extends Record<string, unknown> {
  id: number
}

interface SalaryRecordsTableInstance {
  toggleRowExpansion: (_row: SalaryRecordRow, _expanded: boolean) => void
}

const props = defineProps<{
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  canViewRecords: boolean
  canViewTeamRecords: boolean
  employees: SalaryEmployeeOption[]
  getEmployeeName: (_employeeId: number) => string
  getSalesCount: (_row: SalaryRecordRow) => number
  isMobile: boolean
  loading: boolean
  page: number
  pageSize: number
  periodRange: [string, string] | null
  records: SalaryRecordRow[]
  recordsSearchExpanded: boolean
  selectedEmployeeName: string
  selectedViewEmployeeId?: number
  total: number
}>()

const showActionColumn = computed(() => shouldShowActionColumn(
  props.canViewField('salary_mysalaryview', 'actions'),
  [props.canViewRecords]
))

const emit = defineEmits<{
  employeeChange: []
  paginationChange: [page: number, pageSize: number]
  periodChange: []
  reset: []
  search: []
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'update:periodRange': [value: [string, string] | null]
  'update:recordsSearchExpanded': [value: boolean]
  'update:selectedViewEmployeeId': [value: number | undefined]
  viewRecord: [row: SalaryRecordRow]
  viewSalesDetail: [row: SalaryRecordRow]
}>()

const tableRef = ref<SalaryRecordsTableInstance>()
const mobileExpandedRecordId = ref<number | null>(null)
const lastTappedRecordId = ref<number | null>(null)
const lastTapTimestamp = ref(0)

const handlePaginationChange = (page: number, pageSize: number) => {
  emit('paginationChange', page, pageSize)
}

const handleRowTap = (row: SalaryRecordRow) => {
  if (!props.isMobile) return

  const now = Date.now()
  if (lastTappedRecordId.value === row.id && now - lastTapTimestamp.value <= 320) {
    const shouldExpand = mobileExpandedRecordId.value !== row.id
    if (mobileExpandedRecordId.value && mobileExpandedRecordId.value !== row.id) {
      const previous = props.records.find(record => record.id === mobileExpandedRecordId.value)
      if (previous) tableRef.value?.toggleRowExpansion(previous, false)
    }

    tableRef.value?.toggleRowExpansion(row, shouldExpand)
    mobileExpandedRecordId.value = shouldExpand ? row.id : null
    lastTappedRecordId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRecordId.value = row.id
  lastTapTimestamp.value = now
}
</script>

<style scoped>
.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.amount-text {
  color: var(--color-success);
  font-weight: 600;
}

.net-salary {
  color: var(--color-success);
  font-size: 16px;
  font-weight: 700;
}

.period-text,
.work-days {
  color: var(--color-text-regular);
  font-size: 13px;
}

@media (max-width: 768px) {
  .table-section > .section-header {
    display: none;
  }
}
</style>
