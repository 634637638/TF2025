<template>
  <MobileDialog
    :model-value="true"
    title="配件详情"
    width="920px"
    dialog-class="accessory-details-dialog"
    :show-default-footer="false"
    @update:model-value="handleDialogVisibility"
  >
    <div
      v-if="accessory"
      class="modal-body"
    >
      <div class="details-container">
        <!-- 基本信息 -->
        <div
          v-if="showBasicSection"
          class="detail-section"
        >
          <h3>基本信息</h3>
          <div class="detail-grid">
            <div
              v-if="canViewAccessoryField('name')"
              class="detail-item"
            >
              <label>配件名称：</label>
              <span>{{ accessory.name || '-' }}</span>
            </div>
            <div
              v-if="canViewAccessoryField('category')"
              class="detail-item"
            >
              <label>配件分类：</label>
              <span>{{ accessory.category || '-' }}</span>
            </div>
            <!-- 品牌型号一行显示 -->
            <div
              v-if="canViewAccessoryField('brand_name')"
              class="detail-item"
            >
              <label>品牌：</label>
              <span>{{ accessory.brand_name || '-' }}</span>
            </div>
            <div
              v-if="canViewAccessoryField('model_name')"
              class="detail-item"
            >
              <label>规格型号：</label>
              <span>{{ accessory.model_name || '-' }}</span>
            </div>
            <!-- 颜色内存一行显示（配件用单位和颜色） -->
            <div
              v-if="canViewAccessoryField('color_name')"
              class="detail-item"
            >
              <label>颜色：</label>
              <span>{{ accessory.color_name || '-' }}</span>
            </div>
            <div
              v-if="canViewAccessoryField('unit')"
              class="detail-item"
            >
              <label>单位：</label>
              <span>{{ accessory.unit || '-' }}</span>
            </div>
            <div
              v-if="canViewAccessoryField('supplier_name')"
              class="detail-item"
            >
              <label>供应商：</label>
              <span>{{ accessory.supplier_name || '-' }}</span>
            </div>
            <div
              v-if="canViewAccessoryField('status')"
              class="detail-item"
            >
              <label>状态：</label>
              <span :class="['status-badge', accessory.status]">
                {{ getStatusText(accessory.status) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 价格信息 -->
        <div
          v-if="showPriceSection"
          class="detail-section"
        >
          <h3>价格信息</h3>
          <div class="detail-grid">
            <div
              v-if="canViewAccessoryField('purchase_cost')"
              class="detail-item"
            >
              <label>采购价格：</label>
              <span class="price">¥{{ accessory.purchase_cost || '0.00' }}</span>
            </div>
            <div
              v-if="canViewAccessoryField('sale_price')"
              class="detail-item"
            >
              <label>销售价格：</label>
              <span class="price">¥{{ accessory.sale_price || '0.00' }}</span>
            </div>
            <div
              v-if="canViewAccessoryField('profit')"
              class="detail-item"
            >
              <label>毛利：</label>
              <span class="profit-rate">¥{{ accessory.profit ?? '-' }}</span>
            </div>
          </div>
        </div>

        <!-- 库存信息 -->
        <div
          v-if="showStockSection"
          class="detail-section"
        >
          <h3>库存信息</h3>
          <div class="detail-grid">
            <div
              v-if="canViewAccessoryField('total_stock')"
              class="detail-item"
            >
              <label>当前库存：</label>
              <span :class="['stock-status', canViewAccessoryField('min_stock') ? getStockStatusClass() : '']">
                {{ accessory.total_stock || 0 }}<template v-if="canViewAccessoryField('unit')"> {{ accessory.unit || '' }}</template>
              </span>
            </div>
            <div
              v-if="canViewAccessoryField('min_stock')"
              class="detail-item"
            >
              <label>最小库存警告：</label>
              <span>{{ accessory.min_stock || 0 }}<template v-if="canViewAccessoryField('unit')"> {{ accessory.unit || '' }}</template></span>
            </div>
            <div
              v-if="canViewAccessoryField('remaining_stock')"
              class="detail-item"
            >
              <label>库存状态：</label>
              <span>{{ accessory.remaining_stock ?? '-' }}</span>
            </div>
          </div>
        </div>

        <!-- 描述和备注 -->
        <div
          v-if="showOtherSection"
          class="detail-section"
        >
          <h3>其他信息</h3>
          <div class="detail-grid full-width">
            <div
              v-if="canViewAccessoryField('description') && accessory.description"
              class="detail-item"
            >
              <label>描述：</label>
              <p class="description">
                {{ accessory.description }}
              </p>
            </div>
            <div
              v-if="canViewAccessoryField('remarks') && accessory.remarks"
              class="detail-item"
            >
              <label>备注：</label>
              <p class="remarks">
                {{ accessory.remarks }}
              </p>
            </div>
            <div
              v-if="canViewAccessoryField('created_at')"
              class="detail-item"
            >
              <label>创建时间：</label>
              <span>{{ formatDateTime(accessory.created_at) }}</span>
            </div>
            <div
              v-if="canViewAccessoryField('updated_at')"
              class="detail-item"
            >
              <label>更新时间：</label>
              <span>{{ formatDateTime(accessory.updated_at) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else
      class="modal-body"
    >
      <DataEmptyState
        state="filtered"
        size="compact"
        description="未找到配件信息"
      />
    </div>

    <template #footer>
      <div class="modal-footer">
        <button
          class="btn btn-secondary"
          @click="closeModal"
        >
          关闭
        </button>
        <button
          v-if="accessory && hasEditPermission"
          class="btn btn-primary"
          @click="editAccessory"
        >
          编辑配件
        </button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import { canViewAccessoryField, type AccessoryFieldName } from './accessory-field-permissions'

interface AccessoryDetailItem {
  id?: number
  name?: string
  category?: string
  brand_id?: number | string
  brand_name?: string
  model_name?: string
  color_name?: string
  unit?: string
  supplier_name?: string
  status?: string | number | boolean
  purchase_cost?: string | number
  sale_price?: string | number
  total_stock?: string | number
  min_stock?: string | number
  description?: string
  remarks?: string
  created_at?: string | null
  updated_at?: string | null
  profit?: string | number
  remaining_stock?: string | number
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
const hasAnyField = (fields: AccessoryFieldName[]) => fields.some(canViewAccessoryField)
const showBasicSection = computed(() => hasAnyField(['name','category','brand_name','model_name','color_name','unit','supplier_name','status']))
const showPriceSection = computed(() => hasAnyField(['purchase_cost','sale_price','profit']))
const showStockSection = computed(() => hasAnyField(['total_stock','min_stock','remaining_stock']))
const showOtherSection = computed(() => hasAnyField(['description','remarks','created_at','updated_at']))

// 获取状态文本
const getStatusText = (status: string | number | boolean | undefined) => {
  const statusMap: Record<string, string> = {
    active: '正常',
    inactive: '停用'
  }
  return statusMap[String(status)] || String(status ?? '-')
}

const toNumber = (value: string | number | undefined) => {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

// 获取库存状态类
const getStockStatusClass = () => {
  if (!props.accessory) return ''

  const currentStock = toNumber(props.accessory.total_stock)
  const minStock = toNumber(props.accessory.min_stock)

  if (currentStock === 0) return 'out-of-stock'
  if (currentStock <= minStock) return 'low-stock'
  return 'normal-stock'
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
  background: var(--tf-color-surface-muted);
  border-radius: 6px;
  padding: 16px;
}

.detail-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--tf-color-neutral-800);
  border-bottom: 2px solid var(--tf-color-blue-500);
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
  color: var(--tf-color-neutral-700);
  min-width: 100px;
  flex-shrink: 0;
}

.detail-item span {
  color: var(--tf-color-neutral-800);
}

.detail-item .description,
.detail-item .remarks {
  flex: 1;
  margin: 0;
  color: var(--tf-color-neutral-600);
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
  background-color: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
  border: 1px solid var(--tf-status-success-border);
}

.status-badge.inactive {
  background-color: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
  border: 1px solid var(--tf-status-danger-border);
}

/* 价格样式 */
.price {
  font-weight: 600;
  color: var(--tf-color-emerald-600);
}

/* 利润率样式 */
.profit-rate {
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
}

.profit-rate.high-profit {
  background-color: var(--tf-color-emerald-100);
  color: var(--tf-color-emerald-800);
}

.profit-rate.medium-profit {
  background-color: var(--tf-color-amber-100);
  color: var(--tf-color-amber-800);
}

.profit-rate.low-profit {
  background-color: var(--tf-color-red-100);
  color: var(--tf-color-red-800);
}

/* 库存状态样式 */
.stock-status {
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
}

.stock-status.normal-stock {
  background-color: var(--tf-color-emerald-100);
  color: var(--tf-color-emerald-800);
}

.stock-status.low-stock {
  background-color: var(--tf-color-amber-100);
  color: var(--tf-color-amber-800);
}

.stock-status.out-of-stock {
  background-color: var(--tf-color-red-100);
  color: var(--tf-color-red-800);
}

/* 无数据状态 */
.no-data {
  text-align: center;
  padding: 40px 20px;
  color: var(--tf-color-neutral-500);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--tf-color-neutral-200);
  background: var(--tf-color-neutral-50);
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

}
</style>
