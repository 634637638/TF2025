<!--
  MyOrders - H5我的订单页面
  功能：根据手机号查询订单列表
-->
<template>
  <div class="my-orders-page">
    <UnifiedSearchPanel :expanded="true">
      <template #primary>
        <div class="search-box">
          <i class="fas fa-phone search-icon" />
          <input
            v-model="customer_phone"
            type="tel"
            maxlength="11"
            placeholder="请输入手机号查询订单"
            @input="onPhoneInput"
          >
          <input
            v-model.trim="customer_name"
            type="text"
            maxlength="50"
            placeholder="请输入下单姓名"
          >
          <el-button
            v-if="customer_phone"
            class="clear-btn"
            @click="clearPhone"
          >
            <i class="fas fa-times" />
          </el-button>
        </div>
      </template>
      <template #actions>
        <el-button
          type="primary"
          class="search-btn"
          :disabled="!isValidIdentity"
          :loading="searching"
          @click="searchOrders"
        >
          查询订单
        </el-button>
      </template>
    </UnifiedSearchPanel>

    <!-- 订单列表 -->
    <div
      v-if="loading && orders.length === 0"
      class="loading-state"
    >
      <SectionLoading
        text="加载订单中..."
        size="large"
      />
    </div>

    <div
      v-else-if="orders.length > 0"
      class="orders-list"
    >
      <div
        v-for="order in orders"
        :key="order.id"
        class="order-card"
        @click="goToDetail(order)"
      >
        <div class="order-header">
          <div class="order-number">
            订单号：{{ order.order_number }}
          </div>
          <div
            class="order-status"
            :class="`status-${order.status}`"
          >
            {{ getStatusText(order.status) }}
          </div>
        </div>

        <div class="order-content">
          <div class="order-info">
            <div class="info-row">
              <span class="label">下单时间</span>
              <span class="value">{{ formatTime(order.created_at) }}</span>
            </div>
            <div class="info-row">
              <span class="label">支付方式</span>
              <span class="value">{{ getPaymentText(order.payment_method) }}</span>
            </div>
          </div>

          <div class="order-items-preview">
            <div
              v-for="(item, index) in getFirstItems(order.items)"
              :key="index"
              class="item-preview"
            >
              <Image
                v-if="item.image_url"
                :src="item.image_url"
                :alt="item.product_name"
                mode="lazy"
              />
              <span>{{ item.product_name || '商品' }}</span>
              <span
                v-if="order.items.length > 1"
                class="more-count"
              >等{{ order.items.length }}件</span>
            </div>
          </div>

          <div class="order-footer">
            <div class="order-total">
              <span class="label">订单金额：</span>
              <span class="amount">¥{{ parseFloat(order.total_amount).toFixed(2) }}</span>
            </div>
            <i class="fas fa-chevron-right arrow-icon" />
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div
        v-if="hasMore"
        class="load-more"
        @click="loadMore"
      >
        <el-button :loading="loadingMore">
          加载更多
        </el-button>
      </div>
    </div>

    <!-- 空状态 -->
    <DataEmptyState
      v-else-if="searched"
      size="page"
      description="暂无订单记录"
    >
      <el-button
        type="primary"
        @click="goHome"
      >
        去逛逛
      </el-button>
    </DataEmptyState>

    <!-- 默认提示 -->
    <div
      v-else
      class="default-state"
    >
      <div class="tips-content">
        <i class="fas fa-clipboard-list tips-icon" />
        <p class="tips-title">
          查询我的订单
        </p>
        <p class="tips-desc">
          请输入下单时填写的手机号查询订单记录
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getOrdersByPhone } from '@/api/shop-public'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import Image from '@/components/Image.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import { useLoadingState } from '@/composables'
import { logger } from '@/utils/logger'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
const router = useRouter()

const customer_phone = ref('')
const customer_name = ref('')
const orders = ref<any[]>([])
const { loading } = useLoadingState()
const searching = ref(false)
const { loading: loadingMore } = useLoadingState()
const searched = ref(false)
const current_page = ref(1)
const page_size = 10
const total = ref(0)

// 验证手机号
const isValidPhone = computed(() => {
  return /^1[3-9]\d{9}$/.test(customer_phone.value)
})
const isValidIdentity = computed(() => isValidPhone.value && customer_name.value.length >= 2)

// 是否有更多
const hasMore = computed(() => {
  return orders.value.length < total.value
})

// 手机号输入
const onPhoneInput = (e: any) => {
  // 只允许输入数字
  customer_phone.value = e.target.value.replace(/\D/g, '')
}

// 清空手机号
const clearPhone = () => {
  customer_phone.value = ''
}

// 查询订单
const searchOrders = async () => {
  if (!isValidIdentity.value) {
    ElMessage.warning('请输入正确的手机号和下单姓名')
    return
  }

  searching.value = true
  loading.value = true
  current_page.value = 1
  orders.value = []
  searched.value = true

  try {
    const result: any = await getOrdersByPhone(customer_phone.value, {
      page: current_page.value,
      page_size,
      customer_name: customer_name.value
    })

    orders.value = result.data || []
    total.value = result.total || 0

    if (orders.value.length === 0) {
      ElMessage.info('未找到相关订单')
    }
  } catch (error: any) {
    logger.error('查询订单失败:', error)
    ElMessage.error(error.message || '查询订单失败')
  } finally {
    loading.value = false
    searching.value = false
  }
}

// 加载更多
const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return

  loadingMore.value = true
  current_page.value++

  try {
    const result: any = await getOrdersByPhone(customer_phone.value, {
      page: current_page.value,
      page_size,
      customer_name: customer_name.value
    })

    orders.value.push(...(result.data || []))
    total.value = result.total || 0
  } catch (error: any) {
    logger.error('加载更多失败:', error)
    ElMessage.error('加载失败')
    current_page.value-- // 恢复页码
  } finally {
    loadingMore.value = false
  }
}

// 获取状态文本
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消'
  }
  return texts[status] || '未知'
}

// 获取支付方式文本
const getPaymentText = (method: string) => {
  const texts: Record<string, string> = {
    pickup: '到店自提',
    wechat: '微信支付',
    alipay: '支付宝'
  }
  return texts[method] || method
}

// 格式化时间
const formatTime = (time: string) => {
  if (!time) return ''
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取前几个商品预览
const getFirstItems = (items: any[]) => {
  if (!items || items.length === 0) return []
  return items.slice(0, 2)
}

// 跳转到订单详情
const goToDetail = (order: any) => {
  storage.set(H5_STORAGE_KEYS.ORDER_SUCCESS, {
    orderNumber: order.order_number,
    totalAmount: order.total_amount,
    accessToken: order.access_token,
    timestamp: Date.now()
  }, 'session')
  router.push({
    name: 'MobileOrderDetail',
    params: {
      orderNumber: order.order_number
    }
  })
}

// 返回首页
const goHome = () => {
  router.push('/m')
}
</script>

<style scoped lang="scss">
.my-orders-page {
  min-height: 100vh;
  background: var(--tf-color-surface-soft);
  padding-bottom: 20px;
}

// 加载状态
.loading-state {
  padding: 20px;
}

// 订单列表
.orders-list {
  .order-card {
    background: var(--color-bg-white);
    margin: 0 12px 12px;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s;

    &:active {
      transform: scale(0.99);
    }

    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--tf-color-surface-muted);
      border-bottom: 1px solid var(--tf-color-gray-200);

      .order-number {
        font-size: 13px;
        color: var(--text-secondary);
      }

      .order-status {
        font-size: 13px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 4px;

        &.status-pending {
          color: var(--tf-status-warning-color);
          background: var(--tf-status-warning-bg);
          border: 1px solid var(--tf-status-warning-border);
        }

        &.status-paid {
          color: var(--tf-status-success-color);
          background: var(--tf-status-success-bg);
          border: 1px solid var(--tf-status-success-border);
        }

        &.status-shipped {
          color: var(--tf-status-info-color);
          background: var(--tf-status-info-bg);
          border: 1px solid var(--tf-status-info-border);
        }

        &.status-completed {
          color: var(--tf-status-success-color);
          background: var(--tf-status-success-bg);
          border: 1px solid var(--tf-status-success-border);
        }

        &.status-cancelled {
          color: var(--tf-status-danger-color);
          background: var(--tf-status-danger-bg);
          border: 1px solid var(--tf-status-danger-border);
        }
      }
    }

    .order-content {
      padding: 16px;

      .order-info {
        margin-bottom: 12px;

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;

          .label {
            font-size: 13px;
            color: var(--text-muted);
          }

          .value {
            font-size: 13px;
            color: var(--text-primary);
          }
        }
      }

      .order-items-preview {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;

        .item-preview {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--tf-color-surface-soft);
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          color: var(--text-secondary);

          img {
            width: 24px;
            height: 24px;
            border-radius: 4px;
            object-fit: cover;
          }

          .more-count {
            color: var(--text-muted);
            font-size: 11px;
          }
        }
      }

      .order-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 12px;
        border-top: 1px solid var(--tf-color-gray-200);

        .order-total {
          .label {
            font-size: 14px;
            color: var(--text-secondary);
          }

          .amount {
            font-size: 18px;
            font-weight: 500;
            color: var(--tf-color-accent-pink);
          }
        }

        .arrow-icon {
          color: var(--tf-color-gray-300-alt);
          font-size: 14px;
        }
      }
    }
  }
}

// 加载更多
.load-more {
  padding: 16px;
  text-align: center;

  .el-button {
    width: 100%;
    max-width: 200px;
  }
}

// 空状态
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 150px);
}

// 默认提示
.default-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 150px);

  .tips-content {
    text-align: center;

    .tips-icon {
      font-size: 64px;
      color: var(--tf-color-gray-300-alt);
      margin-bottom: 16px;
    }

    .tips-title {
      font-size: 18px;
      color: var(--text-primary);
      margin: 0 0 8px;
    }

    .tips-desc {
      font-size: 14px;
      color: var(--text-muted);
      margin: 0;
    }
  }
}
</style>
