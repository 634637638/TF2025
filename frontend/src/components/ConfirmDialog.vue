<template>
  <transition name="confirm-dialog">
    <div
      v-if="visible"
      class="confirm-dialog-overlay"
      @click.self="handleCancel"
    >
      <div
        class="confirm-dialog"
        :class="[`confirm-${type}`]"
      >
        <div class="confirm-header">
          <div class="confirm-icon">
            <i :class="getIconClass()" />
          </div>
          <h3 class="confirm-title">
            {{ title }}
          </h3>
        </div>

        <div class="confirm-body">
          <p class="confirm-message">
            {{ message }}
          </p>
          <div
            v-if="details"
            class="confirm-details"
          >
            {{ details }}
          </div>
        </div>

        <div class="confirm-footer tf-dialog-actions">
          <button
            class="btn btn-outline-secondary"
            :disabled="loading"
            @click="handleCancel"
          >
            <i class="fas fa-times" />
            {{ cancelText }}
          </button>
          <button
            class="btn"
            :class="getConfirmButtonClass()"
            :disabled="loading"
            @click="handleConfirm"
          >
            <InlineLoading
              v-if="loading"
              text="处理中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i :class="getConfirmIcon()" />
              {{ confirmText }}
            </template>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useTheme } from '../composables/useTheme'
import InlineLoading from '@/components/InlineLoading.vue'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'warning', // success, warning, error, info
    validator: (value) => ['success', 'warning', 'error', 'info'].includes(value)
  },
  confirmText: {
    type: String,
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['confirm', 'cancel'])

// Composables
const { isDark } = useTheme()

// 计算属性
const _dialogClasses = computed(() => ({
  'confirm-dialog-overlay': true,
  'theme-dark': isDark.value
}))

// 方法
const getIconClass = () => {
  const iconMap = {
    success: 'fas fa-check-circle',
    warning: 'fas fa-exclamation-triangle',
    error: 'fas fa-times-circle',
    info: 'fas fa-info-circle'
  }
  return iconMap[props.type] || iconMap.info
}

const getConfirmIcon = () => {
  const iconMap = {
    success: 'fas fa-check',
    warning: 'fas fa-exclamation',
    error: 'fas fa-trash',
    info: 'fas fa-check'
  }
  return iconMap[props.type] || iconMap.info
}

const getConfirmButtonClass = () => {
  const classMap = {
    success: 'btn-success',
    warning: 'btn-warning',
    error: 'btn-danger',
    info: 'btn-primary'
  }
  return classMap[props.type] || classMap.info
}

const handleConfirm = () => {
  if (props.loading) return
  emit('confirm')
}

const handleCancel = () => {
  if (props.loading) return
  emit('cancel')
}

// 键盘事件处理
const handleKeydown = (event) => {
  if (!props.visible) return

  switch (event.key) {
  case 'Enter':
    event.preventDefault()
    handleConfirm()
    break
  case 'Escape':
    event.preventDefault()
    handleCancel()
    break
  }
}

// 监听键盘事件
watch(() => props.visible, (visible) => {
  if (visible) {
    document.addEventListener('keydown', handleKeydown)
    // 防止背景滚动
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.confirm-dialog {
  background: white;
  border-radius: 12px;
  min-width: 320px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  animation: confirmDialogSlideIn 0.3s ease;
}

/* 暗夜模式适配 */
.theme-dark .confirm-dialog {
  background: var(--tf-color-gray-ant-950);
  color: var(--color-bg-white);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--tf-color-gray-200);
}

.theme-dark .confirm-header {
  border-bottom-color: var(--tf-color-gray-ant-700);
}

.confirm-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  font-size: 18px;
}

.confirm-success .confirm-icon {
  background: var(--tf-color-green-ant-50);
  color: var(--tf-color-green-ant);
}

.confirm-warning .confirm-icon {
  background: var(--tf-color-orange-ant-surface);
  color: var(--tf-color-amber-ant);
}

.confirm-error .confirm-icon {
  background: var(--tf-color-red-ant-surface);
  color: var(--tf-color-red-ant);
}

.confirm-info .confirm-icon {
  background: var(--tf-color-cyan-ant-50);
  color: var(--tf-color-blue-ant);
}

.confirm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.theme-dark .confirm-title {
  color: var(--color-bg-white);
}

.confirm-body {
  padding: 16px 24px;
}

.confirm-message {
  margin: 0 0 12px 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.theme-dark .confirm-message {
  color: var(--tf-color-gray-element-placeholder);
}

.confirm-details {
  background: var(--tf-color-surface-muted);
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--tf-color-gray-500-solid);
  border-left: 3px solid var(--tf-color-blue-ant);
  margin-top: 12px;
}

.theme-dark .confirm-details {
  background: var(--tf-color-neutral-ant);
  color: var(--tf-color-gray-ant-400);
  border-left-color: var(--tf-color-blue-ant-dark);
}

.confirm-footer {
  padding: 16px 24px 24px;
  border-top: 1px solid var(--tf-color-gray-200);
}

.theme-dark .confirm-footer {
  border-top-color: var(--tf-color-gray-ant-700);
}

/* 动画 */
.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: all 0.3s ease;
}

.confirm-dialog-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

.confirm-dialog-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

@keyframes confirmDialogSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 移动端适配 */
@media (max-width: 480px) {
  .confirm-dialog-overlay {
    padding: 16px;
  }

  .confirm-dialog {
    min-width: 280px;
    margin: 0;
  }

  .confirm-header,
  .confirm-body,
  .confirm-footer {
    padding-left: 16px;
    padding-right: 16px;
  }

  .confirm-footer {
    gap: 8px;
  }
}

/* 无障碍访问优化 */
@media (prefers-reduced-motion: reduce) {
  .confirm-dialog {
    animation: none;
  }

  .confirm-dialog-enter-active,
  .confirm-dialog-leave-active {
    transition: none;
  }

}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .confirm-dialog {
    border: 2px solid currentColor;
  }

}
</style>
