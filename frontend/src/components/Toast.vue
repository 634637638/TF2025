<template>
  <teleport to="body">
    <div
      v-bind="$attrs"
      class="toast-container"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`]"
        @click="removeToast(toast.id)"
      >
        <div class="toast-icon">
          <i :class="getIconClass(toast.type)" />
        </div>
        <div class="toast-message">
          {{ toast.message }}
        </div>
        <el-button
          class="toast-close tf-button--dismiss"
          native-type="button"
          aria-label="关闭提示"
          title="关闭提示"
          @click.stop="removeToast(toast.id)"
        >
          <i class="fas fa-times" />
        </el-button>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'

defineOptions({
  inheritAttrs: false
})

const { toasts, removeToast } = useToast()

const getIconClass = (type: string) => {
  const iconMap = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  }
  return iconMap[type] || 'fas fa-info-circle'
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: var(--tf-z-toast);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  background: white;
  pointer-events: auto;
  cursor: pointer;
  transition: all 0.3s ease;
  max-width: 400px;
  min-width: 300px;
  animation: slideInRight 0.3s ease;
}

.toast:hover {
  transform: translateX(-5px);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
}

.toast-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--tf-type-scale-16);
}

.toast-message {
  flex: 1;
  font-size: var(--tf-type-scale-14);
  line-height: 1.4;
  color: var(--tf-color-neutral-800);
}

.toast-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Toast 类型样式 */
.toast-success {
  border-left: 4px solid var(--tf-color-emerald-500);
}

.toast-success .toast-icon {
  color: var(--tf-color-emerald-500);
}

.toast-error {
  border-left: 4px solid var(--tf-color-red-500);
}

.toast-error .toast-icon {
  color: var(--tf-color-red-500);
}

.toast-warning {
  border-left: 4px solid var(--tf-color-amber-500);
}

.toast-warning .toast-icon {
  color: var(--tf-color-amber-500);
}

.toast-info {
  border-left: 4px solid var(--tf-color-blue-500);
}

.toast-info .toast-icon {
  color: var(--tf-color-blue-500);
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 640px) {
  .toast-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }

  .toast {
    max-width: none;
    min-width: auto;
  }
}
</style>
