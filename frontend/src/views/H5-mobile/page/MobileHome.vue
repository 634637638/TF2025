<!--
  MobileHome - H5移动端首页
  功能：轮播图、快速分类、首页推荐区域（动态配置）
-->
<template>
  <div class="mobile-home" style="min-height: 100vh; background: #f5f5f5;">
    <!-- 顶部商家信息栏 -->
    <div v-if="config.shop_name || getImageUrl(config.shop_logo)" class="merchant-header">
      <div class="merchant-info" @click="showMerchantDetail">
        <div v-if="getImageUrl(config.shop_logo)" class="merchant-logo">
          <Image :src="getImageUrl(config.shop_logo)" :alt="config.shop_name || '商家Logo'" mode="eager" />
        </div>
        <div class="merchant-text">
          <div class="merchant-name">{{ config.shop_name || '' }}</div>
        </div>
      </div>
      <div class="merchant-actions">
        <div class="action-btn" @click="showMerchantDetail">
          <i class="fas fa-map-marker-alt"></i>
        </div>
        <div v-if="config.shop_phone" class="action-btn" @click="handlePhoneCall">
          <i class="fas fa-phone"></i>
        </div>
        <div class="action-btn" @click="handleShare">
          <i class="fas fa-share-alt"></i>
        </div>
      </div>
    </div>

    <!-- 轮播图 -->
    <div v-if="config.banner_enabled && allBannerImages.length > 0" class="banner-section">
      <Swiper
        :modules="[SwiperAutoplay, SwiperPagination]"
        :autoplay="{ delay: currentBannerInterval, disableOnInteraction: false } as any"
        :pagination="{ clickable: true } as any"
        :loop="true"
        class="banner-swiper"
        @slide-change="handleSlideChange"
      >
        <SwiperSlide v-for="(img, index) in allBannerImages" :key="`banner-${index}`">
          <div class="banner-slide">
            <Image :src="img.url" :alt="img.title" mode="eager" />
          </div>
        </SwiperSlide>
      </Swiper>
    </div>

    <!-- 快速分类 -->
    <div class="category-section">
      <div class="category-item" @click="goProducts({ is_new: true })">
        <div class="category-icon new">
          <i class="fas fa-star"></i>
        </div>
        <span>全新机</span>
      </div>
      <div class="category-item" @click="goProducts({ is_new: false })">
        <div class="category-icon used">
          <i class="fas fa-recycle"></i>
        </div>
        <span>二手机</span>
      </div>
      <div class="category-item" @click="goProducts({})">
        <div class="category-icon all">
          <i class="fas fa-th"></i>
        </div>
        <span>全部商品</span>
      </div>
    </div>

    <!-- 品牌分类 -->
    <div v-if="brands.length > 0" class="brands-section">
      <div class="section-title">
        <h3>热门品牌</h3>
        <span @click="goProducts({})">更多 <i class="fas fa-chevron-right"></i></span>
      </div>
      <div class="brands-list">
        <div
          v-for="brand in brands.slice(0, 8)"
          :key="brand.id"
          class="brand-item"
          @click="goProducts({ brand_id: brand.id })"
        >
          <div class="brand-icon">
            <i v-if="brand.icon" :class="brand.icon"></i>
            <i v-else class="fas fa-mobile-alt"></i>
          </div>
          <span>{{ brand.name }}</span>
        </div>
      </div>
    </div>

    <!-- 动态推荐区域 -->
    <div
      v-for="section in homeSections"
      :key="section.id"
      class="products-section"
    >
      <div class="section-title">
        <h3>
          <i v-if="section.icon" :class="section.icon" style="margin-right: 8px; color: #ff6b00;"></i>
          {{ section.section_name }}
        </h3>
        <span @click="goProductsFromSection(section)">更多 <i class="fas fa-chevron-right"></i></span>
      </div>
      <div v-if="section.products && section.products.length > 0" class="products-grid">
        <div
          v-for="product in section.products"
          :key="product.template_id || product.phone_id"
          class="product-card"
          @click="goDetail(product)"
        >
          <div class="product-image">
            <div class="product-image-inner">
              <Image
                :src="getProductImage(product)"
                :default-image="generatePlaceholderImage(product)"
                :alt="product.brand_name + ' ' + product.model_name"
                mode="lazy"
              />
            </div>
            <span v-if="product.product_type === 'used'" class="tag-used">二手</span>
            <span v-else class="tag-new">全新</span>
          </div>
          <div class="product-info">
            <h4 class="product-title">
              {{ getProductTitle(product, section.section_name) }}
            </h4>
            <div class="product-footer">
              <span class="product-price">
                <span class="price-label">销售价</span>
                <span class="price-value" :class="{ 'price-inquire': !getDisplayPrice(product) }">
                  <template v-if="getDisplayPrice(product)">
                    ¥{{ getDisplayPrice(product) }}
                  </template>
                  <template v-else>
                    电询
                  </template>
                </span>
              </span>
              <!-- 购物车图标按钮 - 只有有价格时才显示 -->
              <i
                v-if="config.cart_enabled && getDisplayPrice(product)"
                class="fas fa-shopping-cart cart-icon"
                :class="{ 'adding': addingToCart === (product.template_id || product.phone_id) }"
                @click.stop="handleCartClick(product)"
              ></i>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-section">
        <el-empty :description="`暂无${section.section_name}`" :image-size="60" />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && homeSections.length === 0" class="empty-state">
      <el-empty description="暂无推荐商品">
        <template #image>
          <div class="empty-icon">
            <i class="fas fa-box-open"></i>
          </div>
        </template>
      </el-empty>
    </div>

    <!-- 地图弹窗 -->
    <MobileDialog
      v-model="showMapDialog"
      title="店铺位置"
      width="90%"
      :style="{ '--dialog-max-width': '600px' }"
      :close-on-click-modal="true"
      dialog-class="mobile-map-dialog"
      :show-default-footer="false"
      @opened="initMap"
    >
      <div class="map-dialog-content">
        <div v-if="config.map_latitude && config.map_longitude" class="map-container">
          <div id="mobile-map-container" class="mobile-map"></div>
        </div>
        <div v-else class="map-placeholder">
          <i class="fas fa-map-marker-alt"></i>
          <p>暂未设置地图位置</p>
          <p class="hint">请在后台配置中设置店铺位置</p>
        </div>
      </div>
      <template #footer v-if="config.map_latitude && config.map_longitude">
        <div style="display: flex; gap: 10px; justify-content: space-between;">
          <el-button type="primary" @click="openExternalMap" style="flex: 1;">打开导航</el-button>
          <el-button type="default" @click="showMapDialog = false" style="flex: 1;">关闭</el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination } from 'swiper/modules'
import { Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import 'swiper/css'
import 'swiper/css/pagination'
import { getPublicConfig, getActiveBanners } from '@/api/shop-public'
import { baseDataApi } from '@/api/base-data'
import { getActiveHomeSections } from '@/api/home-sections'
import { useCart, useLoadingState } from '@/composables'
import Image from '@/components/Image.vue'
import type { Banner } from '@/api/shop-public'
import type { HomeSection } from '@/api/home-sections'
import { formatImageUrl, generateProductPlaceholder } from '@/utils/format'
import { storage } from '@/services/storage'
import { logger } from '@/utils/logger'
// 滚动位置存储键前缀
const SCROLL_POSITION_PREFIX = 'scroll-pos_'
const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(?:[?#].*)?$/i
const KNOWN_IMAGE_PREFIXES = ['/uploads/', '/upload/', '/images/', '/static/', '/assets/']
const FRONTEND_ROUTE_PATTERNS = [
  /^\/m(?:[/?#]|$)/,
  /^\/login(?:[/?#]|$)/,
  /^\/register(?:[/?#]|$)/,
  /^\/forgot-password(?:[/?#]|$)/,
  /^\/price-query(?:[/?#]|$)/,
  /^\/sales-price-display(?:[/?#]|$)/
]

// 定义组件名称，供 keep-alive 使用
defineOptions({
  name: 'MobileHome'
})

// 注册 Swiper 模块
const SwiperAutoplay = Autoplay
const SwiperPagination = Pagination

const router = useRouter()

// 滚动监听器（在 setup 顶层定义，避免 onUnmounted 警告）
let scrollHandler: (() => void) | null = null

// 购物车功能
const { cartCount, getCartId, addCartItem, refreshCart } = useCart()
const addingToCart = ref<number | null>(null)

// 获取图片 URL
const getImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return ''

  const normalizedValue = imageUrl.trim()
  if (!normalizedValue) return ''

  if (
    normalizedValue.startsWith('data:') ||
    normalizedValue.startsWith('blob:') ||
    normalizedValue.startsWith('http://') ||
    normalizedValue.startsWith('https://')
  ) {
    return formatImageUrl(normalizedValue)
  }

  const normalizedPath = normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`
  const isFrontendRoute = FRONTEND_ROUTE_PATTERNS.some((pattern) => pattern.test(normalizedPath))
  const isKnownImagePath = KNOWN_IMAGE_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))

  if (!isKnownImagePath && (isFrontendRoute || !IMAGE_FILE_PATTERN.test(normalizedPath))) {
    return ''
  }

  return formatImageUrl(normalizedValue)
}

const getConditionText = (product: any): string => {
  const conditionGrade = typeof product?.condition_grade === 'string' ? product.condition_grade.trim() : ''
  if (conditionGrade) {
    return conditionGrade
  }

  const qualityGrade = product?.quality_grade
  if (qualityGrade !== null && qualityGrade !== undefined && qualityGrade !== '') {
    return `${qualityGrade}成新`
  }

  return ''
}

const getProductTitle = (product: any, sectionName = ''): string => {
  if (!product) return ''

  const hideBrand = typeof sectionName === 'string' && sectionName.includes('靓机')
  const parts = [
    !hideBrand ? product.brand_name : '',
    product.model_name,
    product.color_name,
    product.memory_name,
    product.product_type === 'used' ? getConditionText(product) : ''
  ]

  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : part))
    .filter(Boolean)
    .join(' ')
}

const getProductImage = (product: any): string => {
  const imageUrl = getImageUrl(product?.main_image || '')
  return imageUrl || generatePlaceholderImage(product)
}

// 生成默认占位图（使用品牌、型号、颜色、内存生成SVG占位图 - 横向布局）
const generatePlaceholderImage = (product: any): string => {
  return generateProductPlaceholder({
    brand: product.brand_name || '',
    model: product.model_name || '',
    color: product.color_name || '',
    memory: product.memory_size || '',
    size: 200,
    layout: 'horizontal'
  })
}

// 数据
const config = ref<any>({})
const banners = ref<Banner[]>([])
const brands = ref<any[]>([])
const homeSections = ref<HomeSection[]>([])
const { loading } = useLoadingState()
const currentSlideIndex = ref(0)
const showMapDialog = ref(false)

// 当前轮播间隔（根据当前显示的 banner 动态调整）
const currentBannerInterval = computed(() => {
  if (allBannerImages.value.length === 0) return 3000
  const currentImg = allBannerImages.value[currentSlideIndex.value]
  if (currentImg && currentImg.banner && currentImg.banner.interval) {
    return currentImg.banner.interval
  }
  return 3000
})

// 计算所有轮播图片（支持每个 banner 多张图片）
const allBannerImages = computed(() => {
  const images: Array<{ url: string; title: string; banner: Banner }> = []
  banners.value.forEach(banner => {
    if (banner.images && banner.images.length > 0) {
      banner.images.forEach((imgUrl, index) => {
        const resolvedUrl = getImageUrl(imgUrl)
        if (resolvedUrl) {
          images.push({
            url: resolvedUrl,
            title: `${banner.title || '轮播图'} (${index + 1})`,
            banner
          })
        }
      })
    } else if (banner.image_url) {
      const resolvedUrl = getImageUrl(banner.image_url)
      if (resolvedUrl) {
        images.push({
          url: resolvedUrl,
          title: banner.title || '轮播图',
          banner
        })
      }
    }
  })
  return images
})

// 获取商城配置
const loadConfig = async () => {
  try {
    const response: any = await getPublicConfig()
    config.value = response?.data || response || {}
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 获取轮播图
const loadBanners = async () => {
  try {
    const response = await getActiveBanners()
    banners.value = (response as any).data || response || []
  } catch (error) {
    logger.error('获取轮播图失败:', error)
  }
}

// 获取品牌列表
const loadBrands = async () => {
  try {
    brands.value = await baseDataApi.getPublicBrands()
  } catch (error) {
    logger.error('获取品牌列表失败:', error)
  }
}

// 获取首页推荐区域
const loadHomeSections = async () => {
  loading.value = true
  try {
    const response = await getActiveHomeSections()
    // response 格式: { success: true, data: [...] }
    const data = response.data || response || []
    homeSections.value = Array.isArray(data) ? data : []
  } catch (error) {
    logger.error('获取推荐区域失败:', error)
  } finally {
    loading.value = false
  }
}

// 处理购物车图标点击
const handleCartClick = async (product: any) => {
  // 全新机需要找到对应的商品
  if (product.product_type === 'new' || !product.phone_id) {
    addingToCart.value = product.template_id
    try {
      // 使用模板商品API获取详细信息
      const { getTemplatePhones } = await import('@/api/shop-public')
      const phonesResponse = await getTemplatePhones(product.template_id)
      const phones: any = phonesResponse.data || phonesResponse || []

      if (phones && phones.length > 0) {
        // 获取第一个有库存的商品
        const availablePhone = phones.find((p: any) => p.status === 'in_stock')

        if (availablePhone) {
          await addCartItem(availablePhone.id, 1)
          await refreshCart()
          ElMessage.success('已加入购物车')
        } else {
          ElMessage.warning('该商品暂无库存')
        }
      } else {
        ElMessage.warning('该商品暂无库存')
      }
    } catch (error) {
      logger.error('加入购物车失败:', error)
      ElMessage.error('加入购物车失败')
    } finally {
      addingToCart.value = null
    }
    return
  }

  // 二手机直接加入购物车
  addingToCart.value = product.phone_id
  try {
    await addCartItem(product.phone_id, 1)
    await refreshCart()
    ElMessage.success('已加入购物车')
  } catch (error) {
    logger.error('加入购物车失败:', error)
    ElMessage.error('加入购物车失败')
  } finally {
    addingToCart.value = null
  }
}

// 跳转商品列表
const goProducts = (params: any) => {
  router.push({
    path: '/m/products',
    query: params
  })
}

// 根据专区类型跳转商品列表
const goProductsFromSection = (section: any) => {
  const params: any = {}

  // 根据专区名称或 key 判断筛选条件
  const sectionName = section.section_name || ''
  const sectionKey = section.section_key || ''

  // 靓机专区：筛选成色为"靓机"的二手商品
  if (sectionName.includes('靓机') || sectionKey.includes('liangji') || sectionKey.includes('quality')) {
    params.condition_grade = '靓机'
    params.is_new = false
  }

  router.push({
    path: '/m/products',
    query: params
  })
}

// 跳转商品详情
const goDetail = (product: any) => {
  if (product.product_type === 'new' || product.template_id) {
    // 全新机使用 AggregatedProductDetail
    const templateId = product.template_id
    if (templateId) {
      router.push(`/m/product/new/${templateId}`)
    }
  } else {
    // 二手机使用 SmartProductDetail
    const phoneId = product.phone_id
    if (phoneId) {
      router.push(`/m/product/${phoneId}`)
    }
  }
}

// 点击轮播图
const handleBannerClick = (banner: Banner) => {
  if (banner.link_type === 'category' && banner.link_url) {
    try {
      const url = new URL(banner.link_url, window.location.origin)
      const params = Object.fromEntries(url.searchParams.entries())
      goProducts(params)
    } catch {
      goProducts({})
    }
  }
}

// 幻灯片切换事件
const handleSlideChange = (swiper: any) => {
  currentSlideIndex.value = swiper.activeIndex
}

// 商家信息栏操作
const showMerchantDetail = () => {
  if (config.value.map_latitude && config.value.map_longitude) {
    showMapDialog.value = true
  } else {
    ElMessage.info('暂未设置地图位置')
  }
}

const handlePhoneCall = () => {
  if (config.value.shop_phone) {
    window.location.href = `tel:${config.value.shop_phone}`
  }
}

const handleShare = () => {
  // 获取完整的页面地址（确保包含域名）
  const pageUrl = window.location.origin + window.location.pathname

  // 分享功能
  if (navigator.share) {
    navigator.share({
      title: config.value.shop_name || '腾飞数码',
      text: config.value.shop_subtitle || '欢迎光临',
      url: pageUrl
    }).catch(() => {
      ElMessage.info('请使用浏览器分享功能')
    })
  } else {
    // 复制链接
    navigator.clipboard.writeText(pageUrl).then(() => {
      ElMessage.success('链接已复制，快去分享吧')
    }).catch(() => {
      ElMessage.error('复制失败，请手动复制链接')
    })
  }
}

const openExternalMap = () => {
  if (config.value.map_latitude && config.value.map_longitude) {
    // 打开腾讯地图导航
    const lat = config.value.map_latitude
    const lng = config.value.map_longitude
    const name = encodeURIComponent(config.value.shop_name || '店铺')
    const addr = encodeURIComponent(config.value.shop_address || '')
    window.open(`https://apis.map.qq.com/uri/v1/routeplan?type=drive&to=${name}&tocoord=${lat},${lng}&addr=${addr}&referer=TF2025`, '_blank')
  }
}

// 地图相关
let mobileMap: any = null
let mapScriptLoaded = false

// 加载腾讯地图脚本
const loadTencentMapScript = () => {
  return new Promise((resolve, reject) => {
    if (mapScriptLoaded || (window as any).TMap) {
      mapScriptLoaded = true
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://map.qq.com/api/gljs?v=1.exp&key=BUTBZ-J4UC6-ZUNSH-MJCJJ-L2ZY6-CZBFG'
    script.onload = () => {
      mapScriptLoaded = true
      resolve(true)
    }
    script.onerror = () => {
      reject(new Error('地图脚本加载失败'))
    }
    document.head.appendChild(script)
  })
}

// 初始化地图
const initMap = async () => {
  if (!config.value.map_latitude || !config.value.map_longitude) {
    return
  }

  try {
    await loadTencentMapScript()

    await nextTick()
    const container = document.getElementById('mobile-map-container')
    if (!container) {
      logger.error('地图容器不存在')
      return
    }

    // 如果地图已初始化，先销毁
    if (mobileMap) {
      mobileMap.destroy()
      mobileMap = null
    }

    const lat = parseFloat(config.value.map_latitude)
    const lng = parseFloat(config.value.map_longitude)

    const center = new (window as any).TMap.LatLng(lat, lng)

    mobileMap = new (window as any).TMap.Map(container, {
      center: center,
      zoom: 15,
      viewMode: '2D'
    })

    // 添加标记
    new (window as any).TMap.MultiMarker({
      map: mobileMap,
      geometries: [{
        id: 'shop',
        position: center
      }],
      styles: {
        'shop': new (window as any).TMap.MarkerStyle({
          width: 24,
          height: 34,
          anchor: { x: 12, y: 34 }
        })
      }
    })

    // 添加信息窗口
    const info = new (window as any).TMap.InfoWindow({
      map: mobileMap,
      position: center,
      content: `<div style="padding:10px;font-size:14px;"><strong>${config.value.shop_name || '店铺'}</strong><br>${config.value.shop_address || ''}</div>`
    })

  } catch (error) {
    logger.error('地图初始化失败:', error)
  }
}

// 获取商品显示价格
const getDisplayPrice = (product: any) => {
  if (!product) return null

  // 首页商品统一使用 min_price 字段
  return product.min_price || null
}

onMounted(async () => {
  loadConfig()
  loadBanners()
  loadBrands()
  await loadHomeSections()
  await refreshCart()
})

onUnmounted(() => {
  // 清理滚动监听
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler)
    scrollHandler = null
  }
})

// 当从详情页返回时恢复滚动位置
onActivated(async () => {
  const scrollKey = `${SCROLL_POSITION_PREFIX}/m`
  const savedScrollY = storage.get<string>(scrollKey, 'session')

  if (savedScrollY !== null) {
    const scrollY = parseInt(savedScrollY, 10)

    // 等待 Vue 更新和 DOM 渲染
    await nextTick()

    // 多次尝试滚动，确保页面高度足够
    const attemptScroll = async (attempt: number) => {
      const documentHeight = document.documentElement.scrollHeight
      const windowHeight = window.innerHeight

      if (documentHeight > windowHeight) {
        // 页面高度足够，可以滚动
        window.scrollTo({ top: scrollY, behavior: 'instant' })
        await new Promise(resolve => setTimeout(resolve, 50))

        const actualScroll = window.scrollY

        // 如果滚动位置不够，继续尝试
        if (actualScroll < scrollY - 100 && attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, 100))
          await attemptScroll(attempt + 1)
        } else {
          // 滚动完成，清除保存的位置
          storage.remove(scrollKey, 'session')
        }
      } else {
        // 页面高度不够，等待后重试
        if (attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, 200))
          await attemptScroll(attempt + 1)
        } else {
          logger.warn('[MobileHome] 无法恢复滚动位置，页面高度不足')
          storage.remove(scrollKey, 'session')
        }
      }
    }

    await attemptScroll(1)
  }
})

// 滚动位置由路由级别统一管理
</script>

<style scoped lang="scss">
.mobile-home {
  min-height: 100vh;
  background: #f5f5f5;
}

// 商家信息栏
.merchant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 8px 16px;
  z-index: 100;

  .merchant-info {
    display: flex;
    align-items: center;
    flex: 1;
    cursor: pointer;

    .merchant-logo {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
      margin-right: 10px;
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .merchant-text {
      flex: 1;
      min-width: 0;

      .merchant-name {
        font-size: 15px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .merchant-address {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        i {
          font-size: 10px;
        }
      }
    }
  }

  .merchant-actions {
    display: flex;
    gap: 8px;

    .action-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s;

      &:active {
        transform: scale(0.95);
        background: rgba(255, 255, 255, 0.3);
      }

      i {
        font-size: 16px;
        color: #fff;
      }
    }
  }
}

// 轮播图
.banner-section {
  background: #fff;
  margin-bottom: 8px;

  .banner-swiper {
    height: 200px;

    :deep(.swiper-wrapper) {
      height: 100%;
    }

    :deep(.swiper-slide) {
      height: 100%;
    }

    .banner-slide {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #fff;

      :deep(.tf-image) {
        width: 100%;
        height: 100%;
      }

      :deep(img) {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      cursor: pointer;
    }
  }

  :deep(.swiper-pagination-bullet) {
    background: rgba(255, 255, 255, 0.5);
    opacity: 1;

    &.swiper-pagination-bullet-active {
      background: #ff6b00;
    }
  }
}

// 快速分类
.category-section {
  background: #fff;
  padding: 16px;
  display: flex;
  justify-content: space-around;
  margin-bottom: 8px;

  .category-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;

    .category-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: #fff;

      &.new {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.used {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }

      &.all {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      }
    }

    span {
      font-size: 13px;
      color: #333;
    }
  }
}

// 品牌分类
.brands-section {
  background: #fff;
  padding: 16px;
  margin-bottom: 8px;

  .brands-list {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;

    .brand-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;

      .brand-icon {
        width: 48px;
        height: 48px;
        background: #f5f5f5;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #666;
      }

      span {
        font-size: 12px;
        color: #666;
      }
    }
  }
}

// 商品区域
.products-section {
  background: #fff;
  padding: 16px;
  margin-bottom: 8px;

  .products-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .product-card {
    border: 1px solid #eee;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;

    .product-image {
      position: relative;
      width: 100%;
      padding-top: 100%;
      background: #f5f5f5;
      cursor: pointer;

      .product-image-inner {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        :deep(.lazy-container),
        :deep(.tf-image),
        :deep(.tf-image-img),
        :deep(.tf-image-placeholder),
        :deep(.tf-image-error) {
          width: 100%;
          height: 100%;
        }

        :deep(.tf-image-placeholder),
        :deep(.tf-image-error) {
          min-height: 0;
        }

        :deep(.tf-image-img) {
          display: block;
          object-fit: cover;
        }
      }

      .tag-used {
        position: absolute;
        top: 8px;
        left: 8px;
        background: rgba(255, 107, 0, 0.9);
        color: #fff;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .tag-new {
        position: absolute;
        top: 8px;
        left: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
      }
    }

    .product-info {
      padding: 10px 8px;

      .product-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin: 0 0 6px;
      }

      .product-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .product-price {
          display: flex;
          align-items: baseline;
          gap: 4px;

          .price-label {
            font-size: 11px;
            color: #999;
            font-weight: normal;
          }

          .price-value {
            font-size: 17px;
            font-weight: 600;
            color: #ff1744;
            letter-spacing: -0.3px;

            &.price-inquire {
              font-size: 15px;
              color: #ff6b00;
              font-weight: 500;
            }
          }
        }

        .cart-icon {
          font-size: 18px;
          color: #ff6b00;
          cursor: pointer;
          padding: 4px;
          transition: all 0.2s;

          &:hover {
            color: #ff8c00;
            transform: scale(1.1);
          }

          &:active {
            transform: scale(0.95);
          }

          &.adding {
            animation: rotate 1s linear infinite;
            color: #999;
          }
        }
      }
    }
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
}

.empty-section {
  padding: 20px 0;
  text-align: center;
}

// 通用标题
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: #333;
    margin: 0;
  }

  span {
    font-size: 13px;
    color: #999;
    cursor: pointer;
  }
}

// 空状态
.empty-state {
  padding: 60px 16px;
  background: #fff;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;

  .empty-icon {
    width: 120px;
    height: 120px;
    background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    i {
      font-size: 48px;
      color: #ccc;
    }
  }
}

// 地图弹窗样式
.map-dialog-content {
  .map-container {
    border-radius: 8px;
    overflow: hidden;
  }

  .mobile-map {
    width: 100%;
    height: 400px;
    border-radius: 8px;
  }

  .map-placeholder {
    text-align: center;
    padding: 60px 20px;
    color: #999;

    i {
      font-size: 48px;
      margin-bottom: 16px;
      color: #ddd;
    }

    p {
      margin: 8px 0;
      font-size: 14px;

      &.hint {
        font-size: 12px;
        color: #bbb;
      }
    }
  }
}
</style>
