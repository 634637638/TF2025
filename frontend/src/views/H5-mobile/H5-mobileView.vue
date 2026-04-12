<!--
  H5MobileLayout - H5移动端商城布局组件
  功能：统一的移动端页面布局，包含顶部导航和底部菜单
-->
<template>
  <div class="mobile-layout" :class="{ 'has-bottom-nav': showBottomNav }">
    <!-- 顶部导航栏 -->
    <div v-if="showHeader" class="mobile-header">
      <div class="header-left" @click="handleBack">
        <i v-if="showBack" class="fas fa-arrow-left"></i>
      </div>
      <div class="header-title">{{ pageTitle }}</div>
      <div class="header-right">
        <slot name="header-actions">
          <i v-if="showShare" class="fas fa-share-alt" @click="handleShare"></i>
        </slot>
      </div>
    </div>

    <!-- 页面内容 -->
    <div class="mobile-content" :class="{ 'with-header': showHeader, 'with-bottom-nav': showBottomNav }">
      <router-view v-slot="{ Component }">
        <component v-if="Component" :is="Component" :key="routeViewKey" />
      </router-view>
    </div>

    <!-- 底部导航栏 -->
    <div v-if="showBottomNav" class="bottom-nav">
      <div class="nav-item" :class="{ active: route.path === '/m' }" @click="navigateTo('/m')">
        <i class="fas fa-home"></i>
        <span>首页</span>
      </div>
      <div class="nav-item" :class="{ active: route.path.includes('/products') }" @click="navigateTo('/m/products')">
        <i class="fas fa-th-large"></i>
        <span>商品</span>
      </div>
      <div class="nav-item" :class="{ active: route.path === '/m/cart' }" @click="navigateTo('/m/cart')">
        <i class="fas fa-shopping-cart"></i>
        <span>购物车</span>
        <span v-if="cartCount > 0" class="badge">{{ cartCount > 99 ? '99+' : cartCount }}</span>
      </div>
      <div class="nav-item" :class="{ active: route.path.includes('/my') }" @click="navigateTo('/m/my')">
        <i class="fas fa-user"></i>
        <span>我的</span>
      </div>
    </div>

    <!-- 悬浮客服按钮 -->
    <div v-if="showFloatingService" class="floating-service" @click="showServiceDialog">
      <div class="service-icon">
        <i class="fas fa-headset"></i>
      </div>
      <span class="service-text">客服</span>
    </div>

    <!-- 客服信息弹窗 -->
    <MobileDialog
      v-model="serviceVisible"
      title="联系客服"
      width="320px"
      :show-close="true"
      dialog-class="service-dialog-custom"
      :show-default-footer="false"
    >
      <div class="service-info">
        <!-- 一行显示两个选项 -->
        <div class="service-row">
          <div v-if="shopConfig.shop_phone" class="service-item phone-item" @click="callPhone">
            <div class="service-icon phone-icon">
              <i class="fas fa-phone"></i>
            </div>
            <div class="service-content">
              <div class="service-label">拨打</div>
              <div class="service-value">{{ shopConfig.shop_phone }}</div>
            </div>
          </div>

          <div v-if="shopConfig.wechat_id" class="service-item wechat-item" @click="copyWechat">
            <div class="service-icon wechat-icon">
              <i class="fab fa-weixin"></i>
            </div>
            <div class="service-content">
              <div class="service-label">加微信</div>
              <div class="service-value">{{ shopConfig.wechat_id }}</div>
            </div>
          </div>
        </div>

        <!-- 只有一个选项时居中显示 -->
        <div v-if="shopConfig.shop_phone && !shopConfig.wechat_id" class="service-single" @click="callPhone">
          <div class="info-icon phone-icon">
            <i class="fas fa-phone"></i>
          </div>
          <div class="info-content">
            <div class="info-label">客服电话</div>
            <div class="info-value">{{ shopConfig.shop_phone }}</div>
          </div>
          <i class="fas fa-chevron-right info-arrow"></i>
        </div>

        <div v-if="!shopConfig.shop_phone && shopConfig.wechat_id" class="service-single" @click="copyWechat">
          <div class="info-icon wechat-icon">
            <i class="fab fa-weixin"></i>
          </div>
          <div class="info-content">
            <div class="info-label">微信号</div>
            <div class="info-value">{{ shopConfig.wechat_id }}</div>
          </div>
          <i class="fas fa-chevron-right info-arrow"></i>
        </div>

        <div v-if="!shopConfig.shop_phone && !shopConfig.wechat_id" class="no-service">
          <i class="fas fa-info-circle"></i>
          <p>暂无客服联系方式</p>
        </div>
      </div>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getPublicConfig } from '@/api/shop-public'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'
const route = useRoute()
const router = useRouter()

// 商城配置
const shopConfig = ref<any>({})

// 购物车数量
const cartCount = ref(0)

// 客服弹窗
const serviceVisible = ref(false)

// 是否显示悬浮客服按钮
const showFloatingService = computed(() => {
  // 在所有H5页面都显示，除了结账和订单成功页面
  const hideRoutes = ['/m/checkout', '/m/order/success']
  return !hideRoutes.some(path => route.path.startsWith(path))
})

// 是否显示顶部导航
const showHeader = computed(() => {
  const hideHeaderRoutes = ['/m']
  return !hideHeaderRoutes.includes(route.path)
})

// 是否显示返回按钮
const showBack = computed(() => {
  return route.path !== '/m'
})

// 是否显示分享按钮
const showShare = computed(() => {
  return route.path.includes('/product/')
})

// 是否显示底部导航
const showBottomNav = computed(() => {
  const hideBottomNavRoutes = ['/m/checkout', '/m/order/success']
  return !hideBottomNavRoutes.some(path => route.path.startsWith(path))
})

const routeViewKey = computed(() => route.fullPath)

// 页面标题
const pageTitle = computed(() => {
  const titleMap: Record<string, string> = {
    '/m': '首页',
    '/m/products': '商品列表',
    '/m/cart': '购物车',
    '/m/checkout': '确认订单'
  }

  for (const [path, title] of Object.entries(titleMap)) {
    if (route.path.startsWith(path)) {
      return title
    }
  }

  return '商品详情'
})

// 返回上一页
const handleBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/m')
  }
}

// 安全导航方法，避免重复导航警告
const navigateTo = (path: string) => {
  if (route.path !== path) {
    router.push(path)
  }
}

// 分享
const handleShare = () => {
  if (navigator.share) {
    navigator.share({
      title: pageTitle.value,
      url: window.location.href
    })
  } else {
    // 复制链接
    navigator.clipboard.writeText(window.location.href)
    alert('链接已复制到剪贴板')
  }
}

// 获取商城配置
const loadConfig = async () => {
  try {
    const response = await getPublicConfig()
    const config = (response as any).data || response
    shopConfig.value = config
    // 设置页面标题
    if (config && config.shop_name) {
      document.title = config.shop_name
    }
  } catch (error) {
    logger.error('获取商城配置失败:', error)
  }
}

// 更新购物车数量
const updateCartCount = () => {
  const cartId = storage.getH5CartId()
  if (cartId) {
    // 这里可以调用API获取购物车数量
    const count = storage.getH5CartCount()
    cartCount.value = count
  }
}

// 显示客服弹窗
const showServiceDialog = () => {
  serviceVisible.value = true
}

// 拨打电话
const callPhone = () => {
  if (shopConfig.value.shop_phone) {
    window.location.href = `tel:${shopConfig.value.shop_phone}`
  }
}

// 复制微信号
const copyWechat = () => {
  if (shopConfig.value.wechat_id) {
    // 复制微信号到剪贴板
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shopConfig.value.wechat_id).then(() => {
        ElMessage.success('微信号已复制，正在打开微信...')
        // 延迟跳转，让用户看到提示
        setTimeout(() => {
          window.location.href = `weixin://dl/chat?${shopConfig.value.wechat_id}`
        }, 1000)
      }).catch(() => {
        ElMessage.info(`请添加微信号: ${shopConfig.value.wechat_id}`)
      })
    } else {
      ElMessage.info(`请添加微信号: ${shopConfig.value.wechat_id}`)
    }
  }
}

onMounted(() => {
  loadConfig()
  updateCartCount()

  // 监听购物车变化
  window.addEventListener('storage', (e) => {
    if (e.key === 'h5_cart_count') {
      cartCount.value = e.newValue ? parseInt(e.newValue) : 0
    }
  })
})

// 暴露方法供子组件调用
defineExpose({
  updateCartCount
})
</script>

<style scoped lang="scss">
.mobile-layout {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom);
  // 移除 flex 布局，让内容自然流动
}

// 顶部导航栏
.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  z-index: 100;

  .header-left,
  .header-right {
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #333;
    cursor: pointer;

    i {
      padding: 8px;
    }
  }

  .header-title {
    flex: 1;
    text-align: center;
    font-size: 16px;
    font-weight: 500;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// 页面内容
.mobile-content {
  // 移除 flex 相关样式，让内容自然流动
  width: 100%;

  &.with-header {
    padding-top: 44px;
  }

  &.with-bottom-nav {
    padding-bottom: 60px;
  }
}

// 底部导航栏
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #fff;
  display: flex;
  justify-content: space-around;
  align-items: center;
  border-top: 1px solid #eee;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);

  .nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    color: #999;
    position: relative;
    padding: 8px 0;
    cursor: pointer;

    i {
      font-size: 20px;
      margin-bottom: 4px;
    }

    span {
      font-size: 12px;
    }

    &.active {
      color: #ff6b00;
    }

    .badge {
      position: absolute;
      top: 4px;
      right: 25%;
      min-width: 16px;
      height: 16px;
      background: #ff1744;
      color: #fff;
      font-size: 10px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }
  }

  .service-link {
    cursor: pointer;
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 适配刘海屏
@supports (bottom: env(safe-area-inset-bottom)) {
  .bottom-nav {
    height: calc(60px + env(safe-area-inset-bottom));
  }
}

// 悬浮客服按钮
.floating-service {
  position: fixed;
  bottom: 148px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  z-index: 1000;
  animation: pulse 2s infinite;

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  .service-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
    box-shadow: 0 4px 16px rgba(0, 200, 83, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;

    i {
      font-size: 24px;
    }
  }

  .service-text {
    font-size: 12px;
    color: #00c853;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 8px;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

// 客服信息弹窗样式
.service-info {
  // 一行显示两个选项
  .service-row {
    display: flex;
    gap: 12px;

    .service-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;

      &:active {
        background: #e9ecef;
        transform: scale(0.98);
      }

      .service-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;

        &.phone-icon {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        &.wechat-icon {
          background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
        }

        i {
          font-size: 20px;
        }
      }

      .service-content {
        text-align: center;

        .service-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .service-value {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100px;
        }
      }
    }
  }

  // 单个选项居中显示
  .service-single {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;

    &:active {
      background: #e9ecef;
      transform: scale(0.98);
    }

    .info-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;

      &.phone-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.wechat-icon {
        background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
      }

      i {
        font-size: 20px;
      }
    }

    .info-content {
      flex: 1;
      min-width: 0;

      .info-label {
        font-size: 12px;
        color: #666;
        margin-bottom: 4px;
      }

      .info-value {
        font-size: 15px;
        font-weight: 500;
        color: #333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .info-arrow {
      color: #ddd;
      font-size: 14px;
      flex-shrink: 0;
    }
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.3s;

    &:last-child {
      margin-bottom: 0;
    }

    &:active {
      background: #e9ecef;
      transform: scale(0.98);
    }

    .info-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;

      &.phone-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.wechat-icon {
        background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
      }

      i {
        font-size: 20px;
      }
    }

    .info-content {
      flex: 1;
      min-width: 0;

      .info-label {
        font-size: 12px;
        color: #666;
        margin-bottom: 4px;
      }

      .info-value {
        font-size: 15px;
        font-weight: 500;
        color: #333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .info-arrow {
      color: #ddd;
      font-size: 14px;
      flex-shrink: 0;
    }
  }

  .no-service {
    text-align: center;
    padding: 32px 16px;
    color: #999;

    i {
      font-size: 40px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    p {
      font-size: 14px;
      margin: 0;
    }
  }
}
</style>

<style lang="scss">
// 悬浮客服按钮（全局样式，确保在所有页面都能正常显示）
.floating-service {
  position: fixed !important;
  bottom: 148px !important;
  right: 16px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 4px !important;
  cursor: pointer !important;
  z-index: 1000 !important;
  animation: pulse 2s infinite !important;

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  .service-icon {
    width: 56px !important;
    height: 56px !important;
    border-radius: 50% !important;
    background: linear-gradient(135deg, #00c853 0%, #00e676 100%) !important;
    box-shadow: 0 4px 16px rgba(0, 200, 83, 0.4) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: #fff !important;

    i {
      font-size: 24px !important;
    }
  }

  .service-text {
    font-size: 12px !important;
    color: #00c853 !important;
    font-weight: 500 !important;
    background: rgba(255, 255, 255, 0.9) !important;
    padding: 2px 8px !important;
    border-radius: 10px !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  }
}

// 客服信息弹窗样式（全局样式）
.service-info {
  .info-item {
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 16px !important;
    background: #f8f9fa !important;
    border-radius: 8px !important;
    margin-bottom: 12px !important;
    cursor: pointer !important;
    transition: all 0.3s !important;

    &:last-child {
      margin-bottom: 0 !important;
    }

    &:active {
      background: #e9ecef !important;
      transform: scale(0.98) !important;
    }

    .info-icon {
      width: 44px !important;
      height: 44px !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #fff !important;
      flex-shrink: 0 !important;

      &.phone-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      }

      &.wechat-icon {
        background: linear-gradient(135deg, #00c853 0%, #00e676 100%) !important;
      }

      i {
        font-size: 20px !important;
      }
    }

    .info-content {
      flex: 1 !important;
      min-width: 0 !important;

      .info-label {
        font-size: 12px !important;
        color: #666 !important;
        margin-bottom: 4px !important;
      }

      .info-value {
        font-size: 15px !important;
        font-weight: 500 !important;
        color: #333 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
    }

    .info-arrow {
      color: #ddd !important;
      font-size: 14px !important;
      flex-shrink: 0 !important;
    }
  }

  .no-service {
    text-align: center !important;
    padding: 32px 16px !important;
    color: #999 !important;

    i {
      font-size: 40px !important;
      margin-bottom: 12px !important;
      opacity: 0.5 !important;
    }

    p {
      font-size: 14px !important;
      margin: 0 !important;
    }
  }
}
</style>
