<!--
  AggregatedProductDetail - H5聚合商品详情页
  功能：按品牌+型号+颜色聚合展示，支持内存选择、店铺选择、购买
-->
<template>
  <div
    v-if="!loading && productData"
    class="aggregated-product-page"
  >
    <!-- 商品图片轮播 -->
    <div class="product-gallery-card">
      <Swiper
        :modules="[SwiperPagination, SwiperAutoplay]"
        class="product-swiper"
      >
        <SwiperSlide
          v-for="(image, index) in productImages"
          :key="index"
        >
          <div class="swiper-image-wrapper">
            <img
              :src="getImageUrl(image)"
              :alt="`${productData.brand_name} ${productData.model_name}`"
            >
          </div>
        </SwiperSlide>
      </Swiper>
      <div class="gallery-tags">
        <span
          v-if="!productData.is_new"
          class="tag-used"
        >二手</span>
        <span
          v-else
          class="tag-new"
        >全新</span>
      </div>
    </div>

    <!-- 商品基本信息卡片 -->
    <div class="info-card">
      <h1 class="product-title">
        {{ productData.brand_name }} {{ productData.model_name }} {{ productData.color_name }}
      </h1>
    </div>

    <!-- 价格卡片 -->
    <div
      v-if="displayMinPrice"
      class="price-card"
    >
      <div class="price-label">
        销售价
      </div>
      <div class="price-values">
        <span class="price-symbol">¥</span>
        <span class="price-value">{{ displayMinPrice }}</span>
        <span
          v-if="displayMaxPrice && displayMaxPrice !== displayMinPrice"
          class="price-separator"
        >~</span>
        <span
          v-if="displayMaxPrice && displayMaxPrice !== displayMinPrice"
          class="price-value"
        >{{ displayMaxPrice }}</span>
      </div>
    </div>
    <div
      v-else
      class="price-card price-inquire"
    >
      <div class="price-label">
        销售价
      </div>
      <div class="price-values">
        <span class="price-value inquire">电询</span>
      </div>
    </div>

    <!-- 内存规格选择卡片 -->
    <div class="spec-card">
      <div class="card-header">
        <h3 class="card-title">
          <i class="fas fa-memory" />
          选择内存规格
        </h3>
        <span class="required-mark">必选</span>
      </div>
      <div class="memory-options">
        <div
          v-for="memory in productData.memories"
          :key="memory.id"
          class="memory-option"
          :class="{
            active: selectedMemory?.id === memory.id,
            disabled: memory.stock === 0
          }"
          @click="selectMemory(memory)"
        >
          <div class="memory-info">
            <span class="memory-name">{{ memory.name }}</span>
            <span class="memory-price">¥{{ memory.price }}</span>
          </div>
          <div class="memory-check">
            <i
              v-if="selectedMemory?.id === memory.id"
              class="fas fa-check"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 店铺选择卡片 -->
    <div
      v-if="stockDistribution"
      class="store-card"
    >
      <div class="card-header">
        <h3 class="card-title">
          <i class="fas fa-store" />
          选择店铺
        </h3>
        <span class="required-mark">必选</span>
      </div>
      <div class="store-list">
        <div
          v-for="store in stockDistribution.stores"
          :key="store.store_id"
          class="store-option"
          :class="{ active: selectedStore?.store_id === store.store_id }"
          @click="selectStore(store)"
        >
          <div class="store-content">
            <div class="store-header-info">
              <h4 class="store-name">
                {{ store.store_name }}
              </h4>
              <div class="store-check-indicator">
                <i
                  v-if="selectedStore?.store_id === store.store_id"
                  class="fas fa-check-circle"
                />
                <i
                  v-else
                  class="far fa-circle"
                />
              </div>
            </div>
            <p
              v-if="store.store_address"
              class="store-address"
            >
              <i class="fas fa-map-marker-alt" />
              {{ store.store_address }}
            </p>
            <p
              v-if="store.store_phone"
              class="store-phone"
            >
              <i class="fas fa-phone" />
              {{ store.store_phone }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 商品详情卡片 -->
    <div class="detail-card">
      <div class="card-header">
        <h3 class="card-title">
          <i class="fas fa-info-circle" />
          商品详情
        </h3>
      </div>
      <div class="detail-content">
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">品牌</span>
            <span class="detail-value">{{ productData.brand_name }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">型号</span>
            <span class="detail-value">{{ productData.model_name }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">颜色</span>
            <span class="detail-value">{{ productData.color_name }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">成色</span>
            <span class="detail-value">
              <span :class="{ 'tag-new': productData.is_new, 'tag-used-mini': !productData.is_new }">
                {{ productData.is_new ? '全新' : '二手' }}
              </span>
            </span>
          </div>
        </div>
        <div class="warranty-info">
          <i class="fas fa-shield-alt" />
          <span>{{ productData.is_new ? '全新机保修1年，人为损坏不保修' : '二手机保修1月，人为损坏不保修' }}</span>
        </div>
      </div>
    </div>

    <!-- 底部安全间距 -->
    <div class="bottom-spacer" />

    <!-- 底部操作栏 -->
    <div class="bottom-bar">
      <a
        v-if="config.shop_phone"
        :href="`tel:${config.shop_phone}`"
        class="service-btn"
      >
        <i class="fas fa-headset" />
        <span>客服</span>
      </a>

      <!-- 购买按钮组 - 根据direct_buy_enabled控制显示 -->
      <template v-if="config.direct_buy_enabled">
        <el-button
          v-if="config.cart_enabled && canAddToCart"
          class="cart-btn"
          :disabled="!canPurchase"
          @click="addToCart"
        >
          <i class="fas fa-cart-plus" />
          加入购物车
        </el-button>
        <el-button
          type="primary"
          class="buy-btn"
          :class="{ 'full-width': !config.cart_enabled || !canAddToCart }"
          :disabled="!canPurchase"
          @click="buyNow"
        >
          立即购买
        </el-button>
      </template>

      <!-- 购买禁用提示 -->
      <div
        v-else
        class="purchase-disabled"
      >
        <i class="fas fa-ban" />
        <span>商品暂停销售</span>
      </div>
    </div>
  </div>

  <!-- 加载状态 -->
  <SectionLoading
    v-else
    text="加载中..."
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Pagination, Autoplay } from 'swiper/modules'
import { ElMessage } from 'element-plus'
import SectionLoading from '@/components/SectionLoading.vue'
import 'swiper/css'
import 'swiper/css/pagination'
import { getPublicConfig, getStockDistribution, getProductDetail, getAggregatedProducts, type ProductDetail, type ShopConfig } from '@/api/shop-public'
import type { AggregatedProduct, StockDistribution, StoreStock } from '@/api/shop-public'
import { useCart } from '@/composables'
import { formatAmount, formatImageUrl } from '@/utils/format'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'
import { getRequestErrorMessage } from '@/utils/api-response'
// 注册 Swiper 模块
const SwiperPagination = Pagination
const SwiperAutoplay = Autoplay

// Swiper 配置
const router = useRouter()
const route = useRoute()
const { addCartItem, refreshCart } = useCart()

// 数据
const loading = ref(true)
const loadSequence = ref(0)
const config = ref<Partial<ShopConfig>>({ cart_enabled: true, direct_buy_enabled: true })
const productData = ref<AggregatedProduct | null>(null)
const stockDistribution = ref<StockDistribution | null>(null)
const selectedMemory = ref<AggregatedProduct['memories'][0] | null>(null)
const selectedStore = ref<StoreStock | null>(null)

type ProductImageItem =
  | string
  | {
      image_url?: string
      url?: string
    }

// 获取图片 URL
const getImageUrl = (image: ProductImageItem): string => {
  if (typeof image === 'string') {
    return formatImageUrl(image)
  }

  if (image && typeof image === 'object') {
    const imageUrl = image.image_url || image.url || ''
    return formatImageUrl(imageUrl)
  }

  return ''
}

// 商品图片
const productImages = computed(() => {
  if (!productData.value) return []
  // 优先使用模板的图片数组，如果没有则使用 main_image
  if (productData.value.images && productData.value.images.length > 0) {
    return productData.value.images.filter((image) => Boolean(getImageUrl(image as ProductImageItem)))
  }
  if (productData.value.main_image) {
    return [productData.value.main_image]
  }
  return []
})

// 是否可以购买
const canPurchase = computed(() => {
  return selectedMemory.value && selectedMemory.value.stock > 0 && selectedStore.value
})

// 是否可以加入购物车
const canAddToCart = computed(() => {
  return config.value.cart_enabled && selectedStore.value && selectedStore.value.items.length > 0
})

// 价格显示计算属性
const displayMinPrice = computed(() => {
  if (!productData.value) return null
  const price = Number(productData.value.min_price)
  return price && price > 0 ? formatAmount(price) : null
})

const displayMaxPrice = computed(() => {
  if (!productData.value) return null
  const price = Number(productData.value.max_price)
  return price && price > 0 ? formatAmount(price) : null
})

const routeProductKey = computed(() => JSON.stringify({
  id: route.params.id ?? null,
  brand_id: route.query.brand_id ?? null,
  model_id: route.query.model_id ?? null,
  color_id: route.query.color_id ?? null,
  is_new: route.query.is_new ?? null
}))

const resetDetailState = () => {
  loading.value = true
  productData.value = null
  stockDistribution.value = null
  selectedMemory.value = null
  selectedStore.value = null
}

// 加载商城配置
const loadConfig = async () => {
  try {
    const shopConfig = await getPublicConfig()
    // 设置默认值，防止后端没有返回配置项
    config.value = {
      ...shopConfig,
      cart_enabled: shopConfig.cart_enabled !== false,
      direct_buy_enabled: shopConfig.direct_buy_enabled !== false
    }
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 从路由参数构建产品数据
const loadProductFromRoute = async () => {
  const sequence = ++loadSequence.value

  // 优先使用路径参数（模板 ID）
  const templateId = route.params.id as string
  // 兼容查询参数方式
  const { brand_id, model_id, color_id, is_new } = route.query

  if (templateId) {
    // 使用模板 ID 加载
    await loadProductByTemplateId(parseInt(templateId), sequence)
  } else if (brand_id && model_id && color_id && is_new !== undefined) {
    // 使用查询参数加载（兼容旧版）
    await loadProductByQuery(
      parseInt(brand_id as string),
      parseInt(model_id as string),
      parseInt(color_id as string),
      is_new === 'true' || is_new === '1',
      sequence
    )
  } else {
    if (sequence === loadSequence.value) {
      ElMessage.error('商品信息不完整')
      router.push('/m')
    }
  }
}

// 通过模板 ID 加载商品
const loadProductByTemplateId = async (templateId: number, sequence = loadSequence.value) => {
  loading.value = true
  try {
    // 直接通过模板 ID 获取模板详情
    const templateData = await getProductDetail(templateId) as ProductDetail & { template_name?: string, color_id?: number, memory_ids?: number[], price_options?: Array<{ memory_id: number, memory_name: string, display_price?: number, sale_price?: number, stock?: number }>, stock_count?: number, min_wholesale_price?: number }
    if (sequence !== loadSequence.value) {
      return
    }

    if (!templateData || !templateData.template_name) {
      if (sequence === loadSequence.value) {
        ElMessage.error('模板商品不存在')
        router.push('/m')
      }
      return
    }

    // 获取聚合商品数据以获得完整的库存信息
    const result = await getAggregatedProducts({
      brand_id: templateData.brand_id,
      model_id: templateData.model_id,
      color_id: templateData.color_id,
      is_new: true,
      page: 1,
      page_size: 1
    })
    if (sequence !== loadSequence.value) {
      return
    }

    // 使用聚合商品数据（包含库存信息），但使用模板数据的图片和价格
    if (result.data && result.data.length > 0) {
      const aggregatedData = result.data[0]

      // 从 price_options 计算价格范围
      const prices = (templateData.price_options || [])
        .map(po => {
          const price = Number(po.display_price || po.sale_price || 0)
          return price
        })
        .filter((p: number) => p > 0)

      // 优先使用独立的 H5 价格选项，没有选项时使用模板计算结果。
      let calculatedMinPrice: number
      let calculatedMaxPrice: number

      if (prices.length > 0) {
        calculatedMinPrice = Math.min(...prices)
        calculatedMaxPrice = Math.max(...prices)
      } else {
        // price_options 为空，使用模板数据的价格
        const templatePrice = Number(templateData.sale_price || templateData.min_wholesale_price || 0)
        calculatedMinPrice = templatePrice
        calculatedMaxPrice = templatePrice
      }

      productData.value = {
        ...aggregatedData,
        min_price: calculatedMinPrice,
        max_price: calculatedMaxPrice,
        images: templateData.images?.map(image => typeof image === 'string' ? image : image.image_url) || aggregatedData.images,
        main_image: templateData.main_image || aggregatedData.main_image,
        // 如果模板有价格选项，使用模板的价格，否则使用聚合数据的价格
        memories: templateData.price_options?.map(po => ({
          id: po.memory_id,
          name: po.memory_name,
          price: Number(po.display_price || po.sale_price || 0),
          // 使用模板的库存数量，如果没有则使用聚合数据的总库存
          stock: Number(po.stock || aggregatedData.total_stock || 0)
        })) || aggregatedData.memories || []
      }
    } else {
      // 如果没有聚合数据，使用模板数据（库存为0）
      // 从 price_options 计算价格范围
      const prices = (templateData.price_options || [])
        .map(po => Number(po.display_price || po.sale_price || 0))
        .filter((p: number) => p > 0)

      // 优先使用独立的 H5 价格选项，没有选项时使用模板计算结果。
      let calculatedMinPrice: number
      let calculatedMaxPrice: number

      if (prices.length > 0) {
        calculatedMinPrice = Math.min(...prices)
        calculatedMaxPrice = Math.max(...prices)
      } else {
        // price_options 为空，使用模板数据的价格
        const templatePrice = Number(templateData.sale_price || templateData.min_wholesale_price || 0)
        calculatedMinPrice = templatePrice
        calculatedMaxPrice = templatePrice
      }

      productData.value = {
        product_key: `${templateData.brand_id}-${templateData.model_id}-${templateData.color_id}-1`,
        brand_id: templateData.brand_id,
        brand_name: templateData.brand_name,
        model_id: templateData.model_id,
        model_name: templateData.model_name,
        color_id: Number(templateData.color_id || 0),
        color_name: templateData.color_name,
        is_new: 1,
        min_price: calculatedMinPrice,
        max_price: calculatedMaxPrice,
        total_stock: Number(templateData.stock_count || 0),
        main_image: templateData.main_image,
        images: templateData.images?.map(image => typeof image === 'string' ? image : image.image_url) || [],
        template_id: templateId,
        memory_ids: templateData.memory_ids,
        memories: templateData.price_options?.map(po => ({
          id: po.memory_id,
          name: po.memory_name,
          price: Number(po.display_price || po.sale_price || 0),
          // 使用模板的库存数量，如果没有则使用总库存
          stock: Number(po.stock || templateData.stock_count || 0)
        })) || []
      }
    }
  } catch (error) {
    if (sequence !== loadSequence.value) {
      return
    }
    logger.error('获取模板商品信息失败:', error)
    ElMessage.error('获取商品信息失败')
    router.push('/m')
  } finally {
    if (sequence === loadSequence.value) {
      loading.value = false
    }
  }
}

// 通过查询参数加载商品（兼容旧版）
const loadProductByQuery = async (brandId: number, modelId: number, colorId: number, isNew: boolean, sequence = loadSequence.value) => {
  loading.value = true
  try {
    const result = await getAggregatedProducts({
      brand_id: brandId,
      model_id: modelId,
      color_id: colorId,
      is_new: isNew,
      page: 1,
      page_size: 1
    })
    if (sequence !== loadSequence.value) {
      return
    }

    if (result.data.length > 0) {
      productData.value = result.data[0]
    } else {
      ElMessage.error('商品不存在')
      router.push('/m')
    }
  } catch (error) {
    if (sequence !== loadSequence.value) {
      return
    }
    logger.error('获取商品信息失败:', error)
    ElMessage.error('获取商品信息失败')
    router.push('/m')
  } finally {
    if (sequence === loadSequence.value) {
      loading.value = false
    }
  }
}

// 选择内存规格
const selectMemory = async (memory: AggregatedProduct['memories'][0]) => {
  if (memory.stock === 0) {
    ElMessage.warning('该规格暂时缺货')
    return
  }

  selectedMemory.value = memory
  selectedStore.value = null

  // 加载该内存规格的库存分布
  try {
    const result = await getStockDistribution({
      brand_id: productData.value!.brand_id,
      model_id: productData.value!.model_id,
      color_id: productData.value!.color_id,
      memory_id: memory.id,
      is_new: Number(productData.value!.is_new) === 1
    })
    // 如果返回的是 axios 响应对象，取 data 属性
    stockDistribution.value = result
  } catch (error) {
    logger.error('获取库存分布失败:', error)
    ElMessage.error('获取库存信息失败')
  }
}

// 选择店铺
const selectStore = (store: StoreStock) => {
  selectedStore.value = store
}

// 加入购物车
const addToCart = async () => {
  if (!canAddToCart.value || !selectedStore.value) {
    ElMessage.warning('请先选择内存规格和店铺')
    return
  }

  // 检查 items 是否存在
  if (!selectedStore.value.items || selectedStore.value.items.length === 0) {
    ElMessage.error('该店铺暂时没有库存')
    return
  }

  // 选择该店铺的第一个库存商品
  const firstItem = selectedStore.value.items[0]

  try {
    const result = await addCartItem(firstItem.phone_id)
    if (result.success) {
      ElMessage.success('已加入购物车')
      await refreshCart()
    } else {
      ElMessage.error(result.message || '加入购物车失败')
    }
  } catch (error: unknown) {
    logger.error('加入购物车失败:', error)
    ElMessage.error(getRequestErrorMessage(error, '加入购物车失败'))
  }
}

// 立即购买
const buyNow = async () => {
  if (!canPurchase.value || !selectedStore.value) {
    ElMessage.warning('请先选择内存规格和店铺')
    return
  }

  // 选择该店铺的第一个库存商品
  const firstItem = selectedStore.value.items[0]

  // 获取价格：优先使用内存选择的价格，否则使用商品价格
  const priceValue = selectedMemory.value!.price ?? firstItem.sale_price

  // 构建商品数据
  const itemData = {
    phoneId: firstItem.phone_id,
    quantity: 1,
    brand_name: productData.value!.brand_name,
    model_name: productData.value!.model_name,
    color_name: productData.value!.color_name,
    memory_name: selectedMemory.value!.name,
    salePrice: typeof priceValue === 'number' ? priceValue : parseFloat(priceValue as string) || 0,
    image: firstItem.image_url,
    // 添加店铺信息
    store_id: selectedStore.value.store_id,
    store_name: selectedStore.value.store_name,
    store_address: selectedStore.value.store_address || '',
    store_phone: selectedStore.value.store_phone || ''
  }

  // 使用 sessionStorage 存储商品数据
  storage.set(H5_STORAGE_KEYS.CHECKOUT_ITEMS, [itemData], 'session')

  // 跳转到结算页面
  router.push({
    path: '/m/checkout'
  })
}

onMounted(async () => {
  await loadConfig()
})

watch(routeProductKey, () => {
  resetDetailState()
  void loadProductFromRoute()
}, { immediate: true })
</script>

<style scoped lang="scss" src="./styles/aggregated-product-detail/gallery-and-info.scss"></style>
<style scoped lang="scss" src="./styles/aggregated-product-detail/specs-and-details.scss"></style>
<style scoped lang="scss" src="./styles/aggregated-product-detail/bottom-bar.scss"></style>
