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
              <span class="table-number-badge phone-sequence">{{ index + 1 }}</span>
              <span class="phone-detail">{{ [phone.brand, phone.model, phone.color, phone.memory].filter(Boolean).join(' ') || '设备信息' }}</span>
            </div>
            <div
              class="phone-prices"
              :class="{ 'phone-prices--wholesale': mode === 'wholesale' }"
            >
              <div class="price-item">
                <span class="price-label">入库价</span>
                <AmountInput
                  v-model="phone.purchase_cost"
                  :min="0"
                  :step="100"
                  size="small"
                  placeholder="入库价"
                  :aria-label="`第 ${index + 1} 台入库价`"
                  class="price-input"
                  :disabled="mode === 'proxy'"
                />
              </div>
              <div class="price-item">
                <span class="price-label">{{ mode === 'proxy' ? '划拨价' : '批发价' }}</span>
                <AmountInput
                  v-model="phone.wholesale_price"
                  :min="mode === 'wholesale' ? 1 : 0"
                  :step="100"
                  size="small"
                  :placeholder="mode === 'proxy' ? '划拨价' : '批发价'"
                  :aria-label="`第 ${index + 1} 台${mode === 'proxy' ? '划拨价' : '批发价'}`"
                  class="price-input"
                  :disabled="mode === 'proxy'"
                />
              </div>
              <div
                v-if="mode === 'wholesale'"
                class="price-item profit-display"
              >
                <span class="price-label">利润</span>
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
            <span
              v-if="canViewSupplier"
              class="phone-supplier"
              :aria-label="`供应商：${phone.supplier_name || '-'}`"
            >供应商: {{ phone.supplier_name || '-' }}</span>
            <span
              class="phone-store"
              :aria-label="`门店：${phone.store_name || '-'}`"
            >门店: {{ phone.store_name || '-' }}</span>
            <span
              class="phone-inventory-date"
              :aria-label="`入库时间：${formatDate(phone.inventory_time)}`"
            >入库时间: {{ formatDate(phone.inventory_time) }}</span>
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
        <span>{{ mode === 'wholesale' ? '批发总价:' : '划拨总价:' }}</span>
        <span class="price-value">¥{{ formatPrice(totalWholesalePrice) }}</span>
      </div>
      <div
        v-if="mode === 'wholesale'"
        class="summary-item profit"
      >
        <span>预估利润:</span>
        <span
          class="price-value"
          :class="{ loss: totalWholesalePrice < totalCost }"
        >¥{{ formatPrice(totalWholesalePrice - totalCost) }}</span>
      </div>
      <div
        v-else
        class="summary-item"
      >
        <span>划拨数量:</span>
        <span class="price-value">{{ phoneCount }} 台</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { EditableWholesalePhone } from './types'

interface Props {
  mode: 'wholesale' | 'proxy'
  phoneCount: number
  phones: EditableWholesalePhone[]
  canViewSupplier: boolean
  totalCost: number
  totalWholesalePrice: number
  formatPrice: (_price: number) => string
  formatDate: (_date: string | null | undefined) => string
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.form-section {
  margin-bottom: var(--tf-space-6);
  padding-bottom: var(--tf-space-6);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.phones-display {
  margin: var(--tf-space-4) 0;
  border: 1px solid var(--el-color-primary-light-7);
  background: var(--el-bg-color);
  border-radius: var(--tf-radius-card);
  overflow: hidden;
}

.display-header {
  padding: var(--tf-space-3) var(--tf-space-4);
  background: var(--el-color-primary-light-9);
  border-bottom: 1px solid var(--el-color-primary-light-7);
  font-size: var(--tf-font-label);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.phone-item {
  display: grid;
  gap: var(--tf-space-3);
  min-width: 0;
  padding: var(--tf-space-4);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.phone-item:last-child {
  border-bottom: none;
}

.phone-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  align-items: center;
  gap: var(--tf-space-3);
  min-width: 0;
}

.phone-left {
  display: flex;
  align-items: flex-start;
  gap: var(--tf-space-2);
  min-width: 0;
}

.phone-sequence {
  flex-shrink: 0;
}

.phone-detail {
  min-width: 0;
  font-size: var(--tf-font-body);
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.phone-extra {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tf-space-1) var(--tf-space-4);
  min-width: 0;
  font-size: var(--tf-font-caption);
  color: var(--el-text-color-secondary);
  overflow-wrap: anywhere;
}

.phone-extra > span {
  min-width: 0;
}

.phone-prices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--tf-space-3);
  min-width: 0;
}

.phone-prices--wholesale {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.price-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--tf-space-1);
  min-width: 0;
}

.price-label {
  font-size: var(--tf-font-caption);
  color: var(--el-text-color-secondary);
}

.price-input {
  width: 100%;
  min-width: 0;
}

.price-value {
  min-width: 0;
  font-size: var(--tf-font-body);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.price-value.profit {
  color: var(--el-color-success);
}

.price-value.loss {
  color: var(--el-color-danger);
}

.price-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--tf-space-4);
  margin-top: var(--tf-space-4);
  padding: var(--tf-space-4);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--tf-radius-card);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: var(--tf-space-1);
  min-width: 0;
  font-size: var(--tf-font-caption);
  color: var(--el-text-color-regular);
  overflow-wrap: anywhere;
}

.summary-item .price-value {
  color: var(--el-text-color-primary);
}

.summary-item.profit .price-value {
  color: var(--el-color-success);
}

.summary-item.profit .price-value.loss {
  color: var(--el-color-danger);
}

@media (max-width: 767px) {
  .form-section {
    margin-bottom: var(--tf-space-5);
    padding-bottom: var(--tf-space-5);
  }

  .phone-item {
    padding: var(--tf-space-3);
  }

  .phone-main {
    grid-template-columns: minmax(0, 1fr);
  }

  .phone-prices--wholesale {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .price-item {
    grid-template-columns: minmax(0, 1fr);
  }

  .profit-display {
    grid-column: 1 / -1;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .profit-display .price-value {
    text-align: right;
  }

  .price-summary {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--tf-space-3);
  }

  .summary-item {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--tf-space-1) var(--tf-space-3);
  }
}
</style>
