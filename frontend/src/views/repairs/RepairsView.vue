<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="repairs"
    module-name="维修管理"
    permission-code="repairs:view"
  >
    <div class="repairs-management admin-page admin-unified-base-data-page safe-area-top safe-area-bottom">
      <PageHeader icon="fas fa-screwdriver-wrench" title="维修管理" description="管理手机维修记录和进度">
        <template #actions>
          <el-button v-if="canCreate" type="primary" @click="showAddModal">
            <i class="fas fa-plus"></i> 新建维修单
          </el-button>
          <el-button type="info" :disabled="refreshing" @click="refreshData">
            <InlineLoading v-if="refreshing" text="刷新中..." size="small" variant="inherit" />
            <template v-else><i class="fas fa-refresh"></i> 刷新</template>
          </el-button>
        </template>
      </PageHeader>

      <div class="repairs-content admin-page-content">
        <div v-if="showStatsCards" class="stats-cards">
          <div v-if="canViewRepairField('stats_pending')" class="stat-card">
            <div class="stat-icon pending"><i class="fas fa-clock"></i></div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.pending }}</div>
              <div class="stat-label">待维修</div>
            </div>
          </div>
          <div v-if="canViewRepairField('stats_processing')" class="stat-card">
            <div class="stat-icon processing"><i class="fas fa-screwdriver-wrench"></i></div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.processing }}</div>
              <div class="stat-label">维修中</div>
            </div>
          </div>
          <div v-if="canViewRepairField('stats_completed')" class="stat-card">
            <div class="stat-icon completed"><i class="fas fa-circle-check"></i></div>
            <div class="stat-content">
              <div class="stat-value">{{ stats.completed }}</div>
              <div class="stat-label">已完成</div>
            </div>
          </div>
          <div v-if="canViewRepairField('stats_monthly_revenue')" class="stat-card">
            <div class="stat-icon revenue"><i class="fas fa-yen-sign"></i></div>
            <div class="stat-content">
              <div class="stat-value">¥{{ stats.monthlyRevenue }}</div>
              <div class="stat-label">本月收入</div>
            </div>
          </div>
        </div>

        <UnifiedSearchPanel
          v-model:expanded="searchExpanded"
          :loading="loading"
          @search="handleSearch"
          @reset="handleReset"
        >
          <template #primary>
            <el-input
              v-model="searchQuery"
              placeholder="搜索维修单号、客户、手机型号"
              clearable
              @keyup.enter="handleSearch"
            >
              <template #prefix><i class="fas fa-search"></i></template>
            </el-input>
          </template>
          <div class="form-group filter-item">
            <el-select v-model="activeTab" placeholder="维修状态" @change="handleSearch">
              <el-option v-for="tab in statusTabs" :key="tab.key" :label="tab.label" :value="tab.key" />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <div class="repairs-table table-section admin-panel admin-table-panel">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-list"></i>
              维修记录
              <span class="record-count">共 {{ filteredRepairs.length }} 条记录</span>
            </div>
          </div>

          <div class="table-responsive">
            <el-table
              :data="loading ? [] : paginatedRepairs"
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
                <TableLoadingRow v-if="loading" mode="block" text="加载维修记录中..." />
                <div v-else class="empty-state"><i class="fas fa-tools"></i><p>暂无维修记录</p></div>
              </template>

              <el-table-column
                label="维修单号"
                :min-width="repairNumberColumnWidth"
                align="center"
                class-name="identifier-column"
              >
                <template #default="{ row }"><span class="repair-number">{{ row.order_no }}</span></template>
              </el-table-column>
              <el-table-column prop="customer_name" label="客户" :min-width="customerColumnWidth" align="center">
                <template #default="{ row }"><strong>{{ row.customer_name || '-' }}</strong></template>
              </el-table-column>
              <el-table-column prop="phone_model" label="手机型号" :min-width="modelColumnWidth" align="center">
                <template #default="{ row }">{{ row.phone_model || '-' }}</template>
              </el-table-column>
              <el-table-column v-if="!isMobile" prop="problem_description" label="故障描述" min-width="190" align="center" class-name="complete-text-column wrapped-text-column" />
              <el-table-column v-if="!isMobile" label="预计费用" min-width="104" align="center">
                <template #default="{ row }"><span class="amount-value">¥{{ formatAmount(row.estimated_cost) }}</span></template>
              </el-table-column>
              <el-table-column label="维修状态" :min-width="isMobile ? 78 : 94" align="center">
                <template #default="{ row }">
                  <span :class="['status-badge', `status-${row.status}`]">{{ getStatusText(row.status) }}</span>
                </template>
              </el-table-column>
              <el-table-column v-if="!isMobile" prop="technician_name" label="维修员" min-width="96" align="center">
                <template #default="{ row }">{{ row.technician_name || '-' }}</template>
              </el-table-column>
              <el-table-column v-if="!isMobile" label="创建时间" min-width="154" align="center">
                <template #default="{ row }"><span class="time-value">{{ formatDate(row.created_at) }}</span></template>
              </el-table-column>
            <el-table-column v-if="showActionField" label="操作" :width="$getActionColumnWidth(1 + (Number(canEdit) * 2))" align="center" class-name="actions-column">
                <template #default="{ row }">
                  <div class="action-buttons">
                <el-button type="primary" size="small" title="查看详情" @click.stop="viewRepair(row)"><i class="fas fa-eye"></i><span>详情</span></el-button>
                <el-button v-if="canEdit" type="warning" size="small" title="编辑" @click.stop="editRepair(row)"><i class="fas fa-edit"></i><span>编辑</span></el-button>
                <el-button v-if="canEdit" type="success" size="small" title="更新状态" @click.stop="updateStatus(row)"><i class="fas fa-sync"></i><span>状态</span></el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="isMobile && canViewRepairField('actions')"
                type="expand"
                width="1"
                class-name="mobile-expand-column"
                label-class-name="mobile-expand-header"
              >
                <template #default="{ row }">
                  <div class="mobile-row-actions">
                    <el-button type="primary" size="small" @click.stop="viewRepair(row)"><i class="fas fa-eye"></i><span>详情</span></el-button>
                    <el-button v-if="canEdit" type="warning" size="small" @click.stop="editRepair(row)"><i class="fas fa-edit"></i><span>编辑</span></el-button>
                    <el-button v-if="canEdit" type="success" size="small" @click.stop="updateStatus(row)"><i class="fas fa-sync"></i><span>状态</span></el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <Pagination
            v-if="filteredRepairs.length > 0"
            v-model:current="currentPage"
            v-model:page-size="pageSize"
            :total="filteredRepairs.length"
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
        title="新建维修单"
        width="600px"
        dialog-class="repairs-dialog"
        :show-default-footer="false"
        :close-on-click-modal="false"
      >
        <el-form :model="formData" label-width="100px" :disabled="submitting">
          <el-form-item label="客户" required>
            <el-select v-model="formData.customer_id" placeholder="请选择客户" filterable>
              <el-option v-for="customer in customers" :key="customer.id" :label="`${customer.name} - ${customer.phone}`" :value="customer.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="手机品牌" required>
            <el-select v-model="formData.brand_id" placeholder="请选择品牌" @change="onBrandChange">
              <el-option v-for="brand in brands" :key="brand.id" :label="brand.name" :value="brand.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="手机型号" required><el-input v-model="formData.phone_model" placeholder="请输入手机型号" /></el-form-item>
          <el-form-item label="IMEI/序列号"><el-input v-model="formData.imei" placeholder="请输入IMEI或序列号" /></el-form-item>
          <el-form-item label="故障描述" required><el-input v-model="formData.problem_description" type="textarea" :rows="4" placeholder="请详细描述故障情况" /></el-form-item>
          <el-form-item label="预计费用"><el-input-number v-model="formData.estimated_cost" :min="0" :precision="2" :step="10" controls-position="right" /></el-form-item>
          <el-form-item label="维修员">
            <el-select v-model="formData.technician_id" placeholder="请选择维修员" clearable>
              <el-option v-for="technician in technicians" :key="technician.id" :label="technician.name" :value="technician.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="备注"><el-input v-model="formData.remarks" type="textarea" :rows="3" placeholder="其他备注信息" /></el-form-item>
        </el-form>
        <template #footer>
          <div class="modal-footer">
            <el-button type="info" @click="closeModal">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="handleSubmit">创建维修单</el-button>
          </div>
        </template>
      </MobileDialog>
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useLoadingState } from '@/composables'
import { fieldPermissions } from '@/composables/useFieldPermissions'
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

type RepairStatus = 'pending' | 'processing' | 'completed' | 'cancelled'

interface RepairItem {
  id: number
  order_no: string
  customer_id: number
  customer_name: string
  brand_id: number
  phone_model: string
  imei?: string
  problem_description: string
  estimated_cost: number
  actual_cost?: number
  status: RepairStatus
  technician_id?: number
  technician_name?: string
  remarks?: string
  created_at: string
  updated_at: string
}

interface CustomerOption { id: number; name: string; phone: string }
interface BrandOption { id: number; name: string }
interface TechnicianOption { id: number; name: string }

const { canView, canCreate, canEdit, handleNoPermission } = usePagePermissions('repairs')
const { success, error: notifyError, info } = useNotification()
const { isMobile } = useMobile()
const { loading } = useLoadingState()

const repairs = ref<RepairItem[]>([])
const customers = ref<CustomerOption[]>([])
const brands = ref<BrandOption[]>([])
const technicians = ref<TechnicianOption[]>([])
const showModal = ref(false)
const submitting = ref(false)
const refreshing = ref(false)
const searchQuery = ref('')
const searchExpanded = ref(false)
const activeTab = ref<'all' | RepairStatus>('all')
const currentPage = ref(1)
const pageSize = ref(20)
const mobileActionRowId = ref<string | null>(null)
const lastTappedRowId = ref<string | null>(null)
const lastTapTimestamp = ref(0)

const repairFieldMap: Record<string, string> = {
  stats_pending: 'stats.pending',
  stats_processing: 'stats.processing',
  stats_completed: 'stats.completed',
  stats_monthly_revenue: 'stats.monthly_revenue',
  actions: 'system_info.operations'
}

const canViewRepairField = (fieldName: string) => fieldPermissions.isFieldVisible(
  'repairs_repairsview',
  repairFieldMap[fieldName] || fieldName
)

const showStatsCards = computed(() => [
  'stats_pending', 'stats_processing', 'stats_completed', 'stats_monthly_revenue'
].some(canViewRepairField))

const showActionField = computed(() => !isMobile.value && canViewRepairField('actions'))

const stats = ref({ pending: 0, processing: 0, completed: 0, monthlyRevenue: '0' })

const statusTabs: Array<{ key: 'all' | RepairStatus; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待维修' },
  { key: 'processing', label: '维修中' },
  { key: 'completed', label: '已完成' }
]

const formData = reactive({
  customer_id: null as number | null,
  brand_id: null as number | null,
  phone_model: '',
  imei: '',
  problem_description: '',
  estimated_cost: 0,
  technician_id: null as number | null,
  remarks: ''
})

const filteredRepairs = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  return repairs.value.filter(repair => {
    if (activeTab.value !== 'all' && repair.status !== activeTab.value) return false
    if (!keyword) return true
    return [repair.customer_name, repair.phone_model, repair.order_no]
      .some(value => value.toLowerCase().includes(keyword))
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRepairs.value.length / pageSize.value)))
const paginatedRepairs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRepairs.value.slice(start, start + pageSize.value)
})

const repairNumberColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['维修单号', ...paginatedRepairs.value.map(repair => repair.order_no)],
  { minWidth: 132, horizontalPadding: 30 }
))
const customerColumnWidth = computed(() => getTextColumnMinWidth(
  ['客户', ...paginatedRepairs.value.map(repair => repair.customer_name)],
  { minWidth: isMobile.value ? 84 : 96, horizontalPadding: 28 }
))
const modelColumnWidth = computed(() => getTextColumnMinWidth(
  ['手机型号', ...paginatedRepairs.value.map(repair => repair.phone_model)],
  { minWidth: isMobile.value ? 116 : 132, horizontalPadding: 28 }
))

const getRepairRowKey = (repair: RepairItem) => String(repair.id)

const getStatusText = (status: RepairStatus) => ({
  pending: '待维修', processing: '维修中', completed: '已完成', cancelled: '已取消'
}[status])

const loadRepairs = async () => {
  loading.value = true
  try {
    repairs.value = [
      {
        id: 1, order_no: 'RX20251122001', customer_id: 1, customer_name: '张三', brand_id: 1,
        phone_model: 'iPhone 15 Pro', imei: '35 12345678901234', problem_description: '屏幕碎裂，触摸失灵',
        estimated_cost: 1200, status: 'pending', technician_id: 2, technician_name: '李师傅',
        remarks: '客户同意更换屏幕总成', created_at: '2025-11-22T09:30:00Z', updated_at: '2025-11-22T09:30:00Z'
      },
      {
        id: 2, order_no: 'RX20251122002', customer_id: 2, customer_name: '李四', brand_id: 2,
        phone_model: '华为Mate 60 Pro', problem_description: '电池不耐用，需要更换电池', estimated_cost: 300,
        actual_cost: 280, status: 'processing', technician_id: 3, technician_name: '王师傅',
        created_at: '2025-11-21T14:20:00Z', updated_at: '2025-11-22T10:15:00Z'
      }
    ]
    stats.value = {
      pending: repairs.value.filter(repair => repair.status === 'pending').length,
      processing: repairs.value.filter(repair => repair.status === 'processing').length,
      completed: repairs.value.filter(repair => repair.status === 'completed').length,
      monthlyRevenue: '8,560'
    }
  } catch (err) {
    logger.error('加载维修数据失败:', err)
    repairs.value = []
  } finally {
    loading.value = false
  }
}

const loadCustomers = async () => { customers.value = [{ id: 1, name: '张三', phone: '13800138001' }, { id: 2, name: '李四', phone: '13800138002' }] }
const loadBrands = async () => { brands.value = [{ id: 1, name: 'Apple' }, { id: 2, name: '华为' }, { id: 3, name: '小米' }] }
const loadTechnicians = async () => { technicians.value = [{ id: 2, name: '李师傅' }, { id: 3, name: '王师傅' }] }

const resetForm = () => Object.assign(formData, {
  customer_id: null, brand_id: null, phone_model: '', imei: '', problem_description: '',
  estimated_cost: 0, technician_id: null, remarks: ''
})

const showAddModal = () => {
  if (!canCreate.value) return handleNoPermission('create')
  resetForm()
  showModal.value = true
}

const closeModal = () => { showModal.value = false; resetForm() }
const onBrandChange = () => undefined

const handleSubmit = async () => {
  if (submitting.value) return
  if (!canCreate.value) return handleNoPermission('create')
  if (!formData.customer_id || !formData.brand_id || !formData.phone_model || !formData.problem_description) {
    notifyError('请完整填写必填项')
    return
  }
  submitting.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    await loadRepairs()
    closeModal()
    success('维修单创建成功')
  } catch (err) {
    logger.error('创建维修单失败:', err)
    notifyError('创建维修单失败')
  } finally {
    submitting.value = false
  }
}

const viewRepair = (repair: RepairItem) => info(`维修单 ${repair.order_no} 详情功能待接入`)
const editRepair = (repair: RepairItem) => {
  if (!canEdit.value) return handleNoPermission('edit')
  info(`维修单 ${repair.order_no} 编辑功能待接入`)
}
const updateStatus = (repair: RepairItem) => {
  if (!canEdit.value) return handleNoPermission('edit')
  info(`维修单 ${repair.order_no} 状态更新功能待接入`)
}

const refreshData = async () => {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([loadRepairs(), loadCustomers(), loadBrands(), loadTechnicians()])
    success('数据刷新成功')
  } catch (err) {
    logger.error('刷新维修数据失败:', err)
    notifyError('数据刷新失败')
  } finally {
    refreshing.value = false
  }
}

const handleSearch = () => { currentPage.value = 1; mobileActionRowId.value = null }
const handleReset = () => { searchQuery.value = ''; activeTab.value = 'all'; handleSearch() }
const handlePaginationChange = (page: number, newPageSize: number) => {
  currentPage.value = page
  pageSize.value = newPageSize
  mobileActionRowId.value = null
}

const toggleMobileActions = (rowId: string) => {
  if (!isMobile.value) return
  mobileActionRowId.value = mobileActionRowId.value === rowId ? null : rowId
}

const handleRepairRowClick = (repair: RepairItem, _column: unknown, event: Event) => {
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
const formatDate = (date: string) => new Date(date).toLocaleString('zh-CN')

watch([filteredRepairs, pageSize], () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

onMounted(async () => {
  if (!canView.value) return
  await fieldPermissions.init()
  await Promise.all([loadRepairs(), loadCustomers(), loadBrands(), loadTechnicians()])
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
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.status-processing {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.status-completed {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.status-cancelled {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
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
