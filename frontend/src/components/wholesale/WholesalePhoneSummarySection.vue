<template>
  <section class="form-section wholesale-phone-summary">
    <div class="phones-display">
      <div class="display-header">
        <span>手机列表（{{ phoneCount }}台）</span>
      </div>
      <div class="phones-list">
        <div
          v-for="(phone, index) in phones"
          :key="phone.id"
          class="phone-item"
        >
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
                  v-model="phone.purchase_cost"
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
                  v-model="phone.wholesale_price"
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
              <div
                v-if="mode === 'wholesale'"
                class="price-item profit-display"
              >
                <span class="price-label">利润:</span>
                <span
                  class="price-value"
                  :class="(phone.wholesale_price || 0) - (phone.purchase_cost || 0) >= 0 ? 'profit' : 'loss'"
                >
                  ¥{{ formatPrice((phone.wholesale_price || 0) - (phone.purchase_cost || 0)) }}
                </span>
              </div>
            </div>
          </div>
          <div class="phone-extra">
            <span class="phone-supplier">供应商: {{ phone.supplier_name || '-' }}</span>
            <span class="phone-store">店铺: {{ phone.store_name || '-' }}</span>
            <span class="phone-inventory-date">入库时间: {{ formatDate(phone.inventory_time) }}</span>
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
      <div
        v-if="mode === 'wholesale'"
        class="summary-item profit"
      >
        <span>预估利润:</span>
        <span class="price-value">¥{{ formatPrice(totalWholesalePrice - totalCost) }}</span>
      </div>
      <div
        v-else
        class="summary-item"
      >
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
  formatPrice: (_price: number) => string
  formatDate: (_date: string | null | undefined) => string
  handleCostChange: () => void
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.form-section {
  margin-bottom: var(--tf-space-6);
  padding-bottom: var(--tf-space-6);
  border-bottom: 1px solid var(--tf-color-surface-ant);
}

.phones-display {
  margin: var(--tf-space-4) 0;
  border: 1px solid var(--tf-color-border-element);
  border-radius: var(--tf-radius-card);
  overflow: hidden;
}

.display-header {
  background: var(--tf-color-surface);
  padding: 10px 16px;
  font-size: var(--tf-type-scale-13);
  font-weight: 600;
  color: var(--color-text-regular);
  border-bottom: 1px solid var(--tf-color-border-element);
}

.phones-list {
  max-height: 250px;
  overflow-y: auto;
}

.phone-item {
  padding: var(--tf-space-3) var(--tf-space-4);
  border-bottom: 1px solid var(--tf-color-surface-ant);
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
  background: var(--tf-color-indigo-brand);
  color: white;
  border-radius: var(--tf-radius-full);
  font-size: var(--tf-font-caption);
  font-weight: 600;
  flex-shrink: 0;
}

.phone-detail {
  font-size: var(--tf-type-scale-13);
  color: var(--color-text-primary);
  font-weight: 500;
}

.phone-prices {
  display: flex;
  align-items: center;
  gap: var(--tf-space-3);
}

.price-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.price-label {
  font-size: var(--tf-font-caption);
  color: var(--color-info);
  white-space: nowrap;
}

.price-value {
  font-size: var(--tf-type-scale-13);
  font-weight: 600;
  min-width: 80px;
}

.price-value.profit {
  color: var(--color-success);
}

.price-value.loss {
  color: var(--color-danger);
}

.price-input {
  width: 110px;
}

.profit-display .price-value {
  min-width: 70px;
}

.phone-extra {
  display: flex;
  gap: var(--tf-space-4);
  padding-left: 34px;
  font-size: var(--tf-font-caption);
  color: var(--color-info);
  flex-wrap: wrap;
}

.phone-inventory-date {
  color: var(--color-success);
}

.price-summary {
  margin-top: var(--tf-space-4);
  padding: var(--tf-space-4);
  background: var(--tf-color-surface);
  border-radius: var(--tf-radius-card);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--tf-space-4);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--tf-font-body);
  flex: 1;
}

.summary-item.profit {
  margin-top: var(--tf-space-2);
  padding-top: var(--tf-space-2);
  border-top: 1px dashed var(--color-border);
  font-weight: 600;
  color: var(--color-success);
}

.summary-item .price-value {
  font-weight: 600;
  color: var(--color-text-primary);
}

@media (max-width: 767px) {
  .form-section {
    margin-bottom: var(--tf-space-5);
    padding-bottom: var(--tf-space-5);
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
    font-size: var(--tf-type-scale-13);
  }

  .price-input {
    width: 120px;
  }

  .profit-display .price-value {
    min-width: 80px;
    text-align: right;
  }

  .phone-prices-two-col {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--tf-space-2);
  }

  .phone-prices-two-col .price-item {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: var(--tf-space-1);
    min-width: 0;
  }

  .phone-prices-two-col .price-label {
    font-size: var(--tf-font-caption);
    line-height: 1.2;
  }

  .phone-prices-two-col .price-input {
    width: 100%;
  }

  .phone-extra {
    flex-direction: column;
    gap: 6px;
    padding-left: 0;
    font-size: var(--tf-type-scale-11);
  }

  .price-summary {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
}
</style>
