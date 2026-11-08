<template>
  <div
    v-if="detailItem"
    class="query-detail-content"
  >
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
      <div class="price-item tf-inline-field">
        <span class="price-label">入库价格：</span>
        <span class="price-value green">{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.purchase_cost') ? formatPrice(detailItem.价格信息?.purchase_cost) : '-' }}</span>
      </div>
      <div class="price-item tf-inline-field">
        <span class="price-label">销售价格：</span>
        <span class="price-value highlight">{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.sale_price') ? formatPrice(detailItem.价格信息?.sale_price) : '-' }}</span>
      </div>
    </div>

    <div class="customer-row">
      <div class="customer-item tf-inline-field">
        <span class="customer-label">姓名：</span>
        <span class="customer-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'customer_info.customer_name') ? (detailItem.客户信息?.customer_name || '-') : '-' }}</span>
      </div>
      <div class="customer-item tf-inline-field">
        <span class="customer-label">电话：</span>
        <span class="customer-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'customer_info.customer_phone') ? (detailItem.客户信息?.customer_phone || '-') : '-' }}</span>
      </div>
    </div>

    <div class="code-row">
      <div class="code-item tf-stack-field tf-stack-field--identifier">
        <span class="code-label">IMEI：</span>
        <span class="code-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.imei') ? (detailItem.基本信息?.imei || '-') : '-' }}</span>
      </div>
      <div class="code-item tf-stack-field tf-stack-field--identifier">
        <span class="code-label">序列号：</span>
        <span class="code-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.serial_number') ? (detailItem.基本信息?.serial_number || '-') : '-' }}</span>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item tf-inline-field">
        <span class="info-item-label">供应商：</span>
        <span class="info-item-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'supplier_info.supplier_name') ? (detailItem.供应商信息?.supplier_name || '-') : '-' }}</span>
      </div>
      <div class="info-item tf-inline-field">
        <span class="info-item-label">销售店铺：</span>
        <span class="info-item-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'store_info.store_name') ? (detailItem.店铺信息?.store_name || '-') : '-' }}</span>
      </div>
      <div class="info-item tf-stack-field">
        <span class="info-item-label">入库日期：</span>
        <span class="info-item-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'time_info.inventory_time') ? formatDate(detailItem.时间信息?.inventory_time) : '-' }}</span>
      </div>
      <div class="info-item tf-stack-field">
        <span class="info-item-label">销售日期：</span>
        <span class="info-item-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'time_info.sale_time') ? formatDate(detailItem.时间信息?.sale_time) : '-' }}</span>
      </div>
    </div>

    <div class="operator-row">
      <div class="operator-item tf-inline-field">
        <span class="operator-label">入库员：</span>
        <span class="operator-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'operator_info.inventory_operator_name') ? (detailItem.操作员信息?.inventory_operator_name || '-') : '-' }}</span>
      </div>
      <div class="operator-item tf-inline-field">
        <span class="operator-label">销售员：</span>
        <span class="operator-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'operator_info.sale_operator_name') ? (detailItem.操作员信息?.sale_operator_name || '-') : '-' }}</span>
      </div>
    </div>

    <div class="apple-id-row">
      <span class="apple-id-label">Apple ID：</span>
      <span class="apple-id-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'customer_info.apple_id') ? (detailItem.客户信息?.apple_id || '-') : '-' }}</span>
    </div>

    <div class="remark-row">
      <span class="remark-label">备注：</span>
      <span class="remark-value">{{ fieldPermissions.isFieldVisible('query_queryview', 'basic_info.remarks') ? (detailItem.基本信息?.remarks || '-') : '-' }}</span>
    </div>

    <div class="detail-actions">
      <el-button
        v-if="canEdit"
        type="primary"
        size="small"
        @click="$emit('edit')"
      >
        <i class="fas fa-edit" />
        编辑
      </el-button>
      <el-button
        v-if="canDelete"
        type="danger"
        size="small"
        @click="$emit('delete')"
      >
        <i class="fas fa-trash" />
        删除
      </el-button>
      <el-button
        v-if="canReturnToStock"
        type="warning"
        size="small"
        @click="$emit('return')"
      >
        <i class="fas fa-undo-alt" />
        退库
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { getEffectivePhoneStatusClass } from '@/constants/phoneStatuses'
import { formatDate } from '@/utils/format'
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

const formatPrice = (price?: number | null) => price === null || price === undefined ? '-' : `¥${price}`

const getStatusBadgeClass = (status?: string) => {
  return getEffectivePhoneStatusClass({
    status,
    is_preordered: props.detailItem?.基本信息?.is_preordered
  })
}
</script>

<style scoped lang="scss" src="./styles/query-detail-content/desktop.scss"></style>
<style scoped lang="scss" src="./styles/query-detail-content/responsive.scss"></style>
