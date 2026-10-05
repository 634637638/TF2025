<template>
  <MobileDialog
    v-if="isMobile"
    v-model="visible"
    :title="`${product.brand} ${product.model} 在库明细`"
    width="600px"
    :force-fullscreen="true"
    :close-on-click-modal="true"
    dialog-class="inventory-result-dialog"
    :show-default-footer="false"
  >
    <div class="inventory-mobile-body">
            <div class="product-header mobile-only">
              <div class="product-info">
                <div class="product-main">
                  <span class="brand">{{ product.brand }}</span>
                  <span class="model">{{ product.model }}</span>
                </div>
                <div
                  v-if="product.color || product.memory"
                  class="product-specs"
                >
                  <span
                    v-if="product.color"
                    class="color"
                  >{{ product.color }}</span>
                  <span
                    v-if="product.memory"
                    class="memory"
                  >{{ product.memory }}</span>
                </div>
                <span
                  v-if="!loading"
                  class="total-count"
                >共{{ totalCount }}台</span>
              </div>
            </div>

            <SectionLoading
              v-if="loading"
              text="加载中..."
              size="compact"
            />

            <div
              v-else
              class="inventory-list mobile-only"
            >
              <div
                v-for="(item, index) in inventoryData"
                :key="item.id"
                class="inventory-item"
                :class="{ 'priority-item': index === 0 }"
              >
                <div
                  class="item-rank"
                  :class="`rank-${Math.min(index + 1, 3)}`"
                >
                  <span v-if="index === 0"><i class="fas fa-star" /></span>
                  <span v-else>{{ index + 1 }}</span>
                </div>

                <div class="item-content">
                  <div class="item-header">
                    <span class="store-name">{{ item.store_name }}</span>
                    <span class="supplier-name">{{ item.supplier_name || '未关联' }}</span>
                    <span class="date">{{ item.inventory_date }}</span>
                  </div>
                  <div class="item-details">
                    <span class="identifier-label">序列号</span>
                    <span class="identifier-value">{{ getDeviceIdentifier(item) }}</span>
                    <span
                      class="inventory-age"
                      :class="getDaysClass(item.inventory_days)"
                    >
                      <span class="number">{{ item.inventory_days }}</span>
                      <span class="label">天</span>
                    </span>
                  </div>
                </div>
              </div>

              <DataEmptyState
                v-if="!loading && inventoryData.length === 0"
                description="暂无在库明细"
              />
            </div>
    </div>
  </MobileDialog>

  <MobileDialog
    v-else
    v-model="visible"
    :title="`${product.brand} ${product.model} 在库明细`"
    width="600px"
    :close-on-click-modal="true"
    :modal="false"
    dialog-class="inventory-result-dialog"
    :show-default-footer="false"
  >
    <div class="product-header">
      <div class="product-info">
        <div class="product-main">
          <span class="brand">{{ product.brand }}</span>
          <span class="model">{{ product.model }}</span>
        </div>
        <div
          v-if="product.color || product.memory"
          class="product-specs"
        >
          <span
            v-if="product.color"
            class="color"
          >{{ product.color }}</span>
          <span
            v-if="product.memory"
            class="memory"
          >{{ product.memory }}</span>
        </div>
        <span
          v-if="!loading"
          class="total-count"
        >共{{ totalCount }}台</span>
      </div>
    </div>

    <SectionLoading
      v-if="loading"
      text="加载中..."
      size="compact"
    />

    <div
      v-else
      class="inventory-list"
    >
      <div
        v-for="(item, index) in inventoryData"
        :key="item.id"
        class="inventory-item"
        :class="{ 'priority-item': index === 0 }"
      >
        <div
          class="item-rank"
          :class="`rank-${Math.min(index + 1, 3)}`"
        >
          <span v-if="index === 0"><i class="fas fa-star" /></span>
          <span v-else>{{ index + 1 }}</span>
        </div>

        <div class="item-content">
          <div class="item-header">
            <span class="store-name">{{ item.store_name }}</span>
            <span class="supplier-name">{{ item.supplier_name || '未关联' }}</span>
            <span class="date">{{ item.inventory_date }}</span>
        </div>
        <div class="item-details">
            <span class="identifier-label">序列号</span>
            <span class="identifier-value">{{ getDeviceIdentifier(item) }}</span>
            <span
              class="inventory-age"
              :class="getDaysClass(item.inventory_days)"
            >
              <span class="number">{{ item.inventory_days }}</span>
              <span class="label">天</span>
            </span>
          </div>
        </div>
      </div>

      <DataEmptyState
        v-if="!loading && inventoryData.length === 0"
        description="暂无在库明细"
      />
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useMobile } from '@/composables/mobile'
import SectionLoading from '@/components/SectionLoading.vue'
import { logger } from '@/utils/logger'
import type { InventoryItem } from '@/types'
import type { ModelValueProps } from '@/types/component'

interface Product {
  brand_id?: number
  model_id?: number
  color_id?: number
  memory_id?: number
  brand: string
  model: string
  color?: string
  memory?: string
}

interface LongInventoryQueryParams {
  brand_id?: number
  model_id?: number
  color_id?: number
  memory_id?: number
}

// Props
interface Props extends ModelValueProps {
  product?: Product
  queryToken?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  queryToken: '',
  product: () => ({
    brand_id: undefined,
    model_id: undefined,
    color_id: undefined,
    memory_id: undefined,
    brand: '',
    model: '',
    color: '',
    memory: ''
  })
})

// Emits
interface Emits {
  'update:modelValue': [value: boolean]
  authorizationExpired: []
}

const emit = defineEmits<Emits>()

// 响应式数据
const visible = ref(props.modelValue)
const loading = ref(false)
const inventoryData = ref<InventoryItem[]>([])
const { isMobile } = useMobile()

// 计算属性
const totalCount = computed(() => inventoryData.value.length)

watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
  if (newVal) {
    loadData()
  }
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

// 方法
const loadData = async () => {
  loading.value = true
  try {
    const params: LongInventoryQueryParams = {
      brand_id: props.product.brand_id,
      model_id: props.product.model_id,
      color_id: props.product.color_id,
      memory_id: props.product.memory_id
    }

    if (Object.values(params).some(id => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
      inventoryData.value = []
      ElMessage.error('当前报价缺少完整规格，无法查询在库明细')
      return
    }

    const response = await unifiedApi.get('/phones/longest-inventory', {
      params,
      headers: {
        'X-Inventory-Query-Token': props.queryToken
      }
    })

    if (response.success) {
      inventoryData.value = extractResponseData<InventoryItem[]>(response)
    } else {
      inventoryData.value = []
      ElMessage.error(response.message || '加载在库数据失败')
    }
  } catch (error: unknown) {
    inventoryData.value = []
    const requestError = error as { response?: { status?: number }; status?: number }
    const status = requestError.response?.status ?? requestError.status
    if (status === 401) {
      emit('authorizationExpired')
    } else {
      logger.error('加载在库数据失败:', error)
      ElMessage.error('在库明细加载失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}

if (visible.value) {
  loadData()
}

const getDaysClass = (days: number) => {
  if (days >= 30) return 'days-critical'
  if (days >= 20) return 'days-warning'
  if (days >= 10) return 'days-caution'
  return 'days-normal'
}

const formatIdentifier = (value?: string | null) => String(value || '').trim()
const isImei = (value?: string | null) => /^\d{15}$/.test(formatIdentifier(value))
const getDeviceIdentifier = (item: InventoryItem) => {
  if (isImei(item.imei)) return formatIdentifier(item.imei) || '未录入'
  return formatIdentifier(item.serial_number) || formatIdentifier(item.imei) || '未录入'
}

</script>

<style lang="scss" scoped>
.inventory-mobile-body {
  min-height: 0;
  padding: 0;
}

.product-header {
  --product-info-scale: 1;
  margin: 0 0 12px 0;
  padding: 16px;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  border-radius: 12px;
  color: white;
  overflow: hidden;

  .product-info {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    white-space: nowrap;
    width: calc(100% / var(--product-info-scale));
    min-width: 100%;
    transform: scale(var(--product-info-scale));
    transform-origin: left center;
  }

  .product-main {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
    font-size: 16px;
    font-weight: 500;
  }

  .product-specs {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
  }

  .brand {
    font-weight: 600;
    font-size: 18px;
  }

  .color,
  .memory {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 14px;
    white-space: nowrap;
  }

  .total-count {
    background: rgba(255, 255, 255, 0.3);
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    color: var(--color-bg-white);
    margin-left: auto;
    white-space: nowrap;
    align-self: center;
    flex: 0 0 auto;
  }
}

.inventory-list {
  max-height: none;
  overflow: visible;
  background: transparent;
  border-radius: 8px;
  box-shadow: none;
  padding: 8px 0 0;

  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(193, 193, 193, 0.5);
    border-radius: 3px;

    &:hover {
      background: rgba(168, 168, 168, 0.8);
    }
  }

  .inventory-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--tf-color-gray-ant-300);
    border-radius: 10px;
    margin-bottom: 12px;
    transition: all 0.3s ease;
    background: var(--color-bg-white);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    &:hover {
      border-color: var(--tf-color-indigo-brand);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
    }

    &.priority-item {
      background: linear-gradient(135deg, var(--tf-color-orange-ant-surface) 0%, var(--tf-color-warning-legacy) 100%);
      border-color: var(--tf-color-orange);

      .item-rank {
        background: linear-gradient(135deg, var(--tf-color-orange) 0%, var(--tf-color-coral) 100%);
        color: white;
        box-shadow: 0 2px 8px rgba(255, 107, 107, 0.4);
      }
    }

    .item-rank {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      background: var(--tf-color-gray-200);
      color: var(--text-muted);
      flex-shrink: 0;

      &.rank-1 {
        background: linear-gradient(135deg, var(--tf-color-gold) 0%, var(--tf-color-yellow-bright) 100%);
        color: var(--tf-color-dark-goldenrod);
      }

      &.rank-2 {
        background: linear-gradient(135deg, var(--tf-color-silver) 0%, var(--tf-color-gray-ant-300) 100%);
        color: var(--text-secondary);
      }

      &.rank-3 {
        background: linear-gradient(135deg, var(--tf-color-bronze) 0%, var(--tf-color-amber-muted) 100%);
        color: var(--tf-color-brown);
      }

      i {
        font-size: 16px;
      }
    }

    .item-content {
      flex: 1;
      min-width: 0;
      display: grid;
      --inventory-columns: minmax(58px, 0.85fr) minmax(max-content, 1.7fr) minmax(52px, 0.85fr);
      grid-template-columns: var(--inventory-columns);
      grid-template-rows: auto auto;
      column-gap: 12px;
      row-gap: 6px;
      align-items: center;

      .item-header {
        display: grid;
        grid-column: 1 / -1;
        grid-row: 1;
        grid-template-columns: var(--inventory-columns);
        align-items: center;
        min-width: 0;

        .store-name {
          grid-column: 1;
          grid-row: 1;
          justify-self: start;
          font-weight: 600;
          color: var(--tf-color-indigo-brand);
          font-size: 14px;
          min-width: 0;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .supplier-name {
          grid-column: 2;
          grid-row: 1;
          justify-self: center;
          margin-inline: auto;
          width: fit-content;
          max-width: 100%;
          min-width: 0;
          padding: 3px 9px;
          border-radius: 999px;
          background: var(--tf-color-indigo-50);
          color: var(--tf-color-indigo-700);
          font-size: 12px;
          font-weight: 600;
          white-space: normal;
          overflow-wrap: anywhere;
          text-align: center;
        }

        .date {
          grid-column: 3;
          grid-row: 1;
          justify-self: end;
          color: var(--tf-color-green-legacy);
          font-size: 12px;
          display: flex;
          align-items: center;
          white-space: nowrap;
          flex: 0 0 auto;
          font-weight: 600;
        }
      }

      .item-details {
        display: grid;
        grid-template-columns: var(--inventory-columns);
        grid-column: 1 / -1;
        grid-row: 2;
        align-items: center;
        min-height: 28px;
        min-width: 0;

        .identifier-label {
          grid-column: 1;
          justify-self: start;
          font-size: 13px;
          white-space: nowrap;
          color: var(--tf-color-slate-600);
          font-weight: 600;
        }

        .identifier-value {
          grid-column: 2;
          justify-self: center;
          min-width: max-content;
          width: max-content;
          max-width: none;
          overflow: visible;
          color: var(--tf-color-slate-900);
          font-size: 13px;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          white-space: nowrap;
          text-align: center;
        }

        .inventory-age {
          grid-column: 3;
          justify-self: end;
          display: inline-flex;
          align-items: baseline;
          justify-content: center;
          gap: 1px;
          text-align: center;
          padding: 4px 10px;
          border-radius: 999px;
          min-width: 52px;
          white-space: nowrap;

          .number {
            font-size: 18px;
            font-weight: 700;
            line-height: 1;
          }

          .label {
            font-size: 12px;
            font-weight: 600;
            opacity: 0.9;
          }

          &.days-normal {
            background: var(--tf-color-surface-green);
            color: var(--tf-color-green-material-800);
          }

          &.days-caution {
            background: var(--tf-color-orange-material-50);
            color: var(--tf-color-orange-material-900);
          }

          &.days-warning {
            background: var(--tf-color-amber-material-50);
            color: var(--tf-color-amber-material-900);
          }

          &.days-critical {
            background: var(--tf-color-red-50);
            color: var(--tf-color-red-material-800);
          }
        }
      }
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

}

// 手机端重写：移除旧的缩放/多断点叠加逻辑，按内容自然撑开
@media (max-width: 767px) {
  .mobile-dialog-sheet-panel.inventory-result-dialog .product-header {
    margin: 0 0 10px 0;
    padding: 12px;
    border-radius: 16px;

    .product-info {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-width: 0;
      white-space: nowrap;
      transform: none;
    }

    .product-main {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex: 0 1 auto;
      min-width: 0;
      font-size: 13px;
      flex-wrap: nowrap;
    }

    .brand {
      font-size: 14px;
    }

    .model {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .product-specs {
      display: inline-flex;
      align-items: center;
      flex-wrap: nowrap;
      gap: 4px;
      min-width: 0;
      flex: 0 1 auto;
    }

    .color,
    .memory {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 9px;
    }

    .total-count {
      margin-left: auto;
      flex: 0 0 auto;
      justify-self: auto;
      align-self: center;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 9px;
    }
  }

  .mobile-dialog-sheet-panel.inventory-result-dialog .inventory-list {
    padding: 0;
    border-radius: 0;

    .inventory-item {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 16px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);

      .item-rank {
        width: 34px;
        height: 34px;
        font-size: 12px;
        margin-top: 2px;

        i {
          font-size: 14px;
        }
      }

      .item-content {
        --inventory-columns: minmax(52px, 0.8fr) minmax(max-content, 1.8fr) minmax(48px, 0.8fr);
        grid-template-columns: var(--inventory-columns);
        grid-template-rows: auto auto;
        column-gap: 8px;
        row-gap: 8px;
        min-width: 0;
      }

      .item-header {
        display: grid;
        grid-column: 1 / -1;
        grid-row: 1;
        grid-template-columns: var(--inventory-columns);
        align-items: center;

        .store-name {
          grid-column: 1;
          grid-row: 1;
          font-size: 13px;
          line-height: 1.3;
        }

        .supplier-name {
          grid-column: 2;
          grid-row: 1;
          justify-self: center;
          padding: var(--tf-space-1) var(--tf-space-2);
          font-size: 11px;
          line-height: 1.3;
        }

        .date {
          grid-column: 3;
          grid-row: 1;
          font-size: 11px;
          line-height: 1.2;
        }
      }

      .item-details {
        display: grid;
        grid-template-columns: var(--inventory-columns);
        grid-column: 1 / -1;
        grid-row: 2;
        min-height: 26px;

        .identifier-label {
          grid-column: 1;
          justify-self: start;
          font-size: var(--mobile-text-body);
          line-height: 1.3;
        }

        .identifier-value {
          grid-column: 2;
          justify-self: center;
          width: max-content;
          max-width: none;
          overflow: visible;
          font-size: var(--mobile-text-body);
          line-height: 1.3;
          white-space: nowrap;
        }

        .inventory-age {
          grid-column: 3;
          justify-self: end;
          min-width: 46px;
          padding: 4px 8px;

          .number {
            font-size: 15px;
          }

          .label {
            font-size: 10px;
          }
        }
      }
    }
  }

}

@media (max-width: 390px) {
  .mobile-dialog-sheet-panel.inventory-result-dialog .product-header {
    padding: 10px;

    .product-info {
      gap: 4px;
    }

    .product-main {
      gap: 3px;
      font-size: 12px;
    }

    .brand {
      font-size: 13px;
    }

    .model {
      font-size: 12px;
    }

    .product-specs {
      gap: 3px;
    }

    .color,
    .memory,
    .total-count {
      font-size: 10px;
      padding: 2px 6px;
    }
  }

  .mobile-dialog-sheet-panel.inventory-result-dialog .inventory-list {
    .inventory-item {
      grid-template-columns: 30px minmax(0, 1fr);
      gap: 8px;
      padding: 10px;

      .item-rank {
        width: 30px;
        height: 30px;
        font-size: 11px;
      }

      .item-header {
        .store-name {
          font-size: 12px;
        }

        .date {
          font-size: 10px;
        }
      }

      .item-details {
        .identifier-label {
          font-size: var(--mobile-text-label);
        }

        .identifier-value {
          width: max-content;
          max-width: none;
          font-size: var(--mobile-text-label);
          white-space: nowrap;
        }

        .inventory-age {
          min-width: 42px;
          padding: 3px 7px;

          .number {
            font-size: 14px;
          }

          .label {
            font-size: 9px;
          }
        }
      }
    }
  }
}
</style>
