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
      <div
        v-if="canViewField('salary_salaryrecordsview', 'period_start')"
        class="form-group filter-item"
        data-field="month"
      >
        <el-date-picker
          :model-value="month"
          type="month"
          placeholder="选择月份"
          :value-format="TIME_FORMATS.YEAR_MONTH"
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
          v-table-double-tap="mobileDetailTapOptions"
          v-tf-loading="{ active: loading, text: '正在刷新工资发放记录...' }"
          :data="rows"
          border
          stripe
          table-layout="fixed"
          :fit="true"
          row-key="id"
          class="data-table devices-table base-data-table salary-payout-table"
          @row-dblclick="mobileDetailDoubleClick"
        >
          <template #empty>
            <TableLoadingRow
              v-if="loading"
              mode="block"
              text="正在读取工资发放记录..."
            />
            <DataEmptyState
              v-else
              description="暂无工资发放数据"
            />
          </template>



          <el-table-column
            v-if="!isMobile"
            label="序号"
            :width="$getNumberColumnWidth((rows || []).map((_row, $index) => getIndex($index)), 50)"
            align="center"
          >
            <template #default="{ $index }">
              <span class="table-number-badge">{{ getIndex($index) }}</span>
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
              <span class="amount-text">¥{{ formatAmount(getValue(row, 'base_salary')) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'sales_count')"
            label="数量"
            min-width="70"
            align="center"
          >
            <template #default="{ row }">
              <span class="text-regular font-semibold">{{ getValue(row, 'sales_count') }}台</span>
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
                v-if="!row.payoutRecord"
              >待核对</span>
              <span
                v-else-if="Number(getValue(row, 'commission_amount')) !== 0"
                class="text-danger font-semibold salary-mobile-commission"
              >
                {{ isMobile ? formatAmount(getValue(row, 'commission_amount')) : `¥${formatAmount(getValue(row, 'commission_amount'))}` }}
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
              <span class="text-success font-semibold">{{ getValue(row, 'actual_work_days') }}天</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && canViewField('salary_salaryrecordsview', 'monthly_leave_days')"
            label="休假"
            min-width="80"
            align="center"
          >
            <template #default="{ row }">
              <span
                v-if="isPaidSalaryRecord(row.payoutRecord)"
                class="text-secondary"
              >-</span>
              <span
                v-else
                class="text-success"
              >
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
                v-if="Number(getValue(row, 'leave_days')) > 0"
                class="text-danger font-semibold"
              >
                {{ getValue(row, 'leave_days') }}天
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
                v-if="Number(getValue(row, 'leave_deduction')) !== 0"
                class="text-danger font-semibold"
              >
                -¥{{ formatAmount(getValue(row, 'leave_deduction')) }}
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
                v-if="Number(getValue(row, 'overtime_hours')) > 0"
                class="text-blue font-semibold"
              >
                {{ Math.round(Number(getValue(row, 'overtime_hours'))) }}小时
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
                v-if="Number(getValue(row, 'overtime_pay')) !== 0"
                class="text-blue font-semibold salary-mobile-overtime"
              >
                {{ isMobile ? formatAmount(getValue(row, 'overtime_pay')) : `¥${formatAmount(getValue(row, 'overtime_pay'))}` }}
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
                {{ !row.payoutRecord ? '待核对' : isMobile ? formatAmount(getValue(row, 'net_salary')) : `¥${formatAmount(getValue(row, 'net_salary'))}` }}
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
                v-if="isPaidSalaryRecord(row.payoutRecord)"
                class="payout-salary-amount text-success"
              >
                ¥{{ formatAmount(row.payoutRecord?.net_salary) }}
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
                  :type="isPaidSalaryRecord(row.payoutRecord) ? 'success' : 'info'"
                  size="small"
                >
                  {{ isPaidSalaryRecord(row.payoutRecord) ? '已发放' : row.payoutRecord.status === 'approved' ? '待发放' : '待审批' }}
                </el-tag>
                <el-tooltip
                  v-if="!isPaidSalaryRecord(row.payoutRecord) && getRecalculationNotice(row.id)"
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
                v-if="isPaidSalaryRecord(row.payoutRecord) && row.payoutRecord?.paid_at"
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
                  v-if="!isPaidSalaryRecord(row.payoutRecord) && (row.payoutRecord ? canEdit : canCreate && canPay && canApprove)"
                  v-permission="row.payoutRecord ? 'salary-records:edit' : { permission: ['salary-records:create', 'salary-records:pay', 'salary-records:approve'], mode: 'all' }"
                  class="payout-action-button"
                  :type="row.payoutRecord ? 'warning' : 'primary'"
                  plain
                  @click.stop="row.payoutRecord ? emit('recalculate', row) : emit('settle', row)"
                >
                  <i :class="row.payoutRecord ? 'fas fa-rotate' : 'fas fa-check'" />
                  {{ row.payoutRecord ? '重算' : '结算' }}
                </el-button>
                <el-button
                  v-if="row.payoutRecord && ['draft', 'pending'].includes(row.payoutRecord.status || '') && canApprove"
                  v-permission="'salary-records:approve'"
                  type="success"
                  @click.stop="emit('approve', row)"
                >
                  审批
                </el-button>
                <el-button
                  v-if="row.payoutRecord?.status === 'approved' && canPay && !isPaidSalaryRecord(row.payoutRecord)"
                  v-permission="'salary-records:pay'"
                  type="primary"
                  @click.stop="emit('settle', row)"
                >
                  发放
                </el-button>
                <el-button
                  v-if="row.payoutRecord && canEdit && !isPaidSalaryRecord(row.payoutRecord)"
                  v-permission="'salary-records:edit'"
                  class="payout-action-button"
                  type="success"
                  plain
                  @click.stop="emit('edit', row)"
                >
                  编辑
                </el-button>
                <el-button
                  v-if="row.payoutRecord && canDelete && !isPaidSalaryRecord(row.payoutRecord)"
                  v-permission="'salary-records:delete'"
                  class="payout-action-button"
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
        <RecordDetailDialog
          v-model="mobileDetailVisible"
          title="工资结算详情"
          :fields="mobileDetailFields"
          :record="mobileDetailRow"
          :has-actions="mobileDetailRow !== null && !isPaidSalaryRecord(mobileDetailRow.payoutRecord) && ((canCreate && canPay && canApprove) || (Boolean(mobileDetailRow.payoutRecord) && (canEdit || canDelete || canPay || canApprove)))"
        >
          <template #actions="{ row }">
            <el-button
              v-if="!isPaidSalaryRecord(row.payoutRecord) && (row.payoutRecord ? canEdit : canCreate && canPay && canApprove)"
              v-permission="row.payoutRecord ? 'salary-records:edit' : { permission: ['salary-records:create', 'salary-records:pay', 'salary-records:approve'], mode: 'all' }"
              :type="row.payoutRecord ? 'warning' : 'primary'"
              @click.stop="mobileDetailRunAction(() => row.payoutRecord ? emit('recalculate', row) : emit('settle', row))"
            >
              <i :class="row.payoutRecord ? 'fas fa-rotate' : 'fas fa-check'" />
              <span>{{ row.payoutRecord ? '重算' : '结算' }}</span>
            </el-button>
            <el-button
              v-if="row.payoutRecord && ['draft', 'pending'].includes(row.payoutRecord.status || '') && canApprove"
              v-permission="'salary-records:approve'"
              type="success"
              @click.stop="mobileDetailRunAction(() => emit('approve', row))"
            >
              审批
            </el-button>
            <el-button
              v-if="row.payoutRecord?.status === 'approved' && canPay && !isPaidSalaryRecord(row.payoutRecord)"
              v-permission="'salary-records:pay'"
              type="primary"
              @click.stop="mobileDetailRunAction(() => emit('settle', row))"
            >
              发放
            </el-button>
            <el-button
              v-if="row.payoutRecord && canEdit && !isPaidSalaryRecord(row.payoutRecord)"
              v-permission="'salary-records:edit'"
              type="success"
              @click.stop="mobileDetailRunAction(() => emit('edit', row))"
            >
              <span>编辑</span>
            </el-button>
            <el-button
              v-if="row.payoutRecord && canDelete && !isPaidSalaryRecord(row.payoutRecord)"
              v-permission="'salary-records:delete'"
              type="danger"
              @click.stop="mobileDetailRunAction(() => emit('delete', row))"
            >
              <span>删除</span>
            </el-button>
          </template>
        </RecordDetailDialog>
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
import { TIME_FORMATS } from '@/utils/time'
import { computed } from 'vue'
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import type {
  SalaryEmployeeAttendanceStats,
  SalaryEmployeeSalesStats
} from '../salary-employee-data'
import type { SalaryPayoutRow } from '@/types/salary'
import { formatAmount } from '@/utils/format'
import { isPaidSalaryRecord } from '../salary-record-state'

type PayoutStatus = 'paid' | 'unpaid'

interface RecalculationNotice {
  message: string
}


const props = defineProps<{
  actionColumnWidth: number
  calculateLeave: (_employeeId: number, _days: number) => string | number
  calculateOvertime: (_employeeId: number, _hours: number) => string | number
  calculateWorkDays: (_employeeId: number) => string | number
  canPay?: boolean
  canApprove?: boolean
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

/** 已保存记录一律使用服务器金额，避免浏览器按手机销量覆盖商品提成。 */
const currentValues = (employeeId: number) => ({
  base_salary: () => props.getBaseSalary(employeeId),
  sales_count: () => props.getSalesStats(employeeId).sales_count,
  actual_work_days: () => props.calculateWorkDays(employeeId),
  leave_days: () => props.getAttendanceStats(employeeId).leave_days,
  leave_deduction: () => props.calculateLeave(employeeId, props.getAttendanceStats(employeeId).leave_days),
  overtime_hours: () => props.getAttendanceStats(employeeId).overtime_hours,
  overtime_pay: () => props.calculateOvertime(employeeId, props.getAttendanceStats(employeeId).overtime_hours)
})
const getValue = (row: SalaryPayoutRow, field: keyof ReturnType<typeof currentValues> | 'commission_amount' | 'net_salary') => {
  if (row.payoutRecord) return row.payoutRecord[field] ?? 0
  if (field === 'commission_amount' || field === 'net_salary') return '待核对'
  return currentValues(row.id)[field]()
}

const showActionColumn = computed(() => shouldShowActionColumn(
  props.canViewField('salary_salaryrecordsview', 'actions'),
  [props.canCreate && Boolean(props.canPay), props.canEdit, props.canDelete, Boolean(props.canPay), Boolean(props.canApprove)]
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
  approve: [row: SalaryPayoutRow]
  settle: [row: SalaryPayoutRow]
  statusChange: []
  'update:month': [value: string]
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'update:searchExpanded': [value: boolean]
  'update:searchText': [value: string]
  'update:statusFilter': [value: PayoutStatus | undefined]
}>()




const resetInteraction = () => mobileDetailClose()

const handlePaginationChange = (page: number, pageSize: number) => {
  resetInteraction()
  emit('paginationChange', page, pageSize)
}

defineExpose({ resetInteraction })
const { detailRow: mobileDetailRow, detailVisible: mobileDetailVisible, doubleTapOptions: mobileDetailTapOptions,
  handleRowDoubleClick: mobileDetailDoubleClick, runDetailAction: mobileDetailRunAction, closeDetail: mobileDetailClose } = useMobileTableDetail<SalaryPayoutRow>({
    enabled: () => props.isMobile, rows: () => props.rows, getKey: row => row.id
  })
const mobileDetailFields = computed<RecordDetailField[]>(() => {
  const row = mobileDetailRow.value
  if (!row) return []
  return [
    { key: 'employee_username', label: '员工工号', value: row.username, visible: props.canViewField('salary_salaryrecordsview', 'employee_username') },
    { key: 'employee_name', label: '员工姓名', value: row.name, visible: props.canViewField('salary_salaryrecordsview', 'employee_name') },
    { key: 'base_salary', label: '底薪', value: getValue(row, 'base_salary'), visible: props.canViewField('salary_salaryrecordsview', 'base_salary') },
    { key: 'sales_count', label: '销售数量', value: getValue(row, 'sales_count'), visible: props.canViewField('salary_salaryrecordsview', 'sales_count') },
    { key: 'commission_amount', label: '提成', value: getValue(row, 'commission_amount'), visible: props.canViewField('salary_salaryrecordsview', 'commission_amount') },
    { key: 'goods_earned', label: '商品提成', value: row.payoutRecord?.goods_commission?.earned_amount, visible: props.canViewField('salary_salaryrecordsview', 'commission_amount') },
    { key: 'goods_reversal', label: '商品退货扣回', value: row.payoutRecord?.goods_commission?.reversal_amount, visible: props.canViewField('salary_salaryrecordsview', 'commission_amount') },
    { key: 'actual_work_days', label: '工作天数', value: getValue(row, 'actual_work_days'), visible: props.canViewField('salary_salaryrecordsview', 'actual_work_days') },
    { key: 'leave_days', label: '请假天数', value: getValue(row, 'leave_days'), visible: props.canViewField('salary_salaryrecordsview', 'leave_days') },
    { key: 'leave_deduction', label: '请假扣款', value: getValue(row, 'leave_deduction'), visible: props.canViewField('salary_salaryrecordsview', 'leave_deduction') },
    { key: 'overtime_hours', label: '加班小时', value: getValue(row, 'overtime_hours'), visible: props.canViewField('salary_salaryrecordsview', 'overtime_hours') },
    { key: 'overtime_pay', label: '加班费', value: getValue(row, 'overtime_pay'), visible: props.canViewField('salary_salaryrecordsview', 'overtime_pay') },
    { key: 'net_salary', label: '实发工资', value: getValue(row, 'net_salary'), visible: props.canViewField('salary_salaryrecordsview', 'net_salary') },
    { key: 'salary_status', label: '发放状态', value: isPaidSalaryRecord(row.payoutRecord) ? '已发放' : '待发放', visible: props.canViewField('salary_salaryrecordsview', 'salary_status') },
    { key: 'paid_at', label: '结算时间', value: row.payoutRecord?.paid_at ? props.formatPayoutTime(row.payoutRecord.paid_at) : undefined, visible: props.canViewField('salary_salaryrecordsview', 'paid_at'), wide: true },
    { key: 'payment_method', label: '支付方式', value: row.payoutRecord?.payment_method ? props.getPaymentMethodName(row.payoutRecord.payment_method) : undefined, visible: props.canViewField('salary_salaryrecordsview', 'payment_method') }
  ]
})
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
  font-size: var(--tf-type-scale-13);
  font-weight: 600;
  line-height: 1.25;
  white-space: nowrap;
}

.amount-text {
  color: var(--color-success);
  font-weight: 600;
}

@media (max-width: 767px) {
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
