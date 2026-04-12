<!--
  ProductList - H5商品列表页
  功能：商品筛选、排序、分页加载
-->
<template>
  <div class="product-list-page">
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-item" @click="showFilterPopup = true">
        <span>{{ filterText }}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="filter-item" @click="toggleSort">
        <span>{{ sortText }}</span>
        <i class="fas fa-sort"></i>
      </div>
    </div>

    <!-- 商品列表 -->
    <div class="product-list">
      <div v-if="loading && products.length === 0" class="loading-state">
        <el-skeleton :rows="3" animated />
      </div>

      <div v-else-if="products.length === 0" class="empty-state">
        <el-empty description="暂无商品" />
      </div>

      <div v-else class="products">
        <template v-for="product in products" :key="getProductKey(product)">
          <div
            v-if="product"
            class="product-card"
            @click="goDetail(product)"
          >
            <div class="product-image">
              <img
                :src="getProductImage(product)"
                :alt="product.brand_name + ' ' + product.model_name"
                loading="lazy"
                @error="handleImageError"
                :_product="product"
              />
              <span v-if="isProductUsed(product)" class="tag-used">二手</span>
              <span v-else class="tag-new">全新</span>
            </div>
            <div class="product-info">
              <h4 class="product-title">
                <template v-if="isProductUsed(product)">
                  {{ product.model_name || '未知型号' }} {{ product.color_name || '' }}{{ (product as any).memory_name || '' }}
                </template>
                <template v-else>
                  {{ product.brand_name }} {{ product.model_name || '未知型号' }}
                  <span v-if="product.color_name">{{ product.color_name }}</span>
                </template>
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
                  :class="{ 'adding': addingToCart === getProductKey(product) }"
                  @click.stop="handleCartClick(product)"
                ></i>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 加载更多提示 -->
      <div v-if="loading && products.length > 0" class="loading-more">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <div v-else-if="!hasMore && products.length > 0" class="no-more-data">
        <div class="no-more-line">
          <span class="line"></span>
          <span class="text">
            <i class="fas fa-check-circle"></i>
            没有更多了
          </span>
          <span class="line"></span>
        </div>
      </div>
    </div>

    <!-- 筛选弹窗 -->
    <el-drawer v-model="showFilterPopup" direction="rtl" size="80%">
      <div class="filter-popup">
        <div class="filter-header">
          <h3>筛选条件</h3>
          <el-button text @click="resetFilters">重置</el-button>
        </div>

        <div class="filter-content">
          <!-- 成色筛选 -->
          <div class="filter-group">
            <h4>商品成色</h4>
            <div class="filter-options">
              <div
                class="filter-option"
                :class="{ active: draftFilters.is_new === null }"
                @click="selectCondition(null)"
              >
                全部
              </div>
              <div
                class="filter-option"
                :class="{ active: draftFilters.is_new === true }"
                @click="selectCondition(true)"
              >
                全新机
              </div>
              <div
                class="filter-option"
                :class="{ active: draftFilters.is_new === false }"
                @click="selectCondition(false)"
              >
                二手机
              </div>
            </div>
          </div>

          <!-- 品牌筛选 -->
          <div class="filter-group" v-if="brands.length > 0">
            <h4>品牌</h4>
            <div class="filter-options">
              <div
                class="filter-option"
                :class="{ active: draftFilters.brand_id === null }"
                @click="draftFilters.brand_id = null"
              >
                全部
              </div>
              <div
                v-for="brand in brands"
                :key="brand.id"
                class="filter-option"
                :class="{ active: draftFilters.brand_id === brand.id }"
                @click="draftFilters.brand_id = brand.id"
              >
                {{ brand.name }}
              </div>
            </div>
          </div>

          <!-- 内存筛选（仅二手机显示） -->
          <div class="filter-group" v-if="memories.length > 0 && draftFilters.is_new === false">
            <h4>内存</h4>
            <div class="filter-options">
              <div
                class="filter-option"
                :class="{ active: draftFilters.memory_id === null }"
                @click="draftFilters.memory_id = null"
              >
                全部
              </div>
              <div
                v-for="memory in memories"
                :key="memory.id"
                class="filter-option"
                :class="{ active: draftFilters.memory_id === memory.id }"
                @click="draftFilters.memory_id = memory.id"
              >
                {{ memory.name }}
              </div>
            </div>
          </div>
        </div>

        <div class="filter-footer">
          <el-button type="primary" style="width: 100%" @click="applyFilters">确定</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, onActivated, onDeactivated, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getAggregatedProducts, getProducts, getPublicConfig } from '@/api/shop-public'
import { baseDataApi } from '@/api/base-data'
import { useCart, useLoadingState } from '@/composables'
import type { AggregatedProduct } from '@/api/shop-public'
import { storage } from '@/services/storage'
import { formatImageUrl, generateProductPlaceholder } from '@/utils/format'
import { logger } from '@/utils/logger'
// 滚动位置存储键前缀
const SCROLL_POSITION_PREFIX = 'scroll-pos_'
const PRODUCT_LIST_SCROLL_KEY = `${SCROLL_POSITION_PREFIX}/m/products`

// 定义组件名称，供 keep-alive 使用
defineOptions({
  name: 'MobileProducts'
})

const router = useRouter()
const route = useRoute()

// 数据
const products = ref<AggregatedProduct[]>([])
const brands = ref<any[]>([])
const memories = ref<any[]>([])
const { loading } = useLoadingState()
const showFilterPopup = ref(false)
const hasMore = ref(true)
const currentPage = ref(1)
const pageSize = 20
const responseTotal = ref(0) // 存储API返回的总数据量
const requestId = ref(0) // 添加请求 ID，用于取消旧请求
const reloadSequence = ref(0) // 用于终止旧的分批加载流程
const isInitializing = ref(false) // 标记是否正在初始化
const isSyncingRouteFilters = ref(false) // 标记是否正在同步路由筛选
const suppressNextRouteReload = ref(false) // 本地更新 query 后，跳过下一次 route watcher 重载
const config = ref<any>({}) // 商城配置

// 购物车功能
const { cartCount, getCartId, addCartItem, refreshCart } = useCart()
const addingToCart = ref<string | null>(null)

// 缓存管理
const cache = ref<Map<string, any>>(new Map()) // 缓存品牌和内存数据

const saveScrollPosition = () => {
  if (route.path !== '/m/products') {
    return
  }

  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
  storage.set(PRODUCT_LIST_SCROLL_KEY, String(scrollTop), 'session')
}

const clearSavedScrollPosition = () => {
  storage.remove(PRODUCT_LIST_SCROLL_KEY, 'session')
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'auto' })
}

// 滚动加载更多（带节流）
let scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null
const handleScroll = () => {
  if (loading.value || !hasMore.value) {
    return
  }

  // 节流处理
  if (scrollThrottleTimer) return

  scrollThrottleTimer = setTimeout(() => {
    scrollThrottleTimer = null

    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight

    // 距离底部 200px 时触发加载
    if (scrollTop + windowHeight >= documentHeight - 200) {
      loadNextPage()
    }
  }, 100) // 100ms 节流
}

const loadNextPage = async () => {
  if (loading.value || !hasMore.value) {
    return
  }

  const nextPage = currentPage.value + 1
  await loadProducts(nextPage, true)
}

// 计算属性：判断当前是否显示全新机（聚合商品）
const isShowingNewProducts = computed(() => {
  // 始终使用聚合API，让后端根据 is_new 参数决定返回什么
  return true
})

type ProductFilters = {
  brand_id: number | null
  model_id: number | null
  color_id: number | null
  memory_id: number | null
  is_new: boolean | null
  condition_grade: string | null
  search: string
}

// 筛选条件
const filters = ref<ProductFilters>({
  brand_id: null,
  model_id: null,
  color_id: null,
  memory_id: null,
  is_new: null,
  condition_grade: null,
  search: ''
})

const draftFilters = ref<ProductFilters>({
  ...filters.value
})

const createDefaultFilters = (): ProductFilters => ({
  brand_id: null,
  model_id: null,
  color_id: null,
  memory_id: null,
  is_new: null,
  condition_grade: null,
  search: ''
})

const parseNumberQuery = (value: unknown): number | null => {
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = parseInt(value, 10)
    return Number.isNaN(parsed) ? null : parsed
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return null
}

const parseBooleanQuery = (value: unknown): boolean | null => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }

  return null
}

const getFiltersFromRouteQuery = (query: Record<string, any>) => {
  const nextFilters = createDefaultFilters()

  nextFilters.brand_id = parseNumberQuery(query.brand_id)
  nextFilters.model_id = parseNumberQuery(query.model_id)
  nextFilters.color_id = parseNumberQuery(query.color_id)
  nextFilters.memory_id = parseNumberQuery(query.memory_id)
  nextFilters.is_new = parseBooleanQuery(query.is_new)
  nextFilters.condition_grade = typeof query.condition_grade === 'string' && query.condition_grade.trim()
    ? query.condition_grade
    : null
  nextFilters.search = typeof query.search === 'string' ? query.search.trim() : ''

  if (nextFilters.is_new !== false) {
    nextFilters.memory_id = null
  }

  return nextFilters
}

const syncFiltersFromRouteQuery = (query: Record<string, any>) => {
  const nextFilters = getFiltersFromRouteQuery(query)
  const currentFilters = filters.value
  const hasChanged = Object.keys(nextFilters).some((key) => currentFilters[key as keyof typeof nextFilters] !== nextFilters[key as keyof typeof nextFilters])

  if (!hasChanged) {
    draftFilters.value = { ...nextFilters }
    return false
  }

  isSyncingRouteFilters.value = true
  filters.value = nextFilters
  draftFilters.value = { ...nextFilters }
  return true
}

// 防抖定时器
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 应用防抖的筛选条件更新
const debouncedLoadProducts = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    loadProducts(1)
  }, 300) // 300ms 防抖延迟
}

const loadInitialPages = async (sequence: number) => {
  const targetPages = 3 // 自动加载前3页

  for (let i = 2; i <= targetPages; i++) {
    if (sequence !== reloadSequence.value || !hasMore.value) {
      break
    }

    await loadProducts(i, true)

    if (sequence !== reloadSequence.value) {
      break
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

// 排序方式
const sortOptions = [
  { value: 'created_at', label: '最新上架' },
  { value: 'price_asc', label: '价格从低到高' },
  { value: 'price_desc', label: '价格从高到低' }
]
const currentSort = ref('created_at')

// 筛选文本
const filterText = computed(() => {
  const texts = []
  if (filters.value.is_new !== null) {
    texts.push(filters.value.is_new ? '全新机' : '二手机')
  }
  if (filters.value.search) {
    texts.push(`搜索:${filters.value.search}`)
  }
  if (filters.value.brand_id) {
    const brand = brands.value.find(b => b.id === filters.value.brand_id)
    if (brand) texts.push(brand.name)
  }
  // 内存筛选在二手机模式下可用
  if (filters.value.is_new === false && filters.value.memory_id) {
    const memory = memories.value.find(m => m.id === filters.value.memory_id)
    if (memory) texts.push(memory.name)
  }
  return texts.length > 0 ? texts.join(' · ') : '筛选'
})

// 排序文本
const sortText = computed(() => {
  return sortOptions.find(s => s.value === currentSort.value)?.label || '排序'
})

// 获取品牌列表（带缓存）
const loadBrands = async () => {
  try {
    // 检查缓存
    if (cache.value.has('brands')) {
      brands.value = cache.value.get('brands')
      return
    }
    const data = await baseDataApi.getPublicBrands()
    brands.value = data
    cache.value.set('brands', data)
  } catch (error) {
    logger.error('获取品牌列表失败:', error)
  }
}

// 获取商城配置
const loadConfig = async () => {
  try {
    const data = await getPublicConfig()
    config.value = data
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 获取内存列表（带缓存）
const loadMemories = async () => {
  try {
    // 检查缓存
    if (cache.value.has('memories')) {
      memories.value = cache.value.get('memories')
      return
    }
    const data = await baseDataApi.getPublicMemories()
    memories.value = data
    cache.value.set('memories', data)
  } catch (error) {
    logger.error('获取内存列表失败:', error)
  }
}

// 获取商品列表（根据筛选条件自动选择API）
const loadProducts = async (page = 1, append = false, force = false) => {
  // 生成新的请求 ID
  const currentRequestId = ++requestId.value

  // 如果正在加载相同的页，取消重复请求
  if (!force && loading.value && currentPage.value === page) {
    return
  }

  loading.value = true
  try {
    // 根据筛选条件决定使用哪个API
    let response

    // 二手机：使用普通商品API（显示每个独立手机）
    if (filters.value.is_new === false) {
      const requestParams: any = {
        page,
        limit: pageSize,
        is_new: false
      }

      if (filters.value.brand_id) {
        requestParams.brand_id = filters.value.brand_id
      }

      if (filters.value.model_id) {
        requestParams.model_id = filters.value.model_id
      }

      if (filters.value.color_id) {
        requestParams.color_id = filters.value.color_id
      }

      if (filters.value.memory_id) {
        requestParams.memory_id = filters.value.memory_id
      }

      if (filters.value.condition_grade) {
        requestParams.condition_grade = filters.value.condition_grade
      }

      if (filters.value.search) {
        requestParams.search = filters.value.search
      }

      response = await getProducts(requestParams)
    }
    // 全新机或全部：使用聚合商品API
    else {
      const requestParams: any = {
        page,
        limit: pageSize,
        sort: currentSort.value
      }

      if (filters.value.brand_id) {
        requestParams.brand_id = filters.value.brand_id
      }

      if (filters.value.model_id) {
        requestParams.model_id = filters.value.model_id
      }

      if (filters.value.color_id) {
        requestParams.color_id = filters.value.color_id
      }

      // 明确传递 is_new 参数
      if (filters.value.is_new !== null) {
        requestParams.is_new = filters.value.is_new
      }

      // 传递成色筛选参数
      if (filters.value.condition_grade) {
        requestParams.condition_grade = filters.value.condition_grade
      }

      if (filters.value.search) {
        requestParams.search = filters.value.search
      }

      response = await getAggregatedProducts(requestParams)
    }

    // 检查请求是否还有效（可能已被新请求取代）
    if (currentRequestId !== requestId.value) {
      return
    }

    // 响应拦截器已处理，直接返回 { data, page, limit, total } 格式
    if (append) {
      products.value.push(...(response.data || []))
    } else {
      products.value = response.data || []
    }

    // 计算是否还有更多数据
    const loadedCount = response.page * response.limit
    hasMore.value = loadedCount < response.total
    currentPage.value = response.page
    responseTotal.value = response.total
  } catch (error) {
    logger.error('[loadProducts] 获取商品列表失败:', error)
    throw error
  } finally {
    // 确保总是重置 loading
    loading.value = false
  }
}

// 切换排序
const toggleSort = () => {
  const currentIndex = sortOptions.findIndex(s => s.value === currentSort.value)
  const nextIndex = (currentIndex + 1) % sortOptions.length
  currentSort.value = sortOptions[nextIndex].value
  clearSavedScrollPosition()
  scrollToTop()
  products.value = []
  currentPage.value = 1
  hasMore.value = true
  loadProducts(1)
}

// 应用筛选
const applyFilters = () => {
  clearSavedScrollPosition()
  scrollToTop()
  filters.value = {
    ...draftFilters.value
  }
  showFilterPopup.value = false
}

const selectCondition = (condition: boolean | null) => {
  if (draftFilters.value.is_new === condition) {
    return
  }

  draftFilters.value = {
    ...createDefaultFilters(),
    is_new: condition
  }
}

// 重置筛选
const resetFilters = () => {
  draftFilters.value = createDefaultFilters()
}

// 判断是否为聚合商品
const isProductAggregated = (product: any): product is AggregatedProduct => {
  return product && !!(product.product_key || product.template_id || product.template_name)
}

// 获取商品唯一标识
const getProductKey = (product: any) => {
  if (isProductAggregated(product)) {
    return `agg_${product.product_key || product.template_id}`
  }
  return `prod_${product.id}`
}

// 默认占位图（使用品牌、型号、颜色、内存生成SVG占位图 - 横向布局）
const generatePlaceholderImage = (product: any): string => {
  if (!product) return DEFAULT_PLACEHOLDER
  return generateProductPlaceholder({
    brand: product.brand_name || '',
    model: product.model_name || '',
    color: product.color_name || '',
    memory: (product as any).memory_name || product.memory_size || '',
    size: 200,
    layout: 'horizontal'
  })
}

// 默认占位图（SVG格式，避免额外请求）
const DEFAULT_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect width="200" height="200" fill="%23f5f5f5"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="16"%3E%E6%97%A0%E5%9B%BE%E7%89%87%3C/text%3E%3C/svg%3E'

// 获取商品图片
const getProductImage = (product: any) => {
  if (!product) {
    return DEFAULT_PLACEHOLDER
  }
  // 如果有图片URL，直接返回
  if (product.main_image) {
    const resolvedImageUrl = formatImageUrl(product.main_image)
    if (resolvedImageUrl) {
      return resolvedImageUrl
    }
  }
  // 没有图片时，使用生成的占位图
  return generatePlaceholderImage(product)
}

// 处理图片加载错误
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  // 避免重复设置占位图
  if (!img.dataset.placeholderUsed) {
    const product = (img as any)._product
    if (product) {
      img.src = generatePlaceholderImage(product)
      img.dataset.placeholderUsed = 'true'
    } else if (!img.src.includes('data:image/svg+xml')) {
      img.src = DEFAULT_PLACEHOLDER
    }
  }
}

// 判断是否为二手机
const isProductUsed = (product: any) => {
  if (!product) return false

  // 聚合商品：检查 is_new 字段（可能是数字或字符串）
  if (isProductAggregated(product)) {
    const isNewVal = product.is_new
    const isNewNum = Number(isNewVal)
    return isNewNum === 0 || isNewVal === '0'
  }
  // 普通商品：检查 is_new 字段
  const isNewVal = product.is_new
  const isNewNum = Number(isNewVal)
  return isNewNum === 0 || isNewVal === '0'
}

// 获取商品显示价格
const getDisplayPrice = (product: any) => {
  if (!product) return null

  if (isProductAggregated(product)) {
    // 聚合商品：检查 min_price
    return product.min_price || null
  } else {
    // 普通商品：检查 sale_price
    return (product as any).sale_price || null
  }
}

// 处理购物车图标点击
const handleCartClick = async (product: any) => {
  // 全新机需要找到对应的商品
  if (product.template_id) {
    addingToCart.value = getProductKey(product)
    try {
      // 使用模板商品API获取详细信息
      const { getTemplatePhones } = await import('@/api/shop-public')
      const response = await getTemplatePhones(product.template_id)
      const phones = response?.data || []

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
  const phoneId = product.first_phone_id || product.id
  addingToCart.value = getProductKey(product)
  try {
    await addCartItem(phoneId, 1)
    await refreshCart()
    ElMessage.success('已加入购物车')
  } catch (error) {
    logger.error('加入购物车失败:', error)
    ElMessage.error('加入购物车失败')
  } finally {
    addingToCart.value = null
  }
}

// 跳转详情
const goDetail = (product: any) => {
  saveScrollPosition()

  // 判断是否为全新机聚合商品（有 template_id）
  if (product.template_id) {
    // 全新机：跳转到聚合商品详情页，使用新的路由 /m/product/new/:id
    router.push(`/m/product/new/${product.template_id}`)
  } else {
    // 二手机：跳转到普通商品详情页，使用 phone ID
    const phoneId = product.first_phone_id || product.id
    router.push(`/m/product/${phoneId}`)
  }
}

const reloadProductsByRoute = async () => {
  const sequence = ++reloadSequence.value
  products.value = []
  currentPage.value = 1
  hasMore.value = true
  responseTotal.value = 0
  await loadProducts(1, false, true)
  if (sequence !== reloadSequence.value) {
    return
  }
  await loadInitialPages(sequence)
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true })

  // 加载商城配置和购物车数据
  loadConfig()
  await refreshCart()

  try {
    await Promise.all([
      loadBrands(),
      loadMemories()
    ])
  } catch (error) {
    logger.error('[ProductList] Initialization error:', error)
  }
})

watch(showFilterPopup, (visible) => {
  if (visible) {
    draftFilters.value = {
      ...filters.value
    }
  }
})

onUnmounted(() => {
  saveScrollPosition()
  window.removeEventListener('scroll', handleScroll)
})

onDeactivated(() => {
  saveScrollPosition()
})

// 当从详情页返回时恢复滚动位置
onActivated(async () => {
  if (route.path === '/m/products') {
    const routeChanged = syncFiltersFromRouteQuery(route.query as Record<string, any>)

    if (routeChanged) {
      isInitializing.value = true
      await reloadProductsByRoute()
      isInitializing.value = false
      isSyncingRouteFilters.value = false
      return
    }
  }

  const savedScrollY = storage.get<string>(PRODUCT_LIST_SCROLL_KEY, 'session')

  if (savedScrollY !== null) {
    const scrollY = parseInt(savedScrollY, 10)

    // 等待 Vue 更新和 DOM 渲染
    await nextTick()

    // 多次尝试滚动，确保页面高度足够
    const attemptScroll = async (attempt: number) => {
      const documentHeight = document.documentElement.scrollHeight
      const windowHeight = window.innerHeight


      if (documentHeight > windowHeight) {
        window.scrollTo({ top: scrollY, behavior: 'auto' })
        await new Promise(resolve => setTimeout(resolve, 50))

        const actualScroll = window.scrollY

        if (actualScroll < scrollY - 100 && attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, 100))
          await attemptScroll(attempt + 1)
        } else {
          clearSavedScrollPosition()
        }
      } else {
        if (attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, 200))
          await attemptScroll(attempt + 1)
        } else {
          logger.warn('[ProductList] 无法恢复滚动位置，页面高度不足')
          clearSavedScrollPosition()
        }
      }
    }

    await attemptScroll(1)
  }
})

// 监听筛选条件变化 - 分别监听每个属性
watch([() => filters.value.brand_id, () => filters.value.memory_id, () => filters.value.is_new, () => filters.value.condition_grade, () => filters.value.search], async ([newBrandId, newMemoryId, newIsNew, newConditionGrade, newSearch], [oldBrandId, oldMemoryId, oldIsNew, oldConditionGrade, oldSearch]) => {
  // 如果正在初始化，跳过此次变化
  if (isInitializing.value || isSyncingRouteFilters.value) {
    isSyncingRouteFilters.value = false
    return
  }

  // 检查是否有实际变化
  const hasChanged = newBrandId !== oldBrandId || newMemoryId !== oldMemoryId || newIsNew !== oldIsNew || newConditionGrade !== oldConditionGrade || newSearch !== oldSearch

  if (!hasChanged) return

  // 当切换成色时，重置内存筛选（因为全新机不支持内存筛选）
  if (newIsNew !== oldIsNew && oldIsNew !== undefined) {
    if (newIsNew === true || newIsNew === null) {
      filters.value.memory_id = null
    }
  }

  // 更新URL参数（不触发路由守卫）
  const query: any = {}
  if (filters.value.brand_id) query.brand_id = filters.value.brand_id
  // 只在二手机时保存内存筛选参数
  if (filters.value.is_new === false && filters.value.memory_id) {
    query.memory_id = filters.value.memory_id
  }
  if (filters.value.is_new !== null) query.is_new = filters.value.is_new
  if (filters.value.condition_grade) query.condition_grade = filters.value.condition_grade
  if (filters.value.search) query.search = filters.value.search

  // 使用 router.resolve 做规范化比对，避免 true/'true' 这类等价参数触发重复导航告警
  const targetRoute = router.resolve({
    path: route.path,
    query
  })

  if (targetRoute.fullPath !== route.fullPath) {
    suppressNextRouteReload.value = true
    router.replace({ query }).catch(() => {})
  }

  isInitializing.value = true
  await reloadProductsByRoute()
  isInitializing.value = false
})

watch(
  () => route.fullPath,
  async () => {
    if (route.path !== '/m/products') {
      return
    }

    if (suppressNextRouteReload.value) {
      suppressNextRouteReload.value = false
      return
    }

    const routeChanged = syncFiltersFromRouteQuery(route.query as Record<string, any>)
    if (!routeChanged && products.value.length > 0) {
      return
    }

    isInitializing.value = true
    await reloadProductsByRoute()
    isInitializing.value = false
    isSyncingRouteFilters.value = false
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.product-list-page {
  min-height: 100vh;
  background: #f5f5f5;
}

// 筛选栏
.filter-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  display: flex;
  gap: 1px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  .filter-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px;
    font-size: 14px;
    color: #333;
    background: #fff;
    cursor: pointer;

    i {
      font-size: 12px;
      color: #999;
    }
  }
}

// 商品列表
.product-list {
  padding: 8px;

  .products {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .product-card {
    background: #fff;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;

      .product-image {
        position: relative;
        width: 100%;
        padding-top: 100%;
        background: #f5f5f5;

      img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
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
      padding: 8px;

.product-title {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin: 0 0 8px;
        line-height: 1.4;
        min-height: 20px;

        span {
          font-weight: normal;
        }
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

        .product-grade {
          font-size: 11px;
          color: #00c853;
          background: rgba(0, 200, 83, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }
      }
    }
  }

  // 加载更多样式
  .loading-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    color: #999;
    font-size: 14px;

    .el-icon {
      font-size: 18px;
    }
  }

  // 没有更多数据样式
  .no-more-data {
    padding: 20px 16px;

    .no-more-line {
      display: flex;
      align-items: center;
      gap: 12px;

      .line {
        flex: 1;
        height: 1px;
        background: linear-gradient(to right, transparent, #e0e0e0, transparent);
      }

      .text {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #999;
        font-size: 13px;
        white-space: nowrap;

        i {
          color: #4caf50;
          font-size: 14px;
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

// 筛选弹窗
.filter-popup {
  display: flex;
  flex-direction: column;
  height: 100%;

  .filter-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid #eee;

    h3 {
      font-size: 16px;
      font-weight: 500;
      margin: 0;
    }
  }

  .filter-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;

    .filter-group {
      margin-bottom: 24px;

      h4 {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin: 0 0 12px;
      }

      .filter-options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .filter-option {
          padding: 8px 16px;
          background: #f5f5f5;
          border-radius: 4px;
          font-size: 13px;
          color: #666;
          cursor: pointer;
          transition: all 0.2s;

          &.active {
            background: #ff6b00;
            color: #fff;
          }
        }
      }
    }
  }

  .filter-footer {
    padding: 16px;
    border-top: 1px solid #eee;
  }
}

:deep(.el-drawer__body) {
  padding: 0;
}

// 空状态
.empty-state,
.loading-state {
  padding: 40px 16px;
  text-align: center;
}
</style>
