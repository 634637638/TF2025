<template>
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    class="analytics-stat-card"
    @click="interactive && emit('activate')"
  >
    <span class="analytics-stat-card__main">
      <span
        class="stat-icon"
        aria-hidden="true"
      >
        <component :is="icon" />
      </span>
      <span class="stat-content">
        <span class="stat-label">{{ label }}</span>
        <span class="stat-value">{{ value }}</span>
      </span>
    </span>
    <span
      v-if="details?.length"
      class="analytics-stat-card__details"
    >
      <span
        v-for="(detail, index) in details"
        :key="index"
        class="analytics-stat-card__detail"
      >
        <span v-if="detail.label">{{ detail.label }}</span>
        <component
          :is="detail.icon"
          v-if="detail.icon"
          aria-hidden="true"
        />
        <strong>{{ detail.value }}</strong>
      </span>
    </span>
  </component>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  value: string | number
  icon: Component
  details?: ReadonlyArray<{ label?: string; value: string | number; icon?: Component }>
  interactive?: boolean
}>()

const emit = defineEmits<{
  activate: []
}>()
</script>

<style scoped>
.analytics-stat-card {
  --admin-stat-card-display: grid;
  --admin-stat-content-align: start;
  --admin-stat-value-margin-bottom: 0;
  --admin-stat-card-row-gap: var(--tf-space-2);
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  font: inherit;
  text-align: start;
}

.analytics-stat-card[type='button'] {
  cursor: pointer;
}

.analytics-stat-card[type='button']:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.analytics-stat-card__main {
  display: flex;
  align-items: center;
  gap: var(--admin-stat-card-gap);
  width: 100%;
}

.analytics-stat-card__main .stat-content {
  display: grid;
  gap: var(--tf-space-1);
  font-variant-numeric: tabular-nums;
}

.analytics-stat-card__main svg {
  width: 1em;
  height: 1em;
}

.analytics-stat-card__details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tf-space-1) var(--tf-space-2);
  width: 100%;
  color: var(--admin-stat-label-color);
  font-size: var(--tf-font-caption);
  line-height: var(--tf-line-height-compact);
}

.analytics-stat-card__detail {
  display: inline-flex;
  align-items: baseline;
  gap: var(--tf-space-1);
  max-width: 100%;
  min-width: 0;
}

.analytics-stat-card__detail > span {
  flex-shrink: 0;
  white-space: nowrap;
}

.analytics-stat-card__detail > svg {
  flex: 0 0 1em;
  width: 1em;
  height: 1em;
}

.analytics-stat-card__detail > strong {
  min-width: 0;
  color: var(--admin-stat-value-color);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 375px) {
  .analytics-stat-card__main {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--tf-space-1) var(--admin-stat-card-gap);
    font-variant-numeric: tabular-nums;
  }

  .analytics-stat-card__main .stat-content {
    display: contents;
  }

  .analytics-stat-card__main .stat-value {
    grid-column: 1 / -1;
  }
}

@media (min-width: 768px) {
  @container stat-cards (max-width: 1024px) {
    .analytics-stat-card {
      --admin-stat-value-size: var(--tf-font-stat-value-mobile);
    }
  }
}
</style>
