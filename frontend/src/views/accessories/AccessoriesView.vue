<template>
  <div class="accessories-view admin-page">
    <!-- 页面头部 - 使用公共组件 -->
    <PageHeader
      icon="fas fa-box"
      title="配件管理"
    >
      <template #actions>
        <el-button
          v-if="canCreate"
          @click="openStockInModal"
          type="primary"
        >
          <i class="fas fa-box"></i>
          配件入库
        </el-button>
        <el-button
          @click="handleRefresh"
          type="info"
          plain
          :disabled="refreshing"
        >
          <GlobalLoading v-if="refreshing" size="small" />
          <i v-else class="fas fa-sync-alt"></i>
          刷新
        </el-button>
      </template>
    </PageHeader>

    <!-- 配件列表表格 -->
    <div class="accessories-table-container admin-page-content">
      <div v-if="loading && accessories.length === 0" class="loading-state">
        <GlobalLoading />
        <p>加载配件数据中...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <i class="fas fa-exclamation-triangle text-warning"></i>
        <p>{{ error }}</p>
        <el-button @click="loadAccessories" type="primary" size="small">重试</el-button>
      </div>

      <div v-else-if="accessories.length === 0" class="empty-state">
        <i class="fas fa-box-open text-muted"></i>
        <p>暂无配件数据</p>
        <el-button
          v-if="canCreate"
          @click="openStockInModal"
          type="primary"
        >
          配件入库
        </el-button>
      </div>

      <div v-else class="table-container admin-panel admin-table-panel">
        <!-- 桌面端表格视图 -->
        <div class="table-responsive desktop-table" v-loading="loading && accessories.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>配件名称</th>
                <th>分类</th>
                <th>品牌</th>
                <th>型号</th>
                <th>进价</th>
                <th>售价</th>
                <th>毛利</th>
                <th>总库存</th>
                <th>已售</th>
                <th>剩余</th>
                <th>单位</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody v-if="!loading && paginatedAccessories.length > 0">
              <tr v-for="(accessory, index) in paginatedAccessories" :key="accessory.id">
                <td>
                  <span class="index-badge">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</span>
                </td>
                <td>{{ accessory.name || '-' }}</td>
                <td>{{ accessory.category || '-' }}</td>
                <td>{{ accessory.brand_name || '-' }}</td>
                <td>{{ accessory.model_name || '-' }}</td>
                <td class="price">¥{{ formatPrice(accessory.purchase_price) }}</td>
                <td class="price">¥{{ formatPrice(accessory.selling_price) }}</td>
                <td :class="['price-cell', getProfit(accessory) >= 0 ? 'profit-positive' : 'profit-negative']">
                  ¥{{ formatPrice(getProfit(accessory)) }}
                </td>
                <td>
                  <span :class="['status-badge', getStockStatusBadgeClass(accessory)]">
                    {{ accessory.total_stock || accessory.stock_quantity || 0 }} {{ accessory.unit || '件' }}
                  </span>
                </td>
                <td class="text-center">{{ accessory.total_out || 0 }}</td>
                <td :class="['text-center', getRemaining(accessory) < 10 ? 'text-danger' : 'text-success']">
                  {{ getRemaining(accessory) }}
                </td>
                <td class="text-center">{{ accessory.unit || '件' }}</td>
                <td>
                  <span :class="['status-badge', accessory.status === 1 ? 'status-enabled' : 'status-disabled']">
                    {{ accessory.status === 1 ? '启用' : '禁用' }}
                  </span>
                </td>
                <td class="actions-col">
                  <div class="action-buttons">
                    <el-button type="primary" size="small" @click="viewAccessoryDetails(accessory)" title="详情">
                      <i class="fas fa-eye"></i>
                    </el-button>
                    <el-button v-if="canEdit" type="success" size="small" @click="editAccessory(accessory)" title="编辑">
                      <i class="fas fa-edit"></i>
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      @click="deleteAccessory(accessory)"
                      title="删除"
                    >
                      <i class="fas fa-trash"></i>
                    </el-button>
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody v-else-if="loading">
              <tr class="loading-row">
                <td :colspan="14">
                  <GlobalLoading />
                  <p>加载中...</p>
                </td>
              </tr>
            </tbody>
            <tbody v-else>
              <tr class="empty-row">
                <td :colspan="14">
                  <i class="fas fa-box-open"></i>
                  <p>暂无配件数据</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 移动端卡片视图 -->
        <div class="mobile-cards">
          <div
            v-for="accessory in paginatedAccessories"
            :key="accessory.id"
            class="accessory-card"
          >
            <div class="card-header">
              <div class="accessory-name">
                <h3>{{ accessory.name }}</h3>
                <span :class="['status-badge', accessory.status === 1 ? 'status-enabled' : 'status-disabled']">
                  {{ accessory.status === 1 ? '启用' : '禁用' }}
                </span>
              </div>
              <div class="accessory-category">
                <span class="category-tag">{{ accessory.category || '-' }}</span>
              </div>
            </div>

            <div class="card-body">
              <div class="info-row" v-if="accessory.brand_name || accessory.model_name">
                <span class="label">品牌型号:</span>
                <span class="value">{{ accessory.brand_name || '-' }} {{ accessory.model_name || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="label">进价:</span>
                <span class="value price">¥{{ formatPrice(accessory.purchase_price) }}</span>
              </div>
              <div class="info-row">
                <span class="label">售价:</span>
                <span class="value price">¥{{ formatPrice(accessory.selling_price) }}</span>
              </div>
              <div class="info-row">
                <span class="label">毛利:</span>
                <span class="value" :class="getProfit(accessory) >= 0 ? 'profit-positive' : 'profit-negative'">
                  ¥{{ formatPrice(getProfit(accessory)) }}
                </span>
              </div>
              <div class="info-row">
                <span class="label">总库存:</span>
                <span class="value">
                  <span :class="['status-badge', getStockStatusBadgeClass(accessory)]">
                    {{ accessory.total_stock || 0 }} {{ accessory.unit || '件' }}
                  </span>
                </span>
              </div>
              <div class="info-row">
                <span class="label">已售:</span>
                <span class="value text-muted">{{ accessory.total_out || 0 }}</span>
              </div>
              <div class="info-row">
                <span class="label">剩余:</span>
                <span class="value" :class="getRemaining(accessory) < 10 ? 'text-danger' : 'text-success'">
                  {{ getRemaining(accessory) }}
                </span>
              </div>
            </div>

            <div class="card-footer">
              <button class="btn-card-action btn-info" @click="viewAccessoryDetails(accessory)">
                <i class="fas fa-eye"></i>
                详情
              </button>
              <button v-if="canEdit" class="btn-card-action btn-primary" @click="editAccessory(accessory)">
                <i class="fas fa-edit"></i>
                编辑
              </button>
              <button
                v-if="canDelete"
                class="btn-card-action btn-danger"
                @click="deleteAccessory(accessory)"
              >
                <i class="fas fa-trash"></i>
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页控件 -->
    <div v-if="accessories.length > itemsPerPage" class="pagination-section">
      <div class="pagination-controls">
        <el-button
          @click="goToPage(currentPage - 1)"
          type="info"
          plain
          size="small"
          :disabled="currentPage === 1"
        >
          上一页
        </el-button>
        <span class="page-info">
          第 {{ currentPage }} 页，共 {{ totalPages }} 页 ({{ accessories.length }} 条记录)
        </span>
        <el-button
          @click="goToPage(currentPage + 1)"
          type="info"
          plain
          size="small"
          :disabled="currentPage === totalPages"
        >
          下一页
        </el-button>
      </div>
      <div class="pagination-size">
        <select v-model="itemsPerPage" class="form-control form-control-sm">
          <option value="16">16条/页</option>
          <option value="32">32条/页</option>
          <option value="64">64条/页</option>
          <option value="100">100条/页</option>
        </select>
      </div>
    </div>

    <!-- 配件详情模态框 -->
    <AccessoryDetailsModal
      v-if="showDetailsModal"
      :accessory="selectedAccessory"
      @close="closeDetailsModal"
    />

    <!-- 配件入库/编辑模态框（统一） -->
    <AccessoryStockInModal
      v-model="showStockInModal"
      :accessory="selectedAccessory"
      @success="loadAccessories"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import { useRefreshData } from '@/composables/useRefreshData'
import { unifiedApi as api } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useAuthStore } from '@/stores/auth'
import GlobalLoading from '@/components/GlobalLoading.vue'
import AccessoryDetailsModal from '@/components/AccessoryDetailsModal.vue'
import AccessoryStockInModal from '@/components/AccessoryStockInModal.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { logger } from '@/utils/logger'
import { PageHeader } from '@/components/base'

// 使用统一的 composable
const { canView, canCreate, canEdit, canDelete, handleNoPermission } = usePagePermissions('accessories')
const { refreshing, refresh } = useRefreshData()
const authStore = useAuthStore()

// 简化的消息提示
const success = (msg) => ElMessage.success(msg)
const errorMsg = (msg) => ElMessage.error(msg)

// 响应式状态
const { loading } = useLoadingState()
const error = ref('')
const accessories = ref([])

// 模态框状态
const showDetailsModal = ref(false)
const showStockInModal = ref(false)
const selectedAccessory = ref(null)

// 分页状态
const currentPage = ref(1)
const itemsPerPage = ref(16)

// 计算属性
const paginatedAccessories = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return accessories.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(accessories.value.length / itemsPerPage.value)
})

// 工具函数
const getStockStatusType = (accessory) => {
  const stock = accessory.total_stock || accessory.stock_quantity || 0
  if (stock === 0) return 'danger'
  if (stock <= 20) return 'warning'
  return 'success'
}

const getStockStatusBadgeClass = (accessory) => {
  const stock = accessory.total_stock || accessory.stock_quantity || 0
  if (stock === 0) return 'status-out-of-stock'
  if (stock <= 20) return 'status-low-stock'
  return 'status-in-stock'
}

const getProfit = (accessory) => {
  return (accessory.selling_price || 0) - (accessory.purchase_price || 0)
}

const getRemaining = (accessory) => {
  const totalIn = accessory.total_in || 0
  const totalOut = accessory.total_out || 0
  return totalIn - totalOut
}

const formatPrice = (price) => {
  const num = parseFloat(price) || 0
  // 如果是整数，直接返回整数；如果有小数，最多显示2位
  if (Number.isInteger(num)) {
    return num.toLocaleString('zh-CN')
  }
  // 去掉尾部的0，如 15.00 显示为 15，15.50 显示为 15.5
  return parseFloat(num.toFixed(2)).toLocaleString('zh-CN')
}

// API 调用函数
const loadAccessories = async () => {
  try {
    loading.value = true
    error.value = ''

    const response = await api.get('/accessories')
    accessories.value = extractResponseData<any[]>(response)

    logger.info(`配件数据加载成功，共 ${accessories.value.length} 条`)
  } catch (err) {
    logger.error('加载配件数据失败', err)
    accessories.value = []
  } finally {
    loading.value = false
  }
}

// 事件处理函数
// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await loadAccessories()
  })
  success('数据刷新成功')
}

const openStockInModal = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  logger.debug('打开配件入库模态框')
  selectedAccessory.value = null
  showStockInModal.value = true
}

const viewAccessoryDetails = (accessory) => {
  selectedAccessory.value = accessory
  showDetailsModal.value = true
}

const editAccessory = (accessory) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  logger.debug('打开配件编辑模态框', { accessoryId: accessory.id })
  selectedAccessory.value = accessory
  showStockInModal.value = true
}

const deleteAccessory = async (accessory) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除 ${accessory.name} 吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )
  } catch {
    return
  }

  try {
    await api.delete(`/accessories/${accessory.id}`)
    accessories.value = accessories.value.filter(a => a.id !== accessory.id)
    success('删除成功')
  } catch (err) {
    logger.error('删除配件失败', err)
    errorMsg('删除失败，请重试')
  }
}

const closeDetailsModal = () => {
  showDetailsModal.value = false
  selectedAccessory.value = null
}

// 分页函数
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// 监听每页条数变化，重置分页
watch(itemsPerPage, () => {
  currentPage.value = 1
})

// 页面挂载
onMounted(async () => {
  if (!canView.value) {
    return
  }

  logger.debug('配件管理页面挂载完成')
  await loadAccessories()
})
</script>

<style scoped>
/* 配件管理页面样式 */
.accessories-view {
  padding: 20px;
  background-color: #f8f9fa;
  min-height: 100vh;
}

/* 注意：不再使用的通用按钮样式已删除，改用 el-button */

/* 表格容器 */
.table-container {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* 加载、错误、空状态 */
.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.loading-state i,
.error-state i,
.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  display: block;
  opacity: 0.6;
}

/* 表格样式 - 参考供应商打款页面 */
.table-responsive {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table thead {
  background: #fafafa;
}

.data-table thead th {
  padding: 12px 16px;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  border-bottom: 2px solid #ebeef5;
  white-space: nowrap;
}

.data-table tbody tr {
  transition: all 0.3s;
}

.data-table tbody tr:hover {
  background: #f5f7fa;
}

.data-table tbody td {
  padding: 12px 16px;
  font-size: 14px;
  color: #606266;
  border-bottom: 1px solid #ebeef5;
}

.data-table .price {
  font-weight: 600;
  color: #303133;
}

.data-table .price-cell.profit-positive {
  color: #67c23a;
}

.data-table .price-cell.profit-negative {
  color: #f56c6c;
}

.data-table .text-center {
  text-align: center;
}

.data-table .actions-col {
  padding: 8px 12px;
}

/* 序号徽章 */
.index-badge {
  display: inline-block;
  min-width: 28px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
}

/* 状态徽章 */
.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.status-enabled {
  background: #f0f9ff;
  color: #67c23a;
}

.status-badge.status-disabled {
  background: #f5f5f5;
  color: #909399;
}

.status-badge.status-in-stock {
  background: #f0f9ff;
  color: #67c23a;
}

.status-badge.status-low-stock {
  background: #fdf6ec;
  color: #e6a23c;
}

.status-badge.status-out-of-stock {
  background: #fef0f0;
  color: #f56c6c;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.btn-action {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.btn-action.btn-info {
  background: #ecf5ff;
  color: #409eff;
}

.btn-action.btn-info:hover {
  background: #409eff;
  color: white;
}

.btn-action.btn-primary {
  background: #e1f3ff;
  color: #1a73e8;
}

.btn-action.btn-primary:hover {
  background: #1a73e8;
  color: white;
}

.btn-action.btn-danger {
  background: #fef0f0;
  color: #f56c6c;
}

.btn-action.btn-danger:hover {
  background: #f56c6c;
  color: white;
}

/* 文本颜色类 */
.text-success {
  color: #67c23a;
}

.text-danger {
  color: #f56c6c;
}

.text-muted {
  color: #909399;
}

/* 桌面端表格 */
.desktop-table {
  display: block;
}

/* 移动端卡片视图 - 默认隐藏 */
.mobile-cards {
  display: none;
}

/* 分页控件 */
.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  margin-top: 24px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pagination-controls :deep(.el-button) {
  padding: 6px 16px;
}

.pagination-controls :deep(.el-button:hover:not(:disabled)) {
  border-color: #409eff;
  color: #409eff;
}

.pagination-controls :deep(.el-button:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #6c757d;
}

.pagination-size {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #6c757d;
}

.pagination-size .form-control {
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .accessories-view {
    padding: 16px;
  }

  .pagination-section {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }

  .pagination-controls {
    justify-content: center;
  }

  /* 隐藏桌面表格，显示移动卡片 */
  .desktop-table {
    display: none;
  }

  .mobile-cards {
    display: block;
  }

  /* 移动端卡片样式 */
  .accessory-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    margin-bottom: 16px;
    overflow: hidden;
  }

  .card-header {
    padding: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .accessory-name {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .accessory-name h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .category-tag {
    display: inline-block;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-size: 12px;
  }

  .card-body {
    padding: 16px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-row .label {
    color: #909399;
    font-size: 14px;
  }

  .info-row .value {
    font-weight: 500;
    color: #303133;
  }

  .info-row .value.price {
    color: #303133;
    font-weight: 600;
  }

  .info-row .value.profit-positive {
    color: #67c23a;
  }

  .info-row .value.profit-negative {
    color: #f56c6c;
  }

  .card-footer {
    padding: 12px 16px;
    background: #f8f9fa;
    display: flex;
    gap: 8px;
  }

  .btn-card-action {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .btn-card-action.btn-info {
    background: #ecf5ff;
    color: #409eff;
  }

  .btn-card-action.btn-primary {
    background: #e1f3ff;
    color: #1a73e8;
  }

  .btn-card-action.btn-danger {
    background: #fef0f0;
    color: #f56c6c;
  }
}

@media (max-width: 480px) {
  .accessories-view {
    padding: 12px;
  }

  .pagination-controls {
    flex-direction: column;
    gap: 12px;
  }

  /* 卡片样式调整 */
  .card-header {
    padding: 12px;
  }

  .accessory-name h3 {
    font-size: 14px;
  }

  .card-body {
    padding: 12px;
  }

  .info-row {
    padding: 6px 0;
  }

  .info-row .label {
    font-size: 13px;
  }

  .info-row .value {
    font-size: 13px;
  }

  .card-footer {
    padding: 8px 12px;
  }

  .btn-card-action {
    font-size: 12px;
    padding: 6px 8px;
  }

  .btn-card-action i {
    display: none;
  }
}
</style>
