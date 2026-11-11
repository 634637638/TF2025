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
        <div class="price-header-actions">
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
    font-size: var(--tf-type-scale-42);
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

    @media (max-width: 767px) {
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

  .price-header-actions {
    display: inline-grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    align-items: center;
    gap: var(--tf-space-2);
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

    box-sizing: border-box;

    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

    .btn-icon {
      flex: 0 0 auto;
      width: var(--icon-small, 16px);
      height: var(--icon-small, 16px);
      font-size: var(--icon-small, var(--tf-type-scale-16));
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

    &:disabled {

      cursor: not-allowed;
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

@media (max-width: 767px) {
  .header-section {
    padding: 44px 16px 28px;

    .title {
      font-size: var(--tf-type-scale-32);
      gap: 10px;
    }
  }

  .notice-section .price-header-actions {
    padding: 0 12px;
  }

  .public-price-header.has-actions .header-section {
    padding-bottom: 16px;
  }
}

@media (max-width: 479px) {
  .header-section {
    padding: 32px 12px 22px;

    .title {
      font-size: var(--tf-type-scale-26);
      gap: 8px;
    }
  }

  .notice-section .price-header-actions {
    padding: 0 10px;
  }

  .notice-section {
    padding: 18px 0 4px;
  }

  .notice-section :deep(.price-header-action) {
    gap: 4px;

    .btn-content {
      gap: 4px;
    }
  }
}

@media (max-width: 360px) {
  .notice-section .price-header-actions {
    padding: 0 6px;
  }
}
</style>
