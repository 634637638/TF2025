<template>
  <MobileDialog
    :model-value="true"
    title="配件详情"
    width="920px"
    dialog-class="accessory-details-dialog"
    :show-default-footer="false"
    @update:modelValue="handleDialogVisibility"
  >
    <div class="modal-body" v-if="accessory">
      <div class="details-container">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h3>基本信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <label>配件名称：</label>
              <span>{{ accessory.name || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>配件分类：</label>
              <span>{{ getCategoryName(accessory.category_id) || '-' }}</span>
            </div>
            <!-- 品牌型号一行显示 -->
            <div class="detail-item">
              <label>品牌：</label>
              <span>{{ getBrandName(accessory.brand_id) || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>规格型号：</label>
              <span>{{ accessory.model || '-' }}</span>
            </div>
            <!-- 颜色内存一行显示（配件用单位和颜色） -->
            <div class="detail-item">
              <label>颜色：</label>
              <span>{{ accessory.color || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>单位：</label>
              <span>{{ accessory.unit || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>供应商：</label>
              <span>{{ accessory.supplier || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>状态：</label>
              <span :class="['status-badge', accessory.status]">
                {{ getStatusText(accessory.status) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 价格信息 -->
        <div class="detail-section">
          <h3>价格信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <label>采购价格：</label>
              <span class="price">¥{{ accessory.purchase_price || '0.00' }}</span>
            </div>
            <div class="detail-item">
              <label>销售价格：</label>
              <span class="price">¥{{ accessory.sale_price || '0.00' }}</span>
            </div>
            <div class="detail-item">
              <label>利润率：</label>
              <span class="profit-rate" :class="getProfitRateClass()">
                {{ calculateProfitRate() }}%
              </span>
            </div>
          </div>
        </div>

        <!-- 库存信息 -->
        <div class="detail-section">
          <h3>库存信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <label>当前库存：</label>
              <span :class="['stock-status', getStockStatusClass()]">
                {{ accessory.stock_quantity || 0 }} {{ accessory.unit || '' }}
              </span>
            </div>
            <div class="detail-item">
              <label>最小库存警告：</label>
              <span>{{ accessory.min_stock || 0 }} {{ accessory.unit || '' }}</span>
            </div>
            <div class="detail-item">
              <label>库存状态：</label>
              <span :class="['stock-status', getStockStatusClass()]">
                {{ getStockStatusText() }}
              </span>
            </div>
          </div>
        </div>

        <!-- 描述和备注 -->
        <div class="detail-section">
          <h3>其他信息</h3>
          <div class="detail-grid full-width">
            <div class="detail-item" v-if="accessory.description">
              <label>描述：</label>
              <p class="description">{{ accessory.description }}</p>
            </div>
            <div class="detail-item" v-if="accessory.remarks">
              <label>备注：</label>
              <p class="remarks">{{ accessory.remarks }}</p>
            </div>
            <div class="detail-item">
              <label>创建时间：</label>
              <span>{{ formatDateTime(accessory.created_at) }}</span>
            </div>
            <div class="detail-item">
              <label>更新时间：</label>
              <span>{{ formatDateTime(accessory.updated_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-body" v-else>
      <div class="no-data">
        <p>未找到配件信息</p>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary">
          关闭
        </button>
        <button
          v-if="accessory && hasEditPermission"
          @click="editAccessory"
          class="btn btn-primary"
        >
          编辑配件
        </button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'

interface AccessoryDetailItem {
  id?: number
  name?: string
  category_id?: number | string
  brand_id?: number | string
  model?: string
  color?: string
  unit?: string
  supplier?: string
  status?: string
  purchase_price?: string | number
  sale_price?: string | number
  stock_quantity?: string | number
  min_stock?: string | number
  description?: string
  remarks?: string
  created_at?: string | null
  updated_at?: string | null
}

interface AccessoryOptionItem {
  id: number | string
  name: string
}

// Props
const props = defineProps({
  accessory: {
    type: Object as PropType<AccessoryDetailItem | null>,
    default: null
  },
  categories: {
    type: Array as PropType<AccessoryOptionItem[]>,
    default: () => []
  },
  brands: {
    type: Array as PropType<AccessoryOptionItem[]>,
    default: () => []
  },
  hasEditPermission: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['close', 'edit'])

// 获取分类名称
const getCategoryName = (categoryId: number | string) => {
  const category = props.categories.find((cat) => cat.id === categoryId)
  return category?.name
}

// 获取品牌名称
const getBrandName = (brandId: number | string) => {
  const brand = props.brands.find((b) => b.id === brandId)
  return brand?.name
}

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    active: '正常',
    inactive: '停用'
  }
  return statusMap[status] || status
}

// 计算利润率
const calculateProfitRate = () => {
  if (!props.accessory) return 0

  const purchasePrice = parseFloat(props.accessory.purchase_price) || 0
  const salePrice = parseFloat(props.accessory.sale_price) || 0

  if (purchasePrice === 0) return 0
  return ((salePrice - purchasePrice) / purchasePrice * 100).toFixed(2)
}

// 获取利润率样式类
const getProfitRateClass = () => {
  const profitRate = parseFloat(calculateProfitRate())
  if (profitRate > 30) return 'high-profit'
  if (profitRate > 10) return 'medium-profit'
  return 'low-profit'
}

// 获取库存状态类
const getStockStatusClass = () => {
  if (!props.accessory) return ''

  const currentStock = parseInt(props.accessory.stock_quantity) || 0
  const minStock = parseInt(props.accessory.min_stock) || 0

  if (currentStock === 0) return 'out-of-stock'
  if (currentStock <= minStock) return 'low-stock'
  return 'normal-stock'
}

// 获取库存状态文本
const getStockStatusText = () => {
  if (!props.accessory) return '未知'

  const currentStock = parseInt(props.accessory.stock_quantity) || 0
  const minStock = parseInt(props.accessory.min_stock) || 0

  if (currentStock === 0) return '缺货'
  if (currentStock <= minStock) return '库存不足'
  return '库存正常'
}

// 格式化日期时间
const formatDateTime = (dateTime: string | null) => {
  if (!dateTime) return '-'

  try {
    const date = new Date(dateTime)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return '-'
  }
}

// 关闭模态框
const closeModal = () => {
  emit('close')
}

const handleDialogVisibility = (visible: boolean) => {
  if (!visible) {
    closeModal()
  }
}

// 编辑配件
const editAccessory = () => {
  if (props.accessory) {
    emit('edit', props.accessory)
    closeModal()
  }
}
</script>

<style scoped>
.modal-body {
  padding: 24px;
}

.details-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.detail-section {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 16px;
}

.detail-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  border-bottom: 2px solid #3b82f6;
  padding-bottom: 4px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.detail-grid.full-width {
  grid-template-columns: 1fr;
}

.detail-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.detail-item label {
  font-weight: 500;
  color: #374151;
  min-width: 100px;
  flex-shrink: 0;
}

.detail-item span {
  color: #1f2937;
}

.detail-item .description,
.detail-item .remarks {
  flex: 1;
  margin: 0;
  color: #4b5563;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* 状态样式 */
.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background-color: #d1fae5;
  color: #065f46;
}

.status-badge.inactive {
  background-color: #fee2e2;
  color: #991b1b;
}

/* 价格样式 */
.price {
  font-weight: 600;
  color: #059669;
}

/* 利润率样式 */
.profit-rate {
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
}

.profit-rate.high-profit {
  background-color: #d1fae5;
  color: #065f46;
}

.profit-rate.medium-profit {
  background-color: #fef3c7;
  color: #92400e;
}

.profit-rate.low-profit {
  background-color: #fee2e2;
  color: #991b1b;
}

/* 库存状态样式 */
.stock-status {
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
}

.stock-status.normal-stock {
  background-color: #d1fae5;
  color: #065f46;
}

.stock-status.low-stock {
  background-color: #fef3c7;
  color: #92400e;
}

.stock-status.out-of-stock {
  background-color: #fee2e2;
  color: #991b1b;
}

/* 无数据状态 */
.no-data {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background-color: #2563eb;
}

.btn-secondary {
  background-color: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background-color: #4b5563;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .detail-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .detail-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .detail-item label {
    min-width: auto;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }

  .modal-footer {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
