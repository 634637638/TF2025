<template>
  <section class="form-section wholesale-phone-summary">
    <div class="phones-display">
      <div class="display-header">
        <span>手机列表（{{ phoneCount }}台）</span>
      </div>
      <div class="phones-list">
        <div v-for="(phone, index) in phones" :key="phone.id" class="phone-item">
          <div class="phone-main">
            <div class="phone-left">
              <span class="phone-index">{{ index + 1 }}</span>
              <span class="phone-detail">{{ phone.brand }} {{ phone.model }} - {{ phone.color }} {{ phone.memory }}</span>
            </div>
            <div
              class="phone-prices"
              :class="{ 'phone-prices-two-col': mode === 'wholesale' }"
            >
              <div class="price-item">
                <span class="price-label">{{ mode === 'wholesale' ? '入库价:' : '入库:' }}</span>
                <el-input-number
                  v-model="phone.editCost"
                  :min="0"
                  :precision="0"
                  :step="100"
                  :controls="false"
                  size="small"
                  placeholder="入库价"
                  class="price-input"
                  :disabled="mode === 'proxy'"
                  @change="handleCostChange"
                />
              </div>
              <div class="price-item">
                <span class="price-label">{{ mode === 'proxy' ? '划拨价:' : '批发:' }}</span>
                <el-input-number
                  v-model="phone.wholesalePrice"
                  :min="mode === 'wholesale' ? 1 : 0"
                  :precision="0"
                  :step="100"
                  :controls="false"
                  size="small"
                  :placeholder="mode === 'proxy' ? '划拨价' : '批发价'"
                  class="price-input"
                  :disabled="mode === 'proxy'"
                />
              </div>
              <div v-if="mode === 'wholesale'" class="price-item profit-display">
                <span class="price-label">利润:</span>
                <span
                  class="price-value"
                  :class="(phone.wholesalePrice || 0) - (phone.editCost || 0) >= 0 ? 'profit' : 'loss'"
                >
                  ¥{{ formatPrice((phone.wholesalePrice || 0) - (phone.editCost || 0)) }}
                </span>
              </div>
            </div>
          </div>
          <div class="phone-extra">
            <span class="phone-supplier">供应商: {{ phone.supplier_name || '-' }}</span>
            <span class="phone-store">店铺: {{ phone.store_name || '-' }}</span>
            <span class="phone-inventory-date">入库时间: {{ formatDate(phone.Inventorytime || phone.purchase_date || phone.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="price-summary">
      <div class="summary-item">
        <span>总入库价:</span>
        <span class="price-value">¥{{ formatPrice(totalCost) }}</span>
      </div>
      <div class="summary-item">
        <span>{{ mode === 'wholesale' ? '批发总价:' : '销售总价:' }}</span>
        <span class="price-value">¥{{ formatPrice(totalWholesalePrice) }}</span>
      </div>
      <div v-if="mode === 'wholesale'" class="summary-item profit">
        <span>预估利润:</span>
        <span class="price-value">¥{{ formatPrice(totalWholesalePrice - totalCost) }}</span>
      </div>
      <div v-else class="summary-item">
        <span>划拨数量:</span>
        <span class="price-value">{{ phoneCount }} 台</span>
      </div>
    </div>

    <el-alert
      v-if="mode === 'proxy'"
      type="warning"
      :closable="false"
      show-icon
      class="mt-3"
    >
      <template #default>
        <div>应供应商要求进行以上商品实施划拨！</div>
      </template>
    </el-alert>
  </section>
</template>

<script setup lang="ts">
import type { EditableWholesalePhone } from './types'

interface Props {
  mode: 'wholesale' | 'proxy'
  phoneCount: number
  phones: EditableWholesalePhone[]
  totalCost: number
  totalWholesalePrice: number
  formatPrice: (price: number) => string
  formatDate: (date: string | null | undefined) => string
  handleCostChange: () => void
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.form-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f2f5;
}

.phones-display {
  margin: 16px 0;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.display-header {
  background: #f5f7fa;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #e4e7ed;
}

.phones-list {
  max-height: 250px;
  overflow-y: auto;
}

.phone-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
}

.phone-item:last-child {
  border-bottom: none;
}

.phone-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.phone-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.phone-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.phone-detail {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}

.phone-prices {
  display: flex;
  align-items: center;
  gap: 12px;
}

.price-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.price-label {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.price-value {
  font-size: 13px;
  font-weight: 600;
  min-width: 80px;
}

.price-value.profit {
  color: #67c23a;
}

.price-value.loss {
  color: #f56c6c;
}

.price-input {
  width: 110px;
}

.profit-display .price-value {
  min-width: 70px;
}

.phone-extra {
  display: flex;
  gap: 16px;
  padding-left: 34px;
  font-size: 12px;
  color: #909399;
  flex-wrap: wrap;
}

.phone-inventory-date {
  color: #67c23a;
}

.price-summary {
  margin-top: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  flex: 1;
}

.summary-item.profit {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #dcdfe6;
  font-weight: 600;
  color: #67c23a;
}

.summary-item .price-value {
  font-weight: 600;
  color: #303133;
}

@media (max-width: 767px) {
  .form-section {
    margin-bottom: 20px;
    padding-bottom: 20px;
  }

  .phone-main {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .phone-prices {
    gap: 10px;
    width: 100%;
  }

  .price-item {
    justify-content: space-between;
  }

  .price-label {
    font-size: 13px;
  }

  .price-input {
    width: 120px !important;
  }

  .profit-display .price-value {
    min-width: 80px;
    text-align: right;
  }

  .phone-prices-two-col {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px !important;
  }

  .phone-prices-two-col .price-item {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 4px;
    min-width: 0;
  }

  .phone-prices-two-col .price-label {
    font-size: 12px;
    line-height: 1.2;
  }

  .phone-prices-two-col .price-input {
    width: 100% !important;
  }

  .phone-extra {
    flex-direction: column !important;
    gap: 6px !important;
    padding-left: 0;
    font-size: 11px;
  }

  .price-summary {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
}
</style>
