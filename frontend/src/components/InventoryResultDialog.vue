<template>
  <Teleport to="body">
    <transition name="inventory-mobile-fade">
      <div
        v-if="visible && isMobile"
        class="inventory-mobile-overlay"
        @click.self="handleClose"
      >
        <div class="inventory-mobile-sheet">
          <div class="inventory-mobile-header">
            <div class="inventory-mobile-title">{{ product.brand }} {{ product.model }} 在库明细</div>
            <button type="button" class="inventory-mobile-close" @click="handleClose">
              <i class="el-icon">
                <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                  <path fill="currentColor" d="M764.288 214.656a42.624 42.624 0 0 1 60.224 60.288L572.16 527.104l252.352 252.224a42.624 42.624 0 1 1-60.224 60.288L512 587.392 259.648 839.616a42.624 42.624 0 1 1-60.224-60.288l252.352-252.224L199.424 274.944a42.624 42.624 0 0 1 60.224-60.288L512 466.88z" />
                </svg>
              </i>
            </button>
          </div>

          <div v-loading="loading" class="inventory-mobile-body">
            <div class="product-header mobile-only">
              <div class="product-info">
                <div class="product-main">
                  <span class="brand">{{ product.brand }}</span>
                  <span class="model">{{ product.model }}</span>
                </div>
                <div class="product-specs" v-if="product.color || product.memory">
                  <span v-if="product.color" class="color">{{ product.color }}</span>
                  <span v-if="product.memory" class="memory">{{ product.memory }}</span>
                </div>
                <span v-if="!loading" class="total-count">共{{ totalCount }}台</span>
              </div>
            </div>

            <div class="inventory-list mobile-only">
              <div
                v-for="(item, index) in inventoryData"
                :key="item.id"
                class="inventory-item"
                :class="{ 'priority-item': index === 0 }"
              >
                <div class="item-rank" :class="`rank-${Math.min(index + 1, 3)}`">
                  <span v-if="index === 0"><i class="fas fa-star"></i></span>
                  <span v-else>{{ index + 1 }}</span>
                </div>

                <div class="item-content">
                  <div class="item-header">
                    <span class="store-name">{{ item.store_name }}</span>
                    <span class="date">{{ item.inventory_date }}</span>
                  </div>
                  <div class="item-details">
                    <span class="imei">
                      <span class="imei-label">序列号</span>
                      {{ item.imei }}
                    </span>
                    <span class="item-days" :class="getDaysClass(item.inventory_days)">
                      <span class="number">{{ item.inventory_days }}</span>
                      <span class="label">天</span>
                    </span>
                  </div>
                </div>
              </div>

              <div v-if="!loading && inventoryData.length === 0" class="empty-result">
                <el-empty description="暂无在库明细" />
              </div>
            </div>
          </div>

          <div class="inventory-mobile-footer">
            <el-button type="primary" @click="handleClose">关闭</el-button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <MobileDialog
    v-if="!isMobile"
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
        <div class="product-specs" v-if="product.color || product.memory">
          <span v-if="product.color" class="color">{{ product.color }}</span>
          <span v-if="product.memory" class="memory">{{ product.memory }}</span>
        </div>
        <span v-if="!loading" class="total-count">共{{ totalCount }}台</span>
      </div>
    </div>

    <div v-loading="loading" class="inventory-list">
      <div
        v-for="(item, index) in inventoryData"
        :key="item.id"
        class="inventory-item"
        :class="{ 'priority-item': index === 0 }"
      >
        <div class="item-rank" :class="`rank-${Math.min(index + 1, 3)}`">
          <span v-if="index === 0"><i class="fas fa-star"></i></span>
          <span v-else>{{ index + 1 }}</span>
        </div>

        <div class="item-content">
          <div class="item-header">
            <span class="store-name">{{ item.store_name }}</span>
            <span class="date">{{ item.inventory_date }}</span>
          </div>
          <div class="item-details">
            <span class="imei">
              <span class="imei-label">序列号</span>
              {{ item.imei }}
            </span>
            <span class="item-days" :class="getDaysClass(item.inventory_days)">
              <span class="number">{{ item.inventory_days }}</span>
              <span class="label">天</span>
            </span>
          </div>
        </div>
      </div>

      <div v-if="!loading && inventoryData.length === 0" class="empty-result">
        <el-empty description="暂无在库明细" />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="handleClose">关闭</el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useMobile } from '@/composables/mobile'
import { logger } from '@/utils/logger'
import type { InventoryItem } from '@/types'
import type { ModelValueProps, UpdateModelValueEmits } from '@/types/component'

interface Product {
  brand: string
  model: string
  color?: string
  memory?: string
}

interface LongInventoryQueryParams {
  brand?: string
  model?: string
  color?: string
  memory?: string
}

interface InventoryResultError {
  response?: {
    status?: number
  }
  message?: string
}

// Props
interface Props extends ModelValueProps {
  product: Product
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  product: () => ({
    brand: '',
    model: '',
    color: '',
    memory: ''
  })
})

// Emits
const emit = defineEmits<UpdateModelValueEmits>()

// 响应式数据
const visible = ref(false)
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
  if (isMobile.value) {
    document.body.style.overflow = newVal ? 'hidden' : ''
  }
})

// 方法
const loadData = async () => {
  loading.value = true
  try {
    const params: LongInventoryQueryParams = {}
    if (props.product.brand) params.brand = props.product.brand
    if (props.product.model) params.model = props.product.model
    if (props.product.color) params.color = props.product.color
    if (props.product.memory) params.memory = props.product.memory

    const response = await unifiedApi.get('/phones/longest-inventory', { params })

    if (response.success) {
      inventoryData.value = extractResponseData<InventoryItem[]>(response)
    }
  } catch (error: unknown) {
    logger.error('加载在库数据失败:', error)
    const requestError = error as InventoryResultError

    // 如果后端返回 404，使用模拟数据作为演示
    if (requestError.response?.status === 404 || requestError.message?.includes('404')) {
      ElMessage.warning({
        message: '后端服务未连接，显示模拟数据',
        duration: 2000,
        offset: 60
      })
      // 使用模拟数据 - 仅显示在库商品
      inventoryData.value = [
        {
          id: 1,
          store_name: '总店',
          imei: '4901542032375185',
          inventory_date: '2024-01-15',
          inventory_days: Math.floor((Date.now() - new Date('2024-01-15').getTime()) / (1000 * 60 * 60 * 24))
        },
        {
          id: 2,
          store_name: '广场店',
          imei: '4901542032375186',
          inventory_date: '2024-02-01',
          inventory_days: Math.floor((Date.now() - new Date('2024-02-01').getTime()) / (1000 * 60 * 60 * 24))
        },
        {
          id: 3,
          store_name: '三小店',
          imei: '4901542032375187',
          inventory_date: '2024-02-20',
          inventory_days: Math.floor((Date.now() - new Date('2024-02-20').getTime()) / (1000 * 60 * 60 * 24))
        }
      ]
    } else {
      ElMessage.error('加载数据失败')
    }
  } finally {
    loading.value = false
  }
}

const handleClose = () => {
  visible.value = false
}

const getDaysClass = (days: number) => {
  if (days >= 30) return 'days-critical'
  if (days >= 20) return 'days-warning'
  if (days >= 10) return 'days-caution'
  return 'days-normal'
}

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
.inventory-mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
  overflow-y: auto;
}

.inventory-mobile-sheet {
  width: 100%;
  max-width: 100%;
  max-height: calc(100vh - 16px);
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.inventory-mobile-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 68px;
  padding: 12px 52px 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.inventory-mobile-title {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
}

.inventory-mobile-close {
  position: absolute;
  top: 50%;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  transform: translateY(-50%);
}

.inventory-mobile-close .el-icon,
.inventory-mobile-close svg {
  width: 18px;
  height: 18px;
}

.inventory-mobile-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 10px 8px 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.inventory-mobile-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding: 6px 8px 10px;
}

.inventory-mobile-fade-enter-active,
.inventory-mobile-fade-leave-active {
  transition: opacity 0.2s ease;
}

.inventory-mobile-fade-enter-from,
.inventory-mobile-fade-leave-to {
  opacity: 0;
}

:deep(.inventory-result-dialog) {
  .el-dialog {
    overflow: hidden !important;
    width: min(96vw, 600px) !important;
    max-width: min(96vw, 600px) !important;
  }

  .el-dialog__header {
    padding: 12px 0 0 !important;
  }

  .el-dialog__body {
    padding: 10px 0 0 !important;
    background: #ffffff !important;
  }

  .el-dialog__footer {
    display: block !important;
    padding: 0 !important;
    border-top: none !important;
    background: #ffffff !important;
    min-height: 0 !important;
  }
}

.product-header {
  --product-info-scale: 1;
  margin: 0 0 12px 0;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
    color: #fff;
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
    border: 1px solid #e8e8e8;
    border-radius: 10px;
    margin-bottom: 12px;
    transition: all 0.3s ease;
    background: #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

    &:hover {
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
    }

    &.priority-item {
      background: linear-gradient(135deg, #fff7e6 0%, #ffe8cc 100%);
      border-color: #ffa500;

      .item-rank {
        background: linear-gradient(135deg, #ffa500 0%, #ff6b6b 100%);
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
      background: #f0f0f0;
      color: #999;
      flex-shrink: 0;

      &.rank-1 {
        background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
        color: #b8860b;
      }

      &.rank-2 {
        background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);
        color: #666;
      }

      &.rank-3 {
        background: linear-gradient(135deg, #cd7f32 0%, #e5a35d 100%);
        color: #8b4513;
      }

      i {
        font-size: 16px;
      }
    }

    .item-content {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 6px;

      .item-header {
        display: flex;
        align-items: center;
        flex-wrap: nowrap;
        gap: 8px;
        min-width: 0;

        .store-name {
          font-weight: 600;
          color: #667eea;
          font-size: 14px;
          flex: 1 1 auto;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .date {
          color: #27ae60;
          font-size: 12px;
          display: flex;
          align-items: center;
          white-space: nowrap;
          flex: 0 0 auto;
          font-weight: 600;
        }
      }

      .item-details {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-width: 0;

        .imei {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #7f8c8d;
          font-size: 13px;
          font-family: 'Courier New', monospace;
          min-width: 0;
          flex: 1 1 auto;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          .imei-label {
            color: #475569;
            font-weight: 600;
            flex-shrink: 0;
          }
        }

        .item-days {
          flex: 0 0 auto;
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
            background: #e8f5e9;
            color: #2e7d32;
          }

          &.days-caution {
            background: #fff3e0;
            color: #e65100;
          }

          &.days-warning {
            background: #fff8e1;
            color: #f57f17;
          }

          &.days-critical {
            background: #ffebee;
            color: #c62828;
          }
        }
      }
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  .empty-result {
    padding: 40px 20px;
    text-align: center;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  margin: 0;
  padding: 8px 12px 12px;
}

// 手机端重写：移除旧的缩放/多断点叠加逻辑，按内容自然撑开
@media (max-width: 768px) {
  .inventory-mobile-sheet {
    border-radius: 18px;
    max-height: calc(100vh - 16px);
  }

  .inventory-mobile-body {
    padding: 10px 8px 0;
  }

  .inventory-mobile-footer {
    padding: 6px 8px 10px;
  }

  .inventory-mobile-sheet .product-header {
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

  .inventory-mobile-sheet .inventory-list {
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
        display: grid;
        gap: 8px;
        min-width: 0;
      }

      .item-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;

        .store-name {
          font-size: 13px;
          line-height: 1.3;
        }

        .date {
          font-size: 11px;
          line-height: 1.2;
        }
      }

      .item-details {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;

        .imei {
          font-size: 11px;
          line-height: 1.3;
        }

        .item-days {
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

  .inventory-mobile-sheet .dialog-footer,
  .inventory-mobile-footer {
    padding: 4px 8px 10px;
  }
}

@media (max-width: 390px) {
  .inventory-mobile-overlay {
    padding: 4px 2px;
  }

  .inventory-mobile-header {
    min-height: 62px;
    padding: 10px 46px 10px 12px;
  }

  .inventory-mobile-title {
    font-size: 16px;
  }

  .inventory-mobile-close {
    right: 10px;
    width: 34px;
    height: 34px;
  }

  .inventory-mobile-body {
    padding: 8px 4px 0;
  }

  .inventory-mobile-footer {
    padding: 4px 4px 8px;
  }

  .inventory-mobile-sheet .product-header {
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

  .inventory-mobile-sheet .inventory-list {
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
        .imei {
          font-size: 10px;
        }

        .item-days {
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
