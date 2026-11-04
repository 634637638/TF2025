<!--
  MobileHome - H5移动端首页
  功能：轮播图、快速分类、首页推荐区域（动态配置）
-->
<template>
  <div
    class="mobile-home"
    style="min-height: 100vh; background: #f5f5f5;"
  >
    <!-- 顶部商家信息栏 -->
    <div
      v-if="config.shop_name || getImageUrl(config.shop_logo)"
      class="merchant-header"
    >
      <div
        class="merchant-info"
        @click="showMerchantDetail"
      >
        <div
          v-if="getImageUrl(config.shop_logo)"
          class="merchant-logo"
        >
          <Image
            :src="getImageUrl(config.shop_logo)"
            :alt="config.shop_name || '商家Logo'"
            mode="eager"
          />
        </div>
        <div class="merchant-text">
          <div class="merchant-name">
            {{ config.shop_name || '' }}
          </div>
        </div>
      </div>
      <div class="merchant-actions">
        <div
          class="action-btn"
          @click="showMerchantDetail"
        >
          <i class="fas fa-map-marker-alt" />
        </div>
        <div
          v-if="config.shop_phone"
          class="action-btn"
          @click="handlePhoneCall"
        >
          <i class="fas fa-phone" />
        </div>
        <div
          class="action-btn"
          @click="handleShare"
        >
          <i class="fas fa-share-alt" />
        </div>
      </div>
    </div>

    <!-- 轮播图 -->
    <div
      v-if="config.banner_enabled && allBannerImages.length > 0"
      class="banner-section"
    >
      <TypedSwiper
        v-bind="bannerSwiperOptions"
        :modules="[SwiperAutoplay, SwiperPagination]"
        class="banner-swiper"
        @slide-change="handleSlideChange"
      >
        <SwiperSlide
          v-for="(img, index) in allBannerImages"
          :key="`banner-${index}`"
        >
          <div class="banner-slide">
            <Image
              :src="img.url"
              :alt="img.title"
              mode="eager"
            />
          </div>
        </SwiperSlide>
      </TypedSwiper>
    </div>

    <!-- 快速分类 -->
    <div class="category-section">
      <div
        class="category-item"
        @click="goProducts({ is_new: 'true' })"
      >
        <div class="category-icon new">
          <i class="fas fa-star" />
        </div>
        <span>全新机</span>
      </div>
      <div
        class="category-item"
        @click="goProducts({ is_new: 'false' })"
      >
        <div class="category-icon used">
          <i class="fas fa-recycle" />
        </div>
        <span>二手机</span>
      </div>
      <div
        class="category-item"
        @click="goProducts({})"
      >
        <div class="category-icon all">
          <i class="fas fa-th" />
        </div>
        <span>全部商品</span>
      </div>
    </div>

    <!-- 品牌分类 -->
    <div
      v-if="brands.length > 0"
      class="brands-section"
    >
      <div class="section-title">
        <h3>热门品牌</h3>
        <span @click="goProducts({})">更多 <i class="fas fa-chevron-right" /></span>
      </div>
      <div class="brands-scroll">
        <div class="brands-list">
          <div
            v-for="brand in brands"
            :key="brand.id"
            class="brand-item"
            :class="{ active: selectedBrandId === brand.id }"
            @click="openBrandSearch(brand.id)"
          >
            <span>{{ brand.name }}</span>
          </div>
        </div>
      </div>
      <div
        v-if="selectedBrandId"
        class="brand-search-panel"
      >
        <div class="brand-search-header">
          <div class="brand-search-title">
            <strong>{{ selectedBrandName }}</strong>
            <span>精准筛选</span>
          </div>
          <el-button
            native-type="button"
            class="brand-reset-btn"
            @click="resetBrandSearch"
          >
            重置
          </el-button>
        </div>
        <div class="brand-search-grid">
          <label class="brand-field">
            <span>型号</span>
            <div class="brand-field-control">
              <el-input
                v-model.trim="modelKeyword"
                type="text"
                class="brand-field-input"
                placeholder="点击或输入筛选型号"
                @focus="openSearchField('model')"
                @click.stop="openSearchField('model')"
                @input="openSearchField('model')"
              />
              <el-button
                native-type="button"
                class="brand-field-toggle"
                @click.stop="toggleSearchField('model')"
              >
                <i
                  class="fas"
                  :class="activeSearchField === 'model' ? 'fa-chevron-up' : 'fa-chevron-down'"
                />
              </el-button>
            </div>
            <div
              v-if="activeSearchField === 'model'"
              class="brand-option-dropdown"
            >
              <div class="brand-option-list tf-dropdown-scroll">
                <el-button
                  native-type="button"
                  class="brand-option"
                  :class="{ active: selectedModelId === '' }"
                  @click="selectModelOption(null)"
                >
                  全部型号
                </el-button>
                <el-button
                  v-for="model in filteredBrandModels"
                  :key="model.id"
                  native-type="button"
                  class="brand-option"
                  :class="{ active: selectedModelId === String(model.id) }"
                  @click="selectModelOption(model)"
                >
                  {{ model.name }}
                </el-button>
              </div>
            </div>
          </label>
          <label class="brand-field">
            <span>颜色</span>
            <div class="brand-field-control">
              <el-input
                v-model.trim="colorKeyword"
                type="text"
                class="brand-field-input"
                placeholder="点击或输入筛选颜色"
                @focus="openSearchField('color')"
                @click.stop="openSearchField('color')"
                @input="openSearchField('color')"
              />
              <el-button
                native-type="button"
                class="brand-field-toggle"
                @click.stop="toggleSearchField('color')"
              >
                <i
                  class="fas"
                  :class="activeSearchField === 'color' ? 'fa-chevron-up' : 'fa-chevron-down'"
                />
              </el-button>
            </div>
            <div
              v-if="activeSearchField === 'color'"
              class="brand-option-dropdown"
            >
              <div class="brand-option-list tf-dropdown-scroll">
                <el-button
                  native-type="button"
                  class="brand-option"
                  :class="{ active: selectedColorId === '' }"
                  @click="selectColorOption(null)"
                >
                  全部颜色
                </el-button>
                <el-button
                  v-for="color in filteredColors"
                  :key="color.id"
                  native-type="button"
                  class="brand-option"
                  :class="{ active: selectedColorId === String(color.id) }"
                  @click="selectColorOption(color)"
                >
                  {{ color.name }}
                </el-button>
              </div>
            </div>
          </label>
          <label class="brand-field">
            <span>内存</span>
            <div class="brand-field-control">
              <el-input
                v-model.trim="memoryKeyword"
                type="text"
                class="brand-field-input"
                placeholder="点击或输入筛选内存"
                @focus="openSearchField('memory')"
                @click.stop="openSearchField('memory')"
                @input="openSearchField('memory')"
              />
              <el-button
                native-type="button"
                class="brand-field-toggle"
                @click.stop="toggleSearchField('memory')"
              >
                <i
                  class="fas"
                  :class="activeSearchField === 'memory' ? 'fa-chevron-up' : 'fa-chevron-down'"
                />
              </el-button>
            </div>
            <div
              v-if="activeSearchField === 'memory'"
              class="brand-option-dropdown"
            >
              <div class="brand-option-list tf-dropdown-scroll">
                <el-button
                  native-type="button"
                  class="brand-option"
                  :class="{ active: selectedMemoryId === '' }"
                  @click="selectMemoryOption(null)"
                >
                  全部内存
                </el-button>
                <el-button
                  v-for="memory in filteredMemories"
                  :key="memory.id"
                  native-type="button"
                  class="brand-option"
                  :class="{ active: selectedMemoryId === String(memory.id) }"
                  @click="selectMemoryOption(memory)"
                >
                  {{ memory.size || memory.name }}
                </el-button>
              </div>
            </div>
          </label>
        </div>
        <p class="brand-search-hint">
          选择内存时将自动按二手机检索
        </p>
        <div class="brand-search-actions">
          <el-button
            native-type="button"
            class="ghost-btn"
            @click="collapseBrandSearch"
          >
            收起
          </el-button>
          <el-button
            native-type="button"
            class="search-btn"
            @click="searchBrandProducts"
          >
            检索商品
          </el-button>
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
          <i
            v-if="section.icon"
            :class="section.icon"
            style="margin-right: 8px; color: #ff6b00;"
          />
          {{ section.section_name }}
        </h3>
        <span @click="goProductsFromSection(section)">更多 <i class="fas fa-chevron-right" /></span>
      </div>
      <div
        v-if="section.products && section.products.length > 0"
        class="products-grid"
      >
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
            <span
              v-if="product.product_type === 'used'"
              class="tag-used"
            >二手</span>
            <span
              v-else
              class="tag-new"
            >全新</span>
          </div>
          <div class="product-info">
            <h4 class="product-title">
              {{ getProductTitle(product, section.section_name) }}
            </h4>
            <div class="product-footer">
              <span class="product-price">
                <span class="price-label">销售价</span>
                <span
                  class="price-value"
                  :class="{ 'price-inquire': !getDisplayPrice(product) }"
                >
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
              />
            </div>
          </div>
        </div>
      </div>
      <DataEmptyState
        v-else
        :description="`暂无${section.section_name}`"
        :image-size="60"
      />
    </div>

    <!-- 空状态 -->
    <DataEmptyState
      v-if="!loading && homeSections.length === 0"
      size="page"
      description="暂无推荐商品"
    >
      <template #image>
        <div class="empty-icon">
          <i class="fas fa-box-open" />
        </div>
      </template>
    </DataEmptyState>

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
        <div
          v-if="config.map_latitude && config.map_longitude"
          class="map-container"
        >
          <div
            id="mobile-map-container"
            class="mobile-map"
          />
        </div>
        <div
          v-else
          class="map-placeholder"
        >
          <i class="fas fa-map-marker-alt" />
          <p>暂未设置地图位置</p>
          <p class="hint">
            请在后台配置中设置店铺位置
          </p>
        </div>
      </div>
      <template
        v-if="config.map_latitude && config.map_longitude"
        #footer
      >
        <div class="tf-dialog-actions">
          <el-button
            type="primary"
            @click="openExternalMap"
          >
            打开导航
          </el-button>
          <el-button
            type="default"
            @click="showMapDialog = false"
          >
            关闭
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, nextTick, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { Swiper, SwiperSlide } from 'swiper/vue'
import type { Swiper as SwiperInstance } from 'swiper'
import type { SwiperOptions } from 'swiper/types'
import { Autoplay, Pagination } from 'swiper/modules'
import { ElMessage } from 'element-plus'
import 'swiper/css'
import 'swiper/css/pagination'
import { getPublicConfig, getActiveBanners } from '@/api/shop-public'
import { baseDataApi } from '@/api/base-data'
import { getActiveHomeSections } from '@/api/home-sections'
import { useCart, useLoadingState } from '@/composables'
import Image from '@/components/Image.vue'
import type { PublicShopBanner as Banner, PublicTemplatePhone, ShopConfig } from '@/api/shop-public'
import type { HomeSection } from '@/api/home-sections'
import type { HomeSectionProduct } from '@/api/home-sections'
import type { Brand, Color, MemoryOption, Model } from '@/types'
import { formatSafeImageUrl, generateProductPlaceholder } from '@/utils/format'
import { storage } from '@/services/storage'
import { logger } from '@/utils/logger'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { ensureTencentMapKey, loadTencentMapScript } from '@/utils/tencent-map'
// 滚动位置存储键前缀
const SCROLL_POSITION_PREFIX = 'scroll-pos_'

// 定义组件名称，供 keep-alive 使用
defineOptions({
  name: 'MobileHome'
})

// 注册 Swiper 模块
const SwiperAutoplay = Autoplay
const SwiperPagination = Pagination
const TypedSwiper: Component = Swiper

const router = useRouter()

// 滚动监听器（在 setup 顶层定义，避免 onUnmounted 警告）
let scrollHandler: (() => void) | null = null

// 购物车功能
const { cartCount: _cartCount, getCartId: _getCartId, addCartItem, refreshCart } = useCart()
const addingToCart = ref<number | null>(null)

// 获取图片 URL
const getImageUrl = (imageUrl?: string): string => formatSafeImageUrl(imageUrl || '')

const getConditionText = (product: HomeSectionProduct): string => {
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

const getProductTitle = (product: HomeSectionProduct, sectionName = ''): string => {
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

const getProductImage = (product: HomeSectionProduct): string => {
  const imageUrl = getImageUrl(product?.main_image || '')
  return imageUrl || generatePlaceholderImage(product)
}

// 生成默认占位图（使用品牌、型号、颜色、内存生成SVG占位图 - 横向布局）
const generatePlaceholderImage = (product: HomeSectionProduct): string => {
  return generateProductPlaceholder({
    brand: product.brand_name || '',
    model: product.model_name || '',
    color: product.color_name || '',
    memory: product.memory_name || '',
    size: 200,
    layout: 'horizontal'
  })
}

// 数据
const config = ref<Partial<ShopConfig>>({})
const banners = ref<Banner[]>([])
const brands = ref<Brand[]>([])
const colors = ref<Color[]>([])
const memories = ref<MemoryOption[]>([])
const brandModels = ref<Model[]>([])
const homeSections = ref<HomeSection[]>([])
const { loading } = useLoadingState()
const currentSlideIndex = ref(0)
const showMapDialog = ref(false)
const selectedBrandId = ref<number | null>(null)
const selectedModelId = ref('')
const selectedColorId = ref('')
const selectedMemoryId = ref('')
const modelKeyword = ref('')
const colorKeyword = ref('')
const memoryKeyword = ref('')
const activeSearchField = ref<'model' | 'color' | 'memory' | null>(null)
const modelCache = new Map<number, Model[]>()
const selectedBrandName = computed(() => {
  const currentBrand = brands.value.find((brand) => brand.id === selectedBrandId.value)
  return currentBrand?.name || '当前品牌'
})
const normalizeKeyword = (value: string) => value.trim().toLowerCase()
const getMemoryLabel = (memory: MemoryOption) => memory.size || memory.name || ''
const filteredBrandModels = computed(() => {
  const keyword = normalizeKeyword(modelKeyword.value)
  if (!keyword) {
    return brandModels.value
  }
  return brandModels.value.filter((model) => String(model?.name || '').toLowerCase().includes(keyword))
})
const filteredColors = computed(() => {
  const keyword = normalizeKeyword(colorKeyword.value)
  if (!keyword) {
    return colors.value
  }
  return colors.value.filter((color) => String(color?.name || '').toLowerCase().includes(keyword))
})
const filteredMemories = computed(() => {
  const keyword = normalizeKeyword(memoryKeyword.value)
  if (!keyword) {
    return memories.value
  }
  return memories.value.filter((memory) => getMemoryLabel(memory).toLowerCase().includes(keyword))
})

// 当前轮播间隔（根据当前显示的 banner 动态调整）
const currentBannerInterval = computed(() => {
  if (allBannerImages.value.length === 0) return 3000
  const currentImg = allBannerImages.value[currentSlideIndex.value]
  if (currentImg && currentImg.banner && currentImg.banner.interval) {
    return currentImg.banner.interval
  }
  return 3000
})
const bannerSwiperOptions = computed<SwiperOptions>(() => ({
  autoplay: {
    delay: currentBannerInterval.value,
    disableOnInteraction: false
  },
  pagination: { clickable: true },
  loop: true
}))

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
    config.value = await getPublicConfig()
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 获取轮播图
const loadBanners = async () => {
  try {
    const response = await getActiveBanners()
    banners.value = Array.isArray(response) ? response : []
  } catch (error) {
    logger.error('获取轮播图失败:', error)
  }
}

// 获取品牌列表
const loadBrands = async () => {
  try {
    const publicBrands = await baseDataApi.getPublicBrands()
    brands.value = sortOptionsByOrder(publicBrands)
  } catch (error) {
    logger.error('获取品牌列表失败:', error)
  }
}

const loadColors = async () => {
  if (colors.value.length > 0) {
    return
  }

  try {
    const publicColors = await baseDataApi.getPublicColors()
    colors.value = sortOptionsByOrder(publicColors)
  } catch (error) {
    logger.error('获取颜色列表失败:', error)
  }
}

const loadMemories = async () => {
  if (memories.value.length > 0) {
    return
  }

  try {
    const publicMemories = await baseDataApi.getPublicMemories()
    memories.value = sortOptionsByOrder(publicMemories, { labelKeys: ['size', 'capacity', 'name'] })
  } catch (error) {
    logger.error('获取内存列表失败:', error)
  }
}

const loadBrandModels = async (brandId: number) => {
  if (modelCache.has(brandId)) {
    brandModels.value = modelCache.get(brandId) || []
    return
  }

  try {
    const publicModels = await baseDataApi.getPublicModels(brandId)
    const sortedModels = sortOptionsByOrder(publicModels)
    modelCache.set(brandId, sortedModels)
    brandModels.value = sortedModels
  } catch (error) {
    logger.error('获取型号列表失败:', error)
    brandModels.value = []
  }
}

const resetBrandSearchSelections = () => {
  selectedModelId.value = ''
  selectedColorId.value = ''
  selectedMemoryId.value = ''
  modelKeyword.value = ''
  colorKeyword.value = ''
  memoryKeyword.value = ''
}

const openSearchField = (field: 'model' | 'color' | 'memory') => {
  activeSearchField.value = field
}

const toggleSearchField = (field: 'model' | 'color' | 'memory') => {
  activeSearchField.value = activeSearchField.value === field ? null : field
}

const selectModelOption = (model: Model | null) => {
  selectedModelId.value = model ? String(model.id) : ''
  modelKeyword.value = model?.name || ''
  activeSearchField.value = null
}

const selectColorOption = (color: Color | null) => {
  selectedColorId.value = color ? String(color.id) : ''
  colorKeyword.value = color?.name || ''
  activeSearchField.value = null
}

const selectMemoryOption = (memory: MemoryOption | null) => {
  selectedMemoryId.value = memory ? String(memory.id) : ''
  memoryKeyword.value = memory ? getMemoryLabel(memory) : ''
  activeSearchField.value = null
}

const openBrandSearch = async (brandId: number) => {
  if (selectedBrandId.value === brandId) {
    collapseBrandSearch()
    return
  }

  selectedBrandId.value = brandId
  resetBrandSearchSelections()
  await Promise.allSettled([
    loadBrandModels(brandId),
    loadColors(),
    loadMemories()
  ])
}

const collapseBrandSearch = () => {
  selectedBrandId.value = null
  brandModels.value = []
  activeSearchField.value = null
  resetBrandSearchSelections()
}

const resetBrandSearch = async () => {
  if (!selectedBrandId.value) {
    return
  }

  resetBrandSearchSelections()
  await loadBrandModels(selectedBrandId.value)
}

const searchBrandProducts = () => {
  if (!selectedBrandId.value) {
    return
  }

  const query: Record<string, string | number> = {
    brand_id: selectedBrandId.value
  }

  if (selectedModelId.value) {
    query.model_id = Number(selectedModelId.value)
  }

  if (selectedColorId.value) {
    query.color_id = Number(selectedColorId.value)
  }

  if (selectedMemoryId.value) {
    query.memory_id = Number(selectedMemoryId.value)
    query.is_new = 'false'
  }

  router.push({
    path: '/m/products',
    query
  })
}

const handleDocumentPointerDown = (event: Event) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('.brand-search-panel')) {
    return
  }
  activeSearchField.value = null
}

// 获取首页推荐区域
const loadHomeSections = async () => {
  loading.value = true
  try {
    const response = await getActiveHomeSections()
    // response 格式: { success: true, data: [...] }
    const data = response.data || []
    homeSections.value = Array.isArray(data) ? data : []
  } catch (error) {
    logger.error('获取推荐区域失败:', error)
  } finally {
    loading.value = false
  }
}

// 处理购物车图标点击
const handleCartClick = async (product: HomeSectionProduct) => {
  // 全新机需要找到对应的商品
  if (product.product_type === 'new' || !product.phone_id) {
    const templateId = product.template_id
    if (!templateId) {
      ElMessage.warning('商品模板信息不完整')
      return
    }
    addingToCart.value = templateId
    try {
      // 使用模板商品API获取详细信息
      const { getTemplatePhones } = await import('@/api/shop-public')
      const phonesResponse = await getTemplatePhones(templateId)
      const phones: PublicTemplatePhone[] = phonesResponse || []

      if (phones && phones.length > 0) {
        // 获取第一个有库存的商品
        const availablePhone = phones.find(p => p.status === 'in_stock')

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
const goProducts = (params: Record<string, string | number | null>) => {
  router.push({
    path: '/m/products',
    query: params
  })
}

// 根据专区类型跳转商品列表
const goProductsFromSection = (section: HomeSection) => {
  const params: Record<string, string | number | null> = {}

  // 根据专区名称或 key 判断筛选条件
  const sectionName = section.section_name || ''
  const sectionKey = section.section_key || ''

  // 靓机专区：筛选成色为"靓机"的二手商品
  if (sectionName.includes('靓机') || sectionKey.includes('liangji') || sectionKey.includes('quality')) {
    params.condition_grade = '靓机'
    params.is_new = 'false'
  }

  router.push({
    path: '/m/products',
    query: params
  })
}

// 跳转商品详情
const goDetail = (product: HomeSectionProduct) => {
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
const _handleBannerClick = (banner: Banner) => {
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
const handleSlideChange = (swiper: SwiperInstance) => {
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
      title: config.value.shop_name || '未配置店铺名称',
      text: '欢迎光临',
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
    const lat = config.value.map_latitude
    const lng = config.value.map_longitude
    const name = encodeURIComponent(config.value.shop_name || '店铺')
    const addr = encodeURIComponent(config.value.shop_address || '')
    const provider = config.value.map_provider || 'tencent'
    const mapUrl = provider === 'amap'
      ? `https://uri.amap.com/marker?position=${lng},${lat}&name=${name}&src=TF2025&coordinate=gaode&callnative=0`
      : provider === 'baidu'
        ? `https://api.map.baidu.com/marker?location=${lat},${lng}&title=${name}&content=${addr}&output=html&src=TF2025`
        : `https://apis.map.qq.com/uri/v1/routeplan?type=drive&to=${name}&tocoord=${lat},${lng}&addr=${addr}&referer=TF2025`
    window.open(mapUrl, '_blank', 'noopener,noreferrer')
  }
}

// 地图相关
type TencentMapApi = NonNullable<Window['TMap']>
let mobileMap: InstanceType<TencentMapApi['Map']> | null = null

// 初始化地图
const initMap = async () => {
  if (!config.value.map_latitude || !config.value.map_longitude) {
    return
  }

  try {
    await nextTick()
    const container = document.getElementById('mobile-map-container')
    if (!container) {
      logger.error('地图容器不存在')
      return
    }

    if ((config.value.map_provider || 'tencent') !== 'tencent') {
      container.innerHTML = '<div class="map-error-container"><div>当前地图服务商尚未接入</div><div class="map-error-tip">请在后台选择腾讯地图，或等待对应地图 SDK 接入</div></div>'
      return
    }

    const mapKey = ensureTencentMapKey(config.value.tencent_map_key)
    if (!mapKey) {
      container.innerHTML = '<div class="map-error-container"><div>地图服务尚未配置</div><div class="map-error-tip">请联系管理员在商城配置中填写腾讯地图 Key</div></div>'
      return
    }
    await loadTencentMapScript(mapKey)

    await nextTick()

    // 如果地图已初始化，先销毁
    if (mobileMap) {
      mobileMap.destroy()
      mobileMap = null
    }

    const lat = parseFloat(config.value.map_latitude)
    const lng = parseFloat(config.value.map_longitude)

    const tMap = window.TMap
    if (!tMap) throw new Error('腾讯地图 SDK 未加载')
    const center = new tMap.LatLng(lat, lng)

    mobileMap = new tMap.Map(container, {
      center: center,
      zoom: 15,
      viewMode: '2D'
    })

    // 添加标记
    new tMap.MultiMarker({
      map: mobileMap,
      geometries: [{
        id: 'shop',
        position: center
      }],
      styles: {
        'shop': new tMap.MarkerStyle({
          width: 24,
          height: 34,
          anchor: { x: 12, y: 34 }
        })
      }
    })

    // 添加信息窗口
    new tMap.InfoWindow({
      map: mobileMap,
      position: center,
      content: `<div style="padding:10px;font-size:var(--tf-type-scale-14);"><strong>${config.value.shop_name || '店铺'}</strong><br>${config.value.shop_address || ''}</div>`
    })

  } catch (error) {
    logger.error('地图初始化失败:', error)
  }
}

// 获取商品显示价格
const getDisplayPrice = (product: HomeSectionProduct) => {
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
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onUnmounted(() => {
  // 清理滚动监听
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler)
    scrollHandler = null
  }
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
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

<style scoped lang="scss" src="./styles/mobile-home/header-and-categories.scss"></style>
<style scoped lang="scss" src="./styles/mobile-home/brands.scss"></style>
<style scoped lang="scss" src="./styles/mobile-home/products-and-map.scss"></style>
