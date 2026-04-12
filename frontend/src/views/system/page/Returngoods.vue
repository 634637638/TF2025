<template>
  <div class="returngoods-page">
    <div class="returngoods-overview">
      <div class="overview-card">
        <div class="overview-icon primary">
          <i class="fas fa-undo-alt"></i>
        </div>
        <div class="overview-content">
          <div class="overview-value">{{ stats.total_records }}</div>
          <div class="overview-label">退库总数</div>
        </div>
      </div>
      <div class="overview-card">
        <div class="overview-icon success">
          <i class="fas fa-mobile-alt"></i>
        </div>
        <div class="overview-content">
          <div class="overview-value">{{ stats.total_phones }}</div>
          <div class="overview-label">设备数量</div>
        </div>
      </div>
      <div class="overview-card">
        <div class="overview-icon warning">
          <i class="fas fa-calendar-alt"></i>
        </div>
        <div class="overview-content">
          <div class="overview-value">{{ stats.total_days }}</div>
          <div class="overview-label">涉及天数</div>
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
          v-model="searchForm.keyword"
          placeholder="搜索IMEI、型号、客户、备注"
          clearable
          @keyup.enter="handleSearch"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div class="filter-item">
        <el-date-picker
          v-model="searchForm.start_date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="开始日期"
          clearable
        />
      </div>

      <div class="filter-item">
        <el-date-picker
          v-model="searchForm.end_date"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="结束日期"
          clearable
        />
      </div>
    </UnifiedSearchPanel>

    <div class="returngoods-table-panel admin-panel admin-table-panel">
      <div class="panel-header">
        <div class="panel-title">
          <i class="fas fa-clipboard-list"></i>
          <span>退库记录</span>
        </div>
        <el-button type="info" plain @click="loadRecords" :disabled="loading">
          <i :class="loading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
          <span>刷新</span>
        </el-button>
      </div>

      <div v-if="!isMobile" class="table-wrapper">
        <el-table :data="records" border stripe v-loading="loading" style="width: 100%">
          <el-table-column prop="phone_id" label="设备ID" width="88" align="center" />
          <el-table-column label="商品信息" min-width="250">
            <template #default="{ row }">
              <div class="product-cell">
                <div class="product-name">
                  {{ [row.brand, row.model, row.color, row.memory].filter(Boolean).join(' ') || '-' }}
                </div>
                <div class="product-meta">
                  IMEI：{{ row.imei || '-' }}
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="customer_name" label="客户" min-width="120" />
          <el-table-column prop="operator_name" label="操作员" min-width="100" />
          <el-table-column prop="original_sale_id" label="原销售ID" width="100" align="center" />
          <el-table-column label="销售类型" min-width="100">
            <template #default="{ row }">
              {{ getSaleTypeText(row.original_sale_type) }}
            </template>
          </el-table-column>
          <el-table-column prop="original_sale_operator_name" label="销售员" min-width="110" />
          <el-table-column label="退库时间" min-width="168">
            <template #default="{ row }">
              {{ formatDateTime(row.reversal_date) }}
            </template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="220" show-overflow-tooltip />
          <el-table-column v-if="canEdit || canDelete" label="操作" width="180" align="center">
            <template #default="{ row }">
              <div class="table-actions">
                <el-button
                  v-if="canEdit"
                  type="primary"
                  link
                  @click="openEditDialog(row)"
                >
                  编辑
                </el-button>
                <el-button
                  v-if="canDelete"
                  type="danger"
                  link
                  @click="handleDelete(row)"
                >
                  删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-else class="mobile-records" v-loading="loading">
        <div v-if="records.length === 0 && !loading" class="empty-state">
          <i class="fas fa-inbox"></i>
          <span>暂无退库记录</span>
        </div>
        <div
          v-for="record in records"
          :key="record.id"
          class="record-card"
        >
          <div class="record-card-header">
            <div class="record-title">
              {{ [record.brand, record.model, record.color, record.memory].filter(Boolean).join(' ') || '未识别设备' }}
            </div>
            <div class="record-time">{{ formatDateTime(record.reversal_date) }}</div>
          </div>

          <div class="record-grid">
            <div class="record-item">
              <span class="record-label">设备ID</span>
              <span class="record-value">{{ record.phone_id || '-' }}</span>
            </div>
            <div class="record-item">
              <span class="record-label">原销售ID</span>
              <span class="record-value">{{ record.original_sale_id || '-' }}</span>
            </div>
            <div class="record-item">
              <span class="record-label">销售类型</span>
              <span class="record-value">{{ getSaleTypeText(record.original_sale_type) }}</span>
            </div>
            <div class="record-item">
              <span class="record-label">IMEI</span>
              <span class="record-value">{{ record.imei || '-' }}</span>
            </div>
            <div class="record-item">
              <span class="record-label">销售员</span>
              <span class="record-value">{{ record.original_sale_operator_name || '-' }}</span>
            </div>
            <div class="record-item">
              <span class="record-label">客户</span>
              <span class="record-value">{{ record.customer_name || '-' }}</span>
            </div>
            <div class="record-item">
              <span class="record-label">操作员</span>
              <span class="record-value">{{ record.operator_name || '-' }}</span>
            </div>
            <div class="record-item">
              <span class="record-label">手机号</span>
              <span class="record-value">{{ record.customer_phone || '-' }}</span>
            </div>
          </div>

          <div class="record-remark" v-if="record.remarks">
            <span class="record-label">备注</span>
            <span class="record-remark-text">{{ record.remarks }}</span>
          </div>

          <div v-if="canEdit || canDelete" class="mobile-actions">
            <el-button
              v-if="canEdit"
              type="primary"
              plain
              size="small"
              @click="openEditDialog(record)"
            >
              <i class="fas fa-edit"></i>
              <span>编辑</span>
            </el-button>
            <el-button
              v-if="canDelete"
              type="danger"
              plain
              size="small"
              @click="handleDelete(record)"
            >
              <i class="fas fa-trash"></i>
              <span>删除</span>
            </el-button>
          </div>
        </div>
      </div>

      <div class="pagination-wrapper">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :current-page="pagination.page"
          :page-size="pagination.limit"
          :total="pagination.total"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <MobileDialog
      v-model="editDialogVisible"
      title="编辑退库记录"
      width="620px"
      :close-on-click-modal="false"
      dialog-class="returngoods-edit-dialog"
      :show-default-footer="false"
    >
      <div class="edit-dialog-body">
        <div class="edit-grid">
          <div class="edit-item">
            <label>原销售ID</label>
            <el-input v-model="editForm.original_sale_id_display" disabled />
          </div>
          <div class="edit-item">
            <label>销售类型</label>
            <el-select v-model="editForm.original_sale_type" placeholder="请选择销售类型" clearable>
              <el-option
                v-for="option in PHONE_STATUS_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>
          <div class="edit-item">
            <label>销售员</label>
            <el-select
              v-model="editForm.original_sale_operator_id"
              placeholder="请选择销售员"
              filterable
              clearable
              @change="handleOperatorChange"
            >
              <el-option
                v-for="operator in operatorOptions"
                :key="operator.id"
                :label="operator.name"
                :value="operator.id"
              />
            </el-select>
          </div>
          <div class="edit-item">
            <label>退库时间</label>
            <el-date-picker
              v-model="editForm.reversal_date"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm"
              placeholder="请选择退库时间"
              clearable
              style="width: 100%;"
            />
          </div>
          <div class="edit-item edit-item-full">
            <label>备注</label>
            <el-input
              v-model="editForm.remarks"
              type="textarea"
              :rows="4"
              placeholder="请输入退库备注"
              clearable
            />
          </div>
        </div>
      </div>
      <template #footer>
        <div class="edit-dialog-footer">
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSave">
            保存
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { useMobile } from '@/composables/useMobile'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import MobileDialog from '@/components/MobileDialog.vue'
import { ElMessageBox } from 'element-plus'
import { PHONE_STATUS_OPTIONS, getPhoneStatusLabel, normalizePhoneStatus } from '@/constants/phoneStatuses'

interface ReturnGoodsRecord {
  id: number
  phone_id: number
  original_sale_id: number | null
  original_sale_type: string | null
  original_sale_operator_id: number | null
  original_sale_operator_name: string | null
  imei: string | null
  serial_number: string | null
  brand: string | null
  model: string | null
  color: string | null
  memory: string | null
  customer_name: string | null
  customer_phone: string | null
  operator_name: string | null
  reversal_date: string
  remarks: string | null
}

interface OperatorOption {
  id: number
  name: string
}

const { success, error } = useNotification()
const { isMobile } = useMobile()
const { canView, canEdit, canDelete } = usePagePermissions('returngoods')

const { loading } = useLoadingState()
const submitting = ref(false)
const searchExpanded = ref(false)
const editDialogVisible = ref(false)
const records = ref<ReturnGoodsRecord[]>([])
const operatorOptions = ref<OperatorOption[]>([])
const stats = reactive({
  total_records: 0,
  total_phones: 0,
  total_days: 0
})
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
})

const searchForm = reactive({
  keyword: '',
  start_date: '',
  end_date: ''
})

const editForm = reactive({
  id: 0,
  original_sale_id_display: '',
  original_sale_type: '',
  original_sale_operator_id: null as number | null,
  original_sale_operator_name: '',
  reversal_date: '',
  remarks: ''
})

const formatDateTime = (value?: string | null) => {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}`
}

const getSaleTypeText = (value?: string | null) => getPhoneStatusLabel(value)

const loadRecords = async () => {
  loading.value = true

  try {
    const response = await unifiedApi.get('/query/returngoods', {
      params: {
        page: pagination.page,
        limit: pagination.limit,
        keyword: searchForm.keyword || undefined,
        start_date: searchForm.start_date || undefined,
        end_date: searchForm.end_date || undefined
      }
    })

    if (!response?.success) {
      throw new Error(response?.message || '退库记录加载失败')
    }

    records.value = Array.isArray(response.data) ? response.data : []

    const meta = response.pagination || response.meta || {}
    pagination.total = Number(meta.total || 0)
    stats.total_records = Number(meta.stats?.total_records || 0)
    stats.total_phones = Number(meta.stats?.total_phones || 0)
    stats.total_days = Number(meta.stats?.total_days || 0)
  } catch (err: any) {
    records.value = []
    pagination.total = 0
    stats.total_records = 0
    stats.total_phones = 0
    stats.total_days = 0
    error(err?.response?.data?.message || err?.message || '退库记录加载失败')
  } finally {
    loading.value = false
  }
}

const loadOperators = async () => {
  try {
    const response = await unifiedApi.get('/users/operators')
    if (response?.success && Array.isArray(response.data)) {
      operatorOptions.value = response.data.map((item: any) => ({
        id: Number(item.id),
        name: item.name || item.username || `用户${item.id}`
      }))
    }
  } catch (err) {
    operatorOptions.value = []
  }
}

const openEditDialog = (record: ReturnGoodsRecord) => {
  editForm.id = record.id
  editForm.original_sale_id_display = record.original_sale_id ? String(record.original_sale_id) : '-'
  editForm.original_sale_type = normalizePhoneStatus(record.original_sale_type)
  editForm.original_sale_operator_id = record.original_sale_operator_id || null
  editForm.original_sale_operator_name = record.original_sale_operator_name || ''
  editForm.reversal_date = record.reversal_date || ''
  editForm.remarks = record.remarks || ''
  editDialogVisible.value = true
}

const handleOperatorChange = (operatorId: number | null) => {
  const matched = operatorOptions.value.find((item) => item.id === operatorId)
  if (matched) {
    editForm.original_sale_operator_name = matched.name
  }
}

const handleSave = async () => {
  if (!editForm.id) return

  submitting.value = true
  try {
    const response = await unifiedApi.put(`/query/returngoods/${editForm.id}`, {
      original_sale_type: editForm.original_sale_type || null,
      original_sale_operator_id: editForm.original_sale_operator_id || null,
      original_sale_operator_name: editForm.original_sale_operator_name || null,
      reversal_date: editForm.reversal_date || null,
      remarks: editForm.remarks || null
    })

    if (!response?.success) {
      throw new Error(response?.message || '退库记录更新失败')
    }

    editDialogVisible.value = false
    success('退库记录已更新')
    await loadRecords()
  } catch (err: any) {
    error(err?.response?.data?.message || err?.message || '退库记录更新失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (record: ReturnGoodsRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定删除退库记录 #${record.id} 吗？`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )
  } catch {
    return
  }

  try {
    const response = await unifiedApi.delete(`/query/returngoods/${record.id}`)
    if (!response?.success) {
      throw new Error(response?.message || '退库记录删除失败')
    }
    success('退库记录已删除')
    await loadRecords()
  } catch (err: any) {
    error(err?.response?.data?.message || err?.message || '退库记录删除失败')
  }
}

const handleSearch = async () => {
  pagination.page = 1
  await loadRecords()
}

const handleReset = async () => {
  searchForm.keyword = ''
  searchForm.start_date = ''
  searchForm.end_date = ''
  pagination.page = 1
  await loadRecords()
}

const handlePageChange = async (page: number) => {
  pagination.page = page
  await loadRecords()
}

defineExpose({
  reload: loadRecords
})

onMounted(() => {
  loadRecords()
  loadOperators()
})
</script>

<style scoped>
.returngoods-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.returngoods-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.overview-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.overview-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #ffffff;
}

.overview-icon.primary {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
}

.overview-icon.success {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
}

.overview-icon.warning {
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
}

.overview-content {
  min-width: 0;
}

.overview-value {
  font-size: 28px;
  line-height: 1;
  font-weight: 700;
  color: #0f172a;
}

.overview-label {
  margin-top: 6px;
  font-size: 13px;
  color: #64748b;
}

.returngoods-table-panel {
  padding: 18px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.product-cell {
  min-width: 0;
}

.product-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.4;
  word-break: break-word;
}

.product-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.table-wrapper {
  overflow-x: auto;
  overflow-y: visible;
}

.table-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: nowrap;
  min-width: 0;
  white-space: nowrap;
}

.table-actions :deep(.el-button) {
  margin: 0;
  min-width: 0;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.mobile-records {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-card {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  padding: 14px;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
}

.record-card-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.record-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.45;
}

.record-time {
  font-size: 12px;
  color: #2563eb;
  font-weight: 600;
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.record-item {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.record-label {
  font-size: 11px;
  color: #64748b;
}

.record-value {
  font-size: 13px;
  color: #0f172a;
  font-weight: 600;
  word-break: break-word;
}

.record-remark {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e2e8f0;
}

.record-remark-text {
  font-size: 13px;
  line-height: 1.5;
  color: #334155;
  word-break: break-word;
}

.mobile-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e2e8f0;
}

.mobile-actions :deep(.el-button) {
  flex: 1 1 0;
}

.edit-dialog-body {
  padding: 4px 0 0;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.edit-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-item label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.edit-item-full {
  grid-column: 1 / -1;
}

.edit-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 16px;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .returngoods-overview {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .overview-card {
    padding: 12px 10px;
    border-radius: 14px;
    gap: 10px;
  }

  .overview-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    font-size: 14px;
  }

  .overview-value {
    font-size: 20px;
  }

  .overview-label {
    font-size: 11px;
    margin-top: 4px;
  }

  .returngoods-table-panel {
    padding: 12px;
  }

  .edit-grid {
    grid-template-columns: 1fr;
  }

  .panel-header {
    margin-bottom: 10px;
  }

  .pagination-wrapper {
    justify-content: center;
  }
}
</style>
