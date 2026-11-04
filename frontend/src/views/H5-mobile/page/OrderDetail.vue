<!--
  OrderDetail - H5订单详情页面
  功能：显示订单详细信息、商品列表、状态
-->
<template>
  <div class="order-detail-page">
    <div
      v-if="loading"
      class="loading-state"
    >
      <SectionLoading
        text="加载订单详情中..."
        size="large"
      />
    </div>

    <div
      v-else-if="orderData"
      class="order-content"
    >
      <!-- 订单状态 -->
      <div class="status-card">
        <div class="status-icon">
          <i :class="getStatusIcon(orderData.status)" />
        </div>
        <h2 class="status-title">
          {{ getStatusText(orderData.status) }}
        </h2>
        <p
          v-if="orderData.status === 'pending' && remainingTime > 0"
          class="status-tip"
        >
          请在 <span class="countdown">{{ formatTime(remainingTime) }}</span> 内完成支付
        </p>
        <p
          v-else-if="orderData.status === 'pending'"
          class="status-tip expired"
        >
          订单已过期，无法支付
        </p>
        <p
          v-else-if="orderData.status === 'paid'"
          class="status-tip warning"
        >
          <i class="fas fa-info-circle" />
          您的订单正在审核中，请耐心等待后台确认
        </p>
        <p
          v-else-if="orderData.status === 'confirmed'"
          class="status-tip success"
        >
          <i class="fas fa-check-circle" />
          订单已确认，我们会尽快为您发货
        </p>
      </div>

      <!-- 订单信息 -->
      <div class="section">
        <h3 class="section-title">
          订单信息
        </h3>
        <div class="info-list">
          <div class="info-item">
            <span class="label">订单号</span>
            <span class="value">{{ orderData.order_number }}</span>
          </div>
          <div class="info-item">
            <span class="label">下单时间</span>
            <span class="value">{{ formatTime(orderData.created_at) }}</span>
          </div>
          <div class="info-item">
            <span class="label">支付方式</span>
            <span class="value">{{ getPaymentText(orderData.payment_method) }}</span>
          </div>
        </div>
      </div>

      <!-- 收货信息 -->
      <div class="section">
        <h3 class="section-title">
          收货信息
        </h3>
        <div class="info-list">
          <div class="info-item">
            <span class="label">联系人</span>
            <span class="value">{{ orderData.customer_name }}</span>
          </div>
          <div class="info-item">
            <span class="label">联系电话</span>
            <span class="value">{{ orderData.customer_phone }}</span>
          </div>
          <div
            v-if="orderData.customer_address"
            class="info-item"
          >
            <span class="label">收货地址</span>
            <span class="value">{{ orderData.customer_address }}</span>
          </div>
        </div>
      </div>

      <!-- 商品列表 -->
      <div class="section">
        <h3 class="section-title">
          商品信息
        </h3>
        <div class="order-items">
          <div
            v-for="item in orderData.items"
            :key="item.id"
            class="order-item"
          >
            <div class="item-image">
              <Image
                :src="item.image_url"
                :alt="item.product_name"
                mode="lazy"
              />
            </div>
            <div class="item-info">
              <h4 class="item-name">
                {{ item.product_name }}
              </h4>
              <p class="item-specs">
                {{ item.specs }}
              </p>
              <div class="item-footer">
                <span class="item-price">¥{{ formatAmount(item.sale_price) }}</span>
                <span class="item-quantity">x{{ item.quantity }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 价格明细 -->
      <div class="section price-section">
        <div class="price-row">
          <span>商品总额</span>
          <span>¥{{ formatAmount(orderData.total_amount) }}</span>
        </div>
        <div class="price-row">
          <span>运费</span>
          <span>免运费</span>
        </div>
        <div class="price-row total">
          <span>应付金额</span>
          <span class="total-amount">¥{{ formatAmount(orderData.total_amount) }}</span>
        </div>
      </div>

      <!-- 备注 -->
      <div
        v-if="orderData.remarks"
        class="section"
      >
        <h3 class="section-title">
          备注信息
        </h3>
        <p class="remarks">
          {{ orderData.remarks }}
        </p>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div
      v-if="orderData"
      class="bottom-bar"
    >
      <el-button
        v-if="orderData.status === 'pending' && !isOrderExpired"
        class="action-btn cancel-btn"
        :loading="cancelling"
        @click="handleCancelOrder"
      >
        取消订单
      </el-button>
      <el-button
        v-if="orderData.status === 'pending' && !isOrderExpired"
        type="primary"
        class="action-btn pay-btn"
        @click="handlePay"
      >
        立即支付
      </el-button>
      <el-button
        class="action-btn back-btn"
        @click="goBack"
      >
        {{ orderData.status === 'pending' && !isOrderExpired ? '返回' : '关闭' }}
      </el-button>
    </div>

    <!-- 支付方式选择弹窗 -->
    <MobileDialog
      v-model="showPaymentDialog"
      :title="paymentStep === 'select' ? '选择支付方式' : '扫码支付'"
      :show-close="true"
      :close-on-click-modal="true"
      :close-on-press-escape="true"
      width="90%"
      dialog-class="payment-dialog"
      :show-default-footer="false"
      @close="handlePaymentDialogClose"
    >
      <div class="payment-dialog-content">
        <!-- 步骤1：选择支付方式 -->
        <template v-if="paymentStep === 'select'">
          <!-- 订单金额 -->
          <div class="order-amount">
            <span class="label">订单金额</span>
            <span class="amount">¥{{ formatAmount(orderData?.total_amount) }}</span>
          </div>

          <!-- 支付方式选项 -->
          <div class="payment-options">
            <div
              v-for="option in paymentMethodOptions"
              :key="option.code"
              class="payment-option"
              :class="{ active: selectedPaymentMethod === option.code }"
              @click="selectPaymentMethod(option.code)"
            >
              <div
                class="payment-icon"
                :class="option.iconClass"
              >
                <i :class="option.icon" />
              </div>
              <div class="payment-info">
                <span class="payment-name">{{ option.label }}</span>
                <span class="payment-desc">{{ option.description }}</span>
              </div>
              <div class="payment-check">
                <i
                  v-if="selectedPaymentMethod === option.code"
                  class="fas fa-check-circle"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- 步骤2：显示支付二维码或信息 -->
        <template v-else-if="paymentStep === 'pay'">
          <!-- 微信支付二维码 -->
          <div
            v-if="selectedPaymentMethod === 'qr_wechat'"
            class="payment-qrcode"
          >
            <div class="qrcode-header">
              <i
                class="fab fa-weixin"
                style="color: #09bb07;"
              />
              <span>微信扫码支付</span>
            </div>
            <div class="qrcode-box">
              <img
                :src="formatImageUrl(shopConfig.wechat_qrcode)"
                alt="微信支付二维码"
              >
            </div>
            <p class="payment-tip">
              请使用微信扫一扫，扫描二维码完成支付
            </p>
          </div>

          <!-- 支付宝二维码 -->
          <div
            v-else-if="selectedPaymentMethod === 'qr_alipay'"
            class="payment-qrcode"
          >
            <div class="qrcode-header">
              <i
                class="fab fa-alipay"
                style="color: #1677ff;"
              />
              <span>支付宝扫码支付</span>
            </div>
            <div class="qrcode-box">
              <img
                :src="formatImageUrl(shopConfig.alipay_qrcode)"
                alt="支付宝二维码"
              >
            </div>
            <p class="payment-tip">
              请使用支付宝扫一扫，扫描二维码完成支付
            </p>
          </div>

          <div
            v-else-if="selectedPaymentMethod === 'qr_other'"
            class="payment-qrcode"
          >
            <div class="qrcode-header">
              <i class="fas fa-qrcode" /><span>{{ shopConfig.payment_qr_other_name }}</span>
            </div>
            <div class="qrcode-box">
              <img
                :src="formatImageUrl(shopConfig.other_qrcode)"
                :alt="`${shopConfig.payment_qr_other_name}二维码`"
              >
            </div>
          </div>

          <!-- 银行转账信息 -->
          <div
            v-else-if="selectedPaymentMethod === 'bank'"
            class="bank-transfer"
          >
            <div class="bank-header">
              <i
                class="fas fa-university"
                style="color: #ff6b00;"
              />
              <span>银行转账</span>
            </div>
            <div class="bank-info">
              <p style="white-space: pre-line;">
                {{ shopConfig.bank_info }}
              </p>
            </div>
          </div>

          <!-- 到店自提信息 -->
          <div
            v-else-if="selectedPaymentMethod === 'pickup'"
            class="pickup-info"
          >
            <div class="pickup-header">
              <i
                class="fas fa-store"
                style="color: #00c853;"
              />
              <span>到店自提</span>
            </div>
            <div class="pickup-details">
              <p v-if="shopConfig.shop_address">
                <i class="fas fa-map-marker-alt" /> {{ shopConfig.shop_address }}
              </p>
              <p v-if="shopConfig.shop_phone">
                <i class="fas fa-phone" /> {{ shopConfig.shop_phone }}
              </p>
              <p v-if="shopConfig.shop_hours">
                <i class="fas fa-clock" /> {{ shopConfig.shop_hours }}
              </p>
            </div>
            <p class="payment-tip">
              请到店出示订单号，完成支付
            </p>
          </div>
        </template>
      </div>

      <template #footer>
        <div
          v-if="paymentStep === 'select'"
          class="tf-dialog-actions dialog-footer"
        >
          <el-button
            type="default"
            @click="showPaymentDialog = false"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            :disabled="!selectedPaymentMethod"
            size="large"
            @click="confirmPaymentMethod"
          >
            下一步
          </el-button>
        </div>
        <div
          v-else
          class="tf-dialog-actions dialog-footer"
        >
          <el-button
            type="default"
            size="large"
            @click="backToSelect"
          >
            返回
          </el-button>
          <el-button
            type="success"
            size="large"
            @click="completePayment"
          >
            我已完成支付
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getOrderByNumber, getPublicConfig, cancelOrder, confirmPayment, type ShopConfig, type PublicOrder } from '@/api/shop-public'
import { getRequestErrorMessage } from '@/utils/api-response'
import { TimeUtil } from '@/utils/time'
import { formatAmount, formatDateTime as formatGlobalDateTime } from '@/utils/format'
import Image from '@/components/Image.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import { formatImageUrl } from '@/utils/format'
import { logger } from '@/utils/logger'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import { getShopPaymentOptions, getPaymentMethodLabel } from '@/utils/shop-payment'
const router = useRouter()
const route = useRoute()

interface OrderDetailItem {
  id?: number | string
  image_url?: string
  product_name?: string
  specs?: string
  sale_price?: number | string
  quantity?: number
}

interface OrderDetailRecord {
  id?: number | string
  order_number: string
  status: string
  expires_at?: string
  created_at?: string
  payment_method?: string
  customer_name?: string
  customer_phone?: string
  customer_address?: string
  items: OrderDetailItem[]
  total_amount?: number | string
  remarks?: string
}

const orderData = ref<OrderDetailRecord | null>(null)
const orderAccessToken = ref('')
const loading = ref(true)
const shopConfig = ref<Partial<ShopConfig>>({})
const paymentMethodOptions = computed(() => getShopPaymentOptions(shopConfig.value))
const cancelling = ref(false)
const remainingTime = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

// 支付相关
const showPaymentDialog = ref(false)
const selectedPaymentMethod = ref('')
const paymentStep = ref<'select' | 'pay'>('select')

// 计算订单是否已过期
const isOrderExpired = computed(() => {
  if (!orderData.value || !orderData.value.expires_at) return false
  return TimeUtil.parse(orderData.value.expires_at).isBefore(TimeUtil.now())
})

// 获取订单详情
const loadOrder = async () => {
  // 优先从 query 参数获取，其次从 params 获取
  const orderNumber = route.query.order_number || route.params.orderNumber || route.query.orderNumber

  if (!orderNumber) {
    ElMessage.error('订单号不能为空')
    logger.error('订单号获取失败', { query: route.query, params: route.params })
    router.push('/m')
    return
  }

  try {
    loading.value = true
    const storedOrder = storage.get<{ orderNumber: string; accessToken?: string }>(H5_STORAGE_KEYS.ORDER_SUCCESS, 'session')
    orderAccessToken.value = storedOrder?.orderNumber === String(orderNumber)
      ? String(storedOrder.accessToken || '')
      : ''
    const data = await getOrderByNumber(orderNumber as string, orderAccessToken.value)
    orderData.value = data as PublicOrder as OrderDetailRecord
  } catch (error: unknown) {
    logger.error('获取订单详情失败:', error)
    ElMessage.error(getRequestErrorMessage(error, '获取订单详情失败'))
    router.push('/m')
  } finally {
    loading.value = false
  }
}

// 获取商城配置
const loadConfig = async () => {
  try {
    shopConfig.value = await getPublicConfig()
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 获取状态图标
const getStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    pending: 'fas fa-clock',
    paid: 'fas fa-hourglass-half',  // 审核中用沙漏图标
    confirmed: 'fas fa-check-circle',  // 已确认用对勾
    shipped: 'fas fa-truck',
    completed: 'fas fa-check-double',
    cancelled: 'fas fa-times-circle'
  }
  return icons[status] || 'fas fa-file'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: '待支付',
    paid: '审核中',  // 改为"审核中"，表示等待后台确认
    confirmed: '已确认',  // 添加已确认状态
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消'
  }
  return texts[status] || '未知状态'
}

// 获取支付方式文本
const getPaymentText = (method: string) => {
  return getPaymentMethodLabel(method, shopConfig.value)
}

// 计算剩余时间（秒）
const calculateRemainingTime = () => {
  if (!orderData.value || !orderData.value.expires_at) {
    return 0
  }
  const now = TimeUtil.now().valueOf()
  const expiresAt = TimeUtil.parse(orderData.value.expires_at).valueOf()
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
  return remaining
}

// 格式化时间（支持日期字符串和秒数）
const formatTime = (time: string | number) => {
  // 如果是数字，作为秒数处理
  if (typeof time === 'number') {
    if (time <= 0) return '00:00:00'
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const secs = time % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // 如果是字符串，作为日期时间处理
  if (!time) return ''
  return formatGlobalDateTime(time, 'YYYY-MM-DD HH:mm')
}

// 返回
const goBack = () => {
  router.back()
}

// 开始倒计时
const startCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  remainingTime.value = calculateRemainingTime()

  if (remainingTime.value > 0) {
    countdownTimer = setInterval(() => {
      const remaining = calculateRemainingTime()
      remainingTime.value = remaining

      if (remaining <= 0) {
        clearInterval(countdownTimer)
        // 重新加载订单状态
        loadOrder()
      }
    }, 1000)
  }
}

// 处理支付
const handlePay = () => {
  // 打开支付方式选择弹窗
  showPaymentDialog.value = true
  paymentStep.value = 'select'
  // 重置选择的支付方式
  selectedPaymentMethod.value = ''
}

// 选择支付方式
const selectPaymentMethod = (method: string) => {
  selectedPaymentMethod.value = method
}

// 确认支付方式，进入下一步
const confirmPaymentMethod = () => {
  if (!selectedPaymentMethod.value) {
    ElMessage.warning('请选择支付方式')
    return
  }
  paymentStep.value = 'pay'
}

// 返回上一步
const backToSelect = () => {
  paymentStep.value = 'select'
}

// 关闭支付弹窗
const handlePaymentDialogClose = () => {
  paymentStep.value = 'select'
  selectedPaymentMethod.value = ''
}

// 完成支付
const completePayment = async () => {
  if (!orderData.value) return

  try {
    const loading = ElMessage({
      message: '正在确认支付...',
      type: 'info',
      duration: 0
    })

    // 调用确认支付API
    await confirmPayment(orderData.value.order_number, orderAccessToken.value)

    loading.close()
    ElMessage.success('支付确认成功！订单已提交审核，请耐心等待后台确认')

    showPaymentDialog.value = false

    // 重新加载订单状态
    await loadOrder()
  } catch (error: unknown) {
    logger.error('支付确认失败:', error)
    ElMessage.error(getRequestErrorMessage(error, '支付确认失败，请重试'))
  }
}

// 取消订单
const handleCancelOrder = async () => {
  try {
    await confirmAction(
      '取消后订单将无法恢复，是否继续？',
      '取消订单',
      {
        confirmButtonText: '确定取消',
        cancelButtonText: '再想想',
        type: 'warning'
      }
    )

    cancelling.value = true
    const orderId = Number(orderData.value.id)
    if (!Number.isInteger(orderId) || orderId <= 0) {
      throw new Error('订单标识无效，无法取消订单')
    }
    await cancelOrder(orderId, orderAccessToken.value, '用户主动取消')
    ElMessage.success('订单已取消')

    // 重新加载订单信息
    await loadOrder()
  } catch (error: unknown) {
    if (error !== 'cancel') {
      logger.error('取消订单失败:', error)
      ElMessage.error(getRequestErrorMessage(error, '取消订单失败'))
    }
  } finally {
    cancelling.value = false
  }
}

onMounted(async () => {
  await loadConfig()
  await loadOrder()
  startCountdown()
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})
</script>

<style scoped lang="scss">
.order-detail-page {
  min-height: 100vh;
  background: var(--tf-color-surface-soft);
  padding-bottom: 60px;
}

.loading-state {
  padding: 20px;
}

// 订单状态卡片
.status-card {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  color: var(--color-bg-white);
  text-align: center;
  padding: 32px 16px;

  .status-icon {
    i {
      font-size: var(--tf-type-scale-48);
      margin-bottom: 12px;
    }
  }

  .status-title {
    font-size: var(--tf-type-scale-20);
    font-weight: 500;
    margin: 0 0 8px;
  }

  .status-tip {
    font-size: var(--tf-type-scale-14);
    opacity: 0.9;
    margin: 0;

    .countdown {
      font-weight: 600;
      font-size: var(--tf-type-scale-16);
      color: var(--color-bg-white);
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 4px;
      margin: 0 4px;
    }

    &.expired {
      color: var(--tf-color-red-pastel);
    }
  }
}

// 通用区块
.section {
  background: var(--color-bg-white);
  margin: 12px;
  padding: 16px;
  border-radius: 8px;

  .section-title {
    font-size: var(--tf-type-scale-16);
    font-weight: 500;
    color: var(--text-primary);
    margin: 0 0 12px;
  }
}

// 信息列表
.info-list {
  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;

    .label {
      font-size: var(--tf-type-scale-14);
      color: var(--text-secondary);
    }

    .value {
      font-size: var(--tf-type-scale-14);
      color: var(--text-primary);
      text-align: right;
    }
  }
}

// 商品列表
.order-items {
  .order-item {
    display: flex;
    padding: 12px 0;
    border-bottom: 1px solid var(--tf-color-gray-200);

    &:last-child {
      border-bottom: none;
    }

    .item-image {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
      background: var(--tf-color-surface-soft);
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .item-info {
      flex: 1;
      margin-left: 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .item-name {
        font-size: var(--tf-type-scale-14);
        font-weight: 500;
        color: var(--text-primary);
        margin: 0;
      }

      .item-specs {
        font-size: var(--tf-type-scale-12);
        color: var(--text-muted);
        margin: 4px 0;
      }

      .item-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .item-price {
          font-size: var(--tf-type-scale-16);
          font-weight: 500;
          color: var(--tf-color-accent-pink);
        }

        .item-quantity {
          font-size: var(--tf-type-scale-14);
          color: var(--text-secondary);
        }
      }
    }
  }
}

// 价格明细
.price-section {
  .price-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: var(--tf-type-scale-14);

    &.total {
      border-top: 1px solid var(--tf-color-gray-200);
      padding-top: 12px;
      margin-top: 4px;
      font-size: var(--tf-type-scale-16);
      font-weight: 500;

      .total-amount {
        color: var(--tf-color-accent-pink);
        font-size: var(--tf-type-scale-20);
      }
    }
  }
}

// 备注
.remarks {
  font-size: var(--tf-type-scale-14);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
  white-space: pre-line;
}

// 底部操作栏
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: var(--color-bg-white);
  border-top: 1px solid var(--tf-color-gray-200-alt);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 200;

  .action-btn {
    height: 48px;
    border-radius: 24px;
    font-size: var(--tf-type-scale-15);
    font-weight: 500;
    transition: all 0.3s ease;
    border: none;

    &.back-btn {
      flex: 0 0 auto;
      width: 80px;
      background: var(--tf-button-neutral-bg);
      color: var(--tf-button-tool-color);

      &:active {
        transform: scale(0.95);
        background: var(--tf-button-neutral-hover-bg);
      }
    }

    &.cancel-btn {
      flex: 1;
      background: var(--tf-button-danger-soft-bg);
      color: var(--tf-button-danger-soft-color);
      border: 1px solid var(--tf-button-neutral-border);

      &:active {
        transform: scale(0.98);
        background: var(--tf-button-danger-soft-hover-bg);
      }
    }

    &.pay-btn {
      flex: 1.5;
      background: var(--tf-button-danger-bg);
      color: var(--tf-button-on-color);
      font-weight: 600;
      box-shadow: var(--tf-button-danger-shadow);

      &:active {
        transform: scale(0.98);
        box-shadow: var(--tf-button-danger-shadow);
      }
    }
  }
}

// 支付弹窗样式
:deep(.pay-dialog) {
  .el-message-box__message {
    line-height: 1.8;
    white-space: pre-line;
  }

  .el-message-box__content {
    padding: 20px;
  }
}

// 支付方式选择弹窗样式
:deep(.payment-dialog) {
  border-radius: 16px;
  overflow: hidden;
  --tf-dialog-body-padding-inline: var(--tf-space-5);
  --tf-dialog-body-padding-block: var(--tf-space-3) var(--tf-space-5);
  --tf-dialog-footer-padding-inline: var(--tf-space-5);
  --tf-dialog-footer-padding-block-start: 0px;
  --tf-dialog-footer-padding-block-end: var(--tf-space-5);
}

.payment-dialog-content {
  .order-amount {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: linear-gradient(135deg, var(--tf-color-red-surface) 0%, var(--tf-color-red-pastel-light) 100%);
    border-radius: 12px;
    margin-bottom: 20px;

    .label {
      font-size: var(--tf-type-scale-14);
      color: var(--text-secondary);
    }

    .amount {
      font-size: var(--tf-type-scale-24);
      font-weight: 600;
      color: var(--tf-color-red-coral);
    }
  }

  .payment-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .payment-option {
    display: flex;
    align-items: center;
    padding: 16px;
    background: var(--color-bg-white);
    border: 2px solid var(--tf-color-gray-200);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:active {
      transform: scale(0.98);
    }

    &.active {
      border-color: var(--tf-color-coral);
      background: linear-gradient(135deg, var(--tf-color-red-surface) 0%, var(--tf-color-red-pastel-light) 100%);

      .payment-icon {
        background: var(--tf-color-coral);
        color: var(--color-bg-white);
      }

      .payment-check {
        i {
          color: var(--tf-color-coral);
        }
      }
    }

    .payment-icon {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--tf-color-surface-soft);
      border-radius: 10px;
      margin-right: 12px;
      font-size: var(--tf-type-scale-20);
      color: var(--text-secondary);
      transition: all 0.3s ease;

      &.wechat {
        color: var(--tf-color-wechat-legacy);
      }

      &.alipay {
        color: var(--tf-color-blue-bootstrap);
      }
    }

    .payment-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;

      .payment-name {
        font-size: var(--tf-type-scale-15);
        font-weight: 500;
        color: var(--text-primary);
      }

      .payment-desc {
        font-size: var(--tf-type-scale-12);
        color: var(--text-muted);
      }
    }

    .payment-check {
      i {
        font-size: var(--tf-type-scale-20);
        color: var(--tf-color-gray-300-alt);
        transition: all 0.3s ease;
      }
    }
  }
}

.confirm-pay-btn {
  width: 100%;
  height: 48px;
  border-radius: 24px;
  font-size: var(--tf-type-scale-16);
  font-weight: 600;
  background: var(--tf-button-danger-bg);
  border: none;
  color: var(--tf-button-on-color);
  box-shadow: var(--tf-button-danger-shadow);

  &:disabled {
    background: var(--tf-button-neutral-bg);
    box-shadow: none;
    color: var(--tf-button-tool-color);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
    box-shadow: var(--tf-button-danger-shadow);
  }
}

// 支付二维码显示
.payment-qrcode {
  text-align: center;
  padding: 20px 0;

  .qrcode-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: var(--tf-type-scale-18);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 20px;
  }

  .qrcode-box {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    background: var(--tf-color-surface-muted);
    border-radius: 12px;
    margin-bottom: 16px;

    img {
      width: 200px;
      height: 200px;
      object-fit: contain;
    }
  }

  .payment-tip {
    font-size: var(--tf-type-scale-14);
    color: var(--text-secondary);
    margin: 0;
  }
}

// 银行转账
.bank-transfer {
  padding: 20px 0;

  .bank-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: var(--tf-type-scale-18);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 20px;
  }

  .bank-info {
    background: var(--tf-color-surface-muted);
    padding: 20px;
    border-radius: 12px;

    p {
      font-size: var(--tf-type-scale-14);
      color: var(--text-primary);
      line-height: 1.8;
      margin: 0;
    }
  }
}

// 到店自提
.pickup-info {
  padding: 20px 0;

  .pickup-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: var(--tf-type-scale-18);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 20px;
  }

  .pickup-details {
    background: var(--tf-color-surface-muted);
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 16px;

    p {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: var(--tf-type-scale-14);
      color: var(--text-primary);
      line-height: 2;
      margin: 0;

      i {
        color: var(--tf-color-accent-orange);
        font-size: var(--tf-type-scale-16);
        width: 20px;
        text-align: center;
      }
    }
  }

  .payment-tip {
    text-align: center;
    font-size: var(--tf-type-scale-14);
    color: var(--text-secondary);
    margin: 0;
  }
}

</style>
