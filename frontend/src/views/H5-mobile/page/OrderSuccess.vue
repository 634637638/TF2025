<!--
  OrderSuccess - H5下单成功页面
  功能：显示订单信息、支付方式、联系方式
-->
<template>
  <div class="order-success-page">
    <!-- 成功图标 -->
    <div class="success-icon">
      <i class="fas fa-check-circle"></i>
    </div>

    <h2 class="success-title">订单提交成功</h2>

    <!-- 订单信息 -->
    <div class="order-info-card">
      <div class="info-row">
        <span class="label">订单号</span>
        <span class="value">{{ orderNumber }}</span>
      </div>
      <div class="info-row">
        <span class="label">应付金额</span>
        <span class="value amount">¥{{ totalAmount }}</span>
      </div>
    </div>

    <!-- 支付方式 -->
    <div class="payment-section">
      <h3 class="section-title">请选择付款方式</h3>

      <!-- 微信支付 -->
      <div v-if="shopConfig.wechat_qrcode" class="payment-method">
        <div class="method-header">
          <i class="fab fa-weixin" style="color: #09bb07;"></i>
          <span>微信扫码支付</span>
        </div>
        <div class="qrcode-box">
          <img :src="shopConfig.wechat_qrcode" alt="微信支付二维码" />
        </div>
        <p class="payment-tip">请使用微信扫一扫，扫描二维码完成支付</p>
      </div>

      <!-- 支付宝 -->
      <div v-if="shopConfig.alipay_qrcode" class="payment-method">
        <div class="method-header">
          <i class="fab fa-alipay" style="color: #1677ff;"></i>
          <span>支付宝扫码支付</span>
        </div>
        <div class="qrcode-box">
          <img :src="shopConfig.alipay_qrcode" alt="支付宝二维码" />
        </div>
        <p class="payment-tip">请使用支付宝扫一扫，扫描二维码完成支付</p>
      </div>

      <!-- 银行转账 -->
      <div v-if="shopConfig.bank_info" class="payment-method bank">
        <div class="method-header">
          <i class="fas fa-university" style="color: #ff6b00;"></i>
          <span>银行转账</span>
        </div>
        <div class="bank-info">
          <p>{{ shopConfig.bank_info }}</p>
        </div>
      </div>

      <!-- 到店自提 -->
      <div class="payment-method pickup">
        <div class="method-header">
          <i class="fas fa-store" style="color: #00c853;"></i>
          <span>到店自提</span>
        </div>
        <div class="pickup-info">
          <p v-if="shopConfig.shop_address"><i class="fas fa-map-marker-alt"></i> {{ shopConfig.shop_address }}</p>
          <p v-if="shopConfig.shop_phone"><i class="fas fa-phone"></i> {{ shopConfig.shop_phone }}</p>
          <p v-if="shopConfig.shop_hours"><i class="fas fa-clock"></i> {{ shopConfig.shop_hours }}</p>
        </div>
      </div>
    </div>

    <!-- 温馨提示 -->
    <div class="tips-section">
      <p><i class="fas fa-info-circle"></i> 付款后请保留付款凭证，联系客服确认</p>
      <p v-if="shopConfig.shop_phone"><i class="fas fa-phone"></i> 客服电话：<a :href="`tel:${shopConfig.shop_phone}`">{{ shopConfig.shop_phone }}</a></p>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <el-button class="action-btn home" @click="goHome">
        <i class="fas fa-home"></i> 返回首页
      </el-button>
      <el-button class="action-btn primary" @click="viewOrder">
        <i class="fas fa-receipt"></i> 查看订单
      </el-button>
      <el-button class="action-btn success" @click="contactService">
        <i class="fas fa-phone"></i> 联系客服
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getPublicConfig, getOrderByNumber } from '@/api/shop-public'
import { ElMessage } from 'element-plus'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'
const router = useRouter()
const route = useRoute()

// 数据
const orderNumber = ref('')
const totalAmount = ref('')
const shopConfig = ref<any>({})

// 获取商城配置
const loadConfig = async () => {
  try {
    shopConfig.value = await getPublicConfig()
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 获取订单详情
const loadOrder = async () => {
  // 1. 优先从 sessionStorage 获取订单信息
  const sessionOrder = storage.get<{ orderNumber: string; totalAmount: string; timestamp: number }>(H5_STORAGE_KEYS.ORDER_SUCCESS, 'session')

  if (sessionOrder?.orderNumber) {
    // 验证时间戳（30分钟内有效，允许刷新）
    const now = Date.now()
    const isExpired = sessionOrder.timestamp && (now - sessionOrder.timestamp) > 30 * 60 * 1000

    if (isExpired) {
      ElMessage.warning('订单信息已过期，请重新下单')
      storage.remove(H5_STORAGE_KEYS.ORDER_SUCCESS, 'session')
      router.push('/m')
      return
    }

    orderNumber.value = sessionOrder.orderNumber
    totalAmount.value = sessionOrder.totalAmount || '0.00'

    // 从后端获取真实订单信息验证
    try {
      const response = await getOrderByNumber(sessionOrder.orderNumber)
      if (response?.data) {
        totalAmount.value = response.data.total_amount || totalAmount.value
      }
    } catch (error) {
      logger.error('验证订单失败:', error)
    }

    return
  }

  // 2. sessionStorage 没有数据，检查 URL 是否有订单号（兼容扫码分享场景）
  const orderNum = route.query.orderNumber as string

  if (orderNum && /^H5\d{12}$/.test(orderNum)) {
    // 从后端获取订单信息
    try {
      const response = await getOrderByNumber(orderNum)
      if (response?.data) {
        orderNumber.value = orderNum
        totalAmount.value = response.data.total_amount || '0.00'
        // 保存到 sessionStorage 方便后续使用
        storage.set(H5_STORAGE_KEYS.ORDER_SUCCESS, {
          orderNumber: orderNum,
          totalAmount: response.data.total_amount || '0.00',
          timestamp: Date.now()
        }, 'session')
        return
      }
    } catch (error) {
      logger.error('获取订单详情失败:', error)
    }
  }

  // 3. 没有任何订单信息，跳转首页
  ElMessage.error('订单信息不存在')
  router.push('/m')
}

// 返回首页
const goHome = () => {
  router.push('/m')
}

// 查看订单
const viewOrder = () => {
  router.push({
    name: 'MobileOrderDetail',
    params: {
      orderNumber: orderNumber.value
    }
  })
}

// 联系客服
const contactService = () => {
  const phone = shopConfig.value.shop_phone
  if (phone) {
    window.location.href = `tel:${phone}`
  } else {
    ElMessage.warning('暂无客服电话')
  }
}

onMounted(() => {
  loadConfig()
  loadOrder()
})
</script>

<style scoped lang="scss">
.order-success-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24px 16px;
}

// 成功图标
.success-icon {
  text-align: center;
  margin-bottom: 16px;

  i {
    font-size: 64px;
    color: #00c853;
    animation: scaleIn 0.5s ease-out;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

// 成功标题
.success-title {
  text-align: center;
  font-size: 20px;
  font-weight: 500;
  color: #333;
  margin: 0 0 24px;
}

// 订单信息卡片
.order-info-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;

    &:last-child {
      padding-bottom: 0;
    }

    .label {
      font-size: 14px;
      color: #666;
    }

    .value {
      font-size: 14px;
      color: #333;

      &.amount {
        font-size: 20px;
        font-weight: 500;
        color: #ff1744;
      }
    }
  }
}

// 支付方式区域
.payment-section {
  margin-bottom: 16px;

  .section-title {
    font-size: 16px;
    font-weight: 500;
    color: #333;
    margin: 0 0 12px;
  }

  .payment-method {
    background: #fff;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;

    .method-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 16px;
      font-weight: 500;
      color: #333;
    }

    .qrcode-box {
      display: flex;
      justify-content: center;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 12px;

      img {
        width: 200px;
        height: 200px;
        object-fit: contain;
      }
    }

    .payment-tip {
      text-align: center;
      font-size: 13px;
      color: #999;
      margin: 0;
    }

    .bank-info {
      padding: 12px;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 14px;
      color: #333;
      line-height: 1.8;
      white-space: pre-line;
    }

    .pickup-info {
      p {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        font-size: 14px;
        color: #333;
        margin: 0;

        i {
          color: #ff6b00;
        }

        a {
          color: #ff6b00;
          text-decoration: none;
        }
      }
    }
  }
}

// 温馨提示
.tips-section {
  background: #fff8f0;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 24px;

  p {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #ff6b00;
    margin: 8px 0;

    &:first-child {
      margin-top: 0;
    }

    &:last-child {
      margin-bottom: 0;
    }

    i {
      font-size: 14px;
    }

    a {
      color: #ff6b00;
      text-decoration: none;
    }
  }
}

// 操作按钮
.actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 16px 0;
  position: sticky;
  bottom: 0;
  background: linear-gradient(to top, #f5f5f5 80%, transparent);
  margin: 0 -16px -24px;
  padding: 24px 16px 32px;

  .action-btn {
    flex: 1;
    min-width: 0;
    height: 44px;
    border-radius: 22px;
    font-size: 14px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;

    i {
      font-size: 13px;
    }

    &.home {
      background: #fff;
      border: 1px solid #ddd;
      color: #666;

      &:hover {
        background: #f5f5f5;
        border-color: #ccc;
      }
    }

    &.primary {
      background: linear-gradient(135deg, #ff6b00 0%, #ff8f00 100%);
      border: none;
      color: #fff;
      box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);

      &:hover {
        opacity: 0.9;
      }
    }

    &.success {
      background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
      border: none;
      color: #fff;
      box-shadow: 0 4px 12px rgba(0, 200, 83, 0.3);

      &:hover {
        opacity: 0.9;
      }
    }
  }
}
</style>
