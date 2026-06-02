<template>
  <span class="inline-loading" :class="[`inline-loading--${size}`, `inline-loading--${variant}`]">
    <span class="inline-loading__spinner" aria-hidden="true">
      <span class="inline-loading__orbit"></span>
      <span class="inline-loading__core"></span>
    </span>
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
  color: #334155;
  font-weight: 700;
  letter-spacing: 0.02em;
  vertical-align: middle;
}

.inline-loading--inherit {
  color: currentColor;
}

.inline-loading__spinner {
  position: relative;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background:
    conic-gradient(from 90deg, rgba(14, 165, 233, 0), #0ea5e9, #2563eb, #14b8a6, rgba(14, 165, 233, 0) 78%);
  box-shadow:
    0 0 0 1px rgba(14, 165, 233, 0.12),
    0 6px 18px rgba(37, 99, 235, 0.22);
  animation: inline-loading-spin 0.85s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}

.inline-loading__spinner::before {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: inherit;
  background: #fff;
}

.inline-loading__orbit {
  position: absolute;
  top: -1px;
  left: 50%;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #f8fafc;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.8),
    0 0 12px rgba(14, 165, 233, 0.78);
  transform: translateX(-50%);
}

.inline-loading__core {
  position: absolute;
  inset: 6px;
  border-radius: inherit;
  background:
    radial-gradient(circle at 35% 30%, #ffffff 0 22%, #dbeafe 46%, #38bdf8 100%);
  box-shadow: inset 0 0 8px rgba(37, 99, 235, 0.18);
}

.inline-loading--inherit .inline-loading__spinner {
  background:
    conic-gradient(from 90deg, transparent, currentColor, currentColor, transparent 78%);
  box-shadow: none;
  opacity: 0.92;
}

.inline-loading--inherit .inline-loading__spinner::before {
  background: transparent;
  inset: 3px;
  border: 2px solid currentColor;
  opacity: 0.18;
}

.inline-loading--inherit .inline-loading__orbit,
.inline-loading--inherit .inline-loading__core {
  background: currentColor;
  box-shadow: none;
}

.inline-loading--small {
  gap: 6px;
  font-size: 12px;
}

.inline-loading--small .inline-loading__spinner {
  width: 14px;
  height: 14px;
}

.inline-loading--small .inline-loading__orbit {
  width: 4px;
  height: 4px;
}

.inline-loading--small .inline-loading__core {
  inset: 5px;
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
}

.inline-loading--large .inline-loading__orbit {
  width: 6px;
  height: 6px;
}

.inline-loading--large .inline-loading__core {
  inset: 8px;
}

@keyframes inline-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
