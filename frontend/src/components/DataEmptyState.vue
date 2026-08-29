<template>
  <div
    class="data-empty-state"
    :class="[`data-empty-state--${state}`, `data-empty-state--${size}`]"
    :role="state === 'error' ? 'alert' : 'status'"
    :aria-live="state === 'error' ? 'assertive' : 'polite'"
  >
    <el-empty
      :image="image"
      :image-size="resolvedImageSize"
    >
      <template
        v-if="$slots.image"
        #image
      >
        <slot name="image" />
      </template>

      <template #description>
        <slot name="description">
          <div class="data-empty-state__content">
            <p
              v-if="title"
              class="data-empty-state__title"
            >
              {{ title }}
            </p>
            <p
              v-if="description"
              class="data-empty-state__description"
            >
              {{ description }}
            </p>
          </div>
        </slot>
      </template>

      <slot>
        <el-button
          v-if="actionText"
          :type="actionType"
          :loading="actionLoading"
          :disabled="actionDisabled || actionLoading"
          @click="emit('action')"
        >
          {{ actionText }}
        </el-button>
      </slot>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type DataEmptyStateKind = 'empty' | 'filtered' | 'error' | 'permission' | 'initial'
type DataEmptyStateSize = 'compact' | 'default' | 'page'

interface Props {
  state?: DataEmptyStateKind
  size?: DataEmptyStateSize
  title?: string
  description?: string
  image?: string
  imageSize?: number
  actionText?: string
  actionType?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  actionLoading?: boolean
  actionDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  state: 'empty',
  size: 'default',
  title: '',
  description: '暂无数据',
  image: '',
  imageSize: undefined,
  actionText: '',
  actionType: 'primary',
  actionLoading: false,
  actionDisabled: false
})

const emit = defineEmits<{
  action: []
}>()

const resolvedImageSize = computed(() => {
  if (props.imageSize !== undefined) return props.imageSize
  if (props.size === 'compact') return 72
  if (props.size === 'page') return 128
  return 96
})
</script>

<style scoped>
.data-empty-state {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 176px;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  color: var(--color-text-secondary);
  text-align: center;
}

.data-empty-state--compact {
  min-height: 128px;
  padding-block: 16px;
}

.data-empty-state--page {
  min-height: min(420px, 45vh);
  padding-block: 40px;
}

.data-empty-state :deep(.el-empty) {
  width: 100%;
  padding: 0;
}

.data-empty-state :deep(.el-empty__description) {
  margin-top: 12px;
}

.data-empty-state :deep(.el-empty__bottom) {
  margin-top: 16px;
}

.data-empty-state__content {
  display: grid;
  justify-items: center;
  gap: 6px;
  max-width: 480px;
  margin-inline: auto;
}

.data-empty-state__title,
.data-empty-state__description {
  margin: 0;
  overflow-wrap: anywhere;
}

.data-empty-state__title {
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
}

.data-empty-state__description {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.data-empty-state--error .data-empty-state__title,
.data-empty-state--error .data-empty-state__description {
  color: var(--danger-color);
}

@media (max-width: 768px) {
  .data-empty-state {
    min-height: 144px;
    padding: 18px 12px;
  }

  .data-empty-state--compact {
    min-height: 112px;
    padding-block: 12px;
  }

  .data-empty-state--page {
    min-height: min(320px, 40vh);
    padding-block: 28px;
  }

  .data-empty-state__content {
    max-width: 100%;
  }
}
</style>
