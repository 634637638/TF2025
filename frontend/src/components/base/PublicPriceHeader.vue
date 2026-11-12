<template>
  <div
    class="public-price-header"
    :class="{ 'has-actions': $slots.actions }"
    :data-action-size="actionSize"
    :style="actionStyle"
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
import { computed } from 'vue'

interface Props {
  title: string
  actionWidth?: string | number
  actionSize?: 'small' | 'default' | 'large'
}

const props = defineProps<Props>()
const actionStyle = computed(() => {
  const width = typeof props.actionWidth === 'number' ? `${props.actionWidth}px` : props.actionWidth?.trim()
  return width ? { '--tf-price-header-action-width': width } : undefined
})
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
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--tf-space-2);
    padding: 0 var(--tf-space-5);
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  :deep(.price-header-action) {
    display: inline-flex;
    flex: 0 1 auto;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: var(--tf-price-header-action-width, auto);
    min-width: 0;
    max-width: 100%;
    margin: 0;

    box-sizing: border-box;

    > span {
      margin-left: 0;
    }

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
      margin-left: 0;
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

.public-price-header[data-action-size='small'] .price-header-actions {
  --tf-button-height: var(--tf-button-small-base-height);
  --tf-button-padding-x: var(--tf-button-small-base-padding-x);
  --tf-button-font-size: var(--tf-button-small-base-font-size);
}

.public-price-header[data-action-size='large'] .price-header-actions {
  --tf-button-height: var(--tf-button-height-large);
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
    padding: 0 var(--tf-space-3);
  }

  .public-price-header[data-action-size='small'] .price-header-actions {
    --tf-button-padding-x: var(--tf-space-1);
  }

  .notice-section :deep(.price-header-action),
  .notice-section :deep(.price-header-action > span),
  .notice-section :deep(.btn-content) {
    gap: var(--tf-space-1);
  }

  .notice-section :deep(.btn-icon) {
    width: var(--tf-type-scale-14);
    height: var(--tf-type-scale-14);
    font-size: var(--tf-type-scale-14);
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
    padding: 0 var(--tf-space-2);
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
    padding: 0 var(--tf-space-1);
  }

  .notice-section .price-header-actions:has(> :nth-child(4)) {
    display: inline-grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-items: center;
  }
}
</style>
