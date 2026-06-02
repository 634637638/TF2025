<template>
  <tr v-if="mode === 'row'" class="table-loading-row">
    <td :colspan="colspan" class="table-loading-row__cell">
      <InlineLoading :text="text" :size="size" />
    </td>
  </tr>
  <div v-else class="table-loading-row__block">
    <InlineLoading :text="text" :size="size" />
  </div>
</template>

<script setup lang="ts">
import InlineLoading from '@/components/InlineLoading.vue'

interface Props {
  colspan?: number
  text?: string
  size?: 'small' | 'medium' | 'large'
  mode?: 'row' | 'block'
}

withDefaults(defineProps<Props>(), {
  colspan: 1,
  text: '加载中...',
  size: 'medium',
  mode: 'row'
})
</script>

<style scoped>
.table-loading-row__cell,
.table-loading-row__block {
  height: 132px;
  padding: 0 !important;
  text-align: center;
  vertical-align: middle;
  background:
    radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.1), transparent 34%),
    linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98) 48%, rgba(240, 253, 250, 0.72));
  position: relative;
  overflow: hidden;
}

.table-loading-row__block {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.table-loading-row__cell::before,
.table-loading-row__block::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent, rgba(14, 165, 233, 0.08), transparent);
  transform: translateX(-100%);
  animation: table-loading-sheen 1.8s ease-in-out infinite;
}

.table-loading-row__cell :deep(.inline-loading),
.table-loading-row__block :deep(.inline-loading) {
  position: relative;
  z-index: 1;
  min-height: 132px;
}

@keyframes table-loading-sheen {
  55%,
  100% {
    transform: translateX(100%);
  }
}
</style>
