<template>
  <div
    class="public-price-header"
    :class="{ 'has-actions': $slots.actions }"
  >
    <div class="header-section">
      <div class="container">
        <h1 class="title">
          <slot name="title">
            {{ title }}
          </slot>
        </h1>

        <div
          v-if="$slots.search"
          class="search-box-wrapper"
        >
          <div class="search-box">
            <slot name="search" />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="$slots.actions"
      class="notice-section"
    >
      <div class="container">
        <div class="action-buttons">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.header-section {
  padding: 60px 20px 40px;
  text-align: center;
  color: white;

  .container {
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
    overflow-x: hidden;
  }

  .title {
    font-size: 42px;
    font-weight: bold;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
  }

  .search-box {
    max-width: 600px;
    margin: 0 auto 20px;

    @media (max-width: 768px) {
      max-width: 100%;
      padding: 0 15px;
      margin-bottom: 15px;
    }
  }
}

.notice-section {
  padding: 14px 0 6px;

  .container {
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
    text-align: center;
  }

  .action-buttons {
    display: inline-grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    align-items: center;
    padding: 0 20px;
    min-width: 0;
  }

  :deep(.price-header-action) {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-width: max-content;
    max-width: none;
    height: var(--tf-button-height, 36px);
    min-height: var(--tf-button-height, 36px);
    padding: 0 var(--tf-button-padding-x, 16px);
    border: 1px solid transparent;
    border-radius: var(--tf-button-radius, 6px);
    box-sizing: border-box;
    font-size: var(--tf-button-font-size, 14px);
    font-weight: var(--tf-button-font-weight, 600);
    line-height: 1;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

    .btn-icon {
      flex: 0 0 auto;
      width: var(--icon-small, 16px);
      height: var(--icon-small, 16px);
      font-size: var(--icon-small, 16px);
    }

    .btn-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn-content {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 0;
    }

    &:focus-visible {
      outline: none;
      box-shadow: var(--tf-button-focus-ring);
    }

    &:disabled {
      background: var(--tf-button-disabled-bg);
      border-color: var(--tf-button-disabled-border);
      color: var(--tf-button-disabled-color);
      box-shadow: none;
      cursor: not-allowed;
    }
  }

  :deep(.price-header-action--notice) {
    background: var(--tf-button-neutral-bg);
    border-color: var(--tf-button-neutral-border);
    color: var(--tf-button-neutral-color);

    &:hover:not(:disabled) {
      background: var(--tf-button-neutral-hover-bg);
      border-color: var(--tf-button-neutral-hover-border);
      color: var(--tf-button-neutral-hover-color);
    }
  }

  :deep(.price-header-action--inventory) {
    background: var(--tf-button-primary-bg);
    border-color: var(--tf-button-primary-border);
    color: var(--tf-button-primary-color);

    &:hover:not(:disabled),
    &.active {
      background: var(--tf-button-primary-hover-bg);
      border-color: var(--tf-button-primary-hover-border);
    }
  }

  :deep(.price-header-action--download) {
    background: var(--tf-button-success-bg);
    border-color: var(--tf-button-success-border);
    color: var(--tf-button-success-color);

    &:hover:not(:disabled) {
      background: var(--tf-button-success-hover-bg);
      border-color: var(--tf-button-success-hover-border);
    }
  }

}

.public-price-header.has-actions {
  .header-section {
    padding-bottom: 12px;
  }

  .search-box {
    margin-bottom: 0;
  }
}

@media (max-width: 768px) {
  .header-section {
    padding: 44px 16px 28px;

    .title {
      font-size: 32px;
      gap: 10px;
    }
  }

  .notice-section .action-buttons {
    padding: 0 12px;
  }

  .public-price-header.has-actions .header-section {
    padding-bottom: 16px;
  }

  .notice-section :deep(.price-header-action) {
    height: var(--touch-min, 44px);
    min-height: var(--touch-min, 44px);
    padding: 0 16px;
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .header-section {
    padding: 32px 12px 22px;

    .title {
      font-size: 26px;
      gap: 8px;
    }
  }

  .notice-section .action-buttons {
    padding: 0 10px;
  }

  .notice-section {
    padding: 18px 0 4px;
  }

  .notice-section :deep(.price-header-action) {
    gap: 4px;
    padding: 0 12px;
    font-size: 12px;

    .btn-content {
      gap: 4px;
    }
  }
}

@media (max-width: 360px) {
  .notice-section .action-buttons {
    padding: 0 6px;
  }
}
</style>
