<!--
  H5MobileLayout - H5移动端商城布局组件
  功能：统一的移动端页面布局，包含顶部导航和底部菜单
-->
<template>
  <div
    class="mobile-layout"
    :class="{ 'has-bottom-nav': showBottomNav }"
  >
    <!-- 顶部导航栏 -->
    <div
      v-if="showHeader"
      class="mobile-header"
    >
      <div
        class="header-left"
        @click="handleBack"
      >
        <i
          v-if="showBack"
          class="fas fa-arrow-left"
        />
      </div>
      <div class="header-title">
        {{ pageTitle }}
      </div>
      <div class="header-right">
        <slot name="header-actions">
          <i
            v-if="showShare"
            class="fas fa-share-alt"
            @click="handleShare"
          />
        </slot>
      </div>
    </div>

    <!-- 页面内容 -->
    <div
      class="mobile-content"
      :class="{ 'with-header': showHeader, 'with-bottom-nav': showBottomNav }"
    >
      <router-view v-slot="{ Component }">
        <component
          :is="Component"
          v-if="Component"
          :key="routeViewKey"
        />
      </router-view>
    </div>

    <!-- 底部导航栏 -->
    <div
      v-if="showBottomNav"
      class="bottom-nav"
    >
      <div
        class="nav-item"
        :class="{ active: route.path === '/m' }"
        @click="navigateTo('/m')"
      >
        <i class="fas fa-home" />
        <span>首页</span>
      </div>
      <div
        class="nav-item"
        :class="{ active: route.path.includes('/products') }"
        @click="navigateTo('/m/products')"
      >
        <i class="fas fa-th-large" />
        <span>商品</span>
      </div>
      <div
        class="nav-item"
        :class="{ active: route.path === '/m/cart' }"
        @click="navigateTo('/m/cart')"
      >
        <i class="fas fa-shopping-cart" />
        <span>购物车</span>
        <span
          v-if="cartCount > 0"
          class="badge"
        >{{ cartCount > 99 ? '99+' : cartCount }}</span>
      </div>
      <div
        class="nav-item"
        :class="{ active: route.path.includes('/my') }"
        @click="navigateTo('/m/my')"
      >
        <i class="fas fa-user" />
        <span>我的</span>
      </div>
    </div>

    <!-- 悬浮客服按钮 -->
    <div
      v-if="showFloatingService"
      class="floating-service"
      @click="showServiceDialog"
    >
      <div class="service-icon">
        <i class="fas fa-headset" />
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
          <div
            v-if="shopConfig.shop_phone"
            class="service-item phone-item"
            @click="callPhone"
          >
            <div class="service-icon phone-icon">
              <i class="fas fa-phone" />
            </div>
            <div class="service-content">
              <div class="service-label">
                拨打
              </div>
              <div class="service-value">
                {{ shopConfig.shop_phone }}
              </div>
            </div>
          </div>

          <div
            v-if="shopConfig.wechat_id"
            class="service-item wechat-item"
            @click="copyWechat"
          >
            <div class="service-icon wechat-icon">
              <i class="fab fa-weixin" />
            </div>
            <div class="service-content">
              <div class="service-label">
                加微信
              </div>
              <div class="service-value">
                {{ shopConfig.wechat_id }}
              </div>
            </div>
          </div>
        </div>

        <!-- 只有一个选项时居中显示 -->
        <div
          v-if="shopConfig.shop_phone && !shopConfig.wechat_id"
          class="service-single"
          @click="callPhone"
        >
          <div class="info-icon phone-icon">
            <i class="fas fa-phone" />
          </div>
          <div class="info-content">
            <div class="info-label">
              客服电话
            </div>
            <div class="info-value">
              {{ shopConfig.shop_phone }}
            </div>
          </div>
          <i class="fas fa-chevron-right info-arrow" />
        </div>

        <div
          v-if="!shopConfig.shop_phone && shopConfig.wechat_id"
          class="service-single"
          @click="copyWechat"
        >
          <div class="info-icon wechat-icon">
            <i class="fab fa-weixin" />
          </div>
          <div class="info-content">
            <div class="info-label">
              微信号
            </div>
            <div class="info-value">
              {{ shopConfig.wechat_id }}
            </div>
          </div>
          <i class="fas fa-chevron-right info-arrow" />
        </div>

        <div
          v-if="!shopConfig.shop_phone && !shopConfig.wechat_id"
          class="no-service"
        >
          <i class="fas fa-info-circle" />
          <p>暂无客服联系方式</p>
        </div>
      </div>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getPublicConfig, type ShopConfig } from '@/api/shop-public'
import { storage } from '@/services/storage'
import { logger } from '@/utils/logger'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()

const route = useRoute()
const router = useRouter()

// 商城配置
const shopConfig = ref<Partial<ShopConfig>>({})

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
    globalNotifications.success('链接已复制到剪贴板')
  }
}

// 获取商城配置
const loadConfig = async () => {
  try {
    const config = await getPublicConfig()
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
        globalNotifications.success('微信号已复制，正在打开微信...')
        // 延迟跳转，让用户看到提示
        setTimeout(() => {
          window.location.href = `weixin://dl/chat?${shopConfig.value.wechat_id}`
        }, 1000)
      }).catch(() => {
        globalNotifications.info(`请添加微信号: ${shopConfig.value.wechat_id}`)
      })
    } else {
      globalNotifications.info(`请添加微信号: ${shopConfig.value.wechat_id}`)
    }
  }
}

const handleCartStorageChange = (event: StorageEvent) => {
  if (event.key !== 'h5_cart_count') return
  cartCount.value = event.newValue ? parseInt(event.newValue, 10) || 0 : 0
}

onMounted(() => {
  loadConfig()
  updateCartCount()

  // 监听购物车变化
  window.addEventListener('storage', handleCartStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleCartStorageChange)
})

// 暴露方法供子组件调用
defineExpose({
  updateCartCount
})
</script>

<style scoped lang="scss" src="./styles/h5-mobile-view/shell.scss"></style>
<style scoped lang="scss" src="./styles/h5-mobile-view/service-and-navigation.scss"></style>

<style lang="scss">
// 悬浮客服按钮（全局样式，确保在所有页面都能正常显示）
.floating-service {
  position: fixed;
  bottom: var(--tf-service-float-bottom);
  right: var(--tf-service-float-right);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--tf-space-1);
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
    width: var(--tf-service-float-size);
    height: var(--tf-service-float-size);
    border-radius: var(--tf-radius-full);
    background: linear-gradient(135deg, var(--tf-color-accent-green) 0%, var(--tf-color-green-accent) 100%);
    box-shadow: 0 4px 16px rgba(0, 200, 83, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-bg-white);

    i {
      font-size: var(--tf-service-float-icon-size);
    }
  }

  .service-text {
    font-size: var(--tf-type-scale-12);
    color: var(--tf-color-accent-green);
    font-weight: 500;
    background: rgba(255, 255, 255, 0.9);
    padding: var(--tf-space-1) var(--tf-space-2);
    border-radius: var(--tf-radius-full);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

// 客服信息弹窗样式（全局样式）
.service-info {
  .info-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--tf-color-surface-muted);
    border-radius: 8px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.3s;

    &:last-child {
      margin-bottom: 0;
    }

    &:active {
      background: var(--tf-color-border-muted);
      transform: scale(0.98);
    }

    .info-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-bg-white);
      flex-shrink: 0;

      &.phone-icon {
        background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
      }

      &.wechat-icon {
        background: linear-gradient(135deg, var(--tf-color-accent-green) 0%, var(--tf-color-green-accent) 100%);
      }

      i {
        font-size: var(--tf-type-scale-20);
      }
    }

    .info-content {
      flex: 1;
      min-width: 0;

      .info-label {
        font-size: var(--tf-type-scale-12);
        color: var(--text-secondary);
        margin-bottom: 4px;
      }

      .info-value {
        font-size: var(--tf-type-scale-15);
        font-weight: 500;
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .info-arrow {
      color: var(--tf-color-gray-300-alt);
      font-size: var(--tf-type-scale-14);
      flex-shrink: 0;
    }
  }

  .no-service {
    text-align: center;
    padding: 32px 16px;
    color: var(--text-muted);

    i {
      font-size: var(--tf-type-scale-40);
      margin-bottom: 12px;
      opacity: 0.5;
    }

    p {
      font-size: var(--tf-type-scale-14);
      margin: 0;
    }
  }
}
</style>
