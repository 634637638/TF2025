<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="repairs"
    module-name="维修管理"
    permission-code="repairs:view"
  >
    <div class="repairs-management admin-page admin-unified-base-data-page safe-area-top safe-area-bottom">
      <PageHeader
        icon="fas fa-screwdriver-wrench"
        title="维修管理"
        description="管理手机维修记录和进度"
      >
        <template #actions>
          <el-button
            v-if="canCreate && repairsApiAvailable"
            type="primary"
            @click="showAddModal"
          >
            <i class="fas fa-plus" /> 新建维修单
          </el-button>
          <el-button
            type="info"
            :disabled="refreshing"
            @click="refreshData"
          >
            <InlineLoading
              v-if="refreshing"
              text="刷新中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i class="fas fa-refresh" /> 刷新
            </template>
          </el-button>
        </template>
      </PageHeader>

      <div class="repairs-content admin-page-content">
        <el-alert
          v-if="!repairsApiAvailable"
          title="维修服务尚未接入数据接口，当前仅展示空状态。"
          type="warning"
          :closable="false"
          show-icon
          class="repairs-unavailable-alert"
        />
        <div
          v-if="showStatsCards"
          class="stats-cards"
        >
          <div
            v-if="canViewRepairField('stats_pending')"
            class="stat-card"
          >
            <div class="stat-icon pending">
              <i class="fas fa-clock" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.pending }}
              </div>
              <div class="stat-label">
                待维修
              </div>
            </div>
          </div>
          <div
            v-if="canViewRepairField('stats_processing')"
            class="stat-card"
          >
            <div class="stat-icon processing">
              <i class="fas fa-screwdriver-wrench" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.processing }}
              </div>
              <div class="stat-label">
                维修中
              </div>
            </div>
          </div>
          <div
            v-if="canViewRepairField('stats_completed')"
            class="stat-card"
          >
            <div class="stat-icon completed">
              <i class="fas fa-circle-check" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.completed }}
              </div>
              <div class="stat-label">
                已完成
              </div>
            </div>
          </div>
          <div
            v-if="canViewRepairField('stats_monthly_revenue')"
            class="stat-card"
          >
            <div class="stat-icon revenue">
              <i class="fas fa-yen-sign" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                ¥{{ stats.monthly_revenue }}
              </div>
              <div class="stat-label">
                本月收入
              </div>
            </div>
          </div>
        </div>

        <UnifiedSearchPanel
          v-if="showRepairSearchPanel"
          v-model:expanded="searchExpanded"
          :loading="loading"
          @search="handleSearch"
          @reset="handleReset"
        >
          <template
            v-if="showRepairSearchField"
            #primary
          >
            <el-input
              v-model="filters.search"
              placeholder="搜索维修单号、客户、手机型号"
              clearable
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <i class="fas fa-search" />
              </template>
            </el-input>
          </template>
          <div
            v-if="canViewRepairField('status')"
            class="form-group filter-item"
          >
            <el-select
              v-model="filters.status"
              placeholder="维修状态"
              @change="handleSearch"
            >
              <el-option
                v-for="tab in statusTabs"
                :key="tab.key"
                :label="tab.label"
                :value="tab.key"
              />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <div class="repairs-table table-section admin-panel admin-table-panel">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-list" />
              维修记录
              <span class="record-count">共 {{ pagination.total }} 条记录</span>
            </div>
          </div>

          <div class="table-responsive">
            <el-table
              :data="loading ? [] : repairs"
              border
              stripe
              class="data-table devices-table base-data-table repairs-data-table"
              table-layout="fixed"
              :fit="true"
              :row-key="getRepairRowKey"
              :expand-row-keys="isMobile && mobileActionRowId ? [mobileActionRowId] : []"
              @row-click="handleRepairRowClick"
            >
              <template #empty>
                <TableLoadingRow
                  v-if="loading"
                  mode="block"
                  text="加载维修记录中..."
                />
                <DataEmptyState
                  v-else
                  description="暂无维修记录"
                />
              </template>

              <el-table-column
                v-if="canViewRepairField('order_no')"
                label="维修单号"
                :min-width="repairNumberColumnWidth"
                align="center"
                class-name="identifier-column"
              >
                <template #default="{ row }">
                  <span class="repair-number">{{ row.order_no }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('customer_name')"
                prop="customer_name"
                label="客户"
                :min-width="customerColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  <strong>{{ row.customer_name || '-' }}</strong>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('customer_phone')"
                prop="customer_phone"
                label="客户电话"
                min-width="118"
                align="center"
              />
              <el-table-column
                v-if="canViewRepairField('brand_name')"
                prop="brand_name"
                label="品牌"
                min-width="90"
                align="center"
              />
              <el-table-column
                v-if="canViewRepairField('phone_model')"
                prop="phone_model"
                label="手机型号"
                :min-width="modelColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.phone_model || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('imei')"
                prop="imei"
                label="IMEI/序列号"
                min-width="145"
                align="center"
              />
              <el-table-column
                v-if="canViewRepairField('problem_description')"
                prop="problem_description"
                label="故障描述"
                min-width="190"
                align="center"
                class-name="complete-text-column wrapped-text-column"
              />
              <el-table-column
                v-if="canViewRepairField('estimated_cost')"
                label="预计费用"
                min-width="104"
                align="center"
              >
                <template #default="{ row }">
                  <span class="amount-value">¥{{ formatAmount(row.estimated_cost) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('actual_cost')"
                label="实际费用"
                min-width="104"
                align="center"
              >
                <template #default="{ row }">
                  <span class="amount-value">{{ row.actual_cost == null ? '-' : `¥${formatAmount(row.actual_cost)}` }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showRepairStatusField"
                label="维修状态"
                :min-width="isMobile ? 118 : 168"
                align="center"
              >
                <template #default="{ row }">
                  <div class="action-buttons">
                    <span
                      v-if="canViewRepairField('status')"
                      :class="['status-badge', `status-${row.status}`]"
                    >{{ getStatusText(row.status) }}</span>
                    <el-button
                      v-if="canEdit && row.status !== 'completed' && row.status !== 'cancelled'"
                      type="success"
                      size="small"
                      title="更新状态"
                      @click.stop="updateStatus(row)"
                    >
                      <i class="fas fa-sync" /><span>状态</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('technician_name')"
                prop="technician_name"
                label="维修员"
                min-width="96"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.technician_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('remarks')"
                prop="remarks"
                label="备注"
                min-width="150"
                align="center"
                class-name="complete-text-column wrapped-text-column"
              />
              <el-table-column
                v-if="canViewRepairField('created_at')"
                label="创建时间"
                min-width="154"
                align="center"
              >
                <template #default="{ row }">
                  <span class="time-value">{{ formatDate(row.created_at) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('updated_at')"
                label="更新时间"
                min-width="154"
                align="center"
              >
                <template #default="{ row }">
                  <span class="time-value">{{ formatDate(row.updated_at) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('completed_at')"
                label="完成时间"
                min-width="154"
                align="center"
              >
                <template #default="{ row }">
                  <span class="time-value">{{ row.completed_at ? formatDate(row.completed_at) : '-' }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showActionField"
                label="操作"
                :width="$getActionColumnWidth(1 + Number(canEdit))"
                align="center"
                class-name="actions-column"
              >
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-button
                      type="primary"
                      size="small"
                      title="查看详情"
                      @click.stop="viewRepair(row)"
                    >
                      <i class="fas fa-eye" /><span>详情</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="warning"
                      size="small"
                      title="编辑"
                      @click.stop="editRepair(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="isMobile && showMobileActionField"
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
                      @click.stop="viewRepair(row)"
                    >
                      <i class="fas fa-eye" /><span>详情</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="warning"
                      size="small"
                      @click.stop="editRepair(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <Pagination
            v-if="pagination.total > 0"
            v-model:current="pagination.page"
            v-model:page-size="pagination.page_size"
            :total="pagination.total"
            :page-sizes="[20, 50, 100]"
            :show-total="true"
            :show-range="true"
            :show-page-sizes="true"
            :show-quick-jumper="true"
            :disabled="loading"
            @change="handlePaginationChange"
          />
        </div>
      </div>

      <MobileDialog
        v-model="showModal"
        :title="editingRepairId ? '编辑维修单' : '新建维修单'"
        width="600px"
        dialog-class="repairs-dialog"
        :show-default-footer="false"
        :close-on-click-modal="false"
      >
        <el-form
          :model="formData"
          label-width="100px"
          :disabled="submitting"
        >
          <el-form-item
            v-if="canViewRepairField('customer_name')"
            label="客户"
            required
          >
            <el-select
              v-model="formData.customer_id"
              placeholder="请选择客户"
              filterable
            >
              <el-option
                v-for="customer in customers"
                :key="customer.id"
                :label="getCustomerOptionLabel(customer)"
                :value="customer.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="canViewRepairField('brand_name')"
            label="手机品牌"
            required
          >
            <el-select
              v-model="formData.brand_id"
              placeholder="请选择品牌"
              @change="onBrandChange"
            >
              <el-option
                v-for="brand in brands"
                :key="brand.id"
                :label="brand.name"
                :value="brand.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="canViewRepairField('phone_model')"
            label="手机型号"
            required
          >
            <el-input
              v-model="formData.phone_model"
              placeholder="请输入手机型号"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewRepairField('imei')"
            label="IMEI/序列号"
          >
            <el-input
              v-model="formData.imei"
              placeholder="请输入IMEI或序列号"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewRepairField('problem_description')"
            label="故障描述"
            required
          >
            <el-input
              v-model="formData.problem_description"
              type="textarea"
              :rows="4"
              placeholder="请详细描述故障情况"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewRepairField('estimated_cost')"
            label="预计费用"
          >
            <el-input-number
              v-model="formData.estimated_cost"
              :min="0"
              :precision="2"
              :step="10"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item
            v-if="editingRepairId && canViewRepairField('actual_cost')"
            label="实际费用"
          >
            <el-input-number
              v-model="formData.actual_cost"
              :min="0"
              :precision="2"
              :step="10"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewRepairField('technician_name')"
            label="维修员"
          >
            <el-select
              v-model="formData.technician_id"
              placeholder="请选择维修员"
              clearable
            >
              <el-option
                v-for="technician in technicians"
                :key="technician.id"
                :label="technician.name"
                :value="technician.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="canViewRepairField('remarks')"
            label="备注"
          >
            <el-input
              v-model="formData.remarks"
              type="textarea"
              :rows="3"
              placeholder="其他备注信息"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="modal-footer">
            <el-button
              type="info"
              @click="closeModal"
            >
              取消
            </el-button>
            <el-button
              type="primary"
              :loading="submitting"
              :disabled="!canSubmitVisibleFields"
              @click="handleSubmit"
            >
              {{ editingRepairId ? '保存维修单' : '创建维修单' }}
            </el-button>
          </div>
        </template>
      </MobileDialog>
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useLoadingState } from '@/composables'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useMobile } from '@/composables/mobile'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { PageHeader, PermissionGate } from '@/components/base'
import InlineLoading from '@/components/InlineLoading.vue'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { logger } from '@/utils/logger'
import { getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { repairsApi } from '@/api/repairs'
import type { RepairOrder, RepairOrderForm, RepairStatus } from '@/types/repair'

interface CustomerOption { id: number; name: string; phone: string }
interface BrandOption { id: number; name: string }
interface TechnicianOption { id: number; name: string }

const { canView, canCreate, canEdit, handleNoPermission } = usePagePermissions('repairs')
const repairsApiAvailable = true
const { success, error: notifyError, info } = useNotification()
const { isMobile } = useMobile()
const { loading } = useLoadingState()

const repairs = ref<RepairOrder[]>([])
const customers = ref<CustomerOption[]>([])
const brands = ref<BrandOption[]>([])
const technicians = ref<TechnicianOption[]>([])
const showModal = ref(false)
const editingRepairId = ref<number | null>(null)
const submitting = ref(false)
const refreshing = ref(false)
const searchExpanded = ref(false)
const filters = reactive<{ search: string; status: 'all' | RepairStatus }>({ search: '', status: 'all' })
const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0,
  total_pages: 0,
  has_next: false,
  has_prev: false
})
const mobileActionRowId = ref<string | null>(null)
const lastTappedRowId = ref<string | null>(null)
const lastTapTimestamp = ref(0)

const repairFieldMap: Record<string, string> = {
  stats_pending: 'stats.pending',
  stats_processing: 'stats.processing',
  stats_completed: 'stats.completed',
  stats_monthly_revenue: 'stats.monthly_revenue',
  order_no: 'basic_info.order_no',
  customer_name: 'customer_info.customer_name',
  customer_phone: 'customer_info.customer_phone',
  brand_name: 'device_info.brand_name',
  phone_model: 'device_info.phone_model',
  imei: 'device_info.imei',
  problem_description: 'repair_info.problem_description',
  technician_name: 'repair_info.technician_name',
  estimated_cost: 'price_info.estimated_cost',
  actual_cost: 'price_info.actual_cost',
  status: 'status_info.status',
  remarks: 'other_info.remarks',
  created_at: 'time_info.created_at',
  updated_at: 'time_info.updated_at',
  completed_at: 'time_info.completed_at',
  actions: 'system_info.operations'
}

const canViewRepairField = (fieldName: string) => fieldPermissions.isFieldVisible(
  'repairs_repairsview',
  repairFieldMap[fieldName] || fieldName
)

const showStatsCards = computed(() => [
  'stats_pending', 'stats_processing', 'stats_completed', 'stats_monthly_revenue'
].some(canViewRepairField))

const searchableRepairFields = ['order_no', 'customer_name', 'customer_phone', 'phone_model', 'imei']
const showRepairSearchField = computed(() => searchableRepairFields.some(canViewRepairField))
const showRepairSearchPanel = computed(() => showRepairSearchField.value || canViewRepairField('status'))
const showRepairStatusField = computed(() => shouldShowActionColumn(
  canViewRepairField('status'),
  [canEdit.value]
))
const requiredCreateFields = ['customer_name', 'brand_name', 'phone_model', 'problem_description']
const canSubmitVisibleFields = computed(() => (
  Boolean(editingRepairId.value) || requiredCreateFields.every(canViewRepairField)
))

const showActionField = computed(() => (
  !isMobile.value && shouldShowActionColumn(canViewRepairField('actions'), [canEdit.value])
))
const showMobileActionField = computed(() => shouldShowActionColumn(
  canViewRepairField('actions'),
  [canEdit.value]
))

const repairWriteFieldMap: Record<keyof RepairOrderForm, string> = {
  customer_id: 'customer_name',
  brand_id: 'brand_name',
  phone_model: 'phone_model',
  imei: 'imei',
  problem_description: 'problem_description',
  estimated_cost: 'estimated_cost',
  actual_cost: 'actual_cost',
  technician_id: 'technician_name',
  remarks: 'remarks'
}

const buildVisibleRepairPayload = () => Object.fromEntries(
  Object.entries(formData).filter(([field]) => (
    canViewRepairField(repairWriteFieldMap[field as keyof RepairOrderForm])
  ))
) as unknown as RepairOrderForm

const stats = ref({ pending: 0, processing: 0, completed: 0, monthly_revenue: '0' })

const statusTabs: Array<{ key: 'all' | RepairStatus; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待维修' },
  { key: 'processing', label: '维修中' },
  { key: 'completed', label: '已完成' }
]

const formData = reactive<RepairOrderForm>({
  customer_id: null as number | null,
  brand_id: null as number | null,
  phone_model: '',
  imei: '',
  problem_description: '',
  estimated_cost: 0,
  actual_cost: undefined,
  technician_id: null as number | null,
  remarks: ''
})

const repairNumberColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['维修单号', ...repairs.value.map(repair => repair.order_no)],
  { minWidth: 132, horizontalPadding: 30 }
))
const customerColumnWidth = computed(() => getTextColumnMinWidth(
  ['客户', ...repairs.value.map(repair => repair.customer_name)],
  { minWidth: isMobile.value ? 84 : 96, horizontalPadding: 28 }
))
const modelColumnWidth = computed(() => getTextColumnMinWidth(
  ['手机型号', ...repairs.value.map(repair => repair.phone_model || '')],
  { minWidth: isMobile.value ? 116 : 132, horizontalPadding: 28 }
))

const getRepairRowKey = (repair: RepairOrder) => String(repair.id)

const getStatusText = (status: RepairStatus) => ({
  pending: '待维修', processing: '维修中', completed: '已完成', cancelled: '已取消'
}[status])

const loadRepairs = async () => {
  loading.value = true
  try {
    const [listResponse, statsResponse] = await Promise.all([
      repairsApi.list({
        page: pagination.page,
        page_size: pagination.page_size,
        search: showRepairSearchField.value ? filters.search || undefined : undefined,
        status: canViewRepairField('status') ? filters.status : undefined
      }),
      repairsApi.stats()
    ])
    repairs.value = Array.isArray(listResponse?.data) ? listResponse.data : []
    pagination.page = Number(listResponse.pagination.page)
    pagination.page_size = Number(listResponse.pagination.page_size)
    pagination.total = Number(listResponse.pagination.total)
    pagination.total_pages = Number(listResponse.pagination.total_pages)
    pagination.has_next = Boolean(listResponse.pagination.has_next)
    pagination.has_prev = Boolean(listResponse.pagination.has_prev)
    if (!statsResponse.data) throw new Error('维修统计响应缺少 data')
    const summary = statsResponse.data
    stats.value = {
      pending: Number(summary.pending || 0),
      processing: Number(summary.processing || 0),
      completed: Number(summary.completed || 0),
      monthly_revenue: formatAmount(Number(summary.monthly_revenue || 0))
    }
  } catch (err) {
    logger.error('加载维修数据失败:', err)
    repairs.value = []
    pagination.total = 0
    pagination.total_pages = 0
    pagination.has_next = false
    pagination.has_prev = false
    throw err
  } finally {
    loading.value = false
  }
}

const loadOptions = async () => {
  const response = await repairsApi.options()
  if (!response.data) throw new Error('维修选项响应缺少 data')
  const data = response.data
  customers.value = Array.isArray(data.customers) ? data.customers : []
  brands.value = Array.isArray(data.brands) ? data.brands : []
  technicians.value = Array.isArray(data.technicians) ? data.technicians : []
}

const resetForm = () => Object.assign(formData, {
  customer_id: null, brand_id: null, phone_model: '', imei: '', problem_description: '',
  estimated_cost: 0, actual_cost: undefined, technician_id: null, remarks: ''
})

const showAddModal = () => {
  if (!canCreate.value) return handleNoPermission('create')
  editingRepairId.value = null
  resetForm()
  showModal.value = true
}

const closeModal = () => { showModal.value = false; editingRepairId.value = null; resetForm() }
const onBrandChange = () => undefined

const handleSubmit = async () => {
  if (submitting.value) return
  if (editingRepairId.value ? !canEdit.value : !canCreate.value) {
    return handleNoPermission(editingRepairId.value ? 'edit' : 'create')
  }
  if (!canSubmitVisibleFields.value) {
    notifyError('当前字段权限不足，无法提交维修单所需字段')
    return
  }
  if (!formData.customer_id || !formData.brand_id || !formData.phone_model || !formData.problem_description) {
    notifyError('请完整填写必填项')
    return
  }
  submitting.value = true
  try {
    const payload = buildVisibleRepairPayload()
    if (editingRepairId.value) {
      await repairsApi.update(editingRepairId.value, payload)
      success('维修单更新成功')
    } else {
      await repairsApi.create(payload)
      success('维修单创建成功')
    }
    closeModal()
    await loadRepairs()
  } catch (err) {
    logger.error('创建维修单失败:', err)
    notifyError('创建维修单失败')
  } finally {
    submitting.value = false
  }
}

const viewRepair = async (repair: RepairOrder) => {
  try {
    const response = await repairsApi.detail(repair.id)
    const detail = response?.data || repair
    const visibleDetail = [
      canViewRepairField('order_no') ? detail.order_no : null,
      canViewRepairField('problem_description') ? detail.problem_description : null
    ].filter(Boolean)
    info(visibleDetail.length ? visibleDetail.join('：') : '没有可查看的维修详情字段')
  } catch (err) {
    logger.error('获取维修单详情失败:', err)
    notifyError('获取维修单详情失败')
  }
}
const editRepair = (repair: RepairOrder) => {
  if (!canEdit.value) return handleNoPermission('edit')
  editingRepairId.value = repair.id
  const values: RepairOrderForm = {
    customer_id: repair.customer_id,
    brand_id: repair.brand_id || null,
    phone_model: repair.phone_model || '',
    imei: repair.imei || '',
    problem_description: repair.problem_description || '',
    estimated_cost: Number(repair.estimated_cost || 0),
    actual_cost: repair.actual_cost === null || repair.actual_cost === undefined
      ? undefined
      : Number(repair.actual_cost),
    technician_id: repair.technician_id || null,
    remarks: repair.remarks || ''
  }
  Object.entries(values).forEach(([field, value]) => {
    if (canViewRepairField(repairWriteFieldMap[field as keyof RepairOrderForm])) {
      Object.assign(formData, { [field]: value })
    }
  })
  showModal.value = true
}
const updateStatus = async (repair: RepairOrder) => {
  if (!canEdit.value) return handleNoPermission('edit')
  const nextStatus: Record<RepairStatus, RepairStatus> = {
    pending: 'processing', processing: 'completed', completed: 'completed', cancelled: 'cancelled'
  }
  const next = nextStatus[repair.status]
  if (next === repair.status) return info(`维修单 ${repair.order_no} 已完成`)
  try {
    await repairsApi.updateStatus(repair.id, next)
    success('维修状态更新成功')
    await loadRepairs()
  } catch (err) {
    logger.error('更新维修状态失败:', err)
    notifyError('更新维修状态失败')
  }
}

const refreshData = async () => {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([loadRepairs(), loadOptions()])
    success('数据刷新成功')
  } catch (err) {
    logger.error('刷新维修数据失败:', err)
    notifyError('数据刷新失败')
  } finally {
    refreshing.value = false
  }
}

const handleSearch = async () => {
  pagination.page = 1
  mobileActionRowId.value = null
  try {
    await loadRepairs()
  } catch (err) {
    logger.error('检索维修记录失败:', err)
    notifyError('检索维修记录失败')
  }
}
const handleReset = () => { filters.search = ''; filters.status = 'all'; void handleSearch() }
const handlePaginationChange = (page: number, page_size: number) => {
  pagination.page = page
  pagination.page_size = page_size
  mobileActionRowId.value = null
  void loadRepairs().catch(err => {
    logger.error('切换维修分页失败:', err)
    notifyError('加载维修分页失败')
  })
}

const toggleMobileActions = (rowId: string) => {
  if (!isMobile.value) return
  mobileActionRowId.value = mobileActionRowId.value === rowId ? null : rowId
}

const handleRepairRowClick = (repair: RepairOrder, _column: unknown, event: Event) => {
  if (!isMobile.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, textarea, select, .el-button, .el-input, .el-select')) return
  const rowId = getRepairRowKey(repair)
  const now = Date.now()
  if (lastTappedRowId.value === rowId && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(rowId)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }
  lastTappedRowId.value = rowId
  lastTapTimestamp.value = now
}

const formatAmount = (amount?: number) => Number(amount || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const getCustomerOptionLabel = (customer: CustomerOption) => (
  canViewRepairField('customer_phone') && customer.phone
    ? `${customer.name} - ${customer.phone}`
    : customer.name
)
const formatDate = (date: string) => new Date(date).toLocaleString('zh-CN')

onMounted(async () => {
  if (!canView.value) return
  await fieldPermissions.init()
  await Promise.all([loadRepairs(), loadOptions()])
})
</script>

<style scoped>
.stat-icon.pending {
  background: var(--el-color-warning);
}

.stat-icon.processing {
  background: var(--el-color-primary);
}

.stat-icon.completed {
  background: var(--el-color-success);
}

.stat-icon.revenue {
  background: var(--el-color-danger);
}

.repair-number,
.amount-value,
.time-value {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-variant-numeric: tabular-nums;
}

.repair-number,
.amount-value {
  font-weight: 600;
}

.amount-value {
  color: var(--el-color-success);
}

.status-pending {
  background: var(--tf-status-warning-bg);
  color: var(--tf-status-warning-color);
  border: 1px solid var(--tf-status-warning-border);
}

.status-processing {
  background: var(--tf-status-info-bg);
  color: var(--tf-status-info-color);
  border: 1px solid var(--tf-status-info-border);
}

.status-completed {
  background: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
  border: 1px solid var(--tf-status-success-border);
}

.status-cancelled {
  background: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
  border: 1px solid var(--tf-status-danger-border);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.repairs-dialog .el-select),
:deep(.repairs-dialog .el-input-number) {
  width: 100%;
}
</style>
