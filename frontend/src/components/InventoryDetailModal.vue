<template>
  <MobileDialog
    v-model="dialogVisible"
    title="商品详情"
    width="860px"
    :tablet-breakpoint="1400"
    dialog-class="inventory-product-detail-dialog"
    :show-default-footer="false"
    :close-on-click-modal="true"
    destroy-on-close
  >
    <div v-if="item && !permissionLoading" class="detail-modal-body">
      <section class="detail-intro">
        <div class="detail-intro-line">
          <span class="detail-intro-main">{{ productTitle }}</span>
          <span class="detail-intro-meta">{{ productMeta || '基础信息' }}</span>
          <span v-if="canViewField('is_new')" :class="['detail-intro-badge', 'is-condition', conditionClass]">
            {{ conditionText }}
          </span>
          <span v-if="canViewField('status')" class="detail-intro-badge is-status">
            {{ statusText }}
          </span>
        </div>
      </section>

      <section v-if="hasSpecificationFields" class="detail-section">
        <div class="detail-section-head">
          <h3>商品规格</h3>
        </div>

        <div class="detail-grid">
          <div v-if="canViewField('brand')" class="detail-field">
            <span class="field-label">品牌</span>
            <span class="field-value">{{ item.brand || '-' }}</span>
          </div>
          <div v-if="canViewField('model')" class="detail-field">
            <span class="field-label">型号</span>
            <span class="field-value">{{ item.model || '-' }}</span>
          </div>
          <div v-if="canViewField('color')" class="detail-field">
            <span class="field-label">颜色</span>
            <span class="field-value">{{ item.color || '-' }}</span>
          </div>
          <div v-if="canViewField('memory')" class="detail-field">
            <span class="field-label">内存</span>
            <span class="field-value">{{ item.memory || '-' }}</span>
          </div>
          <div v-if="canViewField('is_new')" class="detail-field">
            <span class="field-label">机况</span>
            <span class="field-value field-value-badge">
              <span class="condition-pill" :class="conditionClass">{{ conditionText }}</span>
            </span>
          </div>
          <div v-if="canViewField('status')" class="detail-field">
            <span class="field-label">库存状态</span>
            <span class="field-value">{{ statusText }}</span>
          </div>
          <div v-if="canViewField('purchase_price')" class="detail-field">
            <span class="field-label">采购价格</span>
            <span class="field-value">{{ purchasePriceText }}</span>
          </div>
          <div v-if="canViewField('Inventorytime')" class="detail-field">
            <span class="field-label">入库时间</span>
            <span class="field-value">{{ inventoryTimeText }}</span>
          </div>
          <div v-if="canViewField('imei')" class="detail-field">
            <span class="field-label">IMEI</span>
            <span class="field-value">{{ item.imei || '-' }}</span>
          </div>
          <div v-if="canViewField('serial_number')" class="detail-field">
            <span class="field-label">序列号</span>
            <span class="field-value">{{ item.serial_number || '-' }}</span>
          </div>
        </div>
      </section>

      <section v-if="hasRelationFields" class="detail-section">
        <div class="detail-section-head">
          <h3>关联信息</h3>
        </div>

        <div class="detail-grid">
          <div v-if="canViewField('supplier_name')" class="detail-field">
            <span class="field-label">供应商</span>
            <span class="field-value">{{ item.supplier_name || '-' }}</span>
          </div>
          <div v-if="canViewField('store_name')" class="detail-field">
            <span class="field-label">店铺</span>
            <span class="field-value">{{ item.store_name || '-' }}</span>
          </div>
          <div v-if="canViewField('inventory_operator_name')" class="detail-field">
            <span class="field-label">入库员</span>
            <span class="field-value">{{ item.inventory_operator_name || item.purchase_operator_name || '-' }}</span>
          </div>
          <div v-if="canViewField('purchase_number')" class="detail-field">
            <span class="field-label">采购单号</span>
            <span class="field-value">{{ item.purchase_number || '-' }}</span>
          </div>
        </div>
      </section>

      <section v-if="canViewField('remarks') && item.remarks" class="detail-section">
        <div class="detail-section-head">
          <h3>备注信息</h3>
        </div>

        <div class="remarks-box">
          {{ item.remarks }}
        </div>
      </section>
    </div>

    <template #footer>
      <div v-if="item && !permissionLoading" class="detail-modal-footer">
        <el-button type="default" @click="handleClose">
          <i class="fas fa-times"></i>
          关闭
        </el-button>
        <el-button
          v-if="canEdit && item.status === 'in_stock'"
          type="primary"
          @click="emit('edit')"
        >
          <i class="fas fa-edit"></i>
          编辑
        </el-button>
        <el-button
          v-if="canDelete && item.status === 'in_stock'"
          type="danger"
          @click="emit('delete')"
        >
          <i class="fas fa-trash"></i>
          删除
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import MobileDialog from '@/components/MobileDialog.vue'
import type { InventoryItem } from '@/types'
import type { ModelValueProps, UpdateModelValueEmits, CloseEmits } from '@/types/component'

interface Props extends ModelValueProps {
  item: InventoryItem | null
  permissionLoading?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

interface Emits extends UpdateModelValueEmits, CloseEmits {
  edit: []
  delete: []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const inventoryFieldMap: Record<string, string> = {
  brand: 'basic.brand',
  model: 'basic.model',
  color: 'basic.color',
  memory: 'basic.memory',
  is_new: 'basic.is_new',
  status: 'basic.status',
  imei: 'basic.imei',
  serial_number: 'basic.serial_number',
  purchase_price: 'price_info.purchase_price',
  Inventorytime: 'time_info.Inventorytime',
  supplier_name: 'supplier_info.supplier_name',
  store_name: 'store_info.store_name',
  inventory_operator_name: 'operator_info.inventory_operator_name',
  purchase_number: 'purchase_info.purchase_number',
  remarks: 'other_info.remarks'
}

const canViewField = (fieldName: string) => {
  const fieldKey = inventoryFieldMap[fieldName] || fieldName
  return fieldPermissions.isFieldVisible('inventory_inventoryview', fieldKey)
}

const hasRelationFields = computed(() => {
  return ['supplier_name', 'store_name', 'inventory_operator_name', 'purchase_number']
    .some(fieldName => canViewField(fieldName))
})

const hasSpecificationFields = computed(() => {
  return ['brand', 'model', 'color', 'memory', 'is_new', 'status', 'purchase_price', 'Inventorytime', 'imei', 'serial_number']
    .some(fieldName => canViewField(fieldName))
})

const normalizeCondition = (value?: number | boolean | string) => Number(value) === 1

const conditionText = computed(() => normalizeCondition(props.item?.is_new) ? '全新' : '二手')
const conditionClass = computed(() => normalizeCondition(props.item?.is_new) ? 'is-new' : 'is-used')

const statusText = computed(() => {
  const statusMap: Record<string, string> = {
    in_stock: '在库',
    sold: '已售',
    reserved: '预留',
    repair: '维修',
    peer_transfer: '调货',
    supplier_proxy: '划拨'
  }
  return props.item?.status ? (statusMap[props.item.status] || props.item.status) : '-'
})

const productTitle = computed(() => {
  const model = canViewField('model') ? props.item?.model : null
  const fallback = canViewField('brand') ? props.item?.brand : null
  return model || fallback || '商品详情'
})

const productMeta = computed(() => {
  const parts = [
    canViewField('color') ? props.item?.color : null,
    canViewField('memory') ? props.item?.memory : null
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : '基础信息'
})

const purchasePriceText = computed(() => {
  const amount = Number(props.item?.purchase_cost || props.item?.purchase_price || 0)
  return amount > 0 ? `¥${amount.toLocaleString('zh-CN')}` : '未定价'
})

const inventoryTimeText = computed(() => {
  const raw = props.item?.Inventorytime || props.item?.created_at
  if (!raw) return '-'

  const matched = String(raw).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (matched) {
    return `${matched[1]}-${Number(matched[2])}-${Number(matched[3])}`
  }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
})

const handleClose = () => {
  emit('close')
  dialogVisible.value = false
}
</script>

<style scoped lang="scss">
.detail-modal-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0 0;
}

.detail-intro {
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 10px 24px rgba(102, 126, 234, 0.22);
}

.detail-intro-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}

.detail-intro-main {
  min-width: 0;
  flex: 0 1 auto;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-intro-meta {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-intro-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.detail-intro-badge.is-condition.is-new {
  background: rgba(103, 194, 58, 0.92);
}

.detail-intro-badge.is-condition.is-used {
  background: rgba(245, 158, 11, 0.92);
}

.detail-intro-badge.is-status {
  background: rgba(255, 255, 255, 0.24);
}

.detail-section {
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.detail-section:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.detail-section-head {
  margin-bottom: 10px;
}

.detail-section-head h3 {
  margin: 0;
  font-size: 16px;
  color: #1f2937;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-bottom: 1px dashed rgba(203, 213, 225, 0.9);
  border-radius: 14px;
  min-width: 0;
}

.field-label {
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.field-value {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  word-break: break-word;
}

.field-value-badge {
  display: flex;
  align-items: center;
}

.condition-pill {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.condition-pill.is-new {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.condition-pill.is-used {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.remarks-box {
  padding: 8px 0 0;
  color: #374151;
  line-height: 1.65;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-modal-footer {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 10px;
  padding-top: 2px;
}

.detail-modal-footer :deep(.el-button) {
  width: 100%;
  margin: 0;
}

@media (max-width: 1024px) {
  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1400px) {
  .detail-modal-body {
    padding: 0;
    gap: 8px;
  }

  .detail-intro {
    padding: 12px 14px;
  }

  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .detail-section {
    padding-bottom: 8px;
  }

  .detail-field {
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 0;
    border-radius: 12px;
    background: #f8f9fc;
    box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.72);
  }

  .detail-modal-footer {
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .detail-intro-line {
    gap: 6px;
  }

  .detail-intro-main {
    font-size: 16px;
  }

  .detail-intro-meta {
    font-size: 12px;
  }

  .detail-intro-badge {
    min-height: 26px;
    padding: 4px 9px;
    font-size: 11px;
  }

  .field-label {
    font-size: 11px;
  }

  .field-value {
    font-size: 13px;
  }

  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .detail-field {
    padding: 10px 12px;
    border-radius: 10px;
  }

  .detail-modal-footer {
    gap: 6px;
  }
}
</style>

<style lang="scss">
.inventory-product-detail-dialog {
  --dialog-max-width: 920px;
  --dialog-vertical-gap: 24px;
  --mobile-dialog-body-padding: 4px;
  --mobile-dialog-footer-padding: 0 6px 6px;
}

.mobile-dialog-sheet-panel.inventory-product-detail-dialog .mobile-dialog-sheet-body {
  padding: 4px !important;
  background: linear-gradient(180deg, #ffffff 0%, #faf7ff 100%) !important;
}

.mobile-dialog-sheet-panel.inventory-product-detail-dialog .mobile-dialog-sheet-footer {
  padding: 0 6px 6px !important;
  background: linear-gradient(180deg, #ffffff 0%, #faf7ff 100%) !important;
}

.inventory-product-detail-dialog .el-dialog__body {
  padding: 24px !important;
  background: linear-gradient(180deg, #ffffff 0%, #faf7ff 100%) !important;
}

.inventory-product-detail-dialog .el-dialog__footer {
  padding: 0 24px 24px !important;
  background: linear-gradient(180deg, #ffffff 0%, #faf7ff 100%) !important;
  border-top: 0 !important;
}

@media (max-width: 1400px) {
  .inventory-product-detail-dialog {
    --dialog-max-width: calc(100vw - 4px);
    --dialog-side-gap: 2px;
  }

  .mobile-dialog-sheet-overlay.inventory-product-detail-dialog {
    padding: 12px !important;
  }

  .mobile-dialog-sheet-panel.inventory-product-detail-dialog {
    width: min(calc(100vw - 24px), 920px) !important;
    max-width: min(calc(100vw - 24px), 920px) !important;
    max-height: calc(100dvh - 24px) !important;
  }

  .inventory-product-detail-dialog .el-dialog__body {
    padding: 4px !important;
  }

  .inventory-product-detail-dialog .el-dialog__footer {
    padding: 0 6px 6px !important;
  }
}

@media (max-width: 767px) {
  .inventory-product-detail-dialog {
    --dialog-side-gap: 4px;
  }

  .mobile-dialog-sheet-overlay.inventory-product-detail-dialog {
    padding: 8px 4px !important;
  }

  .inventory-product-detail-dialog .el-dialog__body {
    padding: 2px !important;
  }

  .inventory-product-detail-dialog .el-dialog__footer {
    padding: 0 4px 4px !important;
  }

  .mobile-dialog-sheet-panel.inventory-product-detail-dialog .mobile-dialog-sheet-body {
    padding: 2px !important;
  }

  .mobile-dialog-sheet-panel.inventory-product-detail-dialog .mobile-dialog-sheet-footer {
    padding: 0 4px 4px !important;
  }
}

</style>
