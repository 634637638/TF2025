<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="rentals"
    module-name="租赁管理"
    permission-code="rentals:view"
  />

  <div v-else class="rentals-view admin-page">
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

        <el-table
          :data="displayTableData"
          v-loading="loading"
          stripe
          style="width: 100%"
        >
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
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button size="small" @click="handleView(row)">查看</el-button>
              <el-button v-if="canEdit" size="small" type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button
                v-if="canEdit"
                size="small"
                :type="row.status === 'active' ? 'warning' : 'success'"
                @click="handleStatusChange(row)"
              >
                {{ row.status === 'active' ? '终止' : '续租' }}
              </el-button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import { PageHeader, PermissionDenied } from '@/components/base'
import Pagination from '@/components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'

const { canView, canCreate, canEdit, handleNoPermission } = usePagePermissions('rentals')

const { loading } = useLoadingState()

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

const tableData = ref([
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
}

const handleView = (row: any) => {
}

const handleEdit = (row: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
}

const handleStatusChange = (row: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
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

  pagination.total = filteredTableData.value.length
})
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
