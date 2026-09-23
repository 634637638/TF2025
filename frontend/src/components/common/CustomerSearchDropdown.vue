<template>
  <Teleport
    to="body"
    :disabled="!teleportTarget"
  >
    <div
      v-if="visible && (items.length > 0 || loading || showEmptyCreate)"
      class="customer-search-dropdown"
      :class="{ 'customer-search-dropdown--floating': Boolean(teleportTarget) }"
      :style="teleportTarget ? floatingStyle : undefined"
      role="listbox"
    >
      <div
        v-if="loading"
        class="customer-search-dropdown__loading"
      >
        <InlineLoading
          text="搜索中..."
          size="small"
        />
      </div>

      <template v-else>
        <button
          v-for="(customer, index) in items"
          :key="customerKey(customer, index)"
          type="button"
          class="customer-search-dropdown__item"
          role="option"
          @mousedown.prevent
          @click="$emit('select', customer)"
        >
          <span class="customer-search-dropdown__content">
            <span class="customer-search-dropdown__line customer-search-dropdown__line--headline">
              <strong class="customer-search-dropdown__name">{{ customer.name || '未命名客户' }}</strong>
              <span
                v-if="customer.member_number"
                class="customer-search-dropdown__member"
              >{{ customer.member_number }}</span>
            </span>
            <span class="customer-search-dropdown__line customer-search-dropdown__line--subline">
              <span class="customer-search-dropdown__phone">{{ customer.phone || '-' }}</span>
              <span
                v-if="customer.vip_level"
                class="customer-search-dropdown__vip"
              >{{ vipLabel(customer.vip_level) }}</span>
            </span>
          </span>
        </button>

        <button
          v-if="showEmptyCreate"
          type="button"
          class="customer-search-dropdown__create"
          @mousedown.prevent
          @click="$emit('create')"
        >
          <i class="fas fa-user-plus" />
          <span class="customer-search-dropdown__create-text">{{ emptyCreateText }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import InlineLoading from '@/components/InlineLoading.vue'

export interface CustomerSearchDropdownItem {
  id: number
  name: string
  phone: string
  member_number?: string
  vip_level?: string
  apple_id?: string
}

const props = withDefaults(defineProps<{
  items: CustomerSearchDropdownItem[]
  loading?: boolean
  visible?: boolean
  keyword?: string
  minQueryLength?: number
  allowCreate?: boolean
  emptyCreateText?: string
  teleportTarget?: string
  floatingStyle?: Record<string, string>
}>(), {
  loading: false,
  visible: false,
  keyword: '',
  minQueryLength: 1,
  allowCreate: true,
  emptyCreateText: '暂无数据，点击创建新客户！',
  teleportTarget: '',
  floatingStyle: undefined
})

defineEmits<{
  select: [customer: CustomerSearchDropdownItem]
  create: []
}>()

const showEmptyCreate = computed(() =>
  props.allowCreate
  && !props.loading
  && props.items.length === 0
  && props.keyword.trim().length >= props.minQueryLength
)

const customerKey = (customer: CustomerSearchDropdownItem, index: number) =>
  `${String(customer.id || 'customer')}-${index}`

const vipLabel = (level: string) => ({
  normal: '普通',
  silver: '银卡',
  gold: '金卡',
  platinum: '白金'
}[level] || level)
</script>

<style scoped lang="scss">
.customer-search-dropdown {
  box-sizing: border-box;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  position: absolute;
  z-index: 1001;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--admin-table-panel-border);
  border-radius: var(--admin-data-table-radius);
  background: var(--admin-data-table-bg);
  box-shadow: var(--admin-stat-card-hover-shadow);
}

.customer-search-dropdown--floating {
  position: fixed;
  top: auto;
  right: auto;
  bottom: auto;
  left: auto;
  width: min(460px, calc(100vw - 32px));
  z-index: 3100;
  box-sizing: border-box;
}

.customer-search-dropdown__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  color: var(--admin-record-count-color);
  font-size: 14px;
}

.customer-search-dropdown__item,
.customer-search-dropdown__create {
  box-sizing: border-box;
  display: block;
  width: 100%;
  border: 0;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.customer-search-dropdown__item {
  padding: 12px 14px;
  border-bottom: 1px solid var(--admin-data-table-cell-border);
  background: transparent;
  color: inherit;
  transition: background-color 0.2s ease;
}

.customer-search-dropdown__item:hover,
.customer-search-dropdown__item:focus-visible {
  outline: 0;
  background: var(--admin-data-table-row-even-bg);
}

.customer-search-dropdown__item:last-of-type {
  border-bottom: 0;
}

.customer-search-dropdown__content {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.customer-search-dropdown__line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.customer-search-dropdown__name {
  min-width: 0;
  overflow: hidden;
  color: var(--admin-data-table-cell-color);
  font-size: 13px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-search-dropdown__phone,
.customer-search-dropdown__meta {
  color: var(--admin-record-count-color);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.customer-search-dropdown__phone {
  overflow: visible;
  flex: 0 0 auto;
}

.customer-search-dropdown__line--subline {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
}

.customer-search-dropdown__line--subline .customer-search-dropdown__vip {
  margin-left: auto;
}

.customer-search-dropdown__member,
.customer-search-dropdown__vip {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
}

.customer-search-dropdown__member {
  background: var(--tf-button-primary-soft-bg);
  color: var(--tf-button-primary-soft-color);
}

.customer-search-dropdown__vip {
  background: var(--tf-button-warning-soft-bg);
  box-shadow: var(--tf-button-warning-shadow);
  color: var(--tf-button-warning-soft-color);
}

.customer-search-dropdown__create {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 12px 14px;
  background: var(--tf-button-success-soft-bg);
  color: var(--tf-button-success-soft-color);
  font-size: 12px !important;
  font-weight: 500 !important;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
}

.customer-search-dropdown__create > i {
  flex: 0 0 16px;
  width: 16px;
  text-align: center;
}

.customer-search-dropdown__create-text {
  min-width: 0;
  overflow: hidden;
  font-size: inherit !important;
  line-height: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-search-dropdown__create:hover,
.customer-search-dropdown__create:focus-visible {
  outline: 0;
  background: var(--tf-button-success-soft-hover-bg);
}

@media (max-width: 768px) {
  .customer-search-dropdown {
    max-height: min(300px, 45vh);
  }

  .customer-search-dropdown--floating {
    width: min(460px, calc(100vw - 24px));
    max-width: calc(100vw - 24px);
  }

  .customer-search-dropdown__item,
  .customer-search-dropdown__create {
    padding: 10px 12px;
  }

  .customer-search-dropdown__create {
    gap: 5px;
    padding-inline: 10px;
    font-size: 10px !important;
    line-height: 1.35;
  }

  .customer-search-dropdown__create > i {
    flex-basis: 14px;
    width: 14px;
    font-size: 11px;
  }

  .customer-search-dropdown__line--subline {
    gap: 4px;
  }

  .customer-search-dropdown__phone {
    font-size: 11px;
  }

  .customer-search-dropdown__line--subline .customer-search-dropdown__vip {
    padding: 2px 5px;
    font-size: 9px;
  }
}
</style>
