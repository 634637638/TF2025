<template>
  <div class="stats-cards">
    <div
      v-if="showAvailableInventory"
      class="stat-card stat-card--primary"
    >
      <div class="stat-icon">
        <i class="fas fa-boxes" />
      </div>
      <div class="stat-content">
        <div class="stat-value">
          {{ availableInventory }}
        </div>
        <div class="stat-label">
          库存总数
        </div>
      </div>
    </div>

    <div
      v-if="showTodaySales"
      class="stat-card stat-card--success"
    >
      <div class="stat-icon">
        <i class="fas fa-calendar-day" />
      </div>
      <div class="stat-content">
        <div class="stat-value">
          {{ todaySold }}
        </div>
        <div class="stat-label">
          今日出库
        </div>
      </div>
    </div>

    <div
      v-if="showNewInventoryValue"
      class="stat-card stat-card--new-money"
    >
      <div class="stat-icon">
        <i class="fas fa-dollar-sign" />
      </div>
      <div class="stat-content">
        <div class="stat-value">
          ¥{{ newInventoryValue }}
        </div>
        <div class="stat-label">
          全新库存金额
        </div>
      </div>
    </div>

    <div
      v-if="showUsedInventoryValue"
      class="stat-card stat-card--used-money"
    >
      <div class="stat-icon">
        <i class="fas fa-chart-line" />
      </div>
      <div class="stat-content">
        <div class="stat-value">
          ¥{{ usedInventoryValue }}
        </div>
        <div class="stat-label">
          二手库存金额
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  availableInventory: number
  todaySold: number
  newInventoryValue: string
  usedInventoryValue: string
  showAvailableInventory: boolean
  showTodaySales: boolean
  showNewInventoryValue: boolean
  showUsedInventoryValue: boolean
}>()
</script>
