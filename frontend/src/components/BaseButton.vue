<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClasses"
    @click="handleClick"
  >
    <InlineLoading
      v-if="loading"
      size="small"
      variant="inherit"
    />
    <i
      v-else-if="icon"
      :class="iconClass"
    />

    <span
      v-if="$slots.default"
      :class="{ 'ml-2': icon || loading }"
    >
      <slot />
    </span>

    <span
      v-if="badge"
      class="badge"
    >{{ badge }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InlineLoading from '@/components/InlineLoading.vue'

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
  icon: '',
  iconPosition: 'left',
  outline: false,
  rounded: false,
  block: false,
  badge: undefined
})

interface Emits {
  click: [event: MouseEvent]
}

const emit = defineEmits<Emits>()

const buttonClasses = computed(() => {
  const classes = ['base-button', 'btn', `btn-${props.variant}`, `btn-${props.size}`]

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
  box-shadow: var(--tf-button-primary-shadow);
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
  transform: none;
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
  background: var(--danger-color);
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
  background: var(--tf-button-overlay-bg);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.base-button:active::before {
  width: 300px;
  height: 300px;
}

</style>
