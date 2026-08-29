<template>
  <PermissionGate
    :can-view="canAccessSalaryPage"
    mode="denied"
    module-key="salary"
    module-name="工资管理"
    permission-code="salary:view"
  >
    <ElConfigProvider :locale="locale">
      <div class="page-container salary-page admin-page admin-unified-base-data-page">
        <SalaryPageHeader
          :active-tab="activeTab"
          :can-create-salary-template="canCreateSalaryTemplate"
          :can-view-salary-records="canViewSalaryRecords"
          :payout-loading="payoutLoading"
          :refreshing="refreshing"
          @add-template="handleAddTemplate"
          @bulk-recalculate="handleBulkRecalculatePayout"
          @refresh="handleRefresh"
        />

        <!-- 页面主体 -->
        <div class="page-body admin-page-content">
          <SalaryStatsCards
            v-if="showSalaryStatsCards"
            :stats="stats"
            :module-key="salaryStatsModuleKey"
            :can-view-team-records="canViewTeamSalaryRecords"
            :can-view-field="canViewSalaryField"
          />

          <!-- TAB 切换 -->
          <el-tabs
            v-model="activeTab"
            class="salary-tabs tf-page-tabs"
            @tab-change="handleTabChange"
          >
            <SalaryTemplatesTab
              v-if="canViewSalaryTemplates"
              ref="salaryTemplatesTabRef"
              v-model:page="templatePage"
              v-model:page-size="templatePageSize"
              v-model:search-expanded="templateSearchExpanded"
              v-model:search-text="templateSearch"
              v-model:status-filter="templateFilters.is_active"
              data-view-permission="salary-templates:view"
              :can-delete="canDeleteSalaryTemplate"
              :can-edit="canEditSalaryTemplate"
              :can-view-field="canViewSalaryField"
              :filtered-templates="filteredTemplates"
              :get-employee-count="getEmployeeCountByTemplate"
              :is-mobile="isMobile"
              :loading="templatesLoading"
              :templates="paginatedTemplates"
              @delete="handleDeleteTemplate"
              @edit="handleEditTemplate"
              @pagination-change="handleTemplatePaginationChange"
              @reset="resetTemplateFilters"
              @search="loadTemplates"
              @set-default="handleSetDefault"
              @status-change="loadTemplates"
              @toggle-status="handleToggleTemplateStatus"
            />

            <SalaryEmployeesTab
              v-if="canViewSalaryRecords"
              ref="salaryEmployeesTabRef"
              v-model:page="employeePage"
              v-model:page-size="employeePageSize"
              v-model:salary-month="employeeSalaryMonth"
              v-model:search-expanded="employeeSearchExpanded"
              v-model:search-text="employeeSearch"
              v-model:template-filter="employeeTemplateFilter"
              data-view-permission="salary-records:view"
              :action-column-width="employeeSalaryActionColumnWidth"
              :calculate-commission="calculateSalesCommission"
              :calculate-estimated="calculateEstimatedSalary"
              :calculate-leave="calculateLeaveDeduction"
              :calculate-overtime="calculateOvertimePay"
              :can-edit-template="canEditSalaryTemplate"
              :can-view-field="canViewSalaryField"
              :can-view-records="canViewSalaryRecords"
              :employees="paginatedEmployees"
              :filtered-employees="filteredEmployees"
              :get-attendance-stats="getEmployeeAttendanceStats"
              :get-base-salary="getEmployeeBaseSalary"
              :get-commission-count="getEmployeeCommissionCount"
              :get-commission-percentage="getTemplateCommissionPercentage"
              :get-commission-type="getTemplateCommissionType"
              :get-index="getEmployeeIndex"
              :get-new-commission="getTemplateCommissionNewFixed"
              :get-overtime-rate="getTemplateOvertimeRate"
              :get-sales-stats="getEmployeeSalesStats"
              :get-template-name="getTemplateName"
              :get-used-commission="getTemplateCommissionUsedFixed"
              :is-mobile="isMobile"
              :loading="employeesLoading"
              :template-options="templates"
              :total="filteredEmployees.length"
              @edit-template="handleEditEmployeeTemplate"
              @month-change="handleEmployeeMonthChange"
              @pagination-change="handleEmployeePaginationChange"
              @refresh="handleRefreshEmployeeData"
              @reset="resetEmployeeFilters"
              @view-attendance="handleViewAttendance"
              @view-sales="handleViewEmployeeSalesDetail"
            />
            <SalaryPayoutTab
              v-if="canViewSalaryRecords"
              v-model:month="payoutMonth"
              v-model:page="payoutPage"
              v-model:page-size="payoutPageSize"
              v-model:search-expanded="payoutSearchExpanded"
              v-model:search-text="payoutSearch"
              v-model:status-filter="payoutFilters.status"
              data-view-permission="salary-records:view"
              :action-column-width="payoutActionColumnWidth"
              :calculate-commission="calculateSalesCommission"
              :calculate-estimated="calculateEstimatedSalary"
              :calculate-leave="calculateLeaveDeduction"
              :calculate-overtime="calculateOvertimePay"
              :calculate-work-days="calculateWorkDays"
              :can-create="canCreateSalaryRecord"
              :can-delete="canDeleteSalaryRecord"
              :can-edit="canEditSalaryRecord"
              :can-view-field="canViewSalaryField"
              :format-payout-time="formatPayoutTime"
              :get-attendance-stats="getEmployeeAttendanceStats"
              :get-base-salary="getEmployeeBaseSalary"
              :get-index="getPayoutIndex"
              :get-payment-method-name="getPaymentMethodName"
              :get-recalculation-notice="getSalaryRecalculationNotice"
              :get-sales-stats="getEmployeeSalesStats"
              :is-mobile="isMobile"
              :loading="payoutLoading"
              :rows="paginatedPayoutData"
              :total="salaryPayoutData.length"
              @delete="handleDeletePayout"
              @edit="handleEditPayoutByEmployee"
              @month-change="handleMonthChange"
              @pagination-change="handlePayoutPaginationChange"
              @recalculate="handleRecalculatePayout"
              @reset="resetPayoutFilters"
              @search="loadPayoutList"
              @settle="handlePayoutByEmployee"
              @status-change="handleFilterChange"
            />

            <SalaryMyRecordsTab
              v-if="canViewPayoutRecords"
              v-model:page="myPagination.page"
              v-model:page-size="myPagination.page_size"
              v-model:period-range="myPeriodRange"
              v-model:records-search-expanded="recordsSearchExpanded"
              v-model:selected-view-employee-id="selectedViewEmployeeId"
              data-view-permission="my-salary:view"
              :can-view-field="canViewSalaryField"
              :can-view-records="canViewPayoutRecords"
              :can-view-team-records="canViewTeamSalaryRecords"
              :employees="employees"
              :get-employee-name="getEmployeeName"
              :get-sales-count="getSalesCount"
              :is-mobile="isMobile"
              :loading="myLoading"
              :records="myRecords"
              :selected-employee-name="getSelectedEmployeeName()"
              :total="myPagination.total"
              @employee-change="handleViewEmployeeChange"
              @pagination-change="handleMyPaginationChange"
              @period-change="handleMyPeriodChange"
              @reset="resetMyFilters"
              @search="loadMyRecords"
              @view-record="handleViewMyRecord"
              @view-sales-detail="handleViewSalesDetail"
            />
          </el-tabs>
        </div>

        <SalaryDetailDialog
          v-model="detailDialogVisible"
          :can-view-field="canViewSalaryField"
          :format-leave-days="formatLeaveDays"
          :format-month="formatSalaryMonth"
          :format-work-days="formatWorkDays"
          :get-employee-name="getEmployeeName"
          :record="currentRecord"
        />

        <SalarySalesDetailDialog
          v-model="salesDetailDialogVisible"
          :can-view-field="canViewSalaryField"
          :customer-column-width="salesDetailCustomerColumnWidth"
          :details="salesDetailList"
          :dialog-width="salesDetailDialogWidth"
          :format-amount="formatAmount"
          :format-payout-time="formatPayoutTime"
          :format-sale-time="formatSaleTime"
          :get-sales-count="getSalesCount"
          :imei-column-width="salesDetailImeiColumnWidth"
          :loading="salesDetailLoading"
          :model-column-width="salesDetailModelColumnWidth"
          :record="currentSalesRecord"
          :summary-total-price="salesSummary.total_price"
          :table-width="salesDetailTableWidth"
        />

        <SalaryEmployeeSalesDetailDialog
          v-model="employeeSalesDetailDialogVisible"
          :can-view-field="canViewSalaryField"
          :customer-column-width="employeeSalesDetailCustomerColumnWidth"
          :details="employeeSalesDetailList"
          :dialog-width="employeeSalesDetailDialogWidth"
          :employee="currentEmployeeSales"
          :format-amount="formatAmount"
          :format-sale-time="formatSaleTime"
          :imei-column-width="employeeSalesDetailImeiColumnWidth"
          :loading="employeeSalesDetailLoading"
          :model-column-width="employeeSalesDetailModelColumnWidth"
          :salary-month="employeeSalaryMonth"
          :summary="employeeSalesSummary"
          :table-width="employeeSalesDetailTableWidth"
        />

        <SalaryEditPayoutDialog
          v-model="editPayoutDialogVisible"
          v-model:form="editPayoutForm"
          :can-edit-field="canEditSalaryField"
          :can-view-field="canViewSalaryField"
          :employee-name="getEmployeeName(editPayoutForm.employee_id)"
          :net-salary="calculateEditNetSalary()"
          :saving="editPayoutSaving"
          @submit="handleSaveEditPayout"
        />

        <SalarySettleDialog
          v-model="settleDialogVisible"
          v-model:form="settleForm"
          :can-edit-field="canEditSalaryField"
          :can-view-field="canViewSalaryField"
          :saving="settleSaving"
          @close="closeSettleDialog"
          @submit="confirmSettle"
        />

        <SalaryTemplateFormDialog
          v-model="templateFormDialogVisible"
          v-model:form="templateForm"
          :can-edit-field="canEditSalaryField"
          :can-view-field="canViewSalaryField"
          :saving="templateSaving"
          @submit="handleSaveTemplate"
        />

        <SalaryEmployeeTemplateDialog
          v-model="templateDialogVisible"
          v-model:selected-template-id="selectedTemplateId"
          :can-edit-field="canEditSalaryField"
          :can-view-field="canViewSalaryField"
          :employee="currentEmployee"
          :get-commission-fixed="getTemplateCommissionFixed"
          :get-commission-percentage="getTemplateCommissionPercentage"
          :get-commission-type="getTemplateCommissionType"
          :get-overtime-rate="getTemplateOvertimeRate"
          :get-template-by-id="getTemplateById"
          :templates="templates"
          @save="handleSaveEmployeeTemplate"
        />

        <SalaryAttendanceListDialog
          v-model="attendanceDialogVisible"
          :can-create="canCreateSalaryRecord"
          :can-delete="canDeleteSalaryRecord"
          :can-edit="canEditSalaryRecord"
          :can-view-field="canViewSalaryField"
          :employee="currentAttendanceEmployee"
          :get-attendance-type-tag="getAttendanceTypeTag"
          :get-attendance-type-text="getAttendanceTypeText"
          :loading="attendanceLoading"
          :records="attendanceRecords"
          @add="handleAddAttendance"
          @delete="handleDeleteAttendance"
          @edit="handleEditAttendance"
          @quick-add="handleQuickAdd"
        />

        <SalaryAttendanceFormDialog
          v-model="attendanceFormVisible"
          :can-edit-field="canEditSalaryField"
          :can-view-field="canViewSalaryField"
          :form="attendanceForm"
          :saving="attendanceSaving"
          :title="attendanceDialogTitle"
          @submit="handleSaveAttendance"
          @type-change="handleAttendanceTypeChange"
          @update:form="attendanceForm = $event"
        />
      </div>
    </ElConfigProvider>
  </PermissionGate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox, ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { salaryTemplateApi } from '@/api/salary-template'
import { salaryApi } from '@/api/salary'
import { attendanceApi, type AttendanceRecord } from '@/api/attendance'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useMobile } from '@/composables/mobile'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { PermissionGate } from '@/components/base'
import SalaryPageHeader from './page/SalaryPageHeader.vue'
import SalaryAttendanceListDialog from './page/SalaryAttendanceListDialog.vue'
import SalaryAttendanceFormDialog from './page/SalaryAttendanceFormDialog.vue'
import SalaryDetailDialog from './page/SalaryDetailDialog.vue'
import SalaryEmployeeSalesDetailDialog from './page/SalaryEmployeeSalesDetailDialog.vue'
import SalaryEditPayoutDialog, { type SalaryEditPayoutForm } from './page/SalaryEditPayoutDialog.vue'
import SalaryEmployeeTemplateDialog from './page/SalaryEmployeeTemplateDialog.vue'
import SalarySalesDetailDialog from './page/SalarySalesDetailDialog.vue'
import SalarySettleDialog, { type SalarySettleForm } from './page/SalarySettleDialog.vue'
import SalaryTemplateFormDialog, { type SalaryTemplateForm } from './page/SalaryTemplateFormDialog.vue'
import SalaryMyRecordsTab from './page/SalaryMyRecordsTab.vue'
import SalaryEmployeesTab from './page/SalaryEmployeesTab.vue'
import SalaryPayoutTab from './page/SalaryPayoutTab.vue'
import SalaryStatsCards from './page/SalaryStatsCards.vue'
import SalaryTemplatesTab from './page/SalaryTemplatesTab.vue'
import dayjs from 'dayjs'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'
import { getActionColumnMinWidth, getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { getSalaryFieldKey } from './salary-field-permissions'
import {
  buildEmployeeAttendanceStats,
  buildEmployeeSalesStats,
  buildEmptyEmployeeSalesStats,
  getSalaryMonthRange,
  mergeEmployeeSalaryDetails,
  type SalaryEmployeeDataItem,
  type SalaryEmployeeSalaryDetail,
  type SalaryEmployeeSalesSource
} from './salary-employee-data'
import { useSalaryEmployeeTable } from './useSalaryEmployeeTable'
import { useSalaryMyRecordsTable } from './useSalaryMyRecordsTable'
import { useSalaryPayoutTable } from './useSalaryPayoutTable'
import { useSalaryTemplateTable } from './useSalaryTemplateTable'
import {
  formatSalaryAmount as formatAmount,
  formatSalaryLeaveDays as formatLeaveDays,
  formatSalaryMonth,
  formatSalaryPayoutTime as formatPayoutTime,
  formatSalarySaleTime as formatSaleTime,
  formatSalaryWorkDays as formatWorkDays,
  getAttendanceTypeTag,
  getAttendanceTypeText,
  getSalaryPaymentMethodName as getPaymentMethodName
} from './salary-formatters'

// 配置中文语言环境
const locale = zhCn

// 使用统一的 composable
const authStore = useAuthStore()
const { success, error } = useNotification()
const salaryPagePermissions = usePagePermissions('salary')
const salaryTemplatePermissions = usePagePermissions('salary-templates')
const salaryRecordPermissions = usePagePermissions('salary-records')
const mySalaryPermissions = usePagePermissions('my-salary')
const canViewSalaryPage = computed(() => salaryPagePermissions.canView.value)
const canViewSalaryTemplates = computed(() => salaryTemplatePermissions.canView.value)
const canCreateSalaryTemplate = computed(() => salaryTemplatePermissions.canCreate.value)
const canEditSalaryTemplate = computed(() => salaryTemplatePermissions.canEdit.value)
const canDeleteSalaryTemplate = computed(() => salaryTemplatePermissions.canDelete.value)
const canViewSalaryRecords = computed(() => salaryRecordPermissions.canView.value)
const canCreateSalaryRecord = computed(() => salaryRecordPermissions.canCreate.value)
const canEditSalaryRecord = computed(() => salaryRecordPermissions.canEdit.value)
const canDeleteSalaryRecord = computed(() => salaryRecordPermissions.canDelete.value)
const canApproveSalaryRecord = computed(() => salaryRecordPermissions.canApprove.value)
const canViewOwnSalary = computed(() => mySalaryPermissions.canView.value)
const canViewPayoutRecords = computed(() => canViewSalaryRecords.value || canViewOwnSalary.value)
const canAccessSalaryPage = computed(() => canViewSalaryPage.value)
const { init: initFieldPermissions } = fieldPermissions
const { refreshing, refresh } = useRefreshData()
const { isMobile } = useMobile()
const canViewTeamSalaryRecords = computed(() => canViewSalaryRecords.value)

const requireSalaryTemplatePermission = (action: 'view' | 'create' | 'edit' | 'delete') => {
  const allowed = action === 'view'
    ? canViewSalaryTemplates.value
    : action === 'create'
      ? canCreateSalaryTemplate.value
      : action === 'edit'
        ? canEditSalaryTemplate.value
        : canDeleteSalaryTemplate.value

  if (!allowed) {
    salaryTemplatePermissions.handleNoPermission(action)
  }

  return allowed
}

const requireSalaryRecordPermission = (action: 'view' | 'create' | 'edit' | 'delete' | 'approve') => {
  const allowed = action === 'view'
    ? canViewSalaryRecords.value
    : action === 'create'
      ? canCreateSalaryRecord.value
      : action === 'edit'
        ? canEditSalaryRecord.value
        : action === 'delete'
          ? canDeleteSalaryRecord.value
          : canApproveSalaryRecord.value

  if (!allowed) {
    salaryRecordPermissions.handleNoPermission(action)
  }

  return allowed
}

const canViewOwnSalarySalesDetail = (row: any) => (
  canViewOwnSalary.value &&
  Number(row?.employee_id) === Number(authStore.user?.id)
)

const canUseSalaryField = (moduleKey: string, fieldName: string) => {
  return canViewSalaryField(moduleKey, fieldName) && canEditSalaryField(moduleKey, fieldName)
}

const canViewSalaryField = (moduleKey: string, fieldName: string) => {
  return fieldPermissions.isFieldVisible(moduleKey, getSalaryFieldKey(fieldName))
}
const canEditSalaryField = (moduleKey: string, fieldName: string) => {
  if (!canViewSalaryField(moduleKey, fieldName)) {
    return false
  }

  if (
    canCreateSalaryTemplate.value ||
    canEditSalaryTemplate.value ||
    canCreateSalaryRecord.value ||
    canEditSalaryRecord.value
  ) {
    return true
  }

  return fieldPermissions.isFieldEditable(moduleKey, getSalaryFieldKey(fieldName))
}

const salaryStatsModuleKey = computed(() => (
  canViewTeamSalaryRecords.value ? 'salary_salaryrecordsview' : 'salary_mysalaryview'
))

const showSalaryStatsCards = computed(() => (
  canViewSalaryField(salaryStatsModuleKey.value, 'stats_pending_salary') ||
  canViewSalaryField(salaryStatsModuleKey.value, 'stats_rest_summary') ||
  canViewSalaryField(salaryStatsModuleKey.value, 'stats_leave_summary') ||
  canViewSalaryField(salaryStatsModuleKey.value, 'stats_overtime_summary')
))

// TAB 切换
const activeTab = ref('my')

// 统计数据
const stats = ref({
  pendingSalary: 0,
  pendingCount: 0,
  myPendingSalary: 0,
  restEmployees: [] as string[],
  leaveEmployees: [] as string[],
  overtimeEmployees: [] as string[],
  totalRestDays: 0,
  totalLeaveDays: 0,
  totalOvertimeHours: 0,
  myRestQuota: 0,
  myRestDays: 0,
  myRestRemaining: 0,
  myLeaveDays: 0,
  myLeaveDeduction: 0,
  myOvertimeHours: 0,
  myOvertimePay: 0
})

const resetMyStats = () => {
  stats.value.myPendingSalary = 0
  stats.value.myRestQuota = 0
  stats.value.myRestDays = 0
  stats.value.myRestRemaining = 0
  stats.value.myLeaveDays = 0
  stats.value.myLeaveDeduction = 0
  stats.value.myOvertimeHours = 0
  stats.value.myOvertimePay = 0
}

const getMonthDateRange = (date?: any) => {
  const d = date ? dayjs(date) : TimeUtil.now()
  const year = d.year()
  const month = d.month() + 1
  const lastDay = TimeUtil.endOf(d, 'month').date()

  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }
}

// 模板数据
const templates = ref<any[]>([])
const templatesLoading = ref(false)
const salaryTemplatesTabRef = ref<InstanceType<typeof SalaryTemplatesTab>>()
const {
  filteredTemplates,
  handleTemplatePaginationChange,
  paginatedTemplates,
  resetTemplateTableFilters,
  templateFilters,
  templatePage,
  templatePageSize,
  templateSearch,
  templateSearchExpanded
} = useSalaryTemplateTable({ templates })

const syncVisibleSalaryFilters = () => {
  if (!canViewSalaryField('salary_salarytemplatesview', 'template_is_active')) {
    templateFilters.is_active = undefined
  }
  if (!canViewSalaryField('salary_salaryrecordsview', 'salary_template_name')) {
    employeeTemplateFilter.value = undefined
  }
  if (!canViewSalaryField('salary_salaryrecordsview', 'salary_status')) {
    payoutFilters.status = undefined
  }
  if (!canViewSalaryField('salary_mysalaryview', 'period_start')) {
    myPeriodRange.value = null
  }
  if (!canViewSalaryField('salary_mysalaryview', 'employee_name')) {
    selectedViewEmployeeId.value = undefined
  }
}

const payoutActionColumnWidth = computed(() => {
  const hasPayoutRecord = paginatedPayoutData.value.some((item: any) => Boolean(item.payoutRecord))
  const buttonCount = Number(canCreateSalaryRecord.value) + (hasPayoutRecord
    ? Number(canEditSalaryRecord.value) + Number(canDeleteSalaryRecord.value)
    : 0)
  return getActionColumnMinWidth(buttonCount)
})

// 监听筛选条件变化，自动重新加载数据
watch(() => templateFilters.is_active, () => {
  loadTemplates()
})

// 我的工资数据
const myRecords = ref<any[]>([])
const myLoading = ref(false)

// 工资发放数据
const employees = ref<any[]>([])
const payoutList = ref<any[]>([])
const payoutLoading = ref(false)
const {
  getSelectedEmployeeName,
  handleMyPaginationChange,
  handleMyPeriodChange,
  handleViewEmployeeChange,
  myPagination,
  myPeriodRange,
  recordsSearchExpanded,
  resetMyTableFilters,
  selectedViewEmployeeId
} = useSalaryMyRecordsTable({
  employees,
  reload: () => loadMyRecords()
})
// 设置默认月份为当前月份
const getCurrentMonth = () => {
  return TimeUtil.nowFormatted(TIME_FORMATS.YEAR_MONTH)
}
const {
  getPayoutIndex,
  handlePayoutPaginationChange,
  paginatedPayoutData,
  payoutFilters,
  payoutMonth,
  payoutPage,
  payoutPageSize,
  payoutSearch,
  payoutSearchExpanded,
  resetPayoutTableFilters,
  salaryPayoutData
} = useSalaryPayoutTable({
  getEmployees: () => employees.value,
  initialMonth: getCurrentMonth(),
  payoutList
})

// 编辑工资相关
const editPayoutDialogVisible = ref(false)
const editPayoutSaving = ref(false)
const editPayoutForm = ref<SalaryEditPayoutForm>({
  id: 0,
  employee_id: 0,
  salary_template_id: null,
  base_salary: 0,
  commission_amount: 0,
  overtime_pay: 0,
  leave_deduction: 0,
  status: 'approved',
  paid_at: null,
  payment_method: null
})

// 结算工资相关
const settleDialogVisible = ref(false)
const settleSaving = ref(false)
const settleForm = ref<SalarySettleForm>({
  recordId: 0,
  employeeId: 0,
  employeeName: '',
  netSalary: 0,
  payment_method: ''
})

// 计算编辑后的应发工资
const calculateEditNetSalary = () => {
  const base = Number(editPayoutForm.value.base_salary) || 0
  const commission = Number(editPayoutForm.value.commission_amount) || 0
  const overtime = Number(editPayoutForm.value.overtime_pay) || 0
  const leave = Number(editPayoutForm.value.leave_deduction) || 0
  return (base + commission + overtime - leave).toFixed(2)
}


// 员工列表
const employeesLoading = ref(false)
const {
  employeePage,
  employeePageSize,
  employeeSalaryMonth,
  employeeSearch,
  employeeSearchExpanded,
  employeeTemplateFilter,
  filteredEmployees,
  getEmployeeIndex,
  handleEmployeePaginationChange,
  paginatedEmployees,
  resetEmployeeTableFilters
} = useSalaryEmployeeTable({ employees, initialMonth: getCurrentMonth(), isMobile })
const salaryEmployeesTabRef = ref<InstanceType<typeof SalaryEmployeesTab>>()
const employeeSalaryActionColumnWidth = computed(() => getActionColumnMinWidth(
  Number(canEditSalaryTemplate.value) + Number(canViewSalaryRecords.value) + 1
))
const employeeAttendanceData = ref<Map<number, any>>(new Map())
const employeeSalesData = ref<Map<number, any>>(new Map()) // 员工销售数据

watch([templateSearch, () => templateFilters.is_active], () => {
  templatePage.value = 1
})

// 详情对话框
const detailDialogVisible = ref(false)
const currentRecord = ref<any>(null)

// 销售明细对话框
const salesDetailDialogVisible = ref(false)
const currentSalesRecord = ref<any>(null)
const salesDetailList = ref<any[]>([])
const salesDetailImeiColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['IMEI', ...salesDetailList.value.map((item: any) => item.imei)],
  { minWidth: 146, horizontalPadding: 30 }
))
const salesDetailModelColumnWidth = computed(() => getTextColumnMinWidth(
  ['型号', ...salesDetailList.value.map((item: any) => item.model_name)],
  { minWidth: 104, horizontalPadding: 28 }
))
const salesDetailCustomerColumnWidth = computed(() => getTextColumnMinWidth(
  ['客户', ...salesDetailList.value.map((item: any) => item.customer_name)],
  { minWidth: 92, horizontalPadding: 28 }
))
const employeeSalesDetailImeiColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['IMEI', ...employeeSalesDetailList.value.map((item: any) => item.imei)],
  { minWidth: 146, horizontalPadding: 30 }
))
const employeeSalesDetailModelColumnWidth = computed(() => getTextColumnMinWidth(
  ['型号', ...employeeSalesDetailList.value.map((item: any) => item.model)],
  { minWidth: 104, horizontalPadding: 28 }
))
const employeeSalesDetailCustomerColumnWidth = computed(() => getTextColumnMinWidth(
  ['客户', ...employeeSalesDetailList.value.map((item: any) => item.customer_name)],
  { minWidth: 92, horizontalPadding: 28 }
))
const salesDetailTableWidth = computed(() => {
  return 60
    + (canViewSalaryField('salary_mysalaryview', 'sales_count') ? salesDetailModelColumnWidth.value + 78 + salesDetailImeiColumnWidth.value : 0)
    + (canViewSalaryField('salary_mysalaryview', 'employee_name') ? salesDetailCustomerColumnWidth.value : 0)
    + (canViewSalaryField('salary_mysalaryview', 'commission_amount') ? 96 : 0)
    + (canViewSalaryField('salary_mysalaryview', 'paid_at') ? 132 : 0)
})

const employeeSalesDetailTableWidth = computed(() => {
  return 60
    + (canViewSalaryField('salary_salaryrecordsview', 'sales_count') ? 72 + employeeSalesDetailModelColumnWidth.value + 78 + employeeSalesDetailImeiColumnWidth.value : 0)
    + (canViewSalaryField('salary_salaryrecordsview', 'employee_name') ? employeeSalesDetailCustomerColumnWidth.value : 0)
    + (canViewSalaryField('salary_salaryrecordsview', 'commission_amount') ? 96 + 92 : 0)
    + (canViewSalaryField('salary_salaryrecordsview', 'paid_at') ? 132 : 0)
})

const salesDetailDialogWidth = computed(() => `${Math.max(360, salesDetailTableWidth.value + 48)}px`)
const employeeSalesDetailDialogWidth = computed(() => `${Math.max(360, employeeSalesDetailTableWidth.value + 48)}px`)
const salesDetailLoading = ref(false)

// 销售汇总数据
const salesSummary = computed(() => {
  const list = salesDetailList.value
  return {
    total_price: list.reduce((sum, item) => sum + (Number(item.sale_price) || 0), 0).toFixed(2)
  }
})

// 查看销售明细
const handleViewSalesDetail = async (row: any) => {
  if (!canViewOwnSalarySalesDetail(row) && !requireSalaryRecordPermission('view')) {
    return
  }

  currentSalesRecord.value = row
  salesDetailDialogVisible.value = true
  salesDetailList.value = []
  salesDetailLoading.value = true

  try {
    // 尝试从 commission_detail 解析
    if (row.commission_detail) {
      try {
        let details = JSON.parse(row.commission_detail)
        if (Array.isArray(details) && details.length > 0) {
          // 获取员工工资模板，确定哪些机型需要显示
          const template = getTemplateById(row.salary_template_id)
          const newRate = template?.commission_new_fixed || template?.commission_fixed || 0
          const usedRate = template?.commission_used_fixed || 0

          // 只保留有提成的机型
          details = details.filter((item: any) => {
            // 如果数据中有 is_new 字段
            if (item.is_new !== undefined) {
              const isNew = item.is_new === 1 || item.is_new === '1' || item.is_new === true
              if (isNew && newRate > 0) return true  // 全新机有提成
              if (!isNew && usedRate > 0) return true  // 二手机有提成
              return false
            }
            // 如果没有 is_new 字段，默认是全新机，根据全新机提成判断
            return newRate > 0
          })

          if (details.length > 0) {
            salesDetailList.value = details
            return
          }
        }
      } catch (e) {
        logger.error('解析 commission_detail 失败:', e)
      }
    }

    // 如果 commission_detail 为空或解析后没有数据，调用API获取
    if (row.employee_id && row.period_start && row.period_end) {
      const response = await salaryApi.records.getEmployeeSalesDetails(
        row.employee_id,
        row.period_start,
        row.period_end
      )
      if (response.data && Array.isArray(response.data)) {
        salesDetailList.value = response.data
      }
    }
  } catch (error) {
    logger.error('加载销售明细失败:', error)
    ElMessage.error('加载销售明细失败')
  } finally {
    salesDetailLoading.value = false
  }
}

// 员工销售明细对话框
const employeeSalesDetailDialogVisible = ref(false)
const currentEmployeeSales = ref<any>(null)
const employeeSalesDetailList = ref<any[]>([])
const employeeSalesDetailLoading = ref(false)

// 员工销售汇总数据
const employeeSalesSummary = computed(() => {
  const list = employeeSalesDetailList.value
  return {
    total_count: list.length,
    total_sales: list.reduce((sum, item) => sum + (Number(item.sale_price) || 0), 0).toFixed(2),
    total_profit: list.reduce((sum, item) => sum + (Number(item.profit) || 0), 0).toFixed(2)
  }
})

// 查看员工销售明细（双击销售数量列触发）
const handleViewEmployeeSalesDetail = async (row: any) => {
  if (!requireSalaryRecordPermission('view')) {
    return
  }

  const stats = getEmployeeSalesStats(row.id)
  if (stats.sales_count === 0) {
    ElMessage.info('该员工暂无销售记录')
    return
  }

  currentEmployeeSales.value = row
  employeeSalesDetailDialogVisible.value = true
  employeeSalesDetailLoading.value = true

  try {
    // 根据当前选择的月份计算时间范围
    const monthStr = employeeSalaryMonth.value
    if (!monthStr) {
      ElMessage.warning('请先选择月份')
      employeeSalesDetailLoading.value = false
      return
    }

    const [year, month] = monthStr.split('-')
    const startDate = `${year}-${month}-01`
    // 计算该月的最后一天
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    // 使用专门的员工销售明细API获取该员工的销售明细
    const response = await salaryApi.records.getEmployeeSalesDetails(row.id, startDate, endDate)

    if (response.data) {
      // 员工销售明细API返回的是扁平化的数组
      const detailData = Array.isArray(response.data) ? response.data : []

      // 获取员工工资模板，确定哪些机型需要显示
      const template = getTemplateById(getEmployeeTemplateId(row.id))
      const newRate = template?.commission_new_fixed || template?.commission_fixed || 0
      const usedRate = template?.commission_used_fixed || 0

      // 前端过滤：只显示有提成的机型
      const filteredData = detailData.filter((item: any) => {
        // 只显示有提成的机型
        const isNew = item.is_new === true || item.is_new === 1
        if (isNew && newRate > 0) return true  // 全新机有提成
        if (!isNew && usedRate > 0) return true  // 二手机有提成
        return false  // 没有提成的机型不显示
      })

      employeeSalesDetailList.value = filteredData.map((item: any) => {
        // 新API返回的是扁平化结构，直接使用item的字段
        const purchaseCost = parseFloat(item.purchase_cost || 0)
        const salePrice = parseFloat(item.sale_price || 0)
        const isNew = item.is_new === true || item.is_new === 1

        return {
          phone_id: item.phone_id,
          imei: item.imei || '-',
          serial_number: item.serial_number || '-',
          brand: item.brand || '-',
          model: item.model || '-',
          color: item.color || '-',
          memory: item.memory || '-',
          is_new: isNew,
          condition_type: isNew ? '全新' : '二手',
          purchase_cost: purchaseCost,
          sale_price: salePrice,
          profit: item.profit || (salePrice - purchaseCost),
          sale_time: item.sale_time,
          customer_name: item.customer_name || '-',
          customer_phone: item.customer_phone || '-'
        }
      })
    }
  } catch (error) {
    logger.error('加载员工销售明细失败:', error)
    ElMessage.error('加载员工销售明细失败')
    employeeSalesDetailList.value = []
  } finally {
    employeeSalesDetailLoading.value = false
  }
}

// 员工模板编辑对话框
const templateDialogVisible = ref(false)
const currentEmployee = ref<any>(null)
const selectedTemplateId = ref<number | undefined>(undefined)

// 工资模板表单
const templateFormDialogVisible = ref(false)
const templateSaving = ref(false)
const templateForm = ref<SalaryTemplateForm>({
  id: undefined,
  name: '',
  description: '',
  base_salary: 2500,
  commission_type: 'fixed',
  commission_fixed: 20,
  commission_new_fixed: 20,  // 全新机提成（元/台）
  commission_used_fixed: 0,  // 二手机提成（元/台）
  commission_percentage: 10,
  overtime_hourly_rate: 10,
  rest_days: 2,
  // 自动涨薪规则
  auto_raise_enabled: false,
  auto_raise_months: 6,
  auto_raise_amount: 100,
  auto_raise_max_salary: 3000
})

// 加载模板列表
const loadTemplates = async () => {
  if (!canViewSalaryTemplates.value && !canViewSalaryRecords.value) {
    templates.value = []
    return
  }

  templatesLoading.value = true
  try {
    const templateQuery = canViewSalaryField('salary_salarytemplatesview', 'template_is_active')
      ? templateFilters
      : {}
    const response = canViewSalaryTemplates.value
      ? await salaryTemplateApi.getTemplates(templateQuery)
      : await salaryTemplateApi.getActiveTemplates()

    if (response.data) {
      templates.value = Array.isArray(response.data)
        ? response.data
        : (response.data.records || [])
    }
  } catch (error: any) {
    templates.value = []
    if (error?.response?.status === 403) {
      ElMessage.warning('当前账号没有工资模板查看权限')
      return
    }
    ElMessage.error('加载模板失败')
  } finally {
    templatesLoading.value = false
  }
}

// 加载工资发放记录
// 管理员/有工资记录查看权限：查看全部或按员工筛选
// 普通用户/仅有我的工资权限：只查看自己
const loadMyRecords = async () => {
  if (!canViewPayoutRecords.value) {
    myRecords.value = []
    myPagination.total = 0
    return
  }

  myLoading.value = true
  try {
    const params: any = {
      status: 'paid', // 只查询已发放的记录
      page: myPagination.page,
      page_size: myPagination.page_size
    }

    // 团队工资视角下，允许切换到指定员工记录
    if (
      canViewTeamSalaryRecords.value &&
      canViewSalaryField('salary_mysalaryview', 'employee_name') &&
      selectedViewEmployeeId.value
    ) {
      params.employee_id = selectedViewEmployeeId.value
    }

    if (
      canViewSalaryField('salary_mysalaryview', 'period_start') &&
      myPeriodRange.value &&
      myPeriodRange.value.length === 2
    ) {
      // period_start = 开始月份的第一天
      params.period_start = myPeriodRange.value[0] + '-01'
      // period_end = 结束月份的最后一天
      const endYear = myPeriodRange.value[1].split('-')[0]
      const endMonth = myPeriodRange.value[1].split('-')[1]
      const daysInMonth = new Date(parseInt(endYear), parseInt(endMonth), 0).getDate()
      params.period_end = `${endYear}-${endMonth}-${daysInMonth}`
    }

    const response = canViewTeamSalaryRecords.value
      ? await salaryApi.getSalaryRecords(params)
      : await salaryApi.getMySalaryRecords(params)

    if (response.data) {
      // response.data 已经是 {records: [...], pagination: {...}}
      myRecords.value = response.data.records || []
      myPagination.total = Number(response.data.pagination?.total || 0)
    }
  } catch {
    ElMessage.error('加载工资记录失败')
  } finally {
    myLoading.value = false
  }
}

const loadMyStats = async () => {
  if (!canViewOwnSalary.value || canViewTeamSalaryRecords.value) {
    resetMyStats()
    return
  }

  const userId = Number(authStore.user?.id || 0)
  if (!userId) {
    resetMyStats()
    return
  }

  const { startDate, endDate } = getMonthDateRange()

  try {
    const currentMonthKey = `${startDate.slice(0, 7)}`
    const [currentYear, currentMonth] = currentMonthKey.split('-').map(Number)
    const [employeeListResult, currentSalaryResult, attendanceResult, leaveBalanceResult, salesDetailResult] = await Promise.allSettled([
      unifiedApi.get('/employees/salary-list'),
      unifiedApi.get('/employees/current-salary', { params: { date: currentMonthKey } }),
      attendanceApi.getAttendanceRecords({
        start_date: startDate,
        end_date: endDate,
        status: 'approved',
        page_size: 100
      }),
      attendanceApi.getLeaveBalance(),
      salaryApi.records.getEmployeeSalesDetails(userId, startDate, endDate)
    ])

    const employeesData = employeeListResult.status === 'fulfilled'
      ? (employeeListResult.value.data?.employees || [])
      : []
    const currentSalaryData = currentSalaryResult.status === 'fulfilled'
      ? (currentSalaryResult.value.data?.employees || [])
      : []

    const myEmployee = employeesData.find((employee: any) => Number(employee.id) === userId)
    const mySalaryInfo = currentSalaryData.find((employee: any) => Number(employee.id) === userId)
    const myTemplate = mySalaryInfo || templates.value.find((template: any) => Number(template.id) === Number(myEmployee?.salary_template_id))

    if (attendanceResult.status === 'fulfilled') {
      const attendanceRecords = attendanceResult.value.data?.records || []
      let myLeaveDays = 0
      let myOvertimeHours = 0
      let myRestDays = 0

      attendanceRecords.forEach((record: any) => {
        if (Number(record.employee_id) !== userId) {
          return
        }

        if (record.record_type === 'leave') {
          myLeaveDays += parseFloat(record.leave_days || 0)
        } else if (record.record_type === 'overtime') {
          myOvertimeHours += parseFloat(record.overtime_hours || 0)
        } else if (record.record_type === 'monthly_leave') {
          myRestDays += parseFloat(record.monthly_leave_days || 0)
        }
      })

      stats.value.myLeaveDays = parseFloat(myLeaveDays.toFixed(2))
      stats.value.myOvertimeHours = parseFloat(myOvertimeHours.toFixed(2))
      stats.value.myRestDays = parseFloat(myRestDays.toFixed(2))
    } else {
      stats.value.myLeaveDays = 0
      stats.value.myOvertimeHours = 0
      stats.value.myRestDays = 0
    }

    if (leaveBalanceResult.status === 'fulfilled') {
      const leaveBalance = leaveBalanceResult.value.data
      stats.value.myRestQuota = parseFloat(String(leaveBalance?.total_quota ?? leaveBalance?.monthly_limit ?? 0)) || 0
      stats.value.myRestRemaining = parseFloat(String(leaveBalance?.available ?? 0)) || 0
    } else {
      stats.value.myRestQuota = 0
      stats.value.myRestRemaining = 0
    }

    const salesDetails = salesDetailResult.status === 'fulfilled'
      ? (Array.isArray(salesDetailResult.value.data) ? salesDetailResult.value.data : [])
      : []

    const baseSalary = parseFloat(mySalaryInfo?.current_salary || mySalaryInfo?.base_salary || 0) || 0
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
    const dailySalary = daysInMonth > 0 ? baseSalary / daysInMonth : 0
    const leaveDeduction = dailySalary * (stats.value.myLeaveDays || 0)
    const overtimeRate = parseFloat(myTemplate?.overtime_hourly_rate || 0) || 0
    const overtimePay = (stats.value.myOvertimeHours || 0) * overtimeRate

    let commissionAmount = 0
    if (myTemplate) {
      if (myTemplate.commission_type === 'fixed') {
        const newRate = parseFloat(myTemplate.commission_new_fixed || myTemplate.commission_fixed || 0) || 0
        const usedRate = parseFloat(myTemplate.commission_used_fixed || 0) || 0

        salesDetails.forEach((item: any) => {
          const isNew = item.is_new === true || item.is_new === 1 || item.is_new === '1'
          if (isNew) {
            commissionAmount += newRate
          } else if (usedRate > 0) {
            commissionAmount += usedRate
          }
        })
      } else {
        const percentage = parseFloat(myTemplate.commission_percentage || 0) || 0
        const totalProfit = salesDetails.reduce((sum: number, item: any) => {
          const salePrice = parseFloat(item.sale_price || 0) || 0
          const purchaseCost = parseFloat(item.purchase_cost || 0) || 0
          return sum + (salePrice - purchaseCost)
        }, 0)
        commissionAmount = totalProfit * percentage / 100
      }
    }

    stats.value.myLeaveDeduction = parseFloat(leaveDeduction.toFixed(2))
    stats.value.myOvertimePay = parseFloat(overtimePay.toFixed(2))
    stats.value.myPendingSalary = parseFloat((baseSalary + commissionAmount + overtimePay - leaveDeduction).toFixed(2))
  } catch (err) {
    logger.error('加载个人工资统计失败:', err)
    resetMyStats()
  }
}

// 更新统计数据
const updateStats = () => {
  const currentUserId = authStore.user?.id
  const now = TimeUtil.now()
  const periodDays = TimeUtil.endOf(now, 'month').date()

  // 团队工资统计
  if (canViewTeamSalaryRecords.value) {
    let pendingSalary = 0
    let pendingCount = 0
    let totalRestDays = 0
    let totalLeaveDays = 0
    let totalOvertimeHours = 0
    const restEmployees: string[] = []
    const leaveEmployees: string[] = []
    const overtimeEmployees: string[] = []

    // 统计所有关联工资模板的员工的待发工资
    employees.value.forEach((employee: any) => {
      // 只统计有工资模板的员工
      if (!employee.salary_template_id) return

      const empId = employee.id
      const attendanceData = employeeAttendanceData.value.get(empId)
      const salesData = employeeSalesData.value.get(empId)
      const employeeName = employee.name || employee.username

      // 计算该员工的待发工资：底薪 + 提成 + 加班费 - 请假扣除
      const baseSalary = parseFloat(employee.current_salary || employee.base_salary || 0)
      const overtimePay = parseFloat(salesData?.overtime_pay || 0)
      const commission = parseFloat(salesData?.commission_amount || 0)

      // 动态计算请假扣除
      const leaveDays = attendanceData?.leave_days || 0
      const dailySalary = periodDays > 0 ? baseSalary / periodDays : 0
      const leaveDeduction = dailySalary * leaveDays

      const netSalary = baseSalary + commission + overtimePay - leaveDeduction
      pendingSalary += netSalary
      pendingCount++

      // 累计休假天数和员工名单
      const restDays = attendanceData?.monthly_leave_days_used || 0
      totalRestDays += restDays
      if (restDays > 0) {
        restEmployees.push(employeeName)
      }

      // 累计请假天数和员工名单
      totalLeaveDays += leaveDays
      if (leaveDays > 0) {
        leaveEmployees.push(employeeName)
      }

      // 累计加班小时数和员工名单
      const overtimeHours = salesData?.overtime_hours || 0
      totalOvertimeHours += overtimeHours
      if (overtimeHours > 0) {
        overtimeEmployees.push(employeeName)
      }
    })

    stats.value.pendingSalary = parseFloat(pendingSalary.toFixed(2))
    stats.value.pendingCount = pendingCount
    stats.value.totalRestDays = Math.round(totalRestDays)
    stats.value.totalLeaveDays = Math.round(totalLeaveDays)
    stats.value.totalOvertimeHours = Math.round(totalOvertimeHours)
    stats.value.restEmployees = restEmployees
    stats.value.leaveEmployees = leaveEmployees
    stats.value.overtimeEmployees = overtimeEmployees
  } else {
    // 普通用户统计数据 - 只显示自己的待发工资
    const myAttendanceData = employeeAttendanceData.value.get(currentUserId)
    const mySalesData = employeeSalesData.value.get(currentUserId)
    const employee = employees.value.find((e: any) => e.id === currentUserId)

    if (employee) {
      // 计算自己的待发工资：底薪 + 提成 + 加班费 - 请假扣除
      const baseSalary = parseFloat(employee.current_salary || employee.base_salary || 0)
      const overtimePay = parseFloat(mySalesData?.overtime_pay || 0)
      const commission = parseFloat(mySalesData?.commission_amount || 0)

      // 动态计算请假扣除
      const leaveDays = myAttendanceData?.leave_days || 0
      const dailySalary = periodDays > 0 ? baseSalary / periodDays : 0
      const leaveDeduction = dailySalary * leaveDays

      const netSalary = baseSalary + commission + overtimePay - leaveDeduction
      stats.value.myPendingSalary = parseFloat(netSalary.toFixed(2))

      // 休假数据
      stats.value.myRestDays = myAttendanceData?.monthly_leave_days_used || 0
      stats.value.myRestRemaining = myAttendanceData?.monthly_leave_days_available || 0

      // 请假数据
      stats.value.myLeaveDays = leaveDays
      stats.value.myLeaveDeduction = parseFloat(leaveDeduction.toFixed(2))

      // 加班数据
      stats.value.myOvertimeHours = mySalesData?.overtime_hours || 0
      stats.value.myOvertimePay = parseFloat(overtimePay.toFixed(2))
    }
  }
}

// 获取员工名称
const getEmployeeName = (id: number) => {
  const emp = employees.value.find(e => e.id === id)
  return emp?.name || emp?.username || '-'
}

// 重置筛选
const resetTemplateFilters = () => {
  resetTemplateTableFilters()
  syncVisibleSalaryFilters()
  loadTemplates()
}

const resetMyFilters = () => {
  resetMyTableFilters()
  syncVisibleSalaryFilters()
  loadMyRecords()
}

const resetPayoutFilters = () => {
  resetPayoutTableFilters()
  syncVisibleSalaryFilters()
  loadPayoutList()
}

// 员工薪资相关方法
// 支持传入日期参数（YYYY-MM）来计算指定月份的底薪
const loadEmployeeList = async (dateParam?: string) => {
  if (!canViewSalaryRecords.value) {
    employees.value = []
    employeeAttendanceData.value = new Map()
    employeeSalesData.value = new Map()
    return
  }

  employeesLoading.value = true
  try {
    if (templates.value.length === 0) {
      await loadTemplates()
    }

    const [employeeResponse, salaryResponse] = await Promise.all([
      unifiedApi.get('/employees/salary-list'),
      unifiedApi.get('/employees/current-salary', {
        params: dateParam ? { date: dateParam } : {}
      })
    ])
    const employeeList = Array.isArray(employeeResponse.data?.employees)
      ? employeeResponse.data.employees as SalaryEmployeeDataItem[]
      : []
    const salaryDetails = Array.isArray(salaryResponse.data?.employees)
      ? salaryResponse.data.employees as SalaryEmployeeSalaryDetail[]
      : []
    employees.value = mergeEmployeeSalaryDetails(employeeList, salaryDetails)

    await loadAllEmployeesAttendance(dateParam)
    await loadAllEmployeesSales(dateParam)
  } catch (err) {
    logger.error('加载员工列表失败:', err)
    ElMessage.error('加载员工列表失败')
  } finally {
    employeesLoading.value = false
  }
}

// 加载所有员工的当月考勤统计
// monthParam 格式: "2025-01"，如果为空则使用当前月份
// 休假逻辑：每月休假天数从薪资模板读取，上个月没用完可以累积到本月
const loadAllEmployeesAttendance = async (monthParam?: string) => {
  if (!canViewSalaryRecords.value) {
    employeeAttendanceData.value = new Map()
    return
  }

  try {
    const range = getSalaryMonthRange(monthParam)
    const records: AttendanceRecord[] = []
    let page = 1
    let hasNext = false

    do {
      const response = await attendanceApi.getAttendanceRecords({
        start_date: range.attendance_start_date,
        end_date: range.end_date,
        status: 'approved',
        page,
        page_size: 100
      })
      records.push(...(response.data?.records || []))
      hasNext = Boolean(response.data?.pagination?.has_next)
      page += 1
    } while (hasNext)

    employeeAttendanceData.value = buildEmployeeAttendanceStats(
      records,
      range.start_date,
      range.end_date,
      employeeId => Number(getTemplateById(getEmployeeTemplateId(employeeId))?.rest_days || 2)
    )
    updateStats()
  } catch (error) {
    logger.error('加载考勤统计失败:', error)
  }
}

// 加载所有员工的当月销售数据（含全新机和二手机）
// monthParam 格式: "2025-01"，如果为空则使用当前月份
const loadAllEmployeesSales = async (monthParam?: string) => {
  if (!canViewSalaryRecords.value) {
    employeeSalesData.value = new Map()
    return
  }

  try {
    const range = getSalaryMonthRange(monthParam)
    const response = await salaryApi.records.getEmployeesSalesData(range.start_date, range.end_date)
    const salesData = (response.data || {}) as Record<string, SalaryEmployeeSalesSource>
    employeeSalesData.value = buildEmployeeSalesStats(
      employees.value,
      salesData,
      employeeAttendanceData.value,
      employee => getTemplateById(employee.salary_template_id || undefined)
    )
    updateStats()
  } catch (error) {
    logger.error('加载销售数据失败:', error)
    employeeSalesData.value = buildEmptyEmployeeSalesStats(employees.value)
  }
}

// 计算请假扣款（当月底薪 ÷ 当月天数 × 请假天数）
const calculateLeaveDeduction = (employeeId: number, leaveDays: number) => {
  if (!leaveDays) return 0

  // 根据当前标签页获取选择的月份
  const monthStr = activeTab.value === 'payout' ? payoutMonth.value : employeeSalaryMonth.value
  const [year, month] = monthStr.split('-').map(Number)
  // new Date(year, month, 0) 会创建 year年month月0日，实际是 year年month-1月的最后一天
  // 所以要获取 month 月的天数，需要用 month + 1，然后取第0天
  const daysInMonth = new Date(year, month, 0).getDate()

  // 使用员工当前底薪（包含工龄涨薪）计算日薪
  const baseSalary = parseFloat(getEmployeeBaseSalary(employeeId)) || 0
  if (!baseSalary) return 0

  const dailySalary = baseSalary / daysInMonth

  // 请假扣款 = 日薪 × 请假天数
  return (dailySalary * leaveDays).toFixed(2)
}

// 计算加班费
const calculateOvertimePay = (employeeId: number, overtimeHours: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  if (!template || !overtimeHours) return 0
  const overtimeRate = template.overtime_hourly_rate || 0
  return (overtimeHours * overtimeRate).toFixed(2)
}

// 计算预计实发工资
const calculateEstimatedSalary = (employeeId: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  if (!template) return '-'

  const stats = getEmployeeAttendanceStats(employeeId)
  // 使用当前底薪（包含工龄涨薪）而不是模板的原始底薪
  const baseSalary = parseFloat(getEmployeeBaseSalary(employeeId)) || 0
  const overtimePay = parseFloat(String(calculateOvertimePay(employeeId, stats.overtime_hours))) || 0
  const leaveDeduction = parseFloat(String(calculateLeaveDeduction(employeeId, stats.leave_days))) || 0
  // 超出的休假天数已在 loadAllEmployeesAttendance 中转为请假天数，这里不再扣款
  const salesCommission = parseFloat(calculateSalesCommission(employeeId)) || 0

  const estimated = baseSalary + overtimePay + salesCommission - leaveDeduction

  // 检查是否为有效数字
  if (isNaN(estimated)) {
    return '-'
  }

  return estimated.toFixed(2)
}

// 获取员工模板ID
const getEmployeeTemplateId = (employeeId: number) => {
  const employee = employees.value.find(e => e.id === employeeId)
  return employee?.salary_template_id
}

// 获取员工考勤统计
const getEmployeeAttendanceStats = (employeeId: number) => {
  return employeeAttendanceData.value.get(employeeId) || {
    leave_days: 0,
    overtime_hours: 0,
    monthly_leave_days_used: 0,
    monthly_leave_days_available: 0,
    latest_leave_activity_at: null,
    latest_leave_record_date: null
  }
}

// 获取员工销售统计
const getEmployeeSalesStats = (employeeId: number) => {
  return employeeSalesData.value.get(employeeId) || {
    sales_count: 0,
    sales_amount: 0,
    total_profit: 0,
    new_count: 0,
    new_amount: 0,
    new_profit: 0,
    used_count: 0,
    used_amount: 0,
    used_profit: 0
  }
}

// 计算工作天数（当月天数 - 请假天数）
// 注意：休假（monthly_leave）不影响工作天数计算
const calculateWorkDays = (employeeId: number) => {
  // 根据当前标签页获取选择的月份
  const monthStr = activeTab.value === 'payout' ? payoutMonth.value : employeeSalaryMonth.value
  const [year, month] = monthStr.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()

  const stats = getEmployeeAttendanceStats(employeeId)
  // 工作天数 = 当月天数 - 请假天数
  // 注意：休假（monthly_leave）不影响工作天数计算
  const workDays = daysInMonth - (stats.leave_days || 0)
  return Math.max(0, workDays)
}

// 计算销售提成（全新机和二手机分别计算，只有提成大于0的机型才统计）
const calculateSalesCommission = (employeeId: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  const salesStats = getEmployeeSalesStats(employeeId)

  if (!template || !salesStats.sales_count) return '0'

  const commissionType = template.commission_type || 'fixed'

  let commission = 0
  if (commissionType === 'fixed') {
    // 固定金额/台 - 分别计算全新机和二手机
    const newRate = template.commission_new_fixed || template.commission_fixed || 0
    const usedRate = template.commission_used_fixed || 0

    const newCount = salesStats.new_count || 0
    // 只有当二手机提成大于0时，才计算二手机提成
    const usedCount = (usedRate > 0) ? (salesStats.used_count || 0) : 0

    commission = (newCount * newRate) + (usedCount * usedRate)
  } else {
    // 利润百分比
    const percentage = template.commission_percentage || 0
    const totalProfit = salesStats.total_profit || 0
    commission = totalProfit * percentage / 100
  }

  return commission.toFixed(2)
}

// 获取员工有提成的机型数量（用于显示）
const getEmployeeCommissionCount = (employeeId: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  const salesStats = getEmployeeSalesStats(employeeId)

  if (!template) return 0

  const commissionType = template.commission_type || 'fixed'
  let count = 0

  if (commissionType === 'fixed') {
    const newRate = parseFloat(template.commission_new_fixed || template.commission_fixed || 0)
    const usedRate = parseFloat(template.commission_used_fixed || 0)

    // 只统计有提成的机型
    if (newRate > 0) count += (salesStats.new_count || 0)
    if (usedRate > 0) count += (salesStats.used_count || 0)
  } else {
    // 利润百分比模式：统计所有销售
    count = salesStats.sales_count || 0
  }

  return count
}

const resetEmployeeFilters = () => {
  resetEmployeeTableFilters()
  syncVisibleSalaryFilters()
}

// 员工薪资页面：月份变化处理
const handleEmployeeMonthChange = async () => {
  if (!canViewSalaryRecords.value) return

  // 重新加载员工数据（传入选择的月份，以便计算该月的工龄底薪）
  await loadEmployeeList(employeeSalaryMonth.value)
  // 重新加载考勤和销售数据（根据新选择的月份）
  await loadAllEmployeesAttendance(employeeSalaryMonth.value)
  await loadAllEmployeesSales(employeeSalaryMonth.value)
}

// 员工薪资页面：刷新数据
const handleRefreshEmployeeData = async () => {
  if (!canViewSalaryRecords.value) return

  await loadEmployeeList(employeeSalaryMonth.value)
  await loadAllEmployeesAttendance(employeeSalaryMonth.value)
  await loadAllEmployeesSales(employeeSalaryMonth.value)
}

// 获取模板相关信息的辅助方法
const getTemplateById = (id: number | undefined) => {
  if (!id) return null
  const template = templates.value.find(t => t.id === id)
  return template
}

const getTemplateName = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.name || '-'
}

// 获取员工底薪（使用实时计算的当前底薪，包含工龄涨薪）
const getEmployeeBaseSalary = (employeeId: number) => {
  const employee = employees.value.find((e: any) => e.id === employeeId)
  return employee?.current_salary || employee?.base_salary || '0'
}

// 获取员工工资记录
const getEmployeePayoutRecord = (employeeId: number) => {
  return payoutList.value.find((r: any) => r.employee_id === employeeId)
}

const parseTimestamp = (value: any) => {
  if (!value) return null
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.valueOf() : null
}

const getPayoutSettledTimestamp = (record: any) => {
  return parseTimestamp(record?.paid_at || record?.updated_at || record?.created_at)
}

const getSalaryRecalculationNotice = (employeeId: number) => {
  const record = getEmployeePayoutRecord(employeeId)
  if (!record) return null

  const stats = getEmployeeAttendanceStats(employeeId)
  const settledAt = getPayoutSettledTimestamp(record)
  const leaveActivityAt = parseTimestamp(stats.latest_leave_activity_at)

  if (!settledAt || !leaveActivityAt || leaveActivityAt <= settledAt) {
    return null
  }

  const leaveDateText = stats.latest_leave_record_date ? `请假日期：${stats.latest_leave_record_date}` : '存在后补请假'
  const activityText = dayjs(stats.latest_leave_activity_at).isValid()
    ? dayjs(stats.latest_leave_activity_at).format('YYYY-MM-DD HH:mm')
    : stats.latest_leave_activity_at

  return {
    message: `${leaveDateText}，审批时间晚于工资结算时间（${activityText}），建议重新结算`
  }
}

// 获取销售数量（优先使用 sales_count 字段）
const getSalesCount = (row: any) => {
  // 优先使用 sales_count 字段（新增字段）
  if (row.sales_count !== undefined && row.sales_count !== null) {
    return row.sales_count
  }
  // 备用方案：从 commission_detail JSON 字段解析
  if (row.commission_detail) {
    try {
      const details = JSON.parse(row.commission_detail)
      // commission_detail 是 details 数组，长度就是销售数量
      if (Array.isArray(details)) {
        return details.length
      }
      // 如果是对象且包含 count 字段
      if (details.count !== undefined) {
        return details.count
      }
    } catch (e) {
      logger.error('解析 commission_detail 失败:', e)
    }
  }
  // 如果都没有，返回 0
  return 0
}

// 月份变更处理
const handleMonthChange = async () => {
  if (!canViewSalaryRecords.value) return

  // 重新加载员工数据（传入选择的月份，以便计算该月的工龄底薪）
  await loadEmployeeList(payoutMonth.value)
  // 重新加载考勤和销售数据（根据新选择的月份）
  await loadAllEmployeesAttendance(payoutMonth.value)
  await loadAllEmployeesSales(payoutMonth.value)
  // 重新加载工资记录
  loadPayoutList()
}

// 工资发放：批量重算当月工资
const handleBulkRecalculatePayout = async () => {
  if (!requireSalaryRecordPermission('edit')) {
    return
  }

  if (!payoutMonth.value) {
    ElMessage.warning('请先选择月份')
    return
  }

  try {
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`

    await ElMessageBox.confirm(
      `确认批量重算 ${payoutMonth.value} 全部员工工资？将覆盖历史记录`,
      '确认',
      { type: 'warning' }
    )

    payoutLoading.value = true
    const response = await salaryApi.records.recalculateMonth(startDate, endDate)
    const result = response.data
    ElMessage.success(`批量重算完成：成功 ${result.recalculated}/${result.total}`)

    await loadPayoutList()
    await loadAllEmployeesAttendance(payoutMonth.value)
    await loadAllEmployeesSales(payoutMonth.value)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量重算失败')
    }
  } finally {
    payoutLoading.value = false
  }
}

// 状态筛选变更处理
const handleFilterChange = () => {
  // 筛选由计算属性自动处理
}

// 临时存储计算数据，等待确认后保存
const pendingSalaryData = ref<any>(null)

// 关闭结算对话框并清空临时数据
const closeSettleDialog = () => {
  settleDialogVisible.value = false
  pendingSalaryData.value = null
}

const getCurrentDateTimeString = () => TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)

const normalizePaidAtDateTime = (value: string | null | undefined) => {
  if (!value) return null
  return value.length > 10 ? value : `${value} 00:00:00`
}

// 按员工结算工资
const handlePayoutByEmployee = async (employee: any) => {
  const existingRecord = getEmployeePayoutRecord(employee.id)
  if (!requireSalaryRecordPermission(existingRecord ? 'edit' : 'create')) {
    return
  }

  try {
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    // period_end 是月底（统计当月所有数据）
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    // 使用后端计算 API（支持自动涨薪）
    let calculatedData: any
    try {
      const response = await salaryApi.calculateSalary(employee.id, startDate, endDate)
      calculatedData = response.data
    } catch (err: any) {
      logger.error('计算工资失败:', err)

      // 检查是否是模板错误（处理多种错误响应格式）
      const errorMessage = err.response?.data?.message || err.data?.message || err.message || ''
      if (errorMessage.includes('工资模板') || errorMessage.includes('template') || errorMessage.includes('关联')) {
        ElMessage.error(`无法结算：${employee.name || employee.username} 没有关联薪资模板，请先设置`)
      } else {
        ElMessage.error(`计算工资失败：${errorMessage}`)
      }
      return
    }

    // 检查是否已有记录
    const record = existingRecord

    // 临时存储计算的数据和员工信息，等待确认后保存
    pendingSalaryData.value = {
      employeeId: employee.id,
      employeeName: employee.name || employee.username,
      calculatedData: calculatedData,
      existingRecord: record,
      startDate: startDate,
      endDate: endDate
    }

    // 显示结算对话框，选择支付方式（此时还未保存到数据库）
    settleForm.value = {
      recordId: null, // 还没有保存，所以没有 recordId
      employeeId: employee.id,
      employeeName: employee.name || employee.username,
      netSalary: Number(calculatedData.net_salary || 0).toFixed(2),
      payment_method: record?.payment_method || '' // 预填充之前的支付方式
    }
    settleDialogVisible.value = true

  } catch (error) {
    logger.error('结算失败:', error)
    ElMessage.error('操作失败')
  }
}

// 确认结算
const confirmSettle = async () => {
  if (settleSaving.value) return
  const action = (pendingSalaryData.value?.existingRecord || settleForm.value.recordId) ? 'edit' : 'create'
  if (!requireSalaryRecordPermission(action)) {
    return
  }

  if (canViewSalaryField('salary_salaryrecordsview', 'payment_method') && !settleForm.value.payment_method) {
    ElMessage.warning('请选择支付方式')
    return
  }

  // 如果没有待处理的数据，说明是已存在记录的结算（使用 recordId）
  if (!pendingSalaryData.value && !settleForm.value.recordId) {
    ElMessage.error('结算数据丢失，请重新操作')
    return
  }

  try {
    settleSaving.value = true

    // 情况1：新结算（有 pendingSalaryData）
    if (pendingSalaryData.value) {
      const { calculatedData, existingRecord } = pendingSalaryData.value
      const paymentMethod = settleForm.value.payment_method || existingRecord?.payment_method || null

      // 准备保存的数据
      const saveData = {
        ...calculatedData,
        status: existingRecord?.status === 'paid' ? 'paid' : 'approved',
        payment_method: paymentMethod
      }

      // 使用 UPSERT 接口保存
      const saveResponse = await salaryApi.saveCalculatedSalary(saveData)
      const savedRecord = saveResponse.data?.data

      if (!savedRecord) {
        ElMessage.error('保存工资记录失败')
        return
      }

      // 调用 markAsPaid 确保 paid_at 时间正确
      await salaryApi.records.markAsPaid(savedRecord.id, paymentMethod || undefined)

      ElMessage.success('结算成功')
      settleDialogVisible.value = false
      pendingSalaryData.value = null // 清空临时数据
      await loadPayoutList() // 等待列表刷新完成
    } else if (settleForm.value.recordId) {
      // 情况2：已有记录的结算（使用 recordId）
      const [year, month] = payoutMonth.value.split('-')
      const startDate = `${year}-${month}-01`
      const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
      const endDate = `${year}-${month}-${daysInMonth}`

      // 重新计算并覆盖保存，确保以最新数据为准
      const response = await salaryApi.calculateSalary(settleForm.value.employeeId, startDate, endDate)
      const calculatedData = response.data
      const existingRecord = getEmployeePayoutRecord(settleForm.value.employeeId)
      const paymentMethod = settleForm.value.payment_method || existingRecord?.payment_method || null

      const saveData = {
        ...calculatedData,
        status: existingRecord?.status === 'paid' ? 'paid' : 'approved',
        payment_method: paymentMethod
      }

      await salaryApi.saveCalculatedSalary(saveData)
      await salaryApi.records.markAsPaid(settleForm.value.recordId, paymentMethod || undefined)
      ElMessage.success('结算成功')
      settleDialogVisible.value = false
      await loadPayoutList() // 等待列表刷新完成
    }
  } catch (error) {
    logger.error('结算失败:', error)
    ElMessage.error('结算失败')
  } finally {
    settleSaving.value = false
  }
}

// 重新结算工资（使用最新的销售和考勤数据）
const handleRecalculatePayout = async (employee: any) => {
  if (!requireSalaryRecordPermission('edit')) {
    return
  }

  const record = getEmployeePayoutRecord(employee.id)
  if (!record) {
    ElMessage.error('未找到工资记录')
    return
  }

  try {
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    // 重新计算工资
    const response = await salaryApi.calculateSalary(employee.id, startDate, endDate)
    const calculatedData = response.data

    // 保存数据，更新结算时间为当前时间
    const recordStatus = record.status === 'paid' ? 'paid' : 'approved'
    const saveData = {
      ...calculatedData,
      status: recordStatus,
      paid_at: recordStatus === 'paid' ? getCurrentDateTimeString() : null,
      payment_method: recordStatus === 'paid' ? (record.payment_method || null) : null
    }

    await salaryApi.saveCalculatedSalary(saveData)
    await loadPayoutList()
    ElMessage.success('重新结算成功，工资数据和结算时间已更新')
  } catch (err: any) {
    logger.error('重新结算失败:', err)
    ElMessage.error(err.response?.data?.message || '重新结算失败')
  }
}

// 按员工编辑工资
const handleEditPayoutByEmployee = (employee: any) => {
  const record = getEmployeePayoutRecord(employee.id)
  if (!requireSalaryRecordPermission(record ? 'edit' : 'create')) {
    return
  }

  if (record) {
    // 已有记录：编辑模式
    // 将 datetime 格式转换为 date 格式（用于 date 输入框）
    let paidAtDate = null
    if (record.paid_at) {
      const date = new Date(record.paid_at)
      paidAtDate = date.toISOString().slice(0, 10) // YYYY-MM-DD
    }

    editPayoutForm.value = {
      id: record.id,
      employee_id: record.employee_id,
      salary_template_id: record.salary_template_id || employee.salary_template_id || null,
      base_salary: record.base_salary || 0,
      commission_amount: record.commission_amount || 0,
      overtime_pay: record.overtime_pay || 0,
      leave_deduction: record.leave_deduction || 0,
      status: record.status || 'approved',
      paid_at: paidAtDate,
      payment_method: record.payment_method || null
    }
  } else {
    // 没有记录：新增模式，使用动态计算的数据
    const baseSalary = getEmployeeBaseSalary(employee.id)
    const commissionAmount = calculateSalesCommission(employee.id)
    const overtimePay = calculateOvertimePay(employee.id, getEmployeeAttendanceStats(employee.id).overtime_hours)
    const leaveDeduction = calculateLeaveDeduction(employee.id, getEmployeeAttendanceStats(employee.id).leave_days)

    editPayoutForm.value = {
      id: null,
      employee_id: employee.id,
      salary_template_id: employee.salary_template_id || null,
      base_salary: parseFloat(baseSalary) || 0,
      commission_amount: parseFloat(commissionAmount) || 0,
      overtime_pay: parseFloat(String(overtimePay)) || 0,
      leave_deduction: parseFloat(String(leaveDeduction)) || 0,
      status: 'approved',
      paid_at: null,
      payment_method: null
    }
  }
  editPayoutDialogVisible.value = true
}

// 保存编辑的工资
const handleSaveEditPayout = async () => {
  if (!requireSalaryRecordPermission(editPayoutForm.value.id ? 'edit' : 'create')) {
    return
  }

  try {
    editPayoutSaving.value = true

    // 计算应发工资
    const netSalary = calculateEditNetSalary()

    // 获取期间日期
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    // 获取员工统计数据
    const attendanceStats = getEmployeeAttendanceStats(editPayoutForm.value.employee_id)
    const existingRecord = editPayoutForm.value.id
      ? getEmployeePayoutRecord(editPayoutForm.value.employee_id)
      : null

    const saveData: any = {
      employee_id: editPayoutForm.value.employee_id,
      salary_template_id: editPayoutForm.value.salary_template_id || existingRecord?.salary_template_id || null,
      period_start: startDate,
      period_end: endDate,
      base_salary_adjustment: existingRecord?.base_salary_adjustment || 0,
      performance_bonus: existingRecord?.performance_bonus || 0,
      other_bonus: existingRecord?.other_bonus || 0,
      other_deduction: existingRecord?.other_deduction || 0
    }

    if (canUseSalaryField('salary_salaryrecordsview', 'base_salary')) {
      saveData.base_salary = editPayoutForm.value.base_salary
    } else if (existingRecord) {
      saveData.base_salary = existingRecord.base_salary || 0
    } else {
      saveData.base_salary = editPayoutForm.value.base_salary
    }
    if (canUseSalaryField('salary_salaryrecordsview', 'commission_amount')) {
      saveData.commission_amount = editPayoutForm.value.commission_amount
    } else if (existingRecord) {
      saveData.commission_amount = existingRecord.commission_amount || 0
    } else {
      saveData.commission_amount = editPayoutForm.value.commission_amount
    }
    if (canUseSalaryField('salary_salaryrecordsview', 'overtime_pay')) {
      saveData.overtime_pay = editPayoutForm.value.overtime_pay
    } else if (existingRecord) {
      saveData.overtime_pay = existingRecord.overtime_pay || 0
    } else {
      saveData.overtime_pay = editPayoutForm.value.overtime_pay
    }
    saveData.overtime_hours = attendanceStats.overtime_hours ?? existingRecord?.overtime_hours ?? 0
    if (canUseSalaryField('salary_salaryrecordsview', 'leave_deduction')) {
      saveData.leave_deduction = editPayoutForm.value.leave_deduction
    } else if (existingRecord) {
      saveData.leave_deduction = existingRecord.leave_deduction || 0
    } else {
      saveData.leave_deduction = editPayoutForm.value.leave_deduction
    }
    saveData.leave_days = attendanceStats.leave_days ?? existingRecord?.leave_days ?? 0
    saveData.net_salary = netSalary
    if (canUseSalaryField('salary_salaryrecordsview', 'salary_status')) {
      saveData.status = editPayoutForm.value.status
    } else {
      saveData.status = existingRecord?.status || editPayoutForm.value.status || 'approved'
    }

    const isPaidStatus = saveData.status === 'paid'
    saveData.paid_at = isPaidStatus
      ? (
        canUseSalaryField('salary_salaryrecordsview', 'paid_at')
          ? (
            editPayoutForm.value.id
              ? normalizePaidAtDateTime(editPayoutForm.value.paid_at)
              : getCurrentDateTimeString()
          )
          : normalizePaidAtDateTime(existingRecord?.paid_at || editPayoutForm.value.paid_at) || getCurrentDateTimeString()
      )
      : null
    saveData.payment_method = isPaidStatus
      ? (
        canUseSalaryField('salary_salaryrecordsview', 'payment_method')
          ? (editPayoutForm.value.payment_method || null)
          : (existingRecord?.payment_method || editPayoutForm.value.payment_method || null)
      )
      : null

    // 使用 UPSERT 接口保存
    await salaryApi.saveCalculatedSalary(saveData)

    ElMessage.success(editPayoutForm.value.id ? '工资记录修改成功' : '工资记录创建成功')

    editPayoutDialogVisible.value = false
    loadPayoutList()
  } catch {
    ElMessage.error('保存失败')
  } finally {
    editPayoutSaving.value = false
  }
}

// 删除工资记录
const handleDeletePayout = async (employee: any) => {
  if (!requireSalaryRecordPermission('delete')) {
    return
  }

  const record = getEmployeePayoutRecord(employee.id)
  if (!record) return

  try {
    await ElMessageBox.confirm(`确认删除 ${employee.name || employee.username} 的工资记录？此操作不可恢复！`, '警告', {
      type: 'warning',
      customClass: 'message-box-unified'
    })
    await salaryApi.records.deleteSalaryRecord(record.id)
    ElMessage.success('删除成功')
    loadPayoutList()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const getTemplateCommissionType = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.commission_type || 'fixed'
}

const getTemplateCommissionFixed = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.commission_fixed || 0
}

const getTemplateCommissionNewFixed = (id: number | undefined) => {
  const template = getTemplateById(id)
  // 优先使用新字段，如果没有则使用旧字段
  return template?.commission_new_fixed || template?.commission_fixed || 0
}

const getTemplateCommissionUsedFixed = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.commission_used_fixed || 0
}

const getTemplateCommissionPercentage = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.commission_percentage || 0
}

const getTemplateOvertimeRate = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.overtime_hourly_rate || 0
}

// 编辑员工工资模板
const handleEditEmployeeTemplate = (row: any) => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  currentEmployee.value = row
  selectedTemplateId.value = row.salary_template_id || undefined
  templateDialogVisible.value = true
}

// 保存员工工资模板
const handleSaveEmployeeTemplate = async () => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  if (!canEditSalaryField('salary_salaryrecordsview', 'salary_template_name')) {
    salaryTemplatePermissions.handleNoPermission('edit')
    return
  }

  if (!currentEmployee.value) return

  try {
    // 使用工资模板API，需要工资管理权限
    await salaryTemplateApi.setEmployeeTemplate(
      currentEmployee.value.id,
      selectedTemplateId.value || null
    )
    ElMessage.success('工资模板设置成功')
    templateDialogVisible.value = false
    // 根据当前标签页传递正确的月份参数
    const monthParam = activeTab.value === 'employees' ? employeeSalaryMonth.value : payoutMonth.value
    await loadEmployeeList(monthParam)
  } catch {
    ElMessage.error('设置失败')
  }
}

// ========== 考勤记录相关 ==========
// 考勤记录对话框
const attendanceDialogVisible = ref(false)
const attendanceRecords = ref<Array<AttendanceRecord & { reason?: string }>>([])
const attendanceLoading = ref(false)
const currentAttendanceEmployee = ref<any>(null)
const attendanceFormVisible = ref(false)
const attendanceSaving = ref(false)
const attendanceDialogTitle = ref('新增考勤记录')
const editingAttendanceId = ref<number | null>(null) // 正在编辑的考勤记录ID
type AttendanceFormModel = AttendanceRecord & { reason: string }

const attendanceForm = ref<AttendanceFormModel>({
  record_date: '',
  record_type: 'leave',
  leave_type: '事假',
  leave_days: 1,
  overtime_hours: 1,
  monthly_leave_days: 1,
  reason: '',
  status: 'approved' // 管理端默认添加为已通过
})

// 考勤类型变更处理
const handleAttendanceTypeChange = () => {
  // 类型变更时重置日期
  attendanceForm.value.record_date = TimeUtil.nowFormatted(TIME_FORMATS.DATE)
}

// 打开员工考勤记录对话框
const handleViewAttendance = async (row: any) => {
  if (!requireSalaryRecordPermission('view')) {
    return
  }

  currentAttendanceEmployee.value = row
  // 清空之前的数据
  attendanceRecords.value = []
  attendanceDialogVisible.value = true
  await loadEmployeeAttendance(row.id)
}

// 加载员工考勤记录
const loadEmployeeAttendance = async (employeeId: number) => {
  if (!canViewSalaryRecords.value) {
    attendanceRecords.value = []
    return
  }

  attendanceLoading.value = true
  try {
    // 使用当前选择的月份（员工薪资页面的月份选择）
    const [year, month] = employeeSalaryMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    // 获取当月的最后一天
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${daysInMonth}`

    const response = await attendanceApi.getAttendanceRecords({
      employee_id: employeeId,
      start_date: startDate,
      end_date: endDate
    })

    if (response.data) {
      // unifiedApi 返回的是 response.data
      attendanceRecords.value = response.data.records || []
    }
  } catch (error) {
    logger.error('[员工考勤] 加载失败:', error)
    ElMessage.error('加载考勤记录失败')
  } finally {
    attendanceLoading.value = false
  }
}

// 打开新增考勤记录对话框
const handleAddAttendance = () => {
  if (!requireSalaryRecordPermission('create')) {
    return
  }

  editingAttendanceId.value = null // 清空编辑ID，表示新增模式
  attendanceDialogTitle.value = '新增考勤记录'
  attendanceForm.value = {
    record_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
    record_type: 'leave',
    leave_type: '事假',
    leave_days: 1,
    overtime_hours: 2,
    monthly_leave_days: 1,
    reason: '',
    status: 'approved'
  }
  attendanceFormVisible.value = true
}

// 打开编辑考勤记录对话框
const handleEditAttendance = (row: any) => {
  if (!requireSalaryRecordPermission('edit')) {
    return
  }

  editingAttendanceId.value = row.id // 设置编辑ID
  attendanceDialogTitle.value = '编辑考勤记录'
  attendanceForm.value = {
    record_date: row.record_date,
    record_type: row.record_type,
    leave_type: row.leave_type || '事假',
    leave_days: row.leave_days || 0,
    overtime_hours: row.overtime_hours || 0,
    monthly_leave_days: row.monthly_leave_days || 0,
    reason: row.reason || '',
    status: row.status
  }
  attendanceFormVisible.value = true
}

// 快捷新增考勤记录
const handleQuickAdd = (type: 'overtime' | 'monthly_leave' | 'leave') => {
  if (!requireSalaryRecordPermission('create')) {
    return
  }

  editingAttendanceId.value = null // 清空编辑ID，表示新增模式
  const typeLabels: Record<string, string> = {
    overtime: '加班',
    monthly_leave: '休假',
    leave: '请假'
  }
  attendanceDialogTitle.value = `新增${typeLabels[type]}记录`
  attendanceForm.value = {
    record_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
    record_type: type,
    leave_type: type === 'leave' ? '事假' : '',
    leave_days: type === 'leave' ? 1 : 0,
    overtime_hours: type === 'overtime' ? 2 : 0,
    monthly_leave_days: type === 'monthly_leave' ? 1 : 0,
    reason: '',
    status: 'approved'
  }
  attendanceFormVisible.value = true
}

// 保存考勤记录（支持新增和编辑）
const handleSaveAttendance = async () => {
  if (!requireSalaryRecordPermission(editingAttendanceId.value ? 'edit' : 'create')) {
    return
  }

  if (!currentAttendanceEmployee.value) return

  // 验证必填字段
  if (!attendanceForm.value.record_date) {
    ElMessage.warning('请选择记录日期')
    return
  }

  attendanceSaving.value = true
  try {
    const recordType = attendanceForm.value.record_type || 'leave'
    const recordDate = attendanceForm.value.record_date || TimeUtil.nowFormatted(TIME_FORMATS.DATE)
    const recordStatus = attendanceForm.value.status || 'approved'

    // 根据记录类型构建提交数据
    const submitData: any = {
      employee_id: currentAttendanceEmployee.value.id,
      record_type: recordType,
      record_date: recordDate,
      status: recordStatus
    }

    switch (recordType) {
    case 'monthly_leave':
      submitData.monthly_leave_days = attendanceForm.value.monthly_leave_days
      if (!submitData.monthly_leave_days || submitData.monthly_leave_days <= 0) {
        ElMessage.warning('请输入休假天数')
        return
      }
      break
    case 'leave':
      submitData.leave_type = attendanceForm.value.leave_type || '事假'
      submitData.leave_days = attendanceForm.value.leave_days
      if (attendanceForm.value.reason.trim()) {
        submitData.leave_reason = attendanceForm.value.reason.trim()
      }
      if (!submitData.leave_type) {
        ElMessage.warning('请选择请假类型')
        return
      }
      if (!submitData.leave_days || submitData.leave_days <= 0) {
        ElMessage.warning('请输入请假天数')
        return
      }
      break
    case 'overtime':
      submitData.overtime_hours = attendanceForm.value.overtime_hours
      if (attendanceForm.value.reason.trim()) {
        submitData.overtime_reason = attendanceForm.value.reason.trim()
      }
      if (!submitData.overtime_hours || submitData.overtime_hours <= 0) {
        ElMessage.warning('请输入加班时长')
        return
      }
      break
    }

    // 根据是否有编辑ID判断是新增还是编辑
    const isEdit = !!editingAttendanceId.value

    if (isEdit) {
      // 编辑模式：调用更新API
      await attendanceApi.updateAttendanceRecord(editingAttendanceId.value, submitData)
    } else {
      // 新增模式：调用创建API
      await attendanceApi.createAttendanceRecord(submitData)
    }

    const typeLabels: Record<string, string> = {
      monthly_leave: '休假',
      leave: '请假',
      overtime: '加班'
    }
    ElMessage.success(`${typeLabels[attendanceForm.value.record_type]}记录${isEdit ? '修改' : '添加'}成功`)

    // 关闭对话框并清除编辑ID
    attendanceFormVisible.value = false
    editingAttendanceId.value = null

    // 重新加载考勤记录
    await loadEmployeeAttendance(currentAttendanceEmployee.value.id)

    // 同时刷新考勤统计数据
    await loadAllEmployeesAttendance(employeeSalaryMonth.value)

    // 刷新销售数据
    await loadAllEmployeesSales(employeeSalaryMonth.value)
  } catch {
    ElMessage.error(`${editingAttendanceId.value ? '修改' : '添加'}失败`)
  } finally {
    attendanceSaving.value = false
  }
}

// 删除考勤记录
const handleDeleteAttendance = async (id: number) => {
  if (!requireSalaryRecordPermission('delete')) {
    return
  }

  try {
    await ElMessageBox.confirm('确认删除此考勤记录？', '警告')
    await attendanceApi.deleteAttendanceRecord(id)
    ElMessage.success('删除成功')
    if (currentAttendanceEmployee.value) {
      loadEmployeeAttendance(currentAttendanceEmployee.value.id)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 模板操作
// 新增工资模板
const handleAddTemplate = () => {
  if (!requireSalaryTemplatePermission('create')) {
    return
  }

  templateForm.value = {
    id: undefined,
    name: '',
    description: '',
    base_salary: 2500,
    commission_type: 'fixed',
    commission_fixed: 20,
    commission_new_fixed: 20,
    commission_used_fixed: 0,
    commission_percentage: 10,
    overtime_hourly_rate: 10,
    rest_days: 2,
    // 自动涨薪规则
    auto_raise_enabled: false,
    auto_raise_months: 6,
    auto_raise_amount: 100,
    auto_raise_max_salary: 3000
  }
  templateFormDialogVisible.value = true
}

// 编辑工资模板
const handleEditTemplate = (row: any) => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  // 解析自动涨薪规则
  let autoRaiseEnabled = false
  let autoRaiseMonths = 6
  let autoRaiseAmount = 100
  let autoRaiseMaxSalary = 3000

  if (row.auto_raise_rule) {
    try {
      const rule = typeof row.auto_raise_rule === 'string'
        ? JSON.parse(row.auto_raise_rule)
        : row.auto_raise_rule
      autoRaiseEnabled = rule.enabled || false
      autoRaiseMonths = rule.months || 6
      autoRaiseAmount = rule.amount || 100
      autoRaiseMaxSalary = rule.max_salary || 3000
    } catch {
      // 忽略异常，使用默认值
    }
  }

  templateForm.value = {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    base_salary: row.base_salary || 0,
    commission_type: row.commission_type || 'fixed',
    commission_fixed: row.commission_fixed || 0,
    commission_new_fixed: row.commission_new_fixed || row.commission_fixed || 20,
    commission_used_fixed: row.commission_used_fixed || 0,
    commission_percentage: row.commission_percentage || 0,
    overtime_hourly_rate: row.overtime_hourly_rate || 0,
    rest_days: row.rest_days || 2,
    // 自动涨薪规则
    auto_raise_enabled: autoRaiseEnabled,
    auto_raise_months: autoRaiseMonths,
    auto_raise_amount: autoRaiseAmount,
    auto_raise_max_salary: autoRaiseMaxSalary
  }
  templateFormDialogVisible.value = true
}

// 保存工资模板
const handleSaveTemplate = async () => {
  if (!requireSalaryTemplatePermission(templateForm.value.id ? 'edit' : 'create')) {
    return
  }

  try {
    templateSaving.value = true

    // 构建保存数据
    const saveData: any = {}

    if (canUseSalaryField('salary_salarytemplatesview', 'template_name')) {
      saveData.name = templateForm.value.name
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_description')) {
      saveData.description = templateForm.value.description
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_base_salary')) {
      saveData.base_salary = templateForm.value.base_salary
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_commission_type')) {
      saveData.commission_type = templateForm.value.commission_type
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_commission_new_fixed')) {
      saveData.commission_new_fixed = templateForm.value.commission_new_fixed
      saveData.commission_fixed = templateForm.value.commission_new_fixed
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_commission_used_fixed')) {
      saveData.commission_used_fixed = templateForm.value.commission_used_fixed
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_commission_percentage')) {
      saveData.commission_percentage = templateForm.value.commission_percentage
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_overtime_hourly_rate')) {
      saveData.overtime_hourly_rate = templateForm.value.overtime_hourly_rate
    }
    if (canUseSalaryField('salary_salarytemplatesview', 'template_rest_days')) {
      saveData.rest_days = templateForm.value.rest_days || 2
    }

    // 构建自动涨薪规则
    if (canUseSalaryField('salary_salarytemplatesview', 'template_auto_raise_enabled')) {
      if (templateForm.value.auto_raise_enabled) {
        saveData.auto_raise_rule = JSON.stringify({
          enabled: true,
          months: canUseSalaryField('salary_salarytemplatesview', 'template_auto_raise_months') ? templateForm.value.auto_raise_months : 6,
          amount: canUseSalaryField('salary_salarytemplatesview', 'template_auto_raise_amount') ? templateForm.value.auto_raise_amount : 100,
          max_salary: canUseSalaryField('salary_salarytemplatesview', 'template_auto_raise_max_salary') ? templateForm.value.auto_raise_max_salary : templateForm.value.base_salary
        })
      } else {
        saveData.auto_raise_rule = null
      }
    }

    if (templateForm.value.id) {
      // 更新
      await salaryTemplateApi.updateTemplate(templateForm.value.id, saveData)
      ElMessage.success('模板更新成功')
    } else {
      // 新增
      await salaryTemplateApi.createTemplate(saveData)
      ElMessage.success('模板创建成功')
    }

    templateFormDialogVisible.value = false
    loadTemplates()
  } catch (err: any) {
    logger.error('保存模板失败:', err)
    ElMessage.error(err.message || '保存失败')
  } finally {
    templateSaving.value = false
  }
}

const handleSetDefault = async (row: any) => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认将 "${row.name}" 设为默认模板？`, '确认', {
      customClass: 'message-box-unified'
    })
    await salaryTemplateApi.setAsDefault(row.id)
    ElMessage.success('设置成功')
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('设置失败')
    }
  }
}

const handleToggleTemplateStatus = async (row: any) => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  try {
    const newStatus = !row.is_active
    const actionText = newStatus ? '启用' : '禁用'
    await ElMessageBox.confirm(`确认${actionText}模板 "${row.name}"？`, '确认', {
      customClass: 'message-box-unified'
    })
    await salaryTemplateApi.updateTemplate(row.id, { is_active: newStatus })
    ElMessage.success(`${actionText}成功`)
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败')
    }
  }
}

// 获取使用指定模板的员工数量
const getEmployeeCountByTemplate = (templateId: number): number => {
  if (!employees.value || employees.value.length === 0) return 0
  return employees.value.filter((emp: any) => emp.salary_template_id === templateId).length
}

const handleDeleteTemplate = async (row: any) => {
  if (!requireSalaryTemplatePermission('delete')) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除模板 "${row.name}"？`, '警告', {
      type: 'warning',
      customClass: 'message-box-unified'
    })
    await salaryTemplateApi.deleteTemplate(row.id)
    ElMessage.success('删除成功')
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 工资记录操作
const handleViewMyRecord = (row: any) => {
  if (!canViewPayoutRecords.value) {
    error('您没有查看工资发放记录的权限')
    return
  }

  currentRecord.value = row
  detailDialogVisible.value = true
}

// 删除的函数 - handleApproveRecord (已移除工资记录tab)

// 工资发放操作
const loadPayoutList = async () => {
  if (!canViewSalaryRecords.value) {
    payoutList.value = []
    return
  }

  if (!payoutMonth.value) {
    payoutList.value = []
    return
  }

  payoutLoading.value = true
  try {
    // 获取当月所有员工工资记录（不筛选状态，状态筛选由计算属性处理）
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.endOf(dayjs(`${year}-${month}-01`), 'month').date()
    const endDate = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`

    const response = await salaryApi.getSalaryRecords({
      period_start: startDate,
      period_end: endDate
    })

    if (response.data) {
      payoutList.value = response.data.records || []
    }
  } catch (error) {
    logger.error('加载工资发放列表失败:', error)
    ElMessage.error('加载工资发放列表失败')
  } finally {
    payoutLoading.value = false
  }
}

// TAB 切换
const handleTabChange = async (tabName: string) => {
  salaryTemplatesTabRef.value?.resetInteraction()
  salaryEmployeesTabRef.value?.resetInteraction()

  if (tabName === 'templates') {
    if (!canViewSalaryTemplates.value) return
    loadTemplates()
  } else if (tabName === 'employees') {
    if (!canViewSalaryRecords.value) return
    // 员工薪资：加载用户选择的月份的实时数据
    await loadEmployeeList(employeeSalaryMonth.value)
    await loadTemplates()
    // 根据选择的月份加载考勤和销售数据（实时数据）
    await loadAllEmployeesAttendance(employeeSalaryMonth.value)
    await loadAllEmployeesSales(employeeSalaryMonth.value)
  } else if (tabName === 'payout') {
    if (!canViewSalaryRecords.value) return
    // 工资发放：根据用户选择的月份加载数据
    await loadEmployeeList(payoutMonth.value)
    // 根据选择的月份加载考勤和销售数据
    await loadAllEmployeesAttendance(payoutMonth.value)
    await loadAllEmployeesSales(payoutMonth.value)
    // 加载工资记录
    loadPayoutList()
  } else if (tabName === 'my') {
    if (!canViewPayoutRecords.value) return
    await Promise.all([loadMyRecords(), loadMyStats()])
  }
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    if (activeTab.value === 'templates') {
      await loadTemplates()
    } else if (activeTab.value === 'employees') {
      await Promise.all([loadEmployeeList(employeeSalaryMonth.value), loadTemplates()])
    } else if (activeTab.value === 'payout') {
      await loadTemplates()
      if (payoutMonth.value) {
        await loadPayoutList()
      }
    } else if (activeTab.value === 'my') {
      await Promise.all([loadMyRecords(), loadMyStats()])
    }
  })
  success('数据刷新成功', { duration: 2000 })
}

onMounted(async () => {
  if (!canAccessSalaryPage.value) {
    return
  }

  await initFieldPermissions()
  syncVisibleSalaryFilters()

  if (canViewSalaryTemplates.value) {
    activeTab.value = 'templates'
    await loadTemplates()
    if (canViewSalaryRecords.value) {
      const currentMonth = payoutMonth.value || employeeSalaryMonth.value
      await loadEmployeeList(currentMonth)
    }
  } else if (canViewSalaryRecords.value) {
    activeTab.value = 'employees'
    const currentMonth = payoutMonth.value || employeeSalaryMonth.value
    await loadEmployeeList(currentMonth)
  } else if (canViewPayoutRecords.value) {
    activeTab.value = 'my'
    await Promise.all([loadMyRecords(), loadMyStats()])
  }
})

// 监听标签切换，自动刷新数据（确保显示最新的考勤、销售等数据）
// 注意：handleTabChange 已经处理了数据加载，这里只需要在用户手动切换标签时补充刷新
// 使用一个标志避免重复加载
const isLoadingData = ref(false)

watch(activeTab, async (newTab, oldTab) => {
  // 避免在页面加载时重复触发（oldTab 为空表示首次加载）
  if (!oldTab || isLoadingData.value) {
    return
  }

  if (newTab === 'employees') {
    if (!canViewSalaryRecords.value) return
    // 切换到员工薪资标签时，自动刷新考勤和销售数据
    isLoadingData.value = true
    try {
      await loadAllEmployeesAttendance(employeeSalaryMonth.value)
      await loadAllEmployeesSales(employeeSalaryMonth.value)
    } finally {
      isLoadingData.value = false
    }
  } else if (newTab === 'payout') {
    if (!canViewSalaryRecords.value) return
    // 切换到工资发放标签时，自动刷新考勤和销售数据
    isLoadingData.value = true
    try {
      await loadAllEmployeesAttendance(payoutMonth.value)
      await loadAllEmployeesSales(payoutMonth.value)
      loadPayoutList()
    } finally {
      isLoadingData.value = false
    }
  }
})
</script>

<style lang="scss" scoped>
:global(:root) {
  --salary-mobile-commission-color: #f07a2f;
  --salary-mobile-overtime-color: #2f7d76;
  --salary-mobile-deduction-color: #cf3732;
  --salary-mobile-net-color: #3568df;
}

/* 筛选区域 */
.filter-section {
  margin-bottom: 20px;
  padding: 20px;
  background: var(--tf-color-surface-muted);
  border-radius: 8px;
}

.filter-form {
  width: 100%;
}

.filter-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  align-items: center;
}

.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.filter-item label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-regular);
  white-space: nowrap;
}

.filter-item .el-select,
.filter-item .el-date-picker,
.filter-item .el-input {
  min-width: 140px;
}

.filter-item.actions {
  margin-left: auto;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}


/* 操作按钮容器 - 确保按钮在一行内并排显示 */
.operation-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;
}

.net-salary {
  color: var(--color-success);
  font-weight: 700;
  font-size: 16px;
}

.amount {
  color: var(--color-success);
  font-weight: 500;
}

.amount-deduct {
  color: var(--color-danger);
  font-weight: 500;
}

.income-detail,
.deduction-detail {
  font-size: 12px;
  line-height: 1.6;
}

.rate-info {
  font-size: 12px;
  line-height: 1.5;
}

.rate-label {
  color: var(--color-info);
  margin-right: 4px;
}

.period-text,
.work-days {
  color: var(--color-text-regular);
  font-size: 13px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  background: linear-gradient(135deg, var(--tf-color-surface-neutral) 0%, var(--tf-color-surface) 100%);
  border-radius: 12px;
  color: var(--color-info);
  margin-top: 20px;
}

.empty-state i {
  font-size: 72px;
  margin-bottom: 20px;
  opacity: 0.15;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.empty-state p {
  font-size: 16px;
  margin: 0;
  color: var(--color-text-regular);
  font-weight: 500;
}

/* 分页 */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

// 工资模块统一弹窗样式

:deep(.salary-dialog .el-dialog__body) {
  background: var(--color-bg-white) !important;
  color: var(--color-text-primary);
  padding: 24px;
}

:deep(.salary-dialog .el-dialog__footer) {
  background: var(--tf-color-neutral-25) !important;
  border-top: 1px solid var(--tf-color-gray-200);
  padding: 16px 24px;
  border-radius: 0 0 12px 12px;
}

:deep(.salary-dialog-large .el-dialog) {
  max-width: min(1180px, calc(100vw - 32px)) !important;
}

.employee-template-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-regular);
}

.form-value {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.template-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.template-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.template-detail {
  font-size: 12px;
  color: var(--color-info);
}

.template-preview {
  margin-top: 10px;
  padding: 16px;
  background: var(--tf-color-surface-muted);
  border-radius: 8px;
  border: 1px solid var(--tf-color-border-element);
}

.preview-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.preview-label {
  color: var(--color-text-regular);
}

.preview-value {
  color: var(--color-text-primary);
  font-weight: 500;
}

/* 员工信息单元格样式 */
.employee-info-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.employee-username {
  font-size: 12px;
  color: var(--color-info);
}

/* 员工信息单行显示 */
.employee-info-inline {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.commission-info {
  font-size: 12px;
  line-height: 1.5;
}

.commission-label,
.commission-value {
  display: inline-block;
}

.commission-label {
  color: var(--color-info);
  margin-right: 4px;
}

.commission-value {
  color: var(--color-text-primary);
  font-weight: 500;
}

.text-muted {
  color: var(--color-text-placeholder);
}

/* 员工信息样式 */
.employee-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.employee-name {
  font-weight: 500;
  color: var(--color-text-primary);
}

.template-name {
  font-size: 12px;
  color: var(--color-info);
}

.attendance-actions {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

/* 考勤单元格样式 */
.attendance-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.rest-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.amount-deduction {
  font-size: 11px;
  color: var(--color-danger);
  font-weight: 500;
}

.amount-overtime {
  font-size: 11px;
  color: var(--color-success);
  font-weight: 500;
}

/* 表单样式 */
.form-section {
  margin-bottom: 24px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  padding-bottom: 8px;
  border-bottom: 2px solid var(--tf-color-border-element);
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
  margin-bottom: 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--tf-color-gray-ant-600);
  font-size: 14px;
}

.required {
  color: var(--tf-color-red-ant);
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--tf-color-gray-ant-400);
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
  background: white;
}

.form-control:focus {
  outline: none;
  border-color: var(--tf-color-blue-ant-light);
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.form-control::placeholder {
  color: var(--tf-color-silver);
}

textarea.form-control {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

/* 单选框组样式 */
.radio-group {
  display: flex;
  gap: 24px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--tf-color-gray-ant-600);
}

.radio-label input[type="radio"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.radio-label input[type="radio"]:checked {
  accent-color: var(--tf-color-blue-ant);
}

/* 开关样式 */
.switch-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--tf-color-gray-300-solid);
  transition: 0.3s;
  border-radius: 22px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--tf-color-blue-ant);
}

input:checked + .slider:before {
  transform: translateX(22px);
}

/* 分隔线样式 */
.divider {
  margin: 24px 0;
  padding: 12px 0;
  border-top: 1px solid var(--tf-color-gray-200);
  text-align: left;
}

.divider span {
  color: var(--tf-color-gray-ant-500);
  font-size: 13px;
  font-weight: 500;
}

.divider i {
  margin-right: 6px;
}

/* 表单提示文字 */
.form-tip {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--tf-color-gray-ant-500);
  line-height: 1.5;
}

.tag-success {
  background: linear-gradient(135deg, var(--tf-color-salary-chart-green) 0%, var(--tf-color-salary-chart-lime) 100%);
  color: white;
  border: none;

  &::before {
    content: '✓';
    margin-right: 6px;
    font-size: 12px;
    font-weight: 700;
  }
}

/* 模板预览样式 */
.template-preview-box {
  background: var(--tf-color-indigo-surface);
  border: 1px solid var(--tf-color-blue-element-border);
  border-radius: 8px;
  padding: 16px;
  margin-top: 12px;
}

.template-preview-box h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--tf-color-blue-600);
}

.template-preview-box .preview-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.template-preview-box .preview-label {
  color: var(--tf-color-gray-ant-600);
  font-size: 14px;
}

.template-preview-box .preview-value {
  color: var(--tf-color-neutral-ant);
  font-weight: 500;
  font-size: 14px;
}

/* 考勤操作栏 */
.attendance-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--tf-color-gray-ant-500);
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}

/* 预计工资样式 */
.estimated-salary {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

/* 响应式 */
@media (max-width: 768px) {
  .salary-tabs .table-section > .section-header {
    display: none;
  }

  .salary-mobile-deduction {
    color: var(--salary-mobile-deduction-color);
    font-variant-numeric: tabular-nums;
  }

  .header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .stat-desc {
    margin-top: 4px;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .filter-row {
    flex-direction: column;
  }

  .filter-item {
    width: 100%;
  }

  .filter-item .el-select,
  .filter-item .el-date-picker {
    width: 100% !important;
  }

  .filter-item.actions {
    margin-left: 0;
  }

  .filter-item.actions .btn {
    flex: 1;
    justify-content: center;
  }
}

/* Element Plus 组件样式已移除 - 所有模态框已使用自定义样式 */

/* 销售明细样式 */
.sales-detail-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-info-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 16px;
  background: var(--tf-color-surface-muted);
  border-radius: 8px;
}

.detail-info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-info-item .label {
  font-size: 13px;
  color: var(--color-info);
}

.detail-info-item .value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.detail-info-item .value.highlight {
  color: var(--color-success);
}

.detail-info-item .value.highlight-blue {
  color: var(--color-primary);
}

.detail-info-item .value.highlight-green {
  color: var(--color-success);
}

.sales-table-wrapper {
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  overflow: hidden;
}

.sales-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.sales-table thead {
  background: var(--tf-color-neutral-25);
}

.sales-table th {
  padding: 12px 8px;
  text-align: center;
  font-weight: 600;
  color: var(--color-text-regular);
  border-bottom: 1px solid var(--color-border-light);
  white-space: nowrap;
}

.sales-table td {
  padding: 12px 8px;
  text-align: center;
  border-bottom: 1px solid var(--color-border-light);
  color: var(--color-text-regular);
}

.sales-table tbody tr:last-child td {
  border-bottom: none;
}

.sales-table tbody tr:hover {
  background: var(--tf-color-surface);
}

.sales-table .imei {
  color: var(--color-text-regular);
}

.sales-table .price {
  font-weight: 600;
  color: var(--color-text-primary);
}

.sales-table-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px;
  background: var(--tf-color-neutral-25);
  border-top: 1px solid var(--color-border-light);
  gap: 24px;
}

/* 工资详情表格样式 */
.salary-detail-table-section {
  margin: 20px 0;
}

.salary-detail-table-section > .section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 20px 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--tf-color-border-element);
}

.salary-detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  overflow: hidden;
}

.salary-detail-table tbody tr {
  border-bottom: 1px solid var(--color-border-light);
}

.salary-detail-table tbody tr:last-child {
  border-bottom: none;
}

.salary-detail-table tbody tr:hover {
  background: var(--tf-color-surface-muted);
}

.salary-detail-table td.label {
  padding: 12px 16px;
  font-weight: 500;
  color: var(--color-text-regular);
  background: var(--tf-color-neutral-25);
  width: 120px;
  border-right: 1px solid var(--color-border-light);
}

.salary-detail-table td.value {
  padding: 12px 16px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.salary-detail-table td.value.highlight {
  color: var(--color-success);
  font-weight: 600;
}

.salary-detail-table td.value.net-salary {
  color: var(--color-danger);
  font-weight: 600;
  font-size: 16px;
}

.sales-summary-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}

.sales-summary-item .label {
  color: var(--color-info);
}

.sales-summary-item .value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.sales-summary-item .value.highlight {
  color: var(--color-success);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-info);
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* ==================== 销售明细对话框样式（参考供应商打款页面） ==================== */

.sales-details {
  // 汇总信息区域
  .details-info {
    background: linear-gradient(135deg, var(--tf-color-surface) 0%, var(--tf-color-border-cool-alt) 100%);
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border: 1px solid var(--tf-color-border-element);

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: nowrap;

    .info-row {
      display: flex;
      flex-direction: row;
      align-items: baseline;
      gap: 6px;
      padding: 6px 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid var(--color-border-light);
      transition: all 0.3s ease;
      flex-shrink: 0;
      min-width: fit-content;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transform: translateY(-2px);
      }

      label {
        font-size: 12px;
        color: var(--color-info);
        font-weight: 500;
        white-space: nowrap;
      }

      span {
        font-size: 14px;
        color: var(--color-text-primary);
        font-weight: 600;
        white-space: nowrap;

        &.amount {
          color: var(--color-warning);
          font-family: 'Monaco', 'Consolas', monospace;
        }

        &.profit {
          color: var(--color-success);
          font-family: 'Monaco', 'Consolas', monospace;
        }

        &.highlight {
          color: var(--color-primary);
          font-size: 16px;
        }
      }
    }
  }

  // 工资详情区域
  .salary-info-section {
    margin-bottom: 24px;
    padding: 20px;
    background: var(--tf-color-surface-neutral);
    border-radius: 8px;
    border: 1px solid var(--tf-color-border-element);

    .section-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 16px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--tf-color-border-element);
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--tf-color-surface-ant);

      &:last-child {
        border-bottom: none;
      }

      label {
        font-size: 14px;
        color: var(--color-text-regular);
        font-weight: 500;
      }

      span {
        font-size: 16px;
        color: var(--color-text-primary);
        font-weight: 600;

        &.amount {
          color: var(--color-success);
          font-family: 'Monaco', 'Consolas', monospace;
        }

        &.net-salary {
          color: var(--color-warning);
          font-size: 18px;
          font-weight: 700;
        }

        &.deduction {
          color: var(--color-danger);
        }
      }
    }
  }

  // 销售明细表格区域
  .sales-details-table {
    .section-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0 0 16px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--tf-color-border-element);
    }

    // 价格单元格
    .price {
      font-family: 'Monaco', 'Consolas', monospace;
      font-weight: 600;
      color: var(--color-success);
    }

    // 时间单元格
    .time-cell {
      font-family: 'Monaco', 'Consolas', monospace;
      color: var(--color-text-regular);
    }

    // 提成显示样式
    .commission-display {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;
    }

    .commission-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .commission-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }

    .commission-label {
      color: var(--color-info);
      font-size: 12px;
    }

    .commission-value {
      color: var(--color-text-primary);
      font-weight: 600;
      font-size: 12px;
    }
  }
}

.sales-details.admin-page .salary-detail-table-wrap {
  width: min(100%, var(--salary-detail-table-width)) !important;
  max-width: 100% !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  touch-action: pan-x pan-y;
}

@media (hover: hover) and (pointer: fine) {
  .sales-details.admin-page .salary-detail-table-wrap {
    cursor: grab;
  }

  .sales-details.admin-page .salary-detail-table-wrap.is-dragging {
    cursor: grabbing;
    user-select: none;
  }
}

.sales-details.admin-page .salary-sales-detail-table {
  width: var(--salary-detail-table-width) !important;
  min-width: var(--salary-detail-table-width) !important;
  max-width: none !important;

  .imei-text,
  .price,
  .time-cell {
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
    font-variant-numeric: tabular-nums;
  }

  .imei-text {
    display: inline;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    color: var(--el-text-color-primary);
    font-weight: 600;
    white-space: nowrap;
  }

  .price,
  .profit-positive,
  .profit-negative {
    font-weight: 600;
  }

  .profit-positive {
    color: var(--el-color-success);
  }

  .profit-negative {
    color: var(--el-color-danger);
  }
}

.employee-action-buttons .employee-action-item {
  display: contents;
}

// ==================== 模态框响应式优化 ====================

@media (max-width: 767px) {
  // 表单响应式
  .form-row {
    flex-direction: column;
    gap: 12px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    font-size: 13px;
  }

  .form-control {
    padding: 8px 10px;
    font-size: 13px;
  }

  // 单选框组响应式
  .radio-group {
    gap: 16px;
  }

  .radio-label {
    font-size: 13px;
  }

  // 模板预览框响应式
  .template-preview-box {
    padding: 12px;
  }

  .preview-row {
    font-size: 13px;
    padding: 6px 0;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .form-row {
    gap: 12px;
  }

  .form-control {
    padding: 9px 11px;
  }
}

// ==================== 模态框增强样式 ====================

// 模板预览框样式
.template-preview-box {
  background: linear-gradient(135deg, var(--tf-color-surface-muted) 0%, var(--tf-color-border-muted) 100%);
  border-radius: 8px;
  padding: 16px;
  margin-top: 12px;
  border-left: 4px solid var(--tf-color-indigo-brand);

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--tf-color-gray-bootstrap-700);
    display: flex;
    align-items: center;
    gap: 6px;

    &::before {
      content: '\f05a';
      font-family: 'Font Awesome 6 Free';
      font-weight: 900;
      color: var(--tf-color-indigo-brand);
    }
  }

  .preview-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed var(--tf-color-border-subtle);
    font-size: 14px;

    &:last-child {
      border-bottom: none;
    }

    .preview-label {
      color: var(--tf-color-muted);
      font-weight: 500;
    }

    .preview-value {
      color: var(--tf-color-gray-bootstrap-900);
      font-weight: 600;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    }
  }
}

// 表单提示文字
.form-tip {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--tf-color-gray-ant-500);
  line-height: 1.4;
}

</style>
<style>
.salary-dialog,
.salary-dialog-large {
  --dialog-max-width: 760px;
}

@media (max-width: 767px) {
  .salary-dialog,
  .salary-dialog-large {
    --dialog-side-gap: 6px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 12px);
    --mobile-dialog-body-padding: 10px 8px 8px;
    --mobile-dialog-footer-padding: 0 8px 8px;
  }

  .mobile-dialog-sheet-overlay.salary-dialog,
  .mobile-dialog-sheet-overlay.salary-dialog-large {
    padding: 12px 6px !important;
  }

  .sales-details .details-info,
  .sales-details .salary-info-section {
    padding: 12px 10px;
    border-radius: 14px;
  }

  .sales-details .details-info {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .sales-details .details-info .info-row,
  .sales-details .salary-info-section .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-width: 0;
    padding: 8px 10px;
  }

  .sales-details .details-info .info-row label,
  .sales-details .salary-info-section .info-row label,
  .sales-details .details-info .info-row span,
  .sales-details .salary-info-section .info-row span {
    white-space: normal;
    word-break: break-word;
  }

  .attendance-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .attendance-actions :deep(.el-button) {
    width: 100%;
    margin: 0;
  }

  .employee-template-form,
  .template-preview-box {
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .salary-dialog,
  .salary-dialog-large {
    --dialog-side-gap: 4px;
    --dialog-vertical-gap: 12px;
    --dialog-max-width: calc(100vw - 8px);
    --mobile-dialog-body-padding: 8px 6px 6px;
    --mobile-dialog-footer-padding: 0 6px 6px;
  }

  .mobile-dialog-sheet-overlay.salary-dialog,
  .mobile-dialog-sheet-overlay.salary-dialog-large {
    padding: 12px 4px !important;
  }

}
</style>
