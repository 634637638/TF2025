<template>
  <div
    class="public-search-box"
    :class="{ 'is-verified': verified, 'is-disabled': disabled }"
  >
    <el-icon class="public-search-box__icon" aria-hidden="true">
      <Search />
    </el-icon>
    <el-input
      :model-value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="public-search-box__input"
      :disabled="disabled"
      :aria-busy="loading"
      @update:model-value="emit('update:modelValue', $event)"
      @keyup.enter="emit('search')"
    />
    <el-button
      v-if="modelValue"
      text
      circle
      native-type="button"
      class="public-search-box__clear"
      aria-label="清除搜索内容"
      :disabled="disabled"
      @click="emit('clear')"
    >
      <el-icon aria-hidden="true"><Close /></el-icon>
    </el-button>
    <el-button
      type="primary"
      native-type="button"
      class="public-search-box__submit"
      :disabled="disabled"
      :loading="loading"
      :aria-busy="loading"
      @click="emit('search')"
    >
      搜索
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { Close, Search } from '@element-plus/icons-vue'

interface Props {
  modelValue: string
  placeholder?: string
  verified?: boolean
  disabled?: boolean
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  placeholder: '搜索品牌或型号',
  verified: false,
  disabled: false,
  loading: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: []
  clear: []
}>()

</script>

<style scoped lang="scss">
.public-search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 52px;
  box-sizing: border-box;
  padding: 0 var(--tf-space-4);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--tf-radius-panel);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: border-color var(--tf-motion-standard) var(--tf-motion-ease-standard),
    box-shadow var(--tf-motion-standard) var(--tf-motion-ease-standard);

  &:hover {
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.15);
  }

  &:focus-within,
  &.is-verified {
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  }

  &.is-disabled {
    opacity: 0.65;
  }
}

.public-search-box__icon {
  flex: 0 0 auto;
  margin-right: var(--tf-space-2);
  color: var(--tf-color-indigo-brand);
  font-size: 18px;
}

.public-search-box__input {
  flex: 1 1 auto;
  min-width: 0;

  :deep(.el-input__wrapper) {
    height: 100%;
    padding: 0 var(--tf-space-2);
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  /* 公共搜索框由外层容器绘制聚焦反馈，避免内部输入框重复显示焦点圈。 */
  :deep(.el-input__wrapper.is-focus.is-focus) {
    box-shadow: none;
  }

  :deep(.el-input__inner) {
    color: var(--text-primary);
    font-size: var(--tf-font-body-lg);

    &::placeholder {
      color: var(--text-muted);
    }
  }
}

.public-search-box__clear {
  display: inline-flex;
  flex: 0 0 24px;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: var(--tf-space-2);
  padding: 0;
  border: 0;
  border-radius: var(--tf-radius-full);
  background: var(--tf-button-neutral-bg);
  color: var(--tf-button-tool-color);
  cursor: pointer;
  transition: background-color var(--tf-motion-standard) var(--tf-motion-ease-standard),
    color var(--tf-motion-standard) var(--tf-motion-ease-standard),
    transform var(--tf-motion-standard) var(--tf-motion-ease-standard);

  &:hover {
    background: var(--tf-button-neutral-hover-bg);
    color: var(--tf-button-neutral-hover-color);
  }

  &:active {
    transform: scale(0.95);
  }
}

.public-search-box__submit {
  flex: 0 0 68px;
  min-width: 68px;
  height: 36px;
  padding: 0 var(--tf-space-3);
  border: 0;
  border-radius: var(--tf-radius-control);
  background: var(--tf-button-primary-bg);
  color: var(--tf-button-on-color);
  font-size: var(--tf-font-body-lg);
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  transition: background-color var(--tf-motion-standard) var(--tf-motion-ease-standard),
    transform var(--tf-motion-standard) var(--tf-motion-ease-standard);

  &:hover {
    background: var(--tf-button-primary-hover-bg);
  }

  &:active {
    transform: scale(0.98);
  }
}

@media (max-width: 767px) {
  .public-search-box {
    height: 48px;
    padding: 0 var(--tf-space-2);
    border-radius: var(--tf-radius-card);
  }

  .public-search-box__icon {
    margin-right: 6px;
    font-size: var(--tf-font-body-lg);
  }

  .public-search-box__input {
    padding: 0 var(--tf-space-1);

    :deep(.el-input__wrapper) {
      padding: 0 var(--tf-space-1);
    }

    :deep(.el-input__inner) {
      font-size: var(--tf-font-body);
    }
  }

  .public-search-box__clear {
    flex-basis: 20px;
    width: 20px;
    height: 20px;
    margin-right: 6px;
  }

  .public-search-box__submit {
    flex-basis: 58px;
    min-width: 58px;
    height: 34px;
    padding: 0 var(--tf-space-2);
    border-radius: 4px;
    font-size: var(--tf-font-body);
  }
}

@media (max-width: 375px) {
  .public-search-box {
    height: 46px;
    padding: 0 var(--tf-space-1);
  }

  .public-search-box__icon {
    margin-right: var(--tf-space-1);
    font-size: var(--tf-font-body);
  }

  .public-search-box__input {
    padding: 0 2px 0 4px;

    :deep(.el-input__wrapper) {
      padding: 0 2px 0 4px;
    }

    :deep(.el-input__inner) {
      font-size: 13px;
    }
  }

  .public-search-box__clear {
    flex-basis: 18px;
    width: 18px;
    height: 18px;
    margin-right: 4px;
  }

  .public-search-box__submit {
    flex-basis: 50px;
    min-width: 50px;
    height: 32px;
    padding: 0 var(--tf-space-1);
    font-size: 13px;
  }
}
</style>
