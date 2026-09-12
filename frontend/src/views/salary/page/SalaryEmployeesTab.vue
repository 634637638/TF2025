<template>
  <el-tab-pane
    data-view-permission="salary-records:view"
    label="员工工资"
    name="employees"
    class="tf-tab-panel salary-employees-tab"
  >
    <UnifiedSearchPanel
      :expanded="searchExpanded"
      :loading="loading"
      @update:expanded="emit('update:searchExpanded', $event)"
      @search="emit('refresh')"
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
          @click="emit('refresh')"
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
          :model-value="salaryMonth"
          type="month"
          placeholder="选择月份"
          value-format="YYYY-MM"
          @update:model-value="emit('update:salaryMonth', $event)"
          @change="emit('monthChange')"
        />
      </div>
      <div
        v-if="canViewField('salary_salaryrecordsview', 'salary_template_name')"
        class="form-group filter-item"
        data-field="template"
      >
        <el-select
          :model-value="templateFilter"
          placeholder="工资模板"
          clearable
          @update:model-value="emit('update:templateFilter', $event)"
          @change="emit('refresh')"
        >
          <el-option
            v-for="template in templateOptions"
            :key="template.id"
            :label="template.name"
            :value="template.id"
          />
        </el-select>
      </div>
    </UnifiedSearchPanel>

    <div class="table-section admin-panel admin-table-panel">
      <div class="section-header">
        <div class="section-title">
          <i class="fas fa-list" />员工工资<span class="record-count">共 {{ total }} 条记录</span>
        </div>
      </div>
      <div class="table-responsive">
        <el-table
          ref="tableRef"
          :data="loading ? [] : employees"
          border
          stripe
          table-layout="fixed"
          :fit="true"
          row-key="id"
          class="data-table devices-table base-data-table salary-employee-table"
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
              description="暂无员工工资数据"
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
                  v-if="canEditTemplate"
                  v-permission="'salary-templates:edit'"
                  size="small"
                  type="primary"
                  class="mobile-action-btn mobile-action-btn-edit"
                  @click.stop="emit('editTemplate', row)"
                >
                  <i class="fas fa-file-invoice-dollar" /><span>模板</span>
                </el-button>
                <el-button
                  v-if="canViewRecords"
                  v-permission="'salary-records:view'"
                  size="small"
                  type="success"
                  class="mobile-action-btn mobile-action-btn-status"
                  @click.stop="emit('viewAttendance', row)"
                >
                  <i class="fas fa-calendar-check" /><span>考勤</span>
                </el-button>
                <el-button
                  size="small"
                  type="warning"
                  class="mobile-action-btn mobile-action-btn-default"
                  @click.stop="emit('viewSales', row)"
                >
                  <i class="fas fa-chart-line" /><span>销售</span>
                </el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile"
            label="序号"
            min-width="60"
            align="center"
          >
            <template #default="{ $index }">
              {{ getIndex($index) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'employee_username')"
            label="员工工号"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <span>{{ row.username }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_salaryrecordsview', 'employee_name')"
            :label="isMobile ? '姓名' : '员工姓名'"
            :min-width="isMobile ? 88 : 100"
            align="center"
          >
            <template #default="{ row }">
              <span>{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'employee_phone')"
            prop="phone"
            label="联系电话"
            min-width="115"
            align="center"
          />
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'salary_template_name')"
            label="工资模板"
            min-width="160"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.salary_template_id"
                type="success"
                size="large"
              >
                <i class="fas fa-file-invoice-dollar" />{{ getTemplateName(row.salary_template_id) }}
              </el-tag>
              <el-tag
                v-else
                type="info"
                size="large"
              >
                <i class="fas fa-exclamation-circle" />未设置
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'base_salary')"
            label="底薪"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <span class="amount-text">¥{{ getBaseSalary(row.id) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && (canViewField('salary_salaryrecordsview', 'salary_template_name') || canViewField('salary_salaryrecordsview', 'commission_amount'))"
            label="提成方式"
            min-width="160"
            align="center"
          >
            <template #default="{ row }">
              <div
                v-if="row.salary_template_id"
                class="commission-info"
              >
                <div v-if="getCommissionType(row.salary_template_id) === 'fixed'">
                  <div class="commission-row">
                    <span class="commission-label">新机:</span>
                    <span class="commission-value">¥{{ getNewCommission(row.salary_template_id) }}/台</span>
                  </div>
                  <div class="commission-row">
                    <span class="commission-label">二手:</span>
                    <span class="commission-value">¥{{ getUsedCommission(row.salary_template_id) }}/台</span>
                  </div>
                </div>
                <div v-else>
                  <span class="commission-label">利润:</span>
                  <span class="commission-value">{{ getCommissionPercentage(row.salary_template_id) }}%</span>
                </div>
              </div>
              <span
                v-else
                class="text-muted"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'sales_count')"
            label="销售数量"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getCommissionCount(row.id) > 0"
                class="text-blue font-semibold cursor-pointer"
                @dblclick="emit('viewSales', row)"
              >{{ getCommissionCount(row.id) }}台</span>
              <span
                v-else
                class="text-secondary"
              >0台</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
            :label="isMobile ? '提成' : '销售提成'"
            :min-width="isMobile ? 82 : 100"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getSalesStats(row.id).sales_count > 0"
                class="text-danger font-semibold salary-mobile-commission"
              >{{ isMobile ? calculateCommission(row.id) : `¥${calculateCommission(row.id)}` }}</span>
              <span
                v-else
                class="text-secondary salary-mobile-commission"
              >0</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && (canViewField('salary_salaryrecordsview', 'overtime_pay') || canViewField('salary_salaryrecordsview', 'leave_deduction'))"
            label="费率"
            min-width="140"
            align="center"
          >
            <template #default="{ row }">
              <div
                v-if="row.salary_template_id"
                class="rate-info"
              >
                <div><span class="rate-label">加班:</span> ¥{{ getOvertimeRate(row.salary_template_id) }}/h</div>
                <div><span class="rate-label">请假:</span> 扣平均工资/天</div>
              </div>
              <span
                v-else
                class="text-muted"
              >-</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'monthly_leave_days')"
            label="休假(天)"
            min-width="105"
            align="center"
          >
            <template #default="{ row }">
              <div
                v-if="getAttendanceStats(row.id).monthly_leave_days_available > 0"
                class="attendance-cell"
              >
                <span class="leave-days-display">
                  <span class="used-days text-danger font-semibold">{{ getAttendanceStats(row.id).monthly_leave_days_used || 0 }}</span>
                  <span class="text-secondary">/</span>
                  <span class="total-days text-success font-semibold">{{ getAttendanceStats(row.id).monthly_leave_days_available }}</span>
                </span>
              </div>
              <span
                v-else
                class="text-secondary"
              >0/0</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'leave_days')"
            label="请假(天)"
            min-width="90"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                v-if="getAttendanceStats(row.id).leave_days > 0"
                type="warning"
                size="small"
              >
                {{ getAttendanceStats(row.id).leave_days }}天
              </el-tag>
              <el-tag
                v-else
                type="info"
                size="small"
              >
                0
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'overtime_hours')"
            label="加班时间"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getAttendanceStats(row.id).overtime_hours > 0"
                class="text-blue font-semibold"
              >{{ Math.round(getAttendanceStats(row.id).overtime_hours) }}小时</span>
              <span
                v-else
                class="text-secondary"
              >0小时</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_salaryrecordsview', 'overtime_pay')"
            :label="isMobile ? '加班' : '加班费'"
            :min-width="isMobile ? 82 : 90"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getAttendanceStats(row.id).overtime_hours > 0"
                class="text-danger font-semibold salary-mobile-overtime"
              >{{ isMobile ? calculateOvertime(row.id, getAttendanceStats(row.id).overtime_hours) : `¥${calculateOvertime(row.id, getAttendanceStats(row.id).overtime_hours)}` }}</span>
              <span
                v-else
                class="text-secondary salary-mobile-overtime"
              >0</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('salary_salaryrecordsview', 'leave_deduction')"
            label="请假扣款"
            :min-width="isMobile ? 92 : 100"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="getAttendanceStats(row.id).leave_days > 0"
                class="text-danger font-semibold salary-mobile-deduction"
              >{{ isMobile ? calculateLeave(row.id, getAttendanceStats(row.id).leave_days) : `-¥${calculateLeave(row.id, getAttendanceStats(row.id).leave_days)}` }}</span>
              <span
                v-else
                class="text-secondary salary-mobile-deduction"
              >0</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'net_salary')"
            label="预计工资"
            min-width="110"
            align="center"
          >
            <template #default="{ row }">
              <span class="estimated-salary">¥{{ calculateEstimated(row.id) }}</span>
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
              <div class="employee-action-buttons action-buttons">
                <span
                  v-if="canEditTemplate"
                  class="employee-action-item"
                >
                  <el-button
                    v-permission="'salary-templates:edit'"
                    size="small"
                    type="primary"
                    plain
                    @click.stop="emit('editTemplate', row)"
                  ><i class="fas fa-file-invoice-dollar" /><span class="btn-text">模板</span></el-button>
                </span>
                <span
                  v-if="canViewRecords"
                  class="employee-action-item"
                >
                  <el-button
                    v-permission="'salary-records:view'"
                    size="small"
                    type="success"
                    plain
                    @click.stop="emit('viewAttendance', row)"
                  ><i class="fas fa-calendar-check" /><span class="btn-text">考勤</span></el-button>
                </span>
                <span class="employee-action-item">
                  <el-button
                    size="small"
                    type="warning"
                    plain
                    @click.stop="emit('viewSales', row)"
                  ><i class="fas fa-chart-line" /><span class="btn-text">销售</span></el-button>
                </span>
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

interface EmployeeRow {
  id: number
  name?: string | null
  username?: string | null
  phone?: string | null
  salary_template_id?: number | null
}

interface TemplateOption {
  id: number
  name?: string | null
}

interface AttendanceStats {
  monthly_leave_days_available: number
  monthly_leave_days_used: number
  leave_days: number
  overtime_hours: number
}

interface SalesStats {
  sales_count: number
}

interface EmployeeTableInstance {
  toggleRowExpansion: (_row: EmployeeRow, _expanded: boolean) => void
}

const props = defineProps<{
  actionColumnWidth: number
  calculateCommission: (_employeeId: number) => string | number
  calculateEstimated: (_employeeId: number) => string | number
  calculateLeave: (_employeeId: number, _days: number) => string | number
  calculateOvertime: (_employeeId: number, _hours: number) => string | number
  canEditTemplate: boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  canViewRecords: boolean
  employees: EmployeeRow[]
  filteredEmployees: EmployeeRow[]
  getAttendanceStats: (_employeeId: number) => AttendanceStats
  getBaseSalary: (_employeeId: number) => string | number
  getCommissionCount: (_employeeId: number) => number
  getCommissionPercentage: (_templateId: number) => string | number
  getCommissionType: (_templateId: number) => string
  getIndex: (_index: number) => number
  getNewCommission: (_templateId: number) => string | number
  getOvertimeRate: (_templateId: number) => string | number
  getSalesStats: (_employeeId: number) => SalesStats
  getTemplateName: (_templateId: number) => string
  getUsedCommission: (_templateId: number) => string | number
  isMobile: boolean
  loading: boolean
  page: number
  pageSize: number
  salaryMonth: string
  searchExpanded: boolean
  searchText: string
  templateFilter?: number
  templateOptions: TemplateOption[]
  total: number
}>()

const showActionColumn = computed(() => shouldShowActionColumn(
  props.canViewField('salary_salaryrecordsview', 'actions'),
  [props.canEditTemplate, props.canViewRecords]
))

const emit = defineEmits<{
  editTemplate: [row: EmployeeRow]
  monthChange: []
  paginationChange: [page: number, pageSize: number]
  refresh: []
  reset: []
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'update:salaryMonth': [value: string]
  'update:searchExpanded': [value: boolean]
  'update:searchText': [value: string]
  'update:templateFilter': [value: number | undefined]
  viewAttendance: [row: EmployeeRow]
  viewSales: [row: EmployeeRow]
}>()

const tableRef = ref<EmployeeTableInstance>()
const expandedEmployeeId = ref<number | null>(null)
const lastTappedEmployeeId = ref<number | null>(null)
const lastTapTimestamp = ref(0)

const resetInteraction = () => {
  if (expandedEmployeeId.value) {
    const previous = props.filteredEmployees.find(item => item.id === expandedEmployeeId.value)
    if (previous) tableRef.value?.toggleRowExpansion(previous, false)
  }
  expandedEmployeeId.value = null
  lastTappedEmployeeId.value = null
  lastTapTimestamp.value = 0
}

const handleRowTap = (row: EmployeeRow) => {
  if (!props.isMobile) return
  const now = Date.now()
  if (lastTappedEmployeeId.value === row.id && now - lastTapTimestamp.value <= 320) {
    const shouldExpand = expandedEmployeeId.value !== row.id
    if (expandedEmployeeId.value && expandedEmployeeId.value !== row.id) {
      const previous = props.filteredEmployees.find(item => item.id === expandedEmployeeId.value)
      if (previous) tableRef.value?.toggleRowExpansion(previous, false)
    }
    tableRef.value?.toggleRowExpansion(row, shouldExpand)
    expandedEmployeeId.value = shouldExpand ? row.id : null
    lastTappedEmployeeId.value = null
    lastTapTimestamp.value = 0
    return
  }
  lastTappedEmployeeId.value = row.id
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

.amount-text {
  color: var(--color-success);
  font-weight: 600;
}

.commission-info,
.rate-info {
  font-size: 12px;
  line-height: 1.5;
}

.commission-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.commission-label,
.commission-value {
  display: inline-block;
}

.commission-label,
.rate-label {
  margin-right: 4px;
  color: var(--color-info);
}

.commission-value {
  color: var(--color-text-primary);
  font-weight: 500;
}

.text-muted {
  color: var(--color-text-placeholder);
}

.attendance-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.estimated-salary {
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
}

.employee-action-buttons .employee-action-item {
  display: contents;
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

  .salary-mobile-deduction {
    color: var(--salary-mobile-deduction-color);
    font-variant-numeric: tabular-nums;
  }
}
</style>
