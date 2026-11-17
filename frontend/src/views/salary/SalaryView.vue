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
          :can-edit-salary-records="canEditSalaryRecord"
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
              :can-edit-field="canUseSalaryField"
              :can-view-field="canViewSalaryField"
              :filtered-templates="filteredTemplates"
              :get-employee-count="getEmployeeCountByTemplate"
              :is-mobile="isMobile"
              :loading="templatesLoading || refreshing"
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
              :can-view-attendance="canViewEmployeeAttendance"
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
              :loading="employeesLoading || refreshing"
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
              :calculate-leave="calculateLeaveDeduction"
              :calculate-overtime="calculateOvertimePay"
              :calculate-work-days="calculateWorkDays"
              :can-create="canCreateSalaryRecord"
              :can-pay="canPaySalaryRecord"
              :can-approve="canApproveSalaryRecord"
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
              :loading="payoutLoading || refreshing"
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
              @approve="handleApprovePayout"
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
              :loading="myLoading || refreshing"
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
        >
          <template
            v-if="currentRecord && canViewPayoutRecords && canViewSalaryField('salary_mysalaryview', 'sales_count') && getSalesCount(currentRecord) > 0"
            #actions
          >
            <el-button
              type="primary"
              @click.stop="openCurrentSalarySales"
            >
              <i class="fas fa-list" />销售明细
            </el-button>
          </template>
        </SalaryDetailDialog>

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
          :goods-commission="editPayoutSource?.goods_commission"
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
          :goods-commission="pendingSalaryData?.calculatedData.goods_commission"
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
          :can-create="attendancePermissions.canCreate.value"
          :can-delete="attendancePermissions.canDelete.value"
          :can-edit="attendancePermissions.canEdit.value"
          :can-view-field="canViewSalaryField"
          :employee="currentAttendanceEmployee"
          :get-attendance-type-tag="getAttendanceTypeTag"
          :get-attendance-type-text="getAttendanceTypeText"
          :loading="attendanceLoading"
          :records="attendanceRecords"
          @add="handleAddAttendance"
          @delete="handleDeleteAttendance"
          @edit="handleEditAttendance"
        />

        <SalaryAttendanceFormDialog
          v-model="attendanceFormVisible"
          :can-edit-field="canEditAttendanceField"
          :can-view-field="canViewSalaryField"
          :has-salary-template="Boolean(currentAttendanceEmployee?.salary_template_id)"
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
import { usePageShortcuts } from '@/composables/useRouteDialog'
import { confirmAction } from '@/utils/message-box'
import { ref, computed, onMounted, watch } from 'vue'
import { ElConfigProvider, type TabPaneName } from 'element-plus'
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
import { createSalaryTemplateForm, salaryGoodsRulePayload } from './salary-template-form'
import SalaryMyRecordsTab from './page/SalaryMyRecordsTab.vue'
import SalaryEmployeesTab from './page/SalaryEmployeesTab.vue'
import SalaryPayoutTab from './page/SalaryPayoutTab.vue'
import SalaryStatsCards from './page/SalaryStatsCards.vue'
import SalaryTemplatesTab from './page/SalaryTemplatesTab.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import {
  buildAttendanceLeaveAllocation,
  createAttendanceBatchId,
  groupAttendanceLeaveAssignments
} from '@/utils/attendance-leave-allocation'
import { logger } from '@/utils/logger'
import { getRequestErrorMessage, getRequestErrorStatus } from '@/utils/api-response'
import type { QueryParams } from '@/types'
import type {
  SalaryEmployeeOption,
  SalaryPayoutRecord,
  SalaryRecord,
  SalaryRecordInput,
  SalaryCalculation,
  SalaryRecordStatus,
  SalarySalesDetail,
  SalaryTemplate
} from '@/types/salary'
import { getActionColumnMinWidth, getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { getSalaryFieldKey } from './salary-field-permissions'
import { isPaidSalaryRecord, salaryCalculationInput, salaryPhoneCommission } from './salary-record-state'
import { useLatestRequest } from '@/composables/useLatestRequest'
import {
  buildEmployeeAttendanceStats,
  buildEmployeeSalesStats,
  buildEmptyEmployeeSalesStats,
  getSalaryMonthRange,
  mergeEmployeeSalaryDetails,
  type SalaryEmployeeAttendanceStats,
  type SalaryEmployeeDataItem,
  type SalaryEmployeeSalaryDetail,
  type SalaryEmployeeSalesSource,
  type SalaryEmployeeSalesStats
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
const globalNotifications = useNotification()


// 配置中文语言环境
const locale = zhCn

// 使用统一的 composable
const authStore = useAuthStore()
const { success, error } = useNotification()
const salaryPagePermissions = usePagePermissions('salary')
const salaryTemplatePermissions = usePagePermissions('salary-templates')
const salaryRecordPermissions = usePagePermissions('salary-records')
const mySalaryPermissions = usePagePermissions('my-salary')
const attendancePermissions = usePagePermissions('attendance')
const myAttendancePermissions = usePagePermissions('my-attendance')
const canViewEmployeeAttendance = (id: number) => attendancePermissions.canView.value || (myAttendancePermissions.canView.value && Number(authStore.user?.id) === id)
const requireAttendancePermission = (action: 'view' | 'create' | 'edit' | 'delete') => {
  const employeeId = currentAttendanceEmployee.value?.id
  const allowed = action === 'view'
    ? Boolean(employeeId && canViewEmployeeAttendance(employeeId))
    : attendancePermissions.hasPermission(action) && Boolean(employeeId && canViewEmployeeAttendance(employeeId))
  if (!allowed) attendancePermissions.handleNoPermission(action)
  return allowed
}
const canViewSalaryPage = computed(() => salaryPagePermissions.canView.value)
const canViewSalaryTemplates = computed(() => salaryTemplatePermissions.canView.value)
const canCreateSalaryTemplate = computed(() => salaryTemplatePermissions.canCreate.value)
const canEditSalaryTemplate = computed(() => salaryTemplatePermissions.canEdit.value)
const canDeleteSalaryTemplate = computed(() => salaryTemplatePermissions.canDelete.value)
const canViewSalaryRecords = computed(() => salaryRecordPermissions.canView.value)
const canCreateSalaryRecord = computed(() => salaryRecordPermissions.canCreate.value)
const canEditSalaryRecord = computed(() => salaryRecordPermissions.canEdit.value)
const canDeleteSalaryRecord = computed(() => salaryRecordPermissions.canDelete.value)
const canPaySalaryRecord = computed(() => salaryRecordPermissions.hasPermission('pay'))
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

const requireSalaryRecordPermission = (action: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'pay') => {
  const allowed = action === 'view'
    ? canViewSalaryRecords.value
    : action === 'create'
      ? canCreateSalaryRecord.value
      : action === 'edit'
        ? canEditSalaryRecord.value
        : action === 'delete'
          ? canDeleteSalaryRecord.value
          : action === 'pay' ? canPaySalaryRecord.value : canApproveSalaryRecord.value

  if (!allowed) {
    salaryRecordPermissions.handleNoPermission(action)
  }

  return allowed
}

type SalaryEmployeeRow = SalaryEmployeeOption & {
  current_salary?: number | string | null
  base_salary?: number | string | null
  salary_adjustment?: number | string | null
  salary_note?: string | null
}

type PendingSalaryData = {
  employeeId: number
  employeeName: string
  calculatedData: SalaryCalculation
  existingRecord: SalaryPayoutRecord | undefined
  startDate: string
  endDate: string
}

type SalaryEmployeeSalesDetail = Omit<SalarySalesDetail, 'is_new' | 'profit'> & {
  is_new?: boolean
  profit: number
}

const normalizeSalaryStatus = (value: string | null | undefined): SalaryRecordStatus => {
  const allowed: SalaryRecordStatus[] = ['draft', 'pending', 'approved', 'paid', 'cancelled']
  return value && allowed.includes(value as SalaryRecordStatus) ? value as SalaryRecordStatus : 'approved'
}

const canViewOwnSalarySalesDetail = (row: { employee_id?: number | null }) => (
  canViewOwnSalary.value &&
  Number(row?.employee_id) === Number(authStore.user?.id)
)

const canUseSalaryField = (moduleKey: string, fieldName: string) => {
  return canViewSalaryField(moduleKey, fieldName) && canEditSalaryField(moduleKey, fieldName)
}

const canEditAttendanceField = (moduleKey: string, fieldName: string) => {
  if (fieldName === 'attendance_status') return attendancePermissions.canApprove.value
  return canViewSalaryField(moduleKey, fieldName) && (editingAttendanceId.value
    ? attendancePermissions.canEdit.value : attendancePermissions.canCreate.value)
}

const canViewSalaryField = (moduleKey: string, fieldName: string) => {
  return fieldPermissions.isFieldVisible(moduleKey, getSalaryFieldKey(fieldName))
}
const canEditSalaryField = (moduleKey: string, fieldName: string) => {
  if (!canViewSalaryField(moduleKey, fieldName)) {
    return false
  }

  if (!fieldPermissions.isFieldEditable(moduleKey, getSalaryFieldKey(fieldName), { allowUnconfigured: true })) return false

  if (moduleKey === 'salary_salaryrecordsview') {
    if (fieldName === 'salary_status') return canApproveSalaryRecord.value
    if (fieldName === 'payment_method') return canPaySalaryRecord.value || canCreateSalaryRecord.value || canEditSalaryRecord.value
    return canCreateSalaryRecord.value || canEditSalaryRecord.value
  }
  if (moduleKey === 'salary_salarytemplatesview') return canCreateSalaryTemplate.value || canEditSalaryTemplate.value
  return false
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
const shortcutPageReady = ref(false)

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

const getMonthDateRange = (date?: string | Date | number | null) => {
  const parsedDate = date ? TimeUtil.parse(String(date)) : null
  const d = parsedDate?.isValid() ? parsedDate : TimeUtil.now()
  const year = d.year()
  const month = d.month() + 1
  const lastDay = TimeUtil.endOf(d, 'month').date()

  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }
}

// 模板数据
const templates = ref<SalaryTemplate[]>([])
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
  const hasPayoutRecord = paginatedPayoutData.value.some(item => Boolean(item.payoutRecord))
  const buttonCount = Number(canCreateSalaryRecord.value) + (hasPayoutRecord
    ? Number(canEditSalaryRecord.value) + Number(canDeleteSalaryRecord.value) + Number(canPaySalaryRecord.value) + Number(canApproveSalaryRecord.value)
    : 0)
  return getActionColumnMinWidth(buttonCount)
})

// 监听筛选条件变化，自动重新加载数据
watch(() => templateFilters.is_active, () => {
  loadTemplates()
})

// 我的工资数据
const myRecords = ref<SalaryRecord[]>([])
const myLoading = ref(false)

// 工资发放数据
const employees = ref<SalaryEmployeeRow[]>([])
const payoutList = ref<SalaryPayoutRecord[]>([])
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
const editPayoutSource = ref<SalaryCalculation | null>(null)
const editPayoutForm = ref<SalaryEditPayoutForm>({
  id: 0,
  employee_id: 0,
  salary_template_id: null,
  base_salary: 0,
  commission_amount: 0,
  overtime_pay: 0,
  leave_deduction: 0,
  status: 'approved'
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
  const source = editPayoutSource.value
  if (!source) return '0'
  const form = editPayoutForm.value
  return formatAmount(Number(source.net_salary || 0) + form.base_salary - Number(source.base_salary || 0) +
    form.commission_amount - salaryPhoneCommission(source) + form.overtime_pay - Number(source.overtime_pay || 0) -
    form.leave_deduction + Number(source.leave_deduction || 0))
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
} = useSalaryEmployeeTable({ employees, initialMonth: getCurrentMonth() })
const salaryEmployeesTabRef = ref<InstanceType<typeof SalaryEmployeesTab>>()
const employeeSalaryActionColumnWidth = computed(() => getActionColumnMinWidth(
  Number(canEditSalaryTemplate.value) + Number(canViewSalaryRecords.value) + 1
))
const employeeAttendanceData = ref<Map<number, SalaryEmployeeAttendanceStats>>(new Map())
const employeeSalesData = ref<Map<number, SalaryEmployeeSalesStats>>(new Map()) // 员工销售数据

watch([templateSearch, () => templateFilters.is_active], () => {
  templatePage.value = 1
})

// 详情对话框
const detailDialogVisible = ref(false)
const currentRecord = ref<SalaryRecord | null>(null)

// 销售明细对话框
const salesDetailDialogVisible = ref(false)
const currentSalesRecord = ref<SalaryRecord | null>(null)
const salesDetailList = ref<SalarySalesDetail[]>([])
const salesDetailImeiColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['IMEI', ...salesDetailList.value.map(item => item.imei)],
  { minWidth: 146, horizontalPadding: 30 }
))
const salesDetailModelColumnWidth = computed(() => getTextColumnMinWidth(
  ['型号', ...salesDetailList.value.map(item => item.model_name)],
  { minWidth: 104, horizontalPadding: 28 }
))
const salesDetailCustomerColumnWidth = computed(() => getTextColumnMinWidth(
  ['客户', ...salesDetailList.value.map(item => item.customer_name)],
  { minWidth: 92, horizontalPadding: 28 }
))
const employeeSalesDetailImeiColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['IMEI', ...employeeSalesDetailList.value.map(item => item.imei)],
  { minWidth: 146, horizontalPadding: 30 }
))
const employeeSalesDetailModelColumnWidth = computed(() => getTextColumnMinWidth(
  ['型号', ...employeeSalesDetailList.value.map(item => item.model)],
  { minWidth: 104, horizontalPadding: 28 }
))
const employeeSalesDetailCustomerColumnWidth = computed(() => getTextColumnMinWidth(
  ['客户', ...employeeSalesDetailList.value.map(item => item.customer_name)],
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
const handleViewSalesDetail = async (row: SalaryRecord) => {
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
        const parsedDetails: unknown = JSON.parse(row.commission_detail)
        if (Array.isArray(parsedDetails) && parsedDetails.length > 0) {
          // 获取员工工资模板，确定哪些机型需要显示
          const template = getTemplateById(row.salary_template_id)
          const newRate = template?.commission_new_fixed || template?.commission_fixed || 0
          const usedRate = template?.commission_used_fixed || 0

          // 只保留有提成的机型
          const details = parsedDetails.filter((item): item is SalarySalesDetail => {
            if (!item || typeof item !== 'object') return false
            const detail = item as SalarySalesDetail
            // 如果数据中有 is_new 字段
            if (detail.is_new !== undefined) {
              const isNew = detail.is_new === 1 || detail.is_new === '1' || detail.is_new === true
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
        salesDetailList.value = response.data as SalarySalesDetail[]
      }
    }
  } catch (error) {
    logger.error('加载销售明细失败:', error)
    globalNotifications.error('加载销售明细失败')
  } finally {
    salesDetailLoading.value = false
  }
}

// 员工销售明细对话框
const employeeSalesDetailDialogVisible = ref(false)
const currentEmployeeSales = ref<SalaryEmployeeRow | null>(null)
const employeeSalesDetailList = ref<SalaryEmployeeSalesDetail[]>([])
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
const handleViewEmployeeSalesDetail = async (row: SalaryEmployeeRow) => {
  if (!requireSalaryRecordPermission('view')) {
    return
  }

  const stats = getEmployeeSalesStats(row.id)
  if (stats.sales_count === 0) {
    globalNotifications.info('该员工暂无销售记录')
    return
  }

  currentEmployeeSales.value = row
  employeeSalesDetailDialogVisible.value = true
  employeeSalesDetailLoading.value = true

  try {
    // 根据当前选择的月份计算时间范围
    const monthStr = employeeSalaryMonth.value
    if (!monthStr) {
      globalNotifications.warning('请先选择月份')
      employeeSalesDetailLoading.value = false
      return
    }

    const [year, month] = monthStr.split('-')
    const startDate = `${year}-${month}-01`
    // 计算该月的最后一天
    const daysInMonth = TimeUtil.daysInMonth(Number(year), Number(month))
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
      const filteredData = detailData.filter((item): item is SalarySalesDetail => {
        if (!item || typeof item !== 'object') return false
        const detail = item as SalarySalesDetail
        // 只显示有提成的机型
        const isNew = detail.is_new === true || detail.is_new === 1 || detail.is_new === '1'
        if (isNew && newRate > 0) return true  // 全新机有提成
        if (!isNew && usedRate > 0) return true  // 二手机有提成
        return false  // 没有提成的机型不显示
      })

      employeeSalesDetailList.value = filteredData.map(item => {
        // 新API返回的是扁平化结构，直接使用item的字段
        const purchaseCost = Number(item.purchase_cost || 0)
        const salePrice = Number(item.sale_price || 0)
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
          profit: Number(item.profit) || (salePrice - purchaseCost),
          sale_time: item.sale_time,
          customer_name: item.customer_name || '-',
          customer_phone: item.customer_phone || '-'
        }
      })
    }
  } catch (error) {
    logger.error('加载员工销售明细失败:', error)
    globalNotifications.error('加载员工销售明细失败')
    employeeSalesDetailList.value = []
  } finally {
    employeeSalesDetailLoading.value = false
  }
}

// 员工模板编辑对话框
const templateDialogVisible = ref(false)
const currentEmployee = ref<SalaryEmployeeRow | null>(null)
const selectedTemplateId = ref<number | undefined>(undefined)

// 工资模板表单
const templateFormDialogVisible = ref(false)
const templateSaving = ref(false)
const templateForm = ref<SalaryTemplateForm>(createSalaryTemplateForm())

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
  } catch (error: unknown) {
    templates.value = []
    if (getRequestErrorStatus(error) === 403) {
      globalNotifications.warning('当前账号没有工资模板查看权限')
      return
    }
    globalNotifications.error('加载模板失败')
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
    const params: QueryParams = {
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
      const daysInMonth = TimeUtil.daysInMonth(Number(endYear), Number(endMonth))
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
    globalNotifications.error('加载工资记录失败')
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
      canViewTeamSalaryRecords.value ? unifiedApi.get('/employees/salary-list') : Promise.resolve(null),
      canViewTeamSalaryRecords.value ? unifiedApi.get('/employees/current-salary', { params: { date: currentMonthKey } }) : Promise.resolve(null),
      canViewEmployeeAttendance(userId) ? attendanceApi.getAttendanceRecords({
        start_date: startDate,
        end_date: endDate,
        status: 'approved',
        page_size: 100
      }) : Promise.resolve(null),
      canViewEmployeeAttendance(userId) ? attendanceApi.getLeaveBalance() : Promise.resolve(null),
      salaryApi.records.getEmployeeSalesDetails(userId, startDate, endDate)
    ])

    const employeesData = employeeListResult.status === 'fulfilled'
      ? (employeeListResult.value?.data?.employees || [])
      : []
    const currentSalaryData = currentSalaryResult.status === 'fulfilled'
      ? (currentSalaryResult.value?.data?.employees || [])
      : []

    const myEmployee = employeesData.find((employee: SalaryEmployeeRow) => Number(employee.id) === userId)
    const mySalaryInfo = currentSalaryData.find((employee: SalaryEmployeeRow) => Number(employee.id) === userId)
    const myTemplate = mySalaryInfo || templates.value.find(template => Number(template.id) === Number(myEmployee?.salary_template_id))

    if (attendanceResult.status === 'fulfilled' && attendanceResult.value) {
      const attendanceRecords = attendanceResult.value.data?.records || []
      let myLeaveDays = 0
      let myOvertimeHours = 0
      let myRestDays = 0

      attendanceRecords.forEach((record: AttendanceRecord) => {
        if (Number(record.employee_id) !== userId) {
          return
        }

        if (record.record_type === 'leave') {
          myLeaveDays += Number(record.leave_days || 0)
        } else if (record.record_type === 'overtime') {
          myOvertimeHours += Number(record.overtime_hours || 0)
        } else if (record.record_type === 'monthly_leave') {
          myRestDays += Number(record.monthly_leave_days || 0)
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

    if (leaveBalanceResult.status === 'fulfilled' && leaveBalanceResult.value) {
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

    const baseSalary = Number(mySalaryInfo?.current_salary || mySalaryInfo?.base_salary || 0) || 0
    const daysInMonth = TimeUtil.daysInMonth(currentYear, currentMonth)
    const dailySalary = daysInMonth > 0 ? baseSalary / daysInMonth : 0
    const leaveDeduction = dailySalary * (stats.value.myLeaveDays || 0)
    const overtimeRate = Number(myTemplate?.overtime_hourly_rate || 0) || 0
    const overtimePay = (stats.value.myOvertimeHours || 0) * overtimeRate

    let commissionAmount = 0
    if (myTemplate) {
      if (myTemplate.commission_type === 'fixed') {
        const newRate = Number(myTemplate.commission_new_fixed || myTemplate.commission_fixed || 0) || 0
        const usedRate = Number(myTemplate.commission_used_fixed || 0) || 0

        salesDetails.forEach((item: SalarySalesDetail) => {
          const isNew = item.is_new === true || item.is_new === 1 || item.is_new === '1'
          if (isNew) {
            commissionAmount += newRate
          } else if (usedRate > 0) {
            commissionAmount += usedRate
          }
        })
      } else {
        const percentage = Number(myTemplate.commission_percentage || 0) || 0
        const totalProfit = salesDetails.reduce((sum: number, item: SalarySalesDetail) => {
          const salePrice = Number(item.sale_price || 0) || 0
          const purchaseCost = Number(item.purchase_cost || 0) || 0
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
  if (!currentUserId) {
    resetMyStats()
    return
  }
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
    employees.value.forEach(employee => {
      // 只统计有工资模板的员工
      if (!employee.salary_template_id) return

      const empId = employee.id
      const attendanceData = employeeAttendanceData.value.get(empId)
      const salesData = employeeSalesData.value.get(empId)
      const employeeName = employee.name || employee.username || '未命名员工'

      // 计算该员工的待发工资：底薪 + 提成 + 加班费 - 请假扣除
      const baseSalary = Number(employee.current_salary || employee.base_salary || 0)
      const overtimePay = Number(salesData?.overtime_pay || 0)
      const commission = Number(salesData?.commission_amount || 0)

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
    const employee = employees.value.find(e => e.id === currentUserId)

    if (employee) {
      // 计算自己的待发工资：底薪 + 提成 + 加班费 - 请假扣除
      const baseSalary = Number(employee.current_salary || employee.base_salary || 0)
      const overtimePay = Number(mySalesData?.overtime_pay || 0)
      const commission = Number(mySalesData?.commission_amount || 0)

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
    globalNotifications.error('加载员工列表失败')
  } finally {
    employeesLoading.value = false
  }
}

// 加载所有员工的当月考勤统计
// monthParam 格式: "2025-01"，如果为空则使用当前月份
// 休假逻辑：每月休假天数从薪资模板读取，上个月没用完可以累积到本月
const loadAllEmployeesAttendance = async (monthParam?: string) => {
  if (!canViewSalaryRecords.value || !attendancePermissions.canView.value) {
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
  const daysInMonth = TimeUtil.daysInMonth(year, month)

  // 使用员工当前底薪（包含工龄涨薪）计算日薪
  const baseSalary = Number(getEmployeeBaseSalary(employeeId)) || 0
  if (!baseSalary) return 0

  const dailySalary = baseSalary / daysInMonth

  // 请假扣款 = 日薪 × 请假天数
  return formatAmount(dailySalary * leaveDays)
}

// 计算加班费
const calculateOvertimePay = (employeeId: number, overtimeHours: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  if (!template || !overtimeHours) return 0
  const overtimeRate = template.overtime_hourly_rate || 0
  return formatAmount(overtimeHours * overtimeRate)
}

// 计算预计实发工资
const calculateEstimatedSalary = (employeeId: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  if (!template) return '-'

  const stats = getEmployeeAttendanceStats(employeeId)
  // 使用当前底薪（包含工龄涨薪）而不是模板的原始底薪
  const baseSalary = Number(getEmployeeBaseSalary(employeeId)) || 0
  const overtimePay = parseFloat(String(calculateOvertimePay(employeeId, stats.overtime_hours))) || 0
  const leaveDeduction = parseFloat(String(calculateLeaveDeduction(employeeId, stats.leave_days))) || 0
  // 超出的休假天数已在 loadAllEmployeesAttendance 中转为请假天数，这里不再扣款
  const salesCommission = parseFloat(calculateSalesCommission(employeeId)) || 0

  const estimated = baseSalary + overtimePay + salesCommission - leaveDeduction

  // 检查是否为有效数字
  if (isNaN(estimated)) {
    return '-'
  }

  return formatAmount(estimated)
}

// 获取员工模板ID
const getEmployeeTemplateId = (employeeId: number): number | undefined => {
  const employee = employees.value.find(e => e.id === employeeId)
  return employee?.salary_template_id ?? undefined
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
const getEmployeeSalesStats = (employeeId: number): SalaryEmployeeSalesStats => {
  return employeeSalesData.value.get(employeeId) || {
    sales_count: 0,
    sales_amount: 0,
    total_profit: 0,
    new_count: 0,
    new_amount: 0,
    new_profit: 0,
    used_count: 0,
    used_amount: 0,
    used_profit: 0,
    commission_amount: 0,
    overtime_hours: 0,
    overtime_pay: 0
  }
}

// 计算工作天数（当月天数 - 请假天数）
// 注意：休假（monthly_leave）不影响工作天数计算
const calculateWorkDays = (employeeId: number) => {
  // 根据当前标签页获取选择的月份
  const monthStr = activeTab.value === 'payout' ? payoutMonth.value : employeeSalaryMonth.value
  const [year, month] = monthStr.split('-').map(Number)
  const daysInMonth = TimeUtil.daysInMonth(year, month)

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

  return formatAmount(commission)
}

// 获取员工有提成的机型数量（用于显示）
const getEmployeeCommissionCount = (employeeId: number) => {
  const template = getTemplateById(getEmployeeTemplateId(employeeId))
  const salesStats = getEmployeeSalesStats(employeeId)

  if (!template) return 0

  const commissionType = template.commission_type || 'fixed'
  let count = 0

  if (commissionType === 'fixed') {
    const newRate = Number(template.commission_new_fixed || template.commission_fixed || 0)
    const usedRate = Number(template.commission_used_fixed || 0)

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
}

// 员工薪资页面：刷新数据
const handleRefreshEmployeeData = async () => {
  if (!canViewSalaryRecords.value) return

  await loadEmployeeList(employeeSalaryMonth.value)
}

// 获取模板相关信息的辅助方法
const getTemplateById = (id: number | null | undefined): SalaryTemplate | undefined => {
  if (!id) return undefined
  return templates.value.find(t => t.id === id)
}

const getTemplateName = (id: number | undefined) => {
  const template = getTemplateById(id)
  return template?.name || '-'
}

// 获取员工底薪（使用实时计算的当前底薪，包含工龄涨薪）
const getEmployeeBaseSalary = (employeeId: number) => {
  const employee = employees.value.find(e => e.id === employeeId)
  return employee?.current_salary || employee?.base_salary || '0'
}

// 获取员工工资记录
const getEmployeePayoutRecord = (employeeId: number) => {
  return payoutList.value.find(r => r.employee_id === employeeId)
}

const requireUnpaidPayout = (record: SalaryPayoutRecord | undefined) => {
  if (!isPaidSalaryRecord(record)) return true
  globalNotifications.warning('已发工资保留原记录，后续差额须另行关联调整')
  return false
}

const parseTimestamp = (value: unknown) => {
  if (!value) return null
  const parsed = TimeUtil.parse(String(value))
  return parsed?.isValid() ? parsed.valueOf() : null
}

const getPayoutSettledTimestamp = (record: SalaryPayoutRecord) => {
  return parseTimestamp(record?.paid_at || record?.updated_at || record?.created_at)
}

const getSalaryRecalculationNotice = (employeeId: number) => {
  const record = getEmployeePayoutRecord(employeeId)
  if (!record || isPaidSalaryRecord(record)) return null

  const stats = getEmployeeAttendanceStats(employeeId)
  const settledAt = getPayoutSettledTimestamp(record)
  const leaveActivityAt = parseTimestamp(stats.latest_leave_activity_at)

  if (!settledAt || !leaveActivityAt || leaveActivityAt <= settledAt) {
    return null
  }

  const leaveDateText = stats.latest_leave_record_date ? `请假日期：${stats.latest_leave_record_date}` : '存在后补请假'
  const latestLeaveActivityAt = stats.latest_leave_activity_at
  const activityText = latestLeaveActivityAt && TimeUtil.isValid(latestLeaveActivityAt)
    ? TimeUtil.format(latestLeaveActivityAt, TIME_FORMATS.DATETIME_MINUTE)
    : latestLeaveActivityAt || '未知时间'

  return {
    message: `${leaveDateText}，审批时间晚于工资结算时间（${activityText}），建议重新结算`
  }
}

// 获取销售数量（优先使用 sales_count 字段）
const getSalesCount = (row: { sales_count?: number | null, commission_detail?: string | null }) => {
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
    globalNotifications.warning('请先选择月份')
    return
  }

  try {
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.daysInMonth(Number(year), Number(month))
    const endDate = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`

    await confirmAction(
      `确认批量重算 ${payoutMonth.value} 全部员工未发工资？已发工资保留原记录并跳过`,
      '确认',
      { type: 'warning' }
    )

    payoutLoading.value = true
    const response = await salaryApi.records.recalculateMonth(startDate, endDate)
    const result = response.data
    if (!result) throw new Error('批量重算接口未返回结果')
    const message = `批量重算完成：成功 ${result.recalculated}，跳过已发 ${result.skipped_paid}，失败 ${result.errors.length}，共 ${result.total} 人`
    if (result.errors.length) globalNotifications.warning(message)
    else globalNotifications.success(message)

    await loadPayoutList()
    await loadAllEmployeesAttendance(payoutMonth.value)
    await loadAllEmployeesSales(payoutMonth.value)
  } catch (error) {
    if (error !== 'cancel') {
      globalNotifications.error('批量重算失败')
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
const pendingSalaryData = ref<PendingSalaryData | null>(null)

// 关闭结算对话框并清空临时数据
const closeSettleDialog = () => {
  settleDialogVisible.value = false
  pendingSalaryData.value = null
}

const handleApprovePayout = async (employee: SalaryEmployeeRow) => {
  const record = getEmployeePayoutRecord(employee.id)
  if (!record?.id || !requireSalaryRecordPermission('approve')) return
  try {
    await salaryApi.records.approveSalaryRecord(record.id)
    globalNotifications.success('工资审批成功')
    await loadPayoutList()
  } catch (err) {
    globalNotifications.error(getRequestErrorMessage(err, '工资审批失败'))
  }
}

// 按员工结算工资
const handlePayoutByEmployee = async (employee: SalaryEmployeeRow) => {
  const existingRecord = getEmployeePayoutRecord(employee.id)
  if (!requireUnpaidPayout(existingRecord)) return
  if (!requireSalaryRecordPermission('pay') || (!existingRecord && (!requireSalaryRecordPermission('create') || !requireSalaryRecordPermission('approve')))) {
    return
  }

  try {
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    // period_end 是月底（统计当月所有数据）
    const daysInMonth = TimeUtil.daysInMonth(Number(year), Number(month))
    const endDate = `${year}-${month}-${daysInMonth}`

    // 使用后端计算 API（支持自动涨薪）
    let calculatedData: SalaryCalculation
    try {
      const response = existingRecord?.id
        ? await salaryApi.records.getSalaryRecordById(existingRecord.id)
        : await salaryApi.calculateSalary(employee.id, startDate, endDate)
      if (!response.data) {
        throw new Error('工资计算接口未返回数据')
      }
      if (isPaidSalaryRecord(response.data)) { globalNotifications.warning('工资已经发放，请刷新记录'); return }
      calculatedData = response.data
    } catch (err: unknown) {
      logger.error('计算工资失败:', err)

      // 检查是否是模板错误（处理多种错误响应格式）
      const errorMessage = getRequestErrorMessage(err, '')
      if (errorMessage.includes('工资模板') || errorMessage.includes('template') || errorMessage.includes('关联')) {
        globalNotifications.error(`无法结算：${employee.name || employee.username} 没有关联薪资模板，请先设置`)
      } else {
        globalNotifications.error(`计算工资失败：${errorMessage}`)
      }
      return
    }

    // 检查是否已有记录
    const record = existingRecord

    // 临时存储计算的数据和员工信息，等待确认后保存
    pendingSalaryData.value = {
      employeeId: employee.id,
      employeeName: employee.name || employee.username || '未命名员工',
      calculatedData: calculatedData,
      existingRecord: record,
      startDate: startDate,
      endDate: endDate
    }

    // 显示结算对话框，选择支付方式（此时还未保存到数据库）
    settleForm.value = {
      recordId: null, // 还没有保存，所以没有 recordId
      employeeId: employee.id,
      employeeName: employee.name || employee.username || '未命名员工',
      netSalary: formatAmount(calculatedData.net_salary),
      payment_method: record?.payment_method || '' // 预填充之前的支付方式
    }
    settleDialogVisible.value = true

  } catch (error) {
    logger.error('结算失败:', error)
    globalNotifications.error('操作失败')
  }
}

// 确认结算
const confirmSettle = async () => {
  if (settleSaving.value) return
  if (!requireUnpaidPayout(getEmployeePayoutRecord(settleForm.value.employeeId))) return
  const action = (pendingSalaryData.value?.existingRecord || settleForm.value.recordId) ? 'edit' : 'create'
  if (!requireSalaryRecordPermission('pay') || (action === 'create' && (!requireSalaryRecordPermission('create') || !requireSalaryRecordPermission('approve')))) {
    return
  }

  if (canViewSalaryField('salary_salaryrecordsview', 'payment_method') && !settleForm.value.payment_method) {
    globalNotifications.warning('请选择支付方式')
    return
  }

  // 如果没有待处理的数据，说明是已存在记录的结算（使用 recordId）
  if (!pendingSalaryData.value && !settleForm.value.recordId) {
    globalNotifications.error('结算数据丢失，请重新操作')
    return
  }

  try {
    settleSaving.value = true

    const pending = pendingSalaryData.value
    if (!pending) throw new Error('结算数据丢失，请重新核对')
    const paymentMethod = canUseSalaryField('salary_salaryrecordsview', 'payment_method')
      ? settleForm.value.payment_method || undefined : undefined
    let savedRecord = pending.calculatedData
    if (!pending.existingRecord) {
      const input = { ...salaryCalculationInput(pending.calculatedData), status: 'approved' as const }
      const response = await salaryApi.saveCalculatedSalary({ ...input, ...(paymentMethod ? { payment_method: paymentMethod } : {}) })
      if (!response.data?.data) throw new Error('保存工资记录失败')
      savedRecord = response.data.data
      // 即使随后发放失败，重试也沿用本次已经保存的工资，不再覆盖手工调整。
      pending.existingRecord = savedRecord
      pending.calculatedData = savedRecord
    }
    if (!savedRecord.id || !savedRecord.calculation_version) throw new Error('请重新计算并核对工资后发放')
    await salaryApi.records.markAsPaid(savedRecord.id, paymentMethod, savedRecord.calculation_version)
    globalNotifications.success('结算成功')
    closeSettleDialog()
    await loadPayoutList()
  } catch (error) {
    logger.error('结算失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '结算失败'))
  } finally {
    settleSaving.value = false
  }
}

// 重新结算工资（使用最新的销售和考勤数据）
const handleRecalculatePayout = async (employee: SalaryEmployeeRow) => {
  if (!requireSalaryRecordPermission('edit')) {
    return
  }

  const record = getEmployeePayoutRecord(employee.id)
  if (!requireUnpaidPayout(record)) return
  if (!record) {
    globalNotifications.error('未找到工资记录')
    return
  }

  try {
    const [year, month] = payoutMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    const daysInMonth = TimeUtil.daysInMonth(Number(year), Number(month))
    const endDate = `${year}-${month}-${daysInMonth}`

    // 重新计算工资
    const response = await salaryApi.calculateSalary(employee.id, startDate, endDate)
    const calculatedData = response.data

    if (!calculatedData) throw new Error('工资计算接口未返回数据')
    await salaryApi.saveCalculatedSalary(salaryCalculationInput(calculatedData))
    await loadPayoutList()
    globalNotifications.success('未发工资重新计算成功')
  } catch (err: unknown) {
    logger.error('重新结算失败:', err)
    globalNotifications.error(getRequestErrorMessage(err, '重新结算失败'))
  }
}

// 按员工编辑工资
const handleEditPayoutByEmployee = async (employee: SalaryEmployeeRow) => {
  const existing = getEmployeePayoutRecord(employee.id)
  if (editPayoutSaving.value || !requireUnpaidPayout(existing) || !requireSalaryRecordPermission(existing ? 'edit' : 'create')) return
  editPayoutSaving.value = true
  try {
    const { start_date: startDate, end_date: endDate } = getSalaryMonthRange(payoutMonth.value)
    const response = existing?.id ? await salaryApi.records.getSalaryRecordById(existing.id)
      : await salaryApi.calculateSalary(employee.id, startDate, endDate)
    const record = response.data
    if (!record || isPaidSalaryRecord(record)) throw new Error('工资已变化，请刷新后核对')
    editPayoutSource.value = record
    editPayoutForm.value = {
      id: record.id || null, employee_id: record.employee_id, salary_template_id: record.salary_template_id || null,
      base_salary: Number(record.base_salary) || 0, commission_amount: salaryPhoneCommission(record),
      overtime_pay: Number(record.overtime_pay) || 0, leave_deduction: Number(record.leave_deduction) || 0,
      status: existing?.status || (salaryRecordPermissions.canApprove.value ? 'approved' : 'pending')
    }
    editPayoutDialogVisible.value = true
  } catch (error) { globalNotifications.error(getRequestErrorMessage(error, '加载工资失败')) }
  finally { editPayoutSaving.value = false }
}

// 保存编辑的工资
const handleSaveEditPayout = async () => {
  if (editPayoutSaving.value || !requireUnpaidPayout(getEmployeePayoutRecord(editPayoutForm.value.employee_id))) return
  if (!requireSalaryRecordPermission(editPayoutForm.value.id ? 'edit' : 'create')) {
    return
  }

  try {
    editPayoutSaving.value = true

    const source = editPayoutSource.value
    if (!source?.calculation_version) throw new Error('请重新打开工资编辑后核对')
    const saveData: Partial<SalaryRecordInput> = {}
    const fields = ['base_salary', 'commission_amount', 'overtime_pay', 'leave_deduction'] as const
    for (const field of fields) {
      if (canUseSalaryField('salary_salaryrecordsview', field)) saveData[field] = editPayoutForm.value[field]
    }
    if (salaryRecordPermissions.canApprove.value && canUseSalaryField('salary_salaryrecordsview', 'salary_status')) {
      saveData.status = normalizeSalaryStatus(editPayoutForm.value.status)
    }
    // 手工金额不含商品提成；商品净额始终由服务器逐源核对后追加。
    if (editPayoutForm.value.id) {
      await salaryApi.updateSalaryRecord(editPayoutForm.value.id, { ...saveData, expected_calculation_version: source.calculation_version })
    } else {
      await salaryApi.createSalaryRecord({ ...saveData, employee_id: source.employee_id,
        period_start: source.period_start, period_end: source.period_end, expected_calculation_version: source.calculation_version })
    }

    globalNotifications.success(editPayoutForm.value.id ? '工资记录修改成功' : '工资记录创建成功')

    editPayoutDialogVisible.value = false
    loadPayoutList()
  } catch (error) {
    globalNotifications.error(getRequestErrorMessage(error, '保存失败'))
  } finally {
    editPayoutSaving.value = false
  }
}

// 删除工资记录
const handleDeletePayout = async (employee: SalaryEmployeeRow) => {
  if (!requireSalaryRecordPermission('delete')) {
    return
  }

  const record = getEmployeePayoutRecord(employee.id)
  if (!record || !requireUnpaidPayout(record)) return

  try {
    await confirmAction(`确认删除 ${employee.name || employee.username} 的工资记录？此操作不可恢复！`, '警告', {
      type: 'warning',
      customClass: 'message-box-unified'
    })
    if (!record.id) {
      globalNotifications.warning('工资记录缺少有效ID')
      return
    }
    await salaryApi.records.deleteSalaryRecord(record.id)
    globalNotifications.success('删除成功')
    loadPayoutList()
  } catch (error) {
    if (error !== 'cancel') {
      globalNotifications.error('删除失败')
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
const handleEditEmployeeTemplate = (row: SalaryEmployeeRow) => {
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
    globalNotifications.success('工资模板设置成功')
    templateDialogVisible.value = false
    // 根据当前标签页传递正确的月份参数
    const monthParam = activeTab.value === 'employees' ? employeeSalaryMonth.value : payoutMonth.value
    await loadEmployeeList(monthParam)
  } catch {
    globalNotifications.error('设置失败')
  }
}

// ========== 考勤记录相关 ==========
// 考勤记录对话框
const attendanceDialogVisible = ref(false)
const attendanceRecords = ref<Array<AttendanceRecord & { reason?: string }>>([])
const attendanceLoading = ref(false)
const currentAttendanceEmployee = ref<SalaryEmployeeRow | null>(null)
const attendanceFormVisible = ref(false)
const attendanceSaving = ref(false)
const attendanceDialogTitle = ref('新增考勤记录')
const editingAttendanceId = ref<number | null>(null) // 正在编辑的考勤记录ID
type AttendanceFormModel = AttendanceRecord & { reason: string, record_end_date?: string }

const attendanceForm = ref<AttendanceFormModel>({
  record_date: '',
  record_end_date: '',
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
  attendanceForm.value.record_end_date = ''
  attendanceForm.value.leave_days = attendanceForm.value.record_type === 'leave' ? 1 : 0
  attendanceForm.value.monthly_leave_days = attendanceForm.value.record_type === 'monthly_leave' ? 1 : 0
}

const buildAttendanceEndDate = (startDate: string, days?: number) => {
  const date = TimeUtil.parse(startDate)
  const dayCount = Math.max(1, Number(days) || 1)
  return date?.isValid()
    ? TimeUtil.format(date.add(dayCount - 1, 'day'), TIME_FORMATS.DATE)
    : startDate
}

const buildAttendanceDateRange = (startDate: string, endDate: string) => {
  const start = TimeUtil.parse(startDate)
  const end = TimeUtil.parse(endDate)
  if (!start?.isValid() || !end?.isValid() || end.isBefore(start, 'day')) return []

  const dates: string[] = []
  let current = start
  while (!current.isAfter(end, 'day')) {
    dates.push(TimeUtil.format(current, TIME_FORMATS.DATE))
    current = current.add(1, 'day')
  }
  return dates
}

// 打开员工考勤记录对话框
const handleViewAttendance = async (row: SalaryEmployeeRow) => {
  currentAttendanceEmployee.value = row
  if (!requireAttendancePermission('view')) {
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
  if (!canViewEmployeeAttendance(employeeId)) {
    attendanceRecords.value = []
    return
  }

  attendanceLoading.value = true
  try {
    // 使用当前选择的月份（员工薪资页面的月份选择）
    const [year, month] = employeeSalaryMonth.value.split('-')
    const startDate = `${year}-${month}-01`
    // 获取当月的最后一天
    const daysInMonth = TimeUtil.daysInMonth(Number(year), Number(month))
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
    globalNotifications.error('加载考勤记录失败')
  } finally {
    attendanceLoading.value = false
  }
}

// 打开新增考勤记录对话框
const handleAddAttendance = () => {
  if (!requireAttendancePermission('create')) {
    return
  }
  if (!currentAttendanceEmployee.value?.salary_template_id) {
    globalNotifications.warning('请先为员工绑定工资模板，再登记休假、请假或加班')
    return
  }

  editingAttendanceId.value = null // 清空编辑ID，表示新增模式
  attendanceDialogTitle.value = '新增考勤记录'
  attendanceForm.value = {
    record_date: TimeUtil.nowFormatted(TIME_FORMATS.DATE),
    record_end_date: '',
    record_type: 'leave',
    leave_type: '事假',
    leave_days: 1,
    overtime_hours: 2,
    monthly_leave_days: 1,
    reason: '',
    status: attendancePermissions.canApprove.value ? 'approved' : 'pending'
  }
  attendanceFormVisible.value = true
}

// 打开编辑考勤记录对话框
const handleEditAttendance = (row: AttendanceRecord & { reason?: string }) => {
  if (!requireAttendancePermission('edit')) {
    return
  }

  editingAttendanceId.value = row.id ?? null // 设置编辑ID
  attendanceDialogTitle.value = '编辑考勤记录'
  attendanceForm.value = {
    record_date: row.record_date,
    record_end_date: buildAttendanceEndDate(row.record_date, row.record_type === 'monthly_leave' ? row.monthly_leave_days : row.leave_days),
    record_type: row.record_type,
    leave_type: row.leave_type || '事假',
    leave_days: row.leave_days || 0,
    overtime_hours: row.overtime_hours || 0,
    monthly_leave_days: row.monthly_leave_days || 0,
    reason: row.reason || row.leave_reason || row.overtime_reason || '',
    status: row.status
  }
  attendanceFormVisible.value = true
}

// 保存考勤记录（支持新增和编辑）
const handleSaveAttendance = async () => {
  if (!requireAttendancePermission(editingAttendanceId.value ? 'edit' : 'create')) {
    return
  }

  if (!currentAttendanceEmployee.value) return
  if (!currentAttendanceEmployee.value.salary_template_id) {
    globalNotifications.warning('请先为员工绑定工资模板，再登记休假、请假或加班')
    return
  }

  // 验证必填字段
  if (!attendanceForm.value.record_date) {
    globalNotifications.warning('请选择记录日期')
    return
  }

  attendanceSaving.value = true
  try {
    const recordType = attendanceForm.value.record_type || 'leave'
    const recordDate = attendanceForm.value.record_date || TimeUtil.nowFormatted(TIME_FORMATS.DATE)
    const recordEndDate = attendanceForm.value.record_end_date || recordDate
    const recordStatus = attendanceForm.value.status || 'pending'
    const recordDates = recordType === 'leave' || recordType === 'monthly_leave'
      ? buildAttendanceDateRange(recordDate, recordEndDate)
      : [recordDate]

    if (recordDates.length === 0) {
      globalNotifications.warning('请选择有效的开始日期和结束日期')
      return
    }
    const isEdit = !!editingAttendanceId.value
    if (isEdit && recordDates.length > 1 && !attendancePermissions.canCreate.value) {
      attendancePermissions.handleNoPermission('create')
      return
    }

    // 根据记录类型构建提交数据
    const submitData: Partial<AttendanceRecord> & { employee_id: number } = {
      employee_id: currentAttendanceEmployee.value.id,
      record_type: recordType,
      record_date: recordDate,
      status: recordStatus
    }

    switch (recordType) {
    case 'monthly_leave':
      submitData.monthly_leave_days = recordDates.length
      if (!submitData.monthly_leave_days || submitData.monthly_leave_days <= 0) {
        globalNotifications.warning('请输入休假天数')
        return
      }

      if (!isEdit) {
        const balanceResponse = await attendanceApi.getLeaveBalance(
          Number(currentAttendanceEmployee.value.id),
          { start_date: recordDate, end_date: recordEndDate }
        )
        const balance = balanceResponse.data
        if (!balance) {
          globalNotifications.error('未获取到休假额度，请稍后重试')
          return
        }
        const allocation = buildAttendanceLeaveAllocation({
          requestedDays: recordDates.length,
          range: [recordDate, recordEndDate],
          monthlyLimit: Number(balance.monthly_limit) || 0,
          available: Number(balance.available) || 0,
          monthlyBalances: balance.monthly_balances || []
        })

        if (allocation.assignments.length !== recordDates.length) {
          globalNotifications.error('休假额度计算失败，请检查日期后重试')
          return
        }
        const groups = groupAttendanceLeaveAssignments(allocation.assignments)

        if (allocation.regularLeaveDaysCount > 0) {
          const dateDetails = groups.map(item => {
            const date = TimeUtil.parse(item.startDate)
            const endDate = TimeUtil.parse(item.endDate)
            const dateLabel = date?.isValid()
              ? TimeUtil.format(date, TIME_FORMATS.MONTH_DAY_DISPLAY)
              : item.startDate
            const endDateLabel = endDate?.isValid()
              ? TimeUtil.format(endDate, TIME_FORMATS.MONTH_DAY_DISPLAY)
              : item.endDate
            return `${dateLabel}${item.days > 1 ? `至${endDateLabel}` : ''}：${item.type === 'monthly_leave' ? `休假 ${item.days} 天` : `请假 ${item.days} 天，无薪无提成！`}`
          }).join('\n')

          await confirmAction(
            `申请天数：${recordDates.length}天\n${allocation.monthlyLeaveDaysCount > 0 ? `休假 ${allocation.monthlyLeaveDaysCount} 天` : ''}\n${allocation.regularLeaveDaysCount > 0 ? `请假 ${allocation.regularLeaveDaysCount} 天，无薪无提成！` : ''}\n\n${dateDetails}\n\n是否继续？`,
            '休假额度不足',
            {
              confirmButtonText: '确认并保存',
              cancelButtonText: '取消',
              type: 'warning'
            }
          )
        }

        const manualReason = attendanceForm.value.reason.trim()
        const attendanceBatchId = createAttendanceBatchId()
        for (const group of groups) {
          if (group.type === 'monthly_leave') {
            await attendanceApi.createAttendanceRecord({
              employee_id: currentAttendanceEmployee.value.id,
              attendance_batch_id: attendanceBatchId,
              record_type: 'monthly_leave',
              record_date: group.startDate,
              monthly_leave_days: group.days,
              status: recordStatus
            })
          } else {
            const autoReason = `请假 ${group.days} 天，无薪无提成！`
            await attendanceApi.createAttendanceRecord({
              employee_id: currentAttendanceEmployee.value.id,
              attendance_batch_id: attendanceBatchId,
              record_type: 'leave',
              record_date: group.startDate,
              leave_type: '事假',
              leave_days: group.days,
              leave_reason: manualReason ? `${manualReason}；${autoReason}` : autoReason,
              status: recordStatus
            })
          }
        }

        globalNotifications.success(allocation.regularLeaveDaysCount > 0
          ? `添加成功：带薪休假 ${allocation.monthlyLeaveDaysCount} 天，无薪请假 ${allocation.regularLeaveDaysCount} 天`
          : `添加成功：带薪休假 ${allocation.monthlyLeaveDaysCount} 天`)
        attendanceFormVisible.value = false
        await loadEmployeeAttendance(currentAttendanceEmployee.value.id)
        await loadAllEmployeesAttendance(employeeSalaryMonth.value)
        await loadAllEmployeesSales(employeeSalaryMonth.value)
        return
      }
      break
    case 'leave':
      submitData.leave_type = attendanceForm.value.leave_type || '事假'
      submitData.leave_days = recordDates.length
      if (attendanceForm.value.reason.trim()) {
        submitData.leave_reason = attendanceForm.value.reason.trim()
      }
      if (!submitData.leave_type) {
        globalNotifications.warning('请选择请假类型')
        return
      }
      if (!submitData.leave_days || submitData.leave_days <= 0) {
        globalNotifications.warning('请输入请假天数')
        return
      }
      break
    case 'overtime':
      submitData.overtime_hours = attendanceForm.value.overtime_hours
      if (attendanceForm.value.reason.trim()) {
        submitData.overtime_reason = attendanceForm.value.reason.trim()
      }
      if (!submitData.overtime_hours || submitData.overtime_hours <= 0) {
        globalNotifications.warning('请输入加班时长')
        return
      }
      break
    }

    // 根据是否有编辑ID判断是新增还是编辑
    const attendanceBatchId = !isEdit && (recordType === 'monthly_leave' || recordType === 'leave')
      ? createAttendanceBatchId()
      : undefined
    for (const [index, date] of recordDates.entries()) {
      const dailyData: AttendanceRecord = {
        ...submitData,
        record_type: recordType,
        ...(attendanceBatchId ? { attendance_batch_id: attendanceBatchId } : {}),
        record_date: date,
        ...(recordType === 'monthly_leave' ? { monthly_leave_days: 1 } : {}),
        ...(recordType === 'leave' ? { leave_days: 1 } : {})
      }

      if (isEdit && index === 0) {
        await attendanceApi.updateAttendanceRecord(editingAttendanceId.value as number, dailyData)
      } else {
        await attendanceApi.createAttendanceRecord(dailyData)
      }
    }

    const typeLabels: Record<string, string> = {
      monthly_leave: '休假',
      leave: '请假',
      overtime: '加班'
    }
    globalNotifications.success(`${typeLabels[attendanceForm.value.record_type]}记录${isEdit ? '修改' : '添加'}成功`)

    // 关闭对话框并清除编辑ID
    attendanceFormVisible.value = false
    editingAttendanceId.value = null

    // 重新加载考勤记录
    await loadEmployeeAttendance(currentAttendanceEmployee.value.id)

    // 同时刷新考勤统计数据
    await loadAllEmployeesAttendance(employeeSalaryMonth.value)

    // 刷新销售数据
    await loadAllEmployeesSales(employeeSalaryMonth.value)
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    globalNotifications.error(`${editingAttendanceId.value ? '修改' : '添加'}失败`)
  } finally {
    attendanceSaving.value = false
  }
}

// 删除考勤记录
const handleDeleteAttendance = async (id: number) => {
  if (!requireAttendancePermission('delete')) {
    return
  }

  try {
    await confirmAction('确认删除此考勤记录？', '警告')
    await attendanceApi.deleteAttendanceRecord(id)
    globalNotifications.success('删除成功')
    if (currentAttendanceEmployee.value) {
      loadEmployeeAttendance(currentAttendanceEmployee.value.id)
    }
  } catch (error) {
    if (error !== 'cancel') {
      globalNotifications.error('删除失败')
    }
  }
}

// 模板操作
// 新增工资模板
const handleAddTemplate = () => {
  if (!requireSalaryTemplatePermission('create')) {
    return
  }

  templateForm.value = createSalaryTemplateForm()
  templateFormDialogVisible.value = true
}

// 编辑工资模板
const handleEditTemplate = (row: SalaryTemplate) => {
  if (!requireSalaryTemplatePermission('edit')) {
    return
  }

  try {
    templateForm.value = createSalaryTemplateForm(row)
  } catch (error) {
    globalNotifications.error(getRequestErrorMessage(error, '工资模板资料异常，请重新读取后核对'))
    return
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
    const saveData: Partial<SalaryTemplate> = salaryGoodsRulePayload(templateForm.value,
      canUseSalaryField('salary_salarytemplatesview', 'template_goods_commission_rule'))

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
      saveData.rest_days = templateForm.value.rest_days ?? 2
    }

    // 构建自动涨薪规则
    if (['template_auto_raise_enabled', 'template_auto_raise_months', 'template_auto_raise_amount', 'template_auto_raise_max_salary']
      .every(field => canUseSalaryField('salary_salarytemplatesview', field))) {
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
      globalNotifications.success('模板更新成功')
    } else {
      // 新增
      await salaryTemplateApi.createTemplate(saveData)
      globalNotifications.success('模板创建成功')
    }

    templateFormDialogVisible.value = false
    loadTemplates()
  } catch (err: unknown) {
    logger.error('保存模板失败:', err)
    globalNotifications.error(getRequestErrorMessage(err, '保存失败'))
  } finally {
    templateSaving.value = false
  }
}

const handleSetDefault = async (row: SalaryTemplate) => {
  if (!requireSalaryTemplatePermission('edit') || !canUseSalaryField('salary_salarytemplatesview', 'template_is_default')) {
    return
  }

  try {
    await confirmAction(`确认将 "${row.name}" 设为默认模板？`, '确认', {
      customClass: 'message-box-unified'
    })
    await salaryTemplateApi.setAsDefault(row.id)
    globalNotifications.success('设置成功')
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      globalNotifications.error('设置失败')
    }
  }
}

const handleToggleTemplateStatus = async (row: SalaryTemplate) => {
  if (!requireSalaryTemplatePermission('edit') || !canUseSalaryField('salary_salarytemplatesview', 'template_is_active')) {
    return
  }

  try {
    const newStatus = !row.is_active
    const actionText = newStatus ? '启用' : '禁用'
    await confirmAction(`确认${actionText}模板 "${row.name}"？`, '确认', {
      customClass: 'message-box-unified'
    })
    await salaryTemplateApi.updateTemplate(row.id, { is_active: newStatus })
    globalNotifications.success(`${actionText}成功`)
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      globalNotifications.error('操作失败')
    }
  }
}

// 获取使用指定模板的员工数量
const getEmployeeCountByTemplate = (templateId: number): number => {
  if (!employees.value || employees.value.length === 0) return 0
  return employees.value.filter(emp => emp.salary_template_id === templateId).length
}

const handleDeleteTemplate = async (row: SalaryTemplate) => {
  if (!requireSalaryTemplatePermission('delete')) {
    return
  }

  try {
    await confirmAction(`确认删除模板 "${row.name}"？`, '警告', {
      type: 'warning',
      customClass: 'message-box-unified'
    })
    await salaryTemplateApi.deleteTemplate(row.id)
    globalNotifications.success('删除成功')
    loadTemplates()
  } catch (error) {
    if (error !== 'cancel') {
      globalNotifications.error('删除失败')
    }
  }
}

// 工资记录操作
const handleViewMyRecord = (row: SalaryRecord) => {
  if (!canViewPayoutRecords.value) {
    error('您没有查看工资发放记录的权限')
    return
  }

  currentRecord.value = row
  detailDialogVisible.value = true
}

// 删除的函数 - handleApproveRecord (已移除工资记录tab)

// 工资发放操作
const payoutRequests = useLatestRequest()
const loadPayoutList = async () => {
  const request = payoutRequests.nextRequest()
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
    const daysInMonth = TimeUtil.daysInMonth(Number(year), Number(month))
    const endDate = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`

    const records: SalaryRecord[] = []
    let page = 1
    for (;;) {
      const response = await salaryApi.getSalaryRecords({ period_start: startDate, period_end: endDate, page }, request.signal)
      if (!request.isLatest()) return
      if (!response.data) throw new Error('工资记录列表未返回数据')
      records.push(...response.data.records)
      if (!response.data.pagination.has_next) break
      page++
    }
    payoutList.value = records
    updateStats()
  } catch (error) {
    if (!request.isLatest() || payoutRequests.isCanceledError(error)) return
    logger.error('加载工资发放列表失败:', error)
    globalNotifications.error('加载工资发放列表失败')
  } finally {
    if (request.isLatest()) payoutLoading.value = false
  }
}

// TAB 切换
const handleTabChange = async (tabName: TabPaneName) => {
  salaryTemplatesTabRef.value?.resetInteraction()
  salaryEmployeesTabRef.value?.resetInteraction()

  const normalizedTabName = String(tabName)
  if (normalizedTabName === 'templates') {
    if (!canViewSalaryTemplates.value) return
    loadTemplates()
  } else if (normalizedTabName === 'employees') {
    if (!canViewSalaryRecords.value) return
    // 员工薪资：加载用户选择的月份的实时数据
    await loadEmployeeList(employeeSalaryMonth.value)
    await loadTemplates()
    // 根据选择的月份加载考勤和销售数据（实时数据）
    await loadAllEmployeesAttendance(employeeSalaryMonth.value)
    await loadAllEmployeesSales(employeeSalaryMonth.value)
  } else if (normalizedTabName === 'payout') {
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
    shortcutPageReady.value = true
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
  shortcutPageReady.value = true
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
const openCurrentSalarySales = () => {
  const row = currentRecord.value
  if (!row) return
  detailDialogVisible.value = false
  return handleViewSalesDetail(row)
}

usePageShortcuts('/salary', {
  'salary-template-create': { open: handleAddTemplate, ready: () => shortcutPageReady.value },
  'salary-templates': { open: () => { activeTab.value = 'templates'; return handleTabChange('templates') }, ready: () => shortcutPageReady.value },
  'salary-employees': { open: () => { activeTab.value = 'employees'; return handleTabChange('employees') }, ready: () => shortcutPageReady.value },
  'salary-payout': { open: () => { activeTab.value = 'payout'; return handleTabChange('payout') }, ready: () => shortcutPageReady.value },
  'salary-my': { open: () => { activeTab.value = 'my'; return handleTabChange('my') }, ready: () => shortcutPageReady.value }
})
</script>

<style lang="scss" scoped src="./styles/salary-view.scss"></style>
<style>
@media (max-width: 767px) {
  .sales-details .salary-info-section {
    padding: 12px 10px;
    border-radius: 14px;
  }

  .sales-details .salary-info-section .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-width: 0;
    padding: 8px 10px;
  }

  .sales-details .salary-info-section .info-row label,
  .sales-details .salary-info-section .info-row span {
    white-space: normal;
    overflow-wrap: anywhere;
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
</style>
