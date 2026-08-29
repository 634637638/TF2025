<!--
  OrderQuery - H5前台订单查询页面
  功能：已登录用户直接显示订单，未登录用户通过手机号和姓名查询订单
-->
<template>
  <div class="order-query-page">
    <!-- 未登录验证表单 -->
    <div
      v-if="!isAuthenticated && !verified"
      class="verify-section"
    >
      <div class="verify-card">
        <div class="verify-header">
          <i class="fas fa-shield-alt verify-icon" />
          <h2 class="verify-title">
            订单查询
          </h2>
          <p class="verify-desc">
            请输入下单时的手机号和姓名查询订单
          </p>
        </div>

        <el-form
          ref="verifyFormRef"
          :model="form.values"
          :rules="verifyRules"
          label-position="top"
        >
          <el-form-item
            label="手机号"
            prop="customer_phone"
          >
            <el-input
              :model-value="form.values.customer_phone"
              type="tel"
              maxlength="11"
              placeholder="请输入手机号"
              size="large"
              @update:model-value="setPhoneFieldValue($event)"
              @blur="validate()"
            >
              <template #prefix>
                <i class="fas fa-phone" />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item
            label="姓名"
            prop="customer_name"
          >
            <el-input
              :model-value="form.values.customer_name"
              placeholder="请输入下单时的姓名"
              size="large"
              @update:model-value="setFieldValue('customer_name', $event)"
              @blur="validate()"
            >
              <template #prefix>
                <i class="fas fa-user" />
              </template>
            </el-input>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="verifying"
              class="w-full"
              @click="handleVerify"
            >
              查询订单
            </el-button>
          </el-form-item>
        </el-form>

        <div class="verify-tips">
          <p><i class="fas fa-info-circle" /> 为保护您的隐私，需要验证手机号和姓名</p>
          <p><i class="fas fa-lock" /> 您的信息仅用于订单验证，不会被泄露</p>
          <p><i class="fas fa-user-plus" /> 已有账号？<a @click="goToLogin">立即登录</a></p>
        </div>
      </div>
    </div>

    <!-- 订单列表 -->
    <div
      v-else
      class="orders-section"
    >
      <div class="orders-header">
        <div class="user-info">
          <i class="fas fa-user-circle" />
          <span>{{ displayName }}</span>
          <span class="phone">{{ formatPhone(displayPhone) }}</span>
        </div>
        <el-button
          link
          @click="handleLogout"
        >
          <i class="fas fa-sign-out-alt" /> 退出
        </el-button>
      </div>

      <!-- 订单列表 -->
      <div
        v-if="loading"
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
                <img
                  v-if="item.image_url"
                  :src="formatImageUrl(item.image_url)"
                  :alt="item.product_name"
                >
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
        v-else
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { useForm, ValidationRules, useLoadingState } from '@/composables'
import { getOrdersByPhone } from '@/api/shop-public'
import { getUserOrders, userManager, tokenManager, type AuthUser } from '@/api/auth'
import SectionLoading from '@/components/SectionLoading.vue'
import { formatImageUrl } from '@/utils/format'
import { normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
const router = useRouter()

// 认证状态
const isAuthenticated = ref(false)
const verified = ref(false)
const verifying = ref(false)
const { loading } = useLoadingState()
const { loading: loadingMore } = useLoadingState()

// 当前用户
const currentUser = ref<AuthUser | null>(null)

// 显示名称和手机号
const displayName = computed(() => {
  if (isAuthenticated.value && currentUser.value) {
    return currentUser.value.name
  }
  return form.values.customer_name
})

const displayPhone = computed(() => {
  if (isAuthenticated.value && currentUser.value) {
    return currentUser.value.phone
  }
  return form.values.customer_phone
})

// 验证表单
const verifyFormRef = ref<FormInstance>()
const setPhoneFieldValue = (value: string) => setFieldValue('customer_phone', normalizePhoneDigits(value))

// 使用 useForm 管理表单
const { form, validate, setFieldValue, reset } = useForm({
  initialValues: {
    customer_phone: '',
    customer_name: ''
  },
  validationRules: {
    customer_phone: [
      ValidationRules.required('请输入手机号'),
      ValidationRules.phone('请输入正确的手机号')
    ],
    customer_name: [
      ValidationRules.required('请输入姓名'),
      ValidationRules.minLength(2, '姓名至少2个字符')
    ]
  }
})

// 转换为 el-form 格式的 rules
const verifyRules = computed(() => {
  const rules: Record<string, any[]> = {}
  if (form.errors.customer_phone) {
    rules.customer_phone = [{ required: true, message: form.errors.customer_phone, trigger: 'blur' }]
  }
  if (form.errors.customer_name) {
    rules.customer_name = [{ required: true, message: form.errors.customer_name, trigger: 'blur' }]
  }
  return rules
})

// 订单数据
const orders = ref<any[]>([])
const current_page = ref(1)
const page_size = 10
const total = ref(0)

// 是否有更多
const hasMore = computed(() => {
  return orders.value.length < total.value
})

// 初始化：检查用户登录状态
onMounted(async () => {
  if (tokenManager.isAuthenticated()) {
    const user = userManager.getUser()
    if (user) {
      isAuthenticated.value = true
      currentUser.value = user
      await loadUserOrders()
    }
  }
})

// 监听路由变化，从详情页返回时刷新订单列表
watch(() => router.currentRoute.value,
  (newRoute) => {
    // 只有当返回到订单查询页面时才刷新
    if (newRoute.name === 'MobileOrderQuery') {
      if (isAuthenticated.value && currentUser.value) {
        loadUserOrders()
      } else if (verified.value) {
        const normalizedPhone = normalizePhoneDigits(form.values.customer_phone)
        // 未登录用户，重新查询订单
        getOrdersByPhone(normalizedPhone, {
          page: 1,
          page_size,
          customer_name: form.values.customer_name
        }).then((result: any) => {
          const validOrders = (result.data || []).filter((order: any) =>
            order.customer_name === form.values.customer_name
          )
          orders.value = validOrders
          total.value = result.total || 0
        })
      }
    }
  },
  { flush: 'post' }
)

// 加载已登录用户的订单
const loadUserOrders = async () => {
  loading.value = true
  try {
    const result: any = await getUserOrders()
    orders.value = result || []
    // H5_orders 表可能没有 total 字段，使用数据长度
    total.value = result.length || 0
    current_page.value = 1
  } catch (error: any) {
    logger.error('加载用户订单失败:', error)
    ElMessage.error(error.message || '加载订单失败')
  } finally {
    loading.value = false
  }
}

// 处理未登录用户验证
const handleVerify = async () => {
  if (!verifyFormRef.value) return

  try {
    await verifyFormRef.value.validate()

    verifying.value = true
    const normalizedPhone = normalizePhoneDigits(form.values.customer_phone)

    // 查询订单
    const result: any = await getOrdersByPhone(normalizedPhone, {
      page: 1,
      page_size,
      customer_name: form.values.customer_name
    })

    // 验证姓名：检查订单中是否有匹配的姓名
    const hasValidOrder = result.data && result.data.some((order: any) =>
      order.customer_name === form.values.customer_name
    )

    if (!hasValidOrder) {
      ElMessage.warning('未找到匹配的订单，请检查手机号和姓名是否正确')
      return
    }

    // 验证成功
    verified.value = true
    orders.value = result.data || []
    total.value = result.total || 0
    current_page.value = 1

    ElMessage.success(`查询成功，找到 ${orders.value.length} 条订单记录`)
  } catch (error: any) {
    logger.error('验证失败:', error)
    if (error.message) {
      ElMessage.error(error.message)
    }
  } finally {
    verifying.value = false
  }
}

// 退出
const handleLogout = () => {
  if (isAuthenticated.value) {
    // 已登录用户退出
    userManager.clearAuth()
    isAuthenticated.value = false
    currentUser.value = null
  } else {
    // 未登录用户退出验证
    verified.value = false
    reset()
  }
  orders.value = []
  current_page.value = 1
  total.value = 0
}

// 前往登录
const goToLogin = () => {
  router.push({
    path: '/m/login',
    query: { redirect: '/m/order-query' }
  })
}

// 加载更多
const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return

  loadingMore.value = true
  current_page.value++

  try {
    if (isAuthenticated.value) {
      // 已登录用户加载更多（暂时不支持分页）
      ElMessage.info('没有更多订单了')
    } else {
      const normalizedPhone = normalizePhoneDigits(form.values.customer_phone)
      // 未登录用户加载更多
      const result: any = await getOrdersByPhone(normalizedPhone, {
        page: current_page.value,
        page_size,
        customer_name: form.values.customer_name
      })

      // 过滤只显示匹配的订单
      const validOrders = (result.data || []).filter((order: any) =>
        order.customer_name === form.values.customer_name
      )

      orders.value.push(...validOrders)
      total.value = result.total || 0
    }
  } catch (error: any) {
    logger.error('加载更多失败:', error)
    ElMessage.error('加载失败')
    current_page.value--
  } finally {
    loadingMore.value = false
  }
}

// 格式化手机号
const formatPhone = (phone: string) => {
  if (!phone) return ''
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1****$3')
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

// 获取订单商品预览（最多显示2个）
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
    params: { orderNumber: order.order_number }
  })
}

// 返回首页
const goHome = () => {
  router.push('/m')
}
</script>

<style scoped lang="scss">
.order-query-page {
  min-height: 100vh;
  background: var(--tf-color-surface-soft);
}

// 验证区域
.verify-section {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;

  .verify-card {
    width: 100%;
    max-width: 400px;
    background: var(--color-bg-white);
    border-radius: 16px;
    padding: 32px 24px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

    .verify-header {
      text-align: center;
      margin-bottom: 32px;

      .verify-icon {
        font-size: 48px;
        color: var(--color-primary);
        margin-bottom: 16px;
      }

      .verify-title {
        font-size: 24px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 8px;
      }

      .verify-desc {
        font-size: 14px;
        color: var(--text-muted);
        margin: 0;
      }
    }

    .verify-tips {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid var(--tf-color-gray-200);

      p {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-secondary);
        margin: 8px 0;

        &:first-child {
          margin-top: 0;
        }

        i {
          color: var(--color-primary);
        }
      }
    }
  }
}

// 订单区域
.orders-section {
  padding-bottom: 20px;

  .orders-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--color-bg-white);
    padding: 16px;
    margin-bottom: 12px;

    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      color: var(--text-primary);

      i {
        font-size: 24px;
        color: var(--color-primary);
      }

      .phone {
        color: var(--text-muted);
        font-size: 14px;
      }
    }
  }
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
  min-height: calc(100vh - 100px);
}
</style>
