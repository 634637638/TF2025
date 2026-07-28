<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="rentals"
    module-name="租赁管理"
    permission-code="rentals:view"
  >

  <div class="rentals-view admin-page">
    <PageHeader title="租赁管理" description="设备租赁服务和合同管理" />

    <div class="rentals-content admin-page-content">
      <el-card class="admin-panel admin-table-panel">
        <template #header>
          <div class="flex justify-between items-center">
            <h3>租赁合同列表</h3>
            <el-button v-if="canCreate" type="primary" @click="handleAdd">
              <i class="fas fa-plus"></i> 新建租赁合同
            </el-button>
          </div>
        </template>

        <UnifiedSearchPanel
          v-model:expanded="searchExpanded"
          :loading="loading"
          @search="handleSearch"
          @reset="resetSearch"
        >
          <template #primary>
            <el-input
              v-model="searchForm.customerName"
              placeholder="搜索关键词"
              clearable
              @keyup.enter="handleSearch"
              @click.stop
            >
              <template #prefix>
                <i class="fas fa-search"></i>
              </template>
            </el-input>
          </template>

          <div class="form-group filter-item" data-field="deviceType">
            <el-select v-model="searchForm.deviceType" placeholder="设备类型" clearable @change="handleSearch">
              <el-option label="手机" value="phone" />
              <el-option label="平板" value="tablet" />
              <el-option label="笔记本" value="laptop" />
              <el-option label="配件" value="accessory" />
            </el-select>
          </div>

          <div class="form-group filter-item" data-field="status">
            <el-select v-model="searchForm.status" placeholder="合同状态" clearable @change="handleSearch">
              <el-option label="进行中" value="active" />
              <el-option label="已到期" value="expired" />
              <el-option label="已终止" value="terminated" />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <el-table class="data-table"
          :data="loading ? [] : displayTableData"
          stripe
          style="width: 100%"
        >
          <template #empty>
            <TableLoadingRow v-if="loading" mode="block" text="加载中..." />
            <el-empty v-else description="暂无租赁合同" />
          </template>

          <el-table-column prop="id" label="合同编号" width="100" />
          <el-table-column prop="customerName" label="客户姓名" />
          <el-table-column prop="deviceName" label="租赁设备" />
          <el-table-column prop="deviceType" label="设备类型" width="100">
            <template #default="{ row }">
              <el-tag :type="getDeviceTypeTagType(row.deviceType)">
                {{ getDeviceTypeName(row.deviceType) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="monthlyRent" label="月租金" width="120">
            <template #default="{ row }">
              ￥{{ row.monthlyRent }}
            </template>
          </el-table-column>
          <el-table-column prop="startDate" label="开始日期" width="120" />
          <el-table-column prop="endDate" label="结束日期" width="120" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)">
                {{ getStatusName(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="deposit" label="押金" width="100">
            <template #default="{ row }">
              ￥{{ row.deposit }}
            </template>
          </el-table-column>
        <el-table-column label="操作" :width="$getActionColumnWidth(1 + (Number(canEdit) * 2))" class-name="actions-column">
            <template #default="{ row }">
              <div class="action-buttons">
              <el-button size="small" @click.stop="handleView(row)">查看</el-button>
              <el-button v-if="canEdit" size="small" type="primary" @click.stop="handleEdit(row)">编辑</el-button>
              <el-button
                v-if="canEdit"
                size="small"
                :type="row.status === 'active' ? 'warning' : 'success'"
                @click.stop="handleStatusChange(row)"
              >
                {{ row.status === 'active' ? '终止' : '续租' }}
              </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrapper">
          <Pagination
            v-model:current="pagination.page"
            v-model:page-size="pagination.size"
            :total="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            :show-range="true"
          />
        </div>
      </el-card>

      <!-- 统计卡片 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-item">
              <div class="stat-value">{{ stats.activeContracts }}</div>
              <div class="stat-label">进行中合同</div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-item">
              <div class="stat-value">￥{{ stats.monthlyRevenue }}</div>
              <div class="stat-label">月收入</div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-item">
              <div class="stat-value">{{ stats.totalDevices }}</div>
              <div class="stat-label">租赁设备数</div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-item">
              <div class="stat-value">￥{{ stats.totalDeposits }}</div>
              <div class="stat-label">押金总额</div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <el-dialog
      v-model="viewDialogVisible"
      title="租赁合同详情"
      width="560px"
    >
      <el-descriptions v-if="selectedRental" :column="1" border>
        <el-descriptions-item label="合同编号">{{ selectedRental.id }}</el-descriptions-item>
        <el-descriptions-item label="客户姓名">{{ selectedRental.customerName }}</el-descriptions-item>
        <el-descriptions-item label="租赁设备">{{ selectedRental.deviceName }}</el-descriptions-item>
        <el-descriptions-item label="设备类型">{{ getDeviceTypeName(selectedRental.deviceType) }}</el-descriptions-item>
        <el-descriptions-item label="月租金">￥{{ selectedRental.monthlyRent }}</el-descriptions-item>
        <el-descriptions-item label="押金">￥{{ selectedRental.deposit }}</el-descriptions-item>
        <el-descriptions-item label="租期">{{ selectedRental.startDate }} 至 {{ selectedRental.endDate }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusTagType(selectedRental.status)">
            {{ getStatusName(selectedRental.status) }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editDialogVisible"
      :title="isCreating ? '新建租赁合同' : '编辑租赁合同'"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form :model="rentalForm" label-width="96px">
        <el-form-item label="合同编号">
          <el-input v-model="rentalForm.id" :disabled="!isCreating" />
        </el-form-item>
        <el-form-item label="客户姓名">
          <el-input v-model="rentalForm.customerName" />
        </el-form-item>
        <el-form-item label="租赁设备">
          <el-input v-model="rentalForm.deviceName" />
        </el-form-item>
        <el-form-item label="设备类型">
          <el-select v-model="rentalForm.deviceType" style="width: 100%">
            <el-option label="手机" value="phone" />
            <el-option label="平板" value="tablet" />
            <el-option label="笔记本" value="laptop" />
            <el-option label="配件" value="accessory" />
          </el-select>
        </el-form-item>
        <el-form-item label="月租金">
          <el-input-number v-model="rentalForm.monthlyRent" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="押金">
          <el-input-number v-model="rentalForm.deposit" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="rentalForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束日期">
          <el-date-picker v-model="rentalForm.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="合同状态">
          <el-select v-model="rentalForm.status" style="width: 100%">
            <el-option label="进行中" value="active" />
            <el-option label="已到期" value="expired" />
            <el-option label="已终止" value="terminated" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRental">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import { PageHeader, PermissionGate } from '@/components/base'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'

const { canView, canCreate, canEdit, handleNoPermission } = usePagePermissions('rentals')

const { loading } = useLoadingState()

type RentalStatus = 'active' | 'expired' | 'terminated'
type DeviceType = 'phone' | 'tablet' | 'laptop' | 'accessory'

interface RentalContract {
  id: string
  customerName: string
  deviceName: string
  deviceType: DeviceType
  monthlyRent: number
  startDate: string
  endDate: string
  status: RentalStatus
  deposit: number
}

// 搜索相关状态
const searchExpanded = ref(false)
const searchForm = reactive({
  customerName: '',
  deviceType: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

const stats = reactive({
  activeContracts: 28,
  monthlyRevenue: 15600,
  totalDevices: 45,
  totalDeposits: 89000
})

const tableData = ref<RentalContract[]>([
  {
    id: 'RZ2024001',
    customerName: '张三',
    deviceName: 'iPhone 15 Pro',
    deviceType: 'phone',
    monthlyRent: 299,
    startDate: '2024-01-01',
    endDate: '2024-06-01',
    status: 'active',
    deposit: 1000
  },
  {
    id: 'RZ2024002',
    customerName: '李四',
    deviceName: 'MacBook Pro 14',
    deviceType: 'laptop',
    monthlyRent: 599,
    startDate: '2023-12-15',
    endDate: '2024-12-15',
    status: 'active',
    deposit: 3000
  },
  {
    id: 'RZ2024003',
    customerName: '王五',
    deviceName: 'iPad Air',
    deviceType: 'tablet',
    monthlyRent: 199,
    startDate: '2023-10-01',
    endDate: '2024-01-01',
    status: 'expired',
    deposit: 800
  },
  {
    id: 'RZ2024004',
    customerName: '赵六',
    deviceName: 'AirPods Pro',
    deviceType: 'accessory',
    monthlyRent: 99,
    startDate: '2024-01-10',
    endDate: '2024-04-10',
    status: 'active',
    deposit: 300
  }
])

const emptyRentalForm = (): RentalContract => ({
  id: `RZ${Date.now().toString().slice(-8)}`,
  customerName: '',
  deviceName: '',
  deviceType: 'phone',
  monthlyRent: 0,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: addMonths(new Date().toISOString().slice(0, 10), 6),
  status: 'active',
  deposit: 0
})

const viewDialogVisible = ref(false)
const editDialogVisible = ref(false)
const isCreating = ref(false)
const selectedRental = ref<RentalContract | null>(null)
const rentalForm = reactive<RentalContract>(emptyRentalForm())

const filteredTableData = computed(() => {
  const keyword = searchForm.customerName.trim().toLowerCase()

  return tableData.value.filter((item) => {
    const matchKeyword = !keyword || [
      item.id,
      item.customerName,
      item.deviceName
    ].some(value => String(value || '').toLowerCase().includes(keyword))

    const matchDeviceType = !searchForm.deviceType || item.deviceType === searchForm.deviceType
    const matchStatus = !searchForm.status || item.status === searchForm.status

    return matchKeyword && matchDeviceType && matchStatus
  })
})

const displayTableData = computed(() => filteredTableData.value)

const getDeviceTypeName = (type: string) => {
  const typeMap: Record<string, string> = {
    phone: '手机',
    tablet: '平板',
    laptop: '笔记本',
    accessory: '配件'
  }
  return typeMap[type] || type
}

const getDeviceTypeTagType = (type: string) => {
  const typeMap: Record<string, string> = {
    phone: 'primary',
    tablet: 'success',
    laptop: 'warning',
    accessory: 'info'
  }
  return typeMap[type] || ''
}

const getStatusName = (status: string) => {
  const statusMap: Record<string, string> = {
    active: '进行中',
    expired: '已到期',
    terminated: '已终止'
  }
  return statusMap[status] || status
}

const getStatusTagType = (status: string) => {
  const typeMap: Record<string, string> = {
    active: 'success',
    expired: 'warning',
    terminated: 'danger'
  }
  return typeMap[status] || ''
}

const handleAdd = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  isCreating.value = true
  Object.assign(rentalForm, emptyRentalForm())
  editDialogVisible.value = true
}

const handleView = (row: RentalContract) => {
  selectedRental.value = { ...row }
  viewDialogVisible.value = true
}

const handleEdit = (row: RentalContract) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  isCreating.value = false
  Object.assign(rentalForm, { ...row })
  editDialogVisible.value = true
}

const handleStatusChange = async (row: RentalContract) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  const isActive = row.status === 'active'
  const actionText = isActive ? '终止' : '续租'
  const message = isActive
    ? `确定要终止合同 ${row.id} 吗？`
    : `确定要续租合同 ${row.id} 吗？续租后状态将改为进行中，并自动延长 6 个月。`

  try {
    await ElMessageBox.confirm(message, `${actionText}确认`, {
      confirmButtonText: actionText,
      cancelButtonText: '取消',
      type: isActive ? 'warning' : 'success'
    })

    row.status = isActive ? 'terminated' : 'active'
    if (!isActive) {
      row.startDate = new Date().toISOString().slice(0, 10)
      row.endDate = addMonths(row.startDate, 6)
    }

    updateStats()
    handleSearch()
    ElMessage.success(`${actionText}成功`)
  } catch {
    // 用户取消，不需要提示
  }
}

const handleSaveRental = () => {
  if (!rentalForm.id.trim() || !rentalForm.customerName.trim() || !rentalForm.deviceName.trim()) {
    ElMessage.warning('请填写合同编号、客户姓名和租赁设备')
    return
  }

  const payload: RentalContract = {
    ...rentalForm,
    monthlyRent: Number(rentalForm.monthlyRent || 0),
    deposit: Number(rentalForm.deposit || 0)
  }

  if (isCreating.value) {
    if (tableData.value.some(item => item.id === payload.id)) {
      ElMessage.warning('合同编号已存在')
      return
    }
    tableData.value.unshift(payload)
  } else {
    const index = tableData.value.findIndex(item => item.id === payload.id)
    if (index !== -1) {
      tableData.value[index] = payload
    }
  }

  editDialogVisible.value = false
  updateStats()
  handleSearch()
  ElMessage.success(isCreating.value ? '新建成功' : '保存成功')
}

const handleSearch = () => {
  pagination.page = 1
  pagination.total = filteredTableData.value.length
}

const resetSearch = () => {
  searchForm.customerName = ''
  searchForm.deviceType = ''
  searchForm.status = ''
  handleSearch()
}

onMounted(() => {
  if (!canView.value) {
    return
  }

  updateStats()
  pagination.total = filteredTableData.value.length
})

function addMonths(dateString: string, months: number): string {
  const date = new Date(dateString)
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

function updateStats() {
  const activeContracts = tableData.value.filter(item => item.status === 'active')
  stats.activeContracts = activeContracts.length
  stats.monthlyRevenue = activeContracts.reduce((sum, item) => sum + Number(item.monthlyRent || 0), 0)
  stats.totalDevices = activeContracts.length
  stats.totalDeposits = tableData.value.reduce((sum, item) => sum + Number(item.deposit || 0), 0)
}
</script>

<style scoped>
.rentals-view {
  padding: 20px;
}

.rentals-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pagination-wrapper {
  margin-top: 20px;
  text-align: right;
}

.stats-row {
  margin-top: 20px;
}

.stat-card {
  text-align: center;
}

.stat-item {
  padding: 16px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 8px;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.flex {
  display: flex;
}

.justify-between {
  justify-content: space-between;
}

.items-center {
  align-items: center;
}

.mb-4 {
  margin-bottom: 16px;
}

</style>
