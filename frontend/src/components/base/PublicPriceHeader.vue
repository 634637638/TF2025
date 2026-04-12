<template>
  <div class="public-price-header">
    <div class="header-section">
      <div class="container">
        <h1 class="title">
          <slot name="title">{{ title }}</slot>
        </h1>

        <div v-if="$slots.search" class="search-box-wrapper">
          <div class="search-box">
            <slot name="search" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="$slots.actions" class="notice-section">
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
  .container {
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 0 20px;
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
    gap: 10px;
    padding: 0 16px;
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
    gap: 8px;
    padding: 0 12px;
  }
}
</style>
