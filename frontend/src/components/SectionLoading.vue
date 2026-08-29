<template>
  <div
    class="section-loading"
    :class="`section-loading--${size}`"
  >
    <InlineLoading
      :text="text"
      :size="loadingSize"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InlineLoading from '@/components/InlineLoading.vue'

interface Props {
  text?: string
  size?: 'compact' | 'normal' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  text: '加载中...',
  size: 'normal'
})

const loadingSize = computed(() => {
  if (props.size === 'compact') return 'small'
  if (props.size === 'large') return 'large'
  return 'medium'
})
</script>

<style scoped>
.section-loading {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 132px;
  padding: 24px;
  color: var(--tf-loading-surface-text, var(--tf-color-slate-700));
  background:
    radial-gradient(circle at 50% 36%, var(--tf-loading-surface-glow, rgba(14, 165, 233, 0.14)), transparent 36%),
    var(--tf-loading-surface-bg, linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.9) 52%, rgba(236, 253, 245, 0.72)));
  border: 1px solid var(--tf-loading-surface-border, rgba(226, 232, 240, 0.78));
  border-radius: var(--tf-loading-surface-radius, 16px);
  box-shadow: var(--tf-loading-surface-shadow, inset 0 1px 0 rgba(255, 255, 255, 0.86), 0 18px 50px rgba(15, 23, 42, 0.06));
  overflow: hidden;
}

.section-loading::before {
  content: '';
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 999px;
  background: conic-gradient(from 180deg, transparent, var(--tf-loading-aura, rgba(14, 165, 233, 0.14)), transparent 42%);
  animation: section-loading-aura var(--tf-loading-aura-speed, 2.8s) linear infinite;
}

.section-loading :deep(.inline-loading) {
  position: relative;
  z-index: 1;
}

.section-loading--compact {
  min-height: 72px;
  padding: 14px;
}

.section-loading--large {
  min-height: 220px;
  padding: 32px;
}

@keyframes section-loading-aura {
  to {
    transform: rotate(360deg);
  }
}
</style>
