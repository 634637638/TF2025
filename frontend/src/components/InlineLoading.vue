<template>
  <span class="inline-loading" :class="[`inline-loading--${size}`, `inline-loading--${variant}`]">
    <span class="inline-loading__spinner" aria-hidden="true"></span>
    <span v-if="text" class="inline-loading__text">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
interface Props {
  text?: string
  size?: 'small' | 'medium' | 'large'
  variant?: 'default' | 'inherit'
}

withDefaults(defineProps<Props>(), {
  text: '',
  size: 'medium',
  variant: 'default'
})
</script>

<style scoped>
.inline-loading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--tf-loading-color, #2563eb);
  font-weight: 600;
  letter-spacing: 0;
  vertical-align: middle;
}

.inline-loading--inherit {
  color: currentColor;
}

.inline-loading__spinner {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--tf-loading-ring-track, rgba(37, 99, 235, 0.18));
  border-top-color: var(--tf-loading-ring-primary, #2563eb);
  border-right-color: var(--tf-loading-ring-secondary, #38bdf8);
  box-sizing: border-box;
  animation: tf-loading-spin var(--tf-loading-speed, 0.72s) linear infinite;
}

.inline-loading--inherit .inline-loading__spinner {
  border-color: color-mix(in srgb, currentColor 18%, transparent);
  border-top-color: currentColor;
  border-right-color: currentColor;
}

.inline-loading--small {
  gap: 6px;
  font-size: 12px;
}

.inline-loading--small .inline-loading__spinner {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

.inline-loading--medium {
  font-size: 14px;
}

.inline-loading--large {
  gap: 10px;
  font-size: 16px;
}

.inline-loading--large .inline-loading__spinner {
  width: 24px;
  height: 24px;
  border-width: 3px;
}

@keyframes tf-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
