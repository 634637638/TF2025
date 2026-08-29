<template>
  <div
    v-if="visible"
    class="stats-cards"
    :class="{ loading }"
  >
    <div
      v-for="(stat, index) in stats"
      :key="stat.key"
      class="stat-card"
      :style="{ 'animation-delay': `${index * 100}ms` }"
    >
      <div
        class="stat-icon"
        :class="stat.iconClass"
      >
        <i :class="stat.icon" />
      </div>
      <div class="stat-content">
        <div class="stat-value">
          {{ stat.value }}
        </div>
        <div class="stat-label">
          {{ stat.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface InventoryStatCard {
  icon: string
  iconClass: string
  key: string
  label: string
  value: number | string
}

defineProps<{
  loading: boolean
  stats: InventoryStatCard[]
  visible: boolean
}>()
</script>
