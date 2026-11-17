<template>
  <div
    v-if="lines.length"
    class="sales-profit-summary"
  >
    <div class="sales-profit-summary__scroll">
      <div
        class="sales-profit-summary__table"
        role="table"
        aria-label="手机及商品利润明细"
      >
        <div
          class="sales-profit-summary__row sales-profit-summary__row--header"
          role="row"
        >
          <span role="columnheader">项目</span>
          <span role="columnheader">数量</span>
          <span role="columnheader">进价</span>
          <span role="columnheader">销售价</span>
          <span role="columnheader">利润</span>
        </div>
        <div
          v-for="line in lines"
          :key="line.key"
          class="sales-profit-summary__row"
          role="row"
        >
          <span
            class="sales-profit-summary__name"
            role="cell"
            :title="line.name"
          >
            <strong>{{ line.type === 'phone' ? '手机' : '商品' }}</strong>
            <span>{{ line.name }}</span>
            <em
              v-if="line.type === 'goods'"
              :class="line.sale_type === 'gift' ? 'is-gift' : 'is-sale'"
            >
              {{ line.sale_type === 'gift' ? '赠送' : '购买' }}
            </em>
          </span>
          <span role="cell">{{ line.quantity }}</span>
          <span role="cell">{{ money(line.purchase_cost) }}</span>
          <span role="cell">{{ money(line.sale_price * line.quantity) }}</span>
          <span
            role="cell"
            :class="profitClass(line)"
          >{{ lineProfit(line) }}</span>
        </div>
      </div>
    </div>
    <div class="sales-profit-summary__totals">
      <span>总成本 <strong>{{ money(totalCost) }}</strong></span>
      <span>总销售 <strong>{{ money(totalRevenue) }}</strong></span>
      <span :class="totalProfit === null ? 'is-pending' : profitClass(totalProfit)">
        总利润 <strong>{{ totalProfit === null ? '待核对' : money(totalProfit) }}</strong>
      </span>
      <span :class="totalMargin === null ? 'is-pending' : profitClass(totalProfit || 0)">
        利润率 <strong>{{ totalMargin === null ? '待核对' : `${totalMargin}%` }}</strong>
      </span>
    </div>
    <p
      v-if="totalProfit === null"
      class="sales-profit-summary__hint"
    >
      商品进价未授权或暂未读取，结算时按实际入库批次核算利润。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatAmount } from '@/utils/format'
import type { SalesProfitLine } from '../types'

const props = defineProps<{ lines: SalesProfitLine[] }>()
const money = (value: number | null) => value === null || !Number.isFinite(value) ? '待核对' : `¥${formatAmount(value)}`
const lineCost = (line: SalesProfitLine) => line.purchase_cost === null || !Number.isFinite(line.purchase_cost) ? null : line.purchase_cost * line.quantity
const lineProfit = (line: SalesProfitLine) => {
  const cost = lineCost(line)
  return cost === null ? '待核对' : money(line.sale_price * line.quantity - cost)
}
const profitClass = (value: SalesProfitLine | number) => {
  const profit = typeof value === 'number' ? value : lineCost(value) === null ? null : value.sale_price * value.quantity - lineCost(value)!
  if (profit === null) return 'is-pending'
  return profit > 0 ? 'is-positive' : profit < 0 ? 'is-negative' : 'is-zero'
}
const totalRevenue = computed(() => props.lines.reduce((sum, line) => sum + line.sale_price * line.quantity, 0))
const totalCost = computed<number | null>(() => props.lines.every(line => lineCost(line) !== null)
  ? props.lines.reduce((sum, line) => sum + lineCost(line)!, 0)
  : null)
const totalProfit = computed<number | null>(() => totalCost.value === null ? null : totalRevenue.value - totalCost.value)
const totalMargin = computed<string | null>(() => totalCost.value === null || totalCost.value === 0 ? totalCost.value === 0 ? '0.0' : null : ((totalProfit.value! / totalCost.value) * 100).toFixed(1))
</script>

<style scoped lang="scss">
.sales-profit-summary {
  display: grid;
  gap: var(--tf-space-2);
  padding: var(--tf-space-3);
  border: 1px solid var(--tf-color-border-muted);
  border-radius: var(--tf-radius-control);
  background: var(--tf-color-surface-muted);
}

.sales-profit-summary__scroll { min-width: 0; overflow-x: auto; }
.sales-profit-summary__table {
  display: grid;
  grid-template-columns: minmax(150px, max-content) max-content max-content max-content max-content;
  width: max-content;
}
.sales-profit-summary__row {
  display: contents;
}
.sales-profit-summary__row > * {
  display: flex;
  min-height: 30px;
  align-items: center;
  padding: 0 var(--tf-space-2);
  color: var(--tf-color-text);
  font-size: var(--tf-type-scale-13);
  text-align: right;
}
.sales-profit-summary__row > :first-child { text-align: left; }
.sales-profit-summary__row--header > * { min-height: 24px; color: var(--tf-color-text-secondary); font-size: var(--tf-type-scale-12); }
.sales-profit-summary__row:not(.sales-profit-summary__row--header) > * { border-top: 1px solid var(--tf-color-border-subtle); }
.sales-profit-summary__name { display: flex; max-width: 320px; min-width: 0; align-items: center; gap: var(--tf-space-2); overflow: hidden; white-space: nowrap; }
.sales-profit-summary__name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sales-profit-summary__name strong { color: var(--tf-color-heading); font-weight: 600; }
.sales-profit-summary__name em { flex: 0 0 auto; font-style: normal; }
.sales-profit-summary__name em.is-sale { color: var(--el-color-success); }
.sales-profit-summary__name em.is-gift { color: var(--el-color-danger); }
.sales-profit-summary__totals { display: flex; flex-wrap: wrap; gap: var(--tf-space-2) var(--tf-space-4); padding-top: var(--tf-space-2); border-top: 1px solid var(--tf-color-border-subtle); color: var(--tf-color-text-secondary); font-size: var(--tf-type-scale-13); }
.sales-profit-summary__totals strong { color: var(--tf-color-heading); font-weight: 600; }
.sales-profit-summary__totals .is-positive, .sales-profit-summary__totals .is-positive strong { color: var(--el-color-success); }
.sales-profit-summary__totals .is-negative, .sales-profit-summary__totals .is-negative strong { color: var(--el-color-danger); }
.sales-profit-summary__totals .is-zero, .sales-profit-summary__totals .is-zero strong, .sales-profit-summary__totals .is-pending { color: var(--tf-color-text-secondary); }
.sales-profit-summary__hint { margin: 0; color: var(--tf-color-text-secondary); font-size: var(--tf-type-scale-12); }
.is-positive { color: var(--el-color-success); }
.is-negative { color: var(--el-color-danger); }
.is-zero, .is-pending { color: var(--tf-color-text-secondary); }

@media (max-width: 767px) {
  .sales-profit-summary { padding: var(--tf-space-2); }
}
</style>
