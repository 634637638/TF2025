<template>
  <div v-if="detailItem" class="query-detail-content">
    <div class="device-card-inline">
      <div class="device-card-main">
        <div class="device-meta-row">
          <span class="device-info">{{ productTitle }}</span>
          <span class="device-meta">{{ productMeta }}</span>
          <div class="device-card-tags">
            <span :class="['condition-badge', detailItem.基本信息?.is_new === 1 ? 'new' : 'used']">
              {{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.is_new') ? (detailItem.基本信息?.is_new === 1 ? '全新' : '二手') : '-' }}
            </span>
            <span :class="['status-badge', getStatusBadgeClass(detailItem.基本信息?.status_code)]">
              {{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.status') ? (detailItem.基本信息?.status || '-') : '-' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="price-row">
      <div class="price-item">
        <span class="price-label">入库价格</span>
        <span class="price-value green">¥{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.purchase_price') ? (detailItem.价格信息?.purchase_price || '0') : '-' }}</span>
      </div>
      <div class="price-item">
        <span class="price-label">销售价格</span>
        <span class="price-value highlight">¥{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.sale_price') ? (detailItem.价格信息?.sale_price || '0') : '-' }}</span>
      </div>
    </div>

    <div class="customer-row">
      <div class="customer-item">
        <span class="customer-label">姓名</span>
        <span class="customer-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'customer_info.customer_name') ? (detailItem.客户信息?.customer_name || '-') : '-' }}</span>
      </div>
      <div class="customer-item">
        <span class="customer-label">电话</span>
        <span class="customer-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'customer_info.customer_phone') ? (detailItem.客户信息?.customer_phone || '-') : '-' }}</span>
      </div>
    </div>

    <div class="code-row">
      <div class="code-item">
        <span class="code-label">IMEI</span>
        <span class="code-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.imei') ? (detailItem.基本信息?.imei || '-') : '-' }}</span>
      </div>
      <div class="code-item">
        <span class="code-label">序列号</span>
        <span class="code-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.serial_number') ? (detailItem.基本信息?.serial_number || '-') : '-' }}</span>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <span class="info-item-label">供应商</span>
        <span class="info-item-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'supplier_info.supplier_name') ? (detailItem.供应商信息?.supplier_name || '-') : '-' }}</span>
      </div>
      <div class="info-item">
        <span class="info-item-label">销售店铺</span>
        <span class="info-item-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'store_info.store_name') ? (detailItem.店铺信息?.store_name || '-') : '-' }}</span>
      </div>
      <div class="info-item">
        <span class="info-item-label">入库时间</span>
        <span class="info-item-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'time_info.Inventorytime') ? formatDate(detailItem.时间信息?.Inventorytime) : '-' }}</span>
      </div>
      <div class="info-item">
        <span class="info-item-label">销售时间</span>
        <span class="info-item-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'time_info.salestime') ? formatDate(detailItem.时间信息?.salestime) : '-' }}</span>
      </div>
    </div>

    <div class="operator-row">
      <div class="operator-item">
        <span class="operator-label">入库员</span>
        <span class="operator-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'operator_info.inventory_operator_name') ? (detailItem.操作员信息?.inventory_operator_name || '-') : '-' }}</span>
      </div>
      <div class="operator-item">
        <span class="operator-label">销售员</span>
        <span class="operator-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'operator_info.sale_operator_name') ? (detailItem.操作员信息?.sale_operator_name || '-') : '-' }}</span>
      </div>
    </div>

    <div class="apple-id-row">
      <span class="apple-id-label">Apple ID</span>
      <span class="apple-id-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'customer_info.apple_id') ? (detailItem.客户信息?.apple_id || '-') : '-' }}</span>
    </div>

    <div class="remark-row">
      <span class="remark-label">备注</span>
      <span class="remark-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.remarks') ? (detailItem.基本信息?.remarks || '-') : '-' }}</span>
    </div>

    <div class="detail-actions">
      <el-button
        v-if="canEdit"
        type="primary"
        size="small"
        @click="$emit('edit')"
      >
        <i class="fas fa-edit"></i>
        编辑
      </el-button>
      <el-button
        v-if="canDelete"
        type="danger"
        size="small"
        @click="$emit('delete')"
      >
        <i class="fas fa-trash"></i>
        删除
      </el-button>
      <el-button
        v-if="canReturnToStock"
        type="warning"
        size="small"
        @click="$emit('return')"
      >
        <i class="fas fa-undo-alt"></i>
        退库
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import type { QueryItem } from '@/types'

interface Props {
  detailItem: QueryItem | null
  canEdit: boolean
  canDelete: boolean
  canReturnToStock: boolean
}

interface Emits {
  edit: []
  delete: []
  return: []
}

const props = defineProps<Props>()
defineEmits<Emits>()

const productTitle = computed(() => {
  if (!fieldPermissions.isFieldVisible('query_queryview', 'basic_info.model')) {
    return '-'
  }
  return props.detailItem?.基本信息?.model || '-'
})

const productMeta = computed(() => {
  const parts = [
    fieldPermissions.isFieldVisible('query_queryview', 'basic_info.color') ? (props.detailItem?.基本信息?.color || null) : null,
    fieldPermissions.isFieldVisible('query_queryview', 'basic_info.memory') ? (props.detailItem?.基本信息?.memory || null) : null
  ].filter(Boolean)

  return parts.length ? parts.join(' ') : '-'
})

const formatDate = (dateString?: string) => {
  if (!dateString) return '-'
  return TimeUtil.format(dateString, TIME_FORMATS.DATE)
}

const getStatusBadgeClass = (status?: string) => {
  const classMap: Record<string, string> = {
    in_stock: 'in-stock',
    sold: 'sold',
    peer_transfer: 'peer-transfer',
    supplier_proxy: 'supplier-proxy',
    reserved: 'reserved',
    repair: 'repair',
    lost: 'lost'
  }
  return status ? classMap[status] || '' : ''
}
</script>

<style scoped lang="scss">
.query-detail-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-card-inline {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 14px 16px;
  color: #fff;
  box-shadow: 0 10px 24px rgba(102, 126, 234, 0.22);
}

.device-card-main {
  width: 100%;
  min-width: 0;
}

.device-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  width: 100%;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}

.device-info {
  min-width: 0;
  flex: 0 1 auto;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-card-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: nowrap;
}

.device-meta {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.condition-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  justify-content: center;
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  flex-shrink: 0;
}

.condition-badge.new {
  background: #28a745;
  color: #ffffff;
}

.condition-badge.used {
  background: #f59e0b;
  color: #ffffff;
}

.status-badge.in-stock {
  background: #6c757d;
  color: #ffffff;
}

.status-badge.sold {
  background: #28a745;
  color: #ffffff;
}

.status-badge.peer-transfer {
  background: #667eea;
  color: #ffffff;
}

.status-badge.supplier-proxy {
  background: #764ba2;
  color: #ffffff;
}

.status-badge.reserved {
  background: #17a2b8;
  color: #ffffff;
}

.status-badge.repair {
  background: #f59e0b;
  color: #ffffff;
}

.status-badge.lost {
  background: #dc3545;
  color: #ffffff;
}

.price-row,
.customer-row,
.code-row,
.operator-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.price-item,
.customer-item,
.code-item,
.operator-item,
.info-item {
  background: #f8f9fc;
  border-radius: 14px;
  padding: 12px 14px;
}

.price-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.price-label,
.customer-label,
.code-label,
.info-item-label,
.operator-label,
.apple-id-label,
.remark-label {
  font-size: 12px;
  color: #909399;
}

.price-value {
  font-size: 18px;
  font-weight: 700;
  color: #606266;
}

.price-value.highlight {
  color: #f56c6c;
}

.price-value.green {
  color: #67c23a;
}

.customer-item,
.operator-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.customer-value,
.operator-value {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  min-width: 0;
}

.code-label,
.info-item-label {
  display: block;
  margin-bottom: 4px;
}

.code-value {
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: #303133;
  line-height: 1.45;
  word-break: break-all;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.info-item-value {
  font-size: 13px;
  color: #303133;
  font-weight: 600;
  word-break: break-word;
}

.apple-id-row {
  background: linear-gradient(135deg, #f5f7fa 0%, #e8eaf0 100%);
  border: 1px solid #e6e8ef;
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.apple-id-value {
  font-size: 13px;
  color: #303133;
  font-weight: 600;
  text-align: right;
  word-break: break-all;
}

.remark-row {
  background: #fff8e8;
  border-left: 4px solid #e6a23c;
  border-radius: 14px;
  padding: 12px 14px;
}

.remark-label {
  display: block;
  color: #d89018;
  margin-bottom: 6px;
}

.remark-value {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  word-break: break-word;
}

.detail-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding-top: 2px;
}

.detail-actions :deep(.el-button) {
  width: 100%;
  height: 44px;
  border-radius: 14px;
  font-size: 15px;
  margin: 0;
}

@media (max-width: 768px) {
  .query-detail-content {
    gap: 8px;
  }

  .device-card-inline {
    padding: 14px;
    border-radius: 14px;
  }

  .device-card-main,
  .device-meta-row,
  .device-card-tags {
    gap: 6px;
  }

  .device-info {
    font-size: 16px;
  }

  .device-meta {
    font-size: 12px;
  }

  .price-row,
  .customer-row,
  .code-row,
  .operator-row,
  .info-grid {
    gap: 8px;
  }

  .price-item,
  .customer-item,
  .code-item,
  .operator-item,
  .info-item,
  .apple-id-row,
  .remark-row {
    padding: 10px 12px;
    border-radius: 12px;
  }

  .price-value {
    font-size: 17px;
  }

  .customer-value,
  .operator-value {
    font-size: 14px;
  }

  .detail-actions {
    gap: 8px;
  }

  .detail-actions :deep(.el-button) {
    height: 42px;
    border-radius: 12px;
    font-size: 14px;
  }
}

@media (max-width: 420px) {
  .device-meta-row {
    gap: 4px;
  }

  .device-info {
    font-size: 14px;
  }

  .device-meta {
    font-size: 11px;
  }

  .condition-badge,
  .status-badge {
    min-height: 26px;
    padding: 4px 8px;
    font-size: 11px;
  }

  .price-row,
  .customer-row,
  .code-row,
  .operator-row,
  .info-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .detail-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .detail-actions :deep(.el-button) {
    font-size: 13px;
  }
}
</style>
