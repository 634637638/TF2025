<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="repairs"
    module-name="维修管理"
    permission-code="repairs:view"
  />

  <div v-else class="repairs-management">
    <PageHeader title="维修管理" description="管理手机维修记录和进度">
      <template #actions>
        <el-button v-if="canCreate" @click="showAddModal" type="primary">
          <i class="fas fa-plus"></i> 新建维修单
        </el-button>
        <el-button @click="refreshData" type="info">
          <i class="fas fa-refresh"></i> 刷新
        </el-button>
      </template>
    </PageHeader>

    <div class="toolbar">
      <div class="filter-tabs">
        <button 
          v-for="tab in statusTabs" 
          :key="tab.key"
          @click="activeTab = tab.key"
          :class="['tab-btn', { active: activeTab === tab.key }]"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="搜索客户、手机型号..." 
          class="form-control"
        />
      </div>
    </div>

    <!-- 维修统计 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewRepairField('stats_pending')" class="stat-card">
        <h3>待维修</h3>
        <p class="number pending">{{ stats.pending }}</p>
      </div>
      <div v-if="canViewRepairField('stats_processing')" class="stat-card">
        <h3>维修中</h3>
        <p class="number processing">{{ stats.processing }}</p>
      </div>
      <div v-if="canViewRepairField('stats_completed')" class="stat-card">
        <h3>已完成</h3>
        <p class="number completed">{{ stats.completed }}</p>
      </div>
      <div v-if="canViewRepairField('stats_monthly_revenue')" class="stat-card">
        <h3>本月收入</h3>
        <p class="amount">¥{{ stats.monthlyRevenue }}</p>
      </div>
    </div>

    <!-- 维修记录列表 -->
    <div class="repairs-table">
      <table>
        <thead>
          <tr>
            <th>维修单号</th>
            <th>客户</th>
            <th>手机型号</th>
            <th>故障描述</th>
            <th>预计费用</th>
            <th>维修状态</th>
            <th>维修员</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="repair in filteredRepairs" :key="repair.id">
            <td>{{ repair.order_no }}</td>
            <td class="customer">{{ repair.customer_name }}</td>
            <td>{{ repair.phone_model }}</td>
            <td class="description">{{ repair.problem_description }}</td>
            <td class="amount">¥{{ repair.estimated_cost }}</td>
            <td>
              <span class="status-badge" :class="repair.status">
                {{ getStatusText(repair.status) }}
              </span>
            </td>
            <td>{{ repair.technician_name || '-' }}</td>
            <td>{{ formatDate(repair.created_at) }}</td>
            <td>
              <el-button @click="viewRepair(repair)" type="primary" size="small" title="查看详情">
                <i class="fas fa-eye"></i>
              </el-button>
              <el-button v-if="canEdit" @click="editRepair(repair)" type="warning" size="small" title="编辑">
                <i class="fas fa-edit"></i>
              </el-button>
              <el-button v-if="canEdit" @click="updateStatus(repair)" type="success" size="small" title="更新状态">
                <i class="fas fa-sync"></i>
              </el-button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="filteredRepairs.length === 0" class="empty-state">
        <i class="fas fa-tools"></i>
        <p>暂无维修记录</p>
      </div>
    </div>

    <!-- 新建维修单模态框 -->
    <MobileDialog
      v-model="showModal"
      title="新建维修单"
      width="600px"
      dialog-class="repairs-dialog"
      :show-default-footer="false"
      :close-on-click-modal="false"
    >
      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>客户 *</label>
            <select v-model="formData.customer_id" class="form-control" required>
              <option value="">请选择客户</option>
              <option v-for="customer in customers" :key="customer.id" :value="customer.id">
                {{ customer.name }} - {{ customer.phone }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>手机品牌 *</label>
            <select v-model="formData.brand_id" class="form-control" @change="onBrandChange" required>
              <option value="">请选择品牌</option>
              <option v-for="brand in brands" :key="brand.id" :value="brand.id">
                {{ brand.name }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>手机型号 *</label>
            <input 
              v-model="formData.phone_model" 
              type="text" 
              class="form-control" 
              required
              placeholder="请输入手机型号"
            />
          </div>

          <div class="form-group">
            <label>IMEI/序列号</label>
            <input 
              v-model="formData.imei" 
              type="text" 
              class="form-control" 
              placeholder="请输入IMEI或序列号"
            />
          </div>

          <div class="form-group">
            <label>故障描述 *</label>
            <textarea 
              v-model="formData.problem_description" 
              class="form-control" 
              rows="4"
              required
              placeholder="请详细描述故障情况"
            ></textarea>
          </div>

          <div class="form-group">
            <label>预计费用</label>
            <input 
              v-model.number="formData.estimated_cost" 
              type="number" 
              class="form-control" 
              step="0.01" 
              min="0"
              placeholder="预计维修费用"
            />
          </div>

          <div class="form-group">
            <label>维修员</label>
            <select v-model="formData.technician_id" class="form-control">
              <option value="">请选择维修员</option>
              <option v-for="technician in technicians" :key="technician.id" :value="technician.id">
                {{ technician.name }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>备注</label>
            <textarea 
              v-model="formData.remarks" 
              class="form-control" 
              rows="3"
              placeholder="其他备注信息"
            ></textarea>
          </div>
        </form>
      </div>

      <template #footer>
        <div class="modal-footer">
          <el-button @click="closeModal" type="info">取消</el-button>
          <el-button @click="handleSubmit" type="primary" :disabled="submitting">
            {{ submitting ? '提交中...' : '创建维修单' }}
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { PageHeader, PermissionDenied } from '@/components/base'
import type { RepairOrder } from '@/types/repair'
import type { Customer } from '@/types/order'
import type { Brand, Technician } from '@/types'

const { canView, canCreate, canEdit, handleNoPermission } = usePagePermissions('repairs')

// 维修单别名
type Repair = RepairOrder

const repairs = ref<Repair[]>([])
const customers = ref<Customer[]>([])
const brands = ref<Brand[]>([])
const technicians = ref<Technician[]>([])
const showModal = ref(false)
const submitting = ref(false)
const searchQuery = ref('')
const activeTab = ref('all')

const repairFieldMap: Record<string, string> = {
  stats_pending: 'stats.pending',
  stats_processing: 'stats.processing',
  stats_completed: 'stats.completed',
  stats_monthly_revenue: 'stats.monthly_revenue',
  actions: 'system_info.operations'
}

const getRepairFieldKey = (fieldName: string) => repairFieldMap[fieldName] || fieldName
const canViewRepairField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('repairs_repairsview', getRepairFieldKey(fieldName))
}

const showStatsCards = computed(() => (
  canViewRepairField('stats_pending') ||
  canViewRepairField('stats_processing') ||
  canViewRepairField('stats_completed') ||
  canViewRepairField('stats_monthly_revenue')
))

const stats = ref({
  pending: 0,
  processing: 0,
  completed: 0,
  monthlyRevenue: '0'
})

const statusTabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待维修' },
  { key: 'processing', label: '维修中' },
  { key: 'completed', label: '已完成' }
]

const formData = reactive({
  customer_id: '',
  brand_id: '',
  phone_model: '',
  imei: '',
  problem_description: '',
  estimated_cost: 0,
  technician_id: '',
  remarks: ''
})

const filteredRepairs = computed(() => {
  let filtered = repairs.value

  // 按状态过滤
  if (activeTab.value !== 'all') {
    filtered = filtered.filter(repair => repair.status === activeTab.value)
  }

  // 按搜索词过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(repair => 
      repair.customer_name.toLowerCase().includes(query) ||
      repair.phone_model.toLowerCase().includes(query) ||
      repair.order_no.toLowerCase().includes(query)
    )
  }

  return filtered
})

const getStatusText = (status: string) => {
  const statusMap = {
    'pending': '待维修',
    'processing': '维修中',
    'completed': '已完成',
    'cancelled': '已取消'
  }
  return statusMap[status] || status
}

const loadRepairs = async () => {
  try {
    // 模拟数据
    repairs.value = [
      {
        id: 1,
        order_no: 'RX20251122001',
        customer_id: 1,
        customer_name: '张三',
        brand_id: 1,
        phone_model: 'iPhone 15 Pro',
        imei: '35 12345678901234',
        problem_description: '屏幕碎裂，触摸失灵',
        estimated_cost: 1200,
        status: 'pending',
        technician_id: 2,
        technician_name: '李师傅',
        remarks: '客户同意更换屏幕总成',
        created_at: '2025-11-22T09:30:00Z',
        updated_at: '2025-11-22T09:30:00Z'
      },
      {
        id: 2,
        order_no: 'RX20251122002',
        customer_id: 2,
        customer_name: '李四',
        brand_id: 2,
        phone_model: '华为Mate 60 Pro',
        problem_description: '电池不耐用，需要更换电池',
        estimated_cost: 300,
        actual_cost: 280,
        status: 'processing',
        technician_id: 3,
        technician_name: '王师傅',
        created_at: '2025-11-21T14:20:00Z',
        updated_at: '2025-11-22T10:15:00Z'
      }
    ]

    // 计算统计数据
    stats.value = {
      pending: repairs.value.filter(r => r.status === 'pending').length,
      processing: repairs.value.filter(r => r.status === 'processing').length,
      completed: repairs.value.filter(r => r.status === 'completed').length,
      monthlyRevenue: '8,560'
    }
  } catch (error) {
    logger.error('加载维修数据失败:', error)
  }
}

const loadCustomers = async () => {
  try {
    customers.value = [
      { id: 1, name: '张三', phone: '13800138001' },
      { id: 2, name: '李四', phone: '13800138002' }
    ]
  } catch (error) {
    logger.error('加载客户数据失败:', error)
  }
}

const loadBrands = async () => {
  try {
    brands.value = [
      { id: 1, name: 'Apple' },
      { id: 2, name: '华为' },
      { id: 3, name: '小米' }
    ]
  } catch (error) {
    logger.error('加载品牌数据失败:', error)
  }
}

const loadTechnicians = async () => {
  try {
    technicians.value = [
      { id: 2, name: '李师傅' },
      { id: 3, name: '王师傅' }
    ]
  } catch (error) {
    logger.error('加载维修员数据失败:', error)
  }
}

const showAddModal = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  resetForm()
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  resetForm()
}

const resetForm = () => {
  Object.assign(formData, {
    customer_id: '',
    brand_id: '',
    phone_model: '',
    imei: '',
    problem_description: '',
    estimated_cost: 0,
    technician_id: '',
    remarks: ''
  })
}

const onBrandChange = () => {
  // 根据品牌设置默认型号
  const brand = brands.value.find(b => b.id === formData.brand_id)
  if (brand) {
    // 这里可以根据品牌预填充一些常见型号
  }
}

const handleSubmit = async () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  submitting.value = true

  try {
    await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟API调用

    await loadRepairs()
    closeModal()
  } catch (error) {
    logger.error('创建维修单失败:', error)
  } finally {
    submitting.value = false
  }
}

const viewRepair = (repair: Repair) => {
}

const editRepair = (repair: Repair) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
}

const updateStatus = (repair: Repair) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
}

const refreshData = () => {
  loadRepairs()
  loadCustomers()
  loadBrands()
  loadTechnicians()
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(async () => {
  if (!canView.value) {
    return
  }

  await fieldPermissions.init()
  loadRepairs()
  loadCustomers()
  loadBrands()
  loadTechnicians()
})
</script>

<style scoped>
.repairs-management {
  padding: 20px;
}

.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 5px;
  background: #f8f9fa;
  padding: 4px;
  border-radius: 6px;
}

.tab-btn {
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.tab-btn.active {
  background: white;
  color: #007bff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.search-box {
  margin-left: auto;
}

.search-box .form-control {
  width: 250px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #666;
}

.stat-card .number {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.stat-card .number.pending {
  color: #ffc107;
}

.stat-card .number.processing {
  color: #17a2b8;
}

.stat-card .number.completed {
  color: #28a745;
}

.stat-card .amount {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #007bff;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-warning {
  background: #ffc107;
  color: #212529;
}

.btn-success {
  background: #28a745;
  color: white;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.repairs-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.repairs-table table {
  width: 100%;
  border-collapse: separate;  border-spacing: 0;
}

.repairs-table th,
.repairs-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.repairs-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
}

.repairs-table .customer {
  font-weight: 600;
  color: #333;
}

.repairs-table .description {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.repairs-table .amount {
  font-weight: 600;
  color: #28a745;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.status-badge.processing {
  background: #cce7ff;
  color: #0066cc;
}

.status-badge.completed {
  background: #d4edda;
  color: #155724;
}

.status-badge.cancelled {
  background: #f8d7da;
  color: #721c24;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #7f8c8d;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.modal-body {
  padding: 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
}

.modal-footer {
  padding: 0;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 767px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box {
    margin-left: 0;
    margin-top: 10px;
  }
  
  .search-box .form-control {
    width: 100%;
  }
}
</style>
