<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClasses"
    @click="handleClick"
  >
    <i v-if="loading" class="fas fa-spinner animate-spin"></i>
    <i v-else-if="icon" :class="iconClass"></i>

    <span v-if="$slots.default" :class="{ 'ml-2': icon || loading }">
      <slot></slot>
    </span>

    <span v-if="badge" class="badge">{{ badge }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  icon?: string
  iconPosition?: 'left' | 'right'
  outline?: boolean
  rounded?: boolean
  block?: boolean
  badge?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  iconPosition: 'left',
  outline: false,
  rounded: false,
  block: false
})

interface Emits {
  click: [event: MouseEvent]
}

const emit = defineEmits<Emits>()

const buttonClasses = computed(() => {
  const classes = ['base-button', `btn-${props.variant}`, `btn-${props.size}`]

  if (props.outline) classes.push('btn-outline')
  if (props.rounded) classes.push('btn-rounded')
  if (props.block) classes.push('btn-block')
  if (props.disabled || props.loading) classes.push('btn-disabled')
  if (props.loading) classes.push('btn-loading')
  if (props.icon) classes.push('btn-icon')

  return classes
})

const iconClass = computed(() => {
  return props.icon?.startsWith('fa-') ? `fas ${props.icon}` : props.icon || ''
})

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-weight: 500;
  text-align: center;
  text-decoration: none;
  vertical-align: middle;
  cursor: pointer;
  user-select: none;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}

.base-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.25);
}

/* 尺寸 */
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
}

.btn-md {
  padding: 8px 16px;
  font-size: 14px;
  border-radius: 6px;
}

.btn-lg {
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 8px;
}

/* 变体 */
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
}

.btn-primary:hover:not(.btn-disabled) {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(.btn-disabled) {
  background: #5a6268;
  transform: translateY(-1px);
}

.btn-success {
  background: #28a745;
  border-color: #28a745;
  color: white;
}

.btn-success:hover:not(.btn-disabled) {
  background: #218838;
  transform: translateY(-1px);
}

.btn-warning {
  background: #ffc107;
  border-color: #ffc107;
  color: #212529;
}

.btn-warning:hover:not(.btn-disabled) {
  background: #e0a800;
  transform: translateY(-1px);
}

.btn-danger {
  background: #dc3545;
  border-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(.btn-disabled) {
  background: #c82333;
  transform: translateY(-1px);
}

.btn-info {
  background: #17a2b8;
  border-color: #17a2b8;
  color: white;
}

.btn-info:hover:not(.btn-disabled) {
  background: #138496;
  transform: translateY(-1px);
}

.btn-light {
  background: #f8f9fa;
  border-color: #f8f9fa;
  color: #212529;
}

.btn-light:hover:not(.btn-disabled) {
  background: #e2e6ea;
  transform: translateY(-1px);
}

.btn-dark {
  background: #343a40;
  border-color: #343a40;
  color: white;
}

.btn-dark:hover:not(.btn-disabled) {
  background: #23272b;
  transform: translateY(-1px);
}

/* 轮廓样式 */
.btn-outline {
  background: transparent;
}

.btn-outline.btn-primary {
  color: #667eea;
  border-color: #667eea;
}

.btn-outline.btn-primary:hover:not(.btn-disabled) {
  background: #667eea;
  color: white;
}

/* 圆角 */
.btn-rounded {
  border-radius: 50px;
}

/* 块级 */
.btn-block {
  width: 100%;
  display: flex;
}

/* 禁用状态 */
.btn-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

/* 加载状态 */
.btn-loading {
  cursor: wait;
}

/* 图标 */
.base-button i {
  display: inline-block;
}

.ml-2 {
  margin-left: 8px;
}

/* 徽章 */
.badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #dc3545;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  font-weight: bold;
}

/* 动画效果 */
.base-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.base-button:active::before {
  width: 300px;
  height: 300px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .btn-lg {
    padding: 10px 20px;
    font-size: 15px;
  }

  .btn-md {
    padding: 7px 14px;
    font-size: 13px;
  }

  .btn-sm {
    padding: 5px 10px;
    font-size: 11px;
  }
}
</style>
