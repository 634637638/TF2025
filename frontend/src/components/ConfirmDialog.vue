<template>
  <transition name="confirm-dialog">
    <div v-if="visible" class="confirm-dialog-overlay" @click.self="handleCancel">
      <div class="confirm-dialog" :class="[`confirm-${type}`]">
        <div class="confirm-header">
          <div class="confirm-icon">
            <i :class="getIconClass()"></i>
          </div>
          <h3 class="confirm-title">{{ title }}</h3>
        </div>

        <div class="confirm-body">
          <p class="confirm-message">{{ message }}</p>
          <div v-if="details" class="confirm-details">
            {{ details }}
          </div>
        </div>

        <div class="confirm-footer">
          <button
            class="btn btn-outline-secondary"
            @click="handleCancel"
            :disabled="loading"
          >
            <i class="fas fa-times"></i>
            {{ cancelText }}
          </button>
          <button
            class="btn"
            :class="getConfirmButtonClass()"
            @click="handleConfirm"
            :disabled="loading"
          >
            <i :class="loading ? 'fas fa-spinner fa-spin' : getConfirmIcon()"></i>
            {{ loading ? '处理中...' : confirmText }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useTheme } from '../composables/useTheme'

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
const dialogClasses = computed(() => ({
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
  background: #1f1f1f;
  color: #ffffff;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.theme-dark .confirm-header {
  border-bottom-color: #434343;
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
  background: #f6ffed;
  color: #52c41a;
}

.confirm-warning .confirm-icon {
  background: #fff7e6;
  color: #faad14;
}

.confirm-error .confirm-icon {
  background: #fff2f0;
  color: #ff4d4f;
}

.confirm-info .confirm-icon {
  background: #e6f7ff;
  color: #1890ff;
}

.confirm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333333;
  flex: 1;
}

.theme-dark .confirm-title {
  color: #ffffff;
}

.confirm-body {
  padding: 16px 24px;
}

.confirm-message {
  margin: 0 0 12px 0;
  font-size: 14px;
  line-height: 1.5;
  color: #666666;
}

.theme-dark .confirm-message {
  color: #b3b3b3;
}

.confirm-details {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #555555;
  border-left: 3px solid #1890ff;
  margin-top: 12px;
}

.theme-dark .confirm-details {
  background: #262626;
  color: #d9d9d9;
  border-left-color: #177ddc;
}

.confirm-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 24px 24px;
  border-top: 1px solid #f0f0f0;
}

.theme-dark .confirm-footer {
  border-top-color: #434343;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  min-height: 36px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline-secondary {
  background: transparent;
  color: #666666;
  border: 1px solid #d9d9d9;
}

.btn-outline-secondary:hover:not(:disabled) {
  background: #f5f5f5;
  color: #333333;
}

.btn-primary {
  background: #1890ff;
  color: white;
  border: 1px solid #1890ff;
}

.btn-primary:hover:not(:disabled) {
  background: #40a9ff;
  border-color: #40a9ff;
}

.btn-success {
  background: #52c41a;
  color: white;
  border: 1px solid #52c41a;
}

.btn-success:hover:not(:disabled) {
  background: #73d13d;
  border-color: #73d13d;
}

.btn-warning {
  background: #faad14;
  color: white;
  border: 1px solid #faad14;
}

.btn-warning:hover:not(:disabled) {
  background: #ffc53d;
  border-color: #ffc53d;
}

.btn-danger {
  background: #ff4d4f;
  color: white;
  border: 1px solid #ff4d4f;
}

.btn-danger:hover:not(:disabled) {
  background: #ff7875;
  border-color: #ff7875;
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
    flex-direction: column-reverse;
    gap: 8px;
  }

  .btn {
    width: 100%;
    justify-content: center;
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

  .btn {
    transition: none;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .confirm-dialog {
    border: 2px solid currentColor;
  }

  .btn {
    border-width: 2px;
  }
}
</style>