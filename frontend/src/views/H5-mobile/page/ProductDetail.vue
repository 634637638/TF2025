<!--
  ProductDetail - H5商品详情页
  功能：商品图片轮播、信息展示、验机报告、加入购物车/立即购买
-->
<template>
  <div class="product-detail-page">
    <div v-if="loading" class="loading-state">
      <el-skeleton animated />
    </div>

    <div v-else-if="product" class="detail-content">
      <!-- 图片/视频轮播 -->
      <div class="image-swiper-section">
        <swiper
          :modules="[SwiperPagination, SwiperZoom]"
          :pagination="{ type: 'fraction' } as any"
          :zoom="{ maxRatio: 2, minRatio: 1, toggle: true } as any"
          class="image-swiper"
          @slide-change="handleSlideChange"
        >
          <swiper-slide v-for="(image, index) in product.images" :key="index">
            <div class="swiper-zoom-container">
              <video v-if="image.image_type === 'video'" :src="getImageUrl(image.image_url)" controls playsinline autoplay muted class="media-item" />
              <Image v-else :src="image.image_url" :alt="`${product.brand_name} ${product.model_name} 图片${index + 1}`" mode="eager" class="media-item" />
            </div>
            <!-- 视频标记 -->
            <div v-if="image.image_type === 'video'" class="media-video-label">
              <i class="fas fa-video"></i> 验机视频
            </div>
          </swiper-slide>
        </swiper>
        <div v-if="product.images && product.images.length > 0" class="image-count">
          {{ currentImageIndex + 1 }} / {{ product.images.length }}
        </div>
      </div>

      <!-- 价格和标题 -->
      <div class="price-section">
        <div class="price-row">
          <span class="price-label">销售价</span>
          <span v-if="displaySalePrice !== null" class="price">¥{{ displaySalePrice }}</span>
          <span v-else class="price inquire">电询</span>
          <span v-if="!product.is_new" class="tag-used">二手</span>
        </div>
        <h1 class="product-title">
          <template v-for="(item, index) in productTitleItems" :key="`${item}-${index}`">
            <span v-if="index > 0" class="title-separator">|</span>
            <span class="title-item">{{ item }}</span>
          </template>
        </h1>
      </div>

      <!-- 规格信息 -->
      <div class="specs-section">
        <h3 class="section-title">📱 机器参数</h3>
        <div class="specs-grid">
          <div
            v-for="spec in machineSpecItems"
            :key="spec.label"
            class="spec-card"
          >
            <div class="spec-card-title">{{ spec.label }}</div>
            <div class="spec-card-value">{{ spec.value }}</div>
          </div>
        </div>
      </div>

      <!-- 商家描述（备注） -->
      <div v-if="product.remarks" class="merchant-description-section">
        <h3 class="section-title">💬 商家描述</h3>
        <div class="description-content">
          <p>{{ product.remarks }}</p>
        </div>
      </div>

      <!-- 验机报告 -->
      <div v-if="hasInspectionReport" class="inspection-section">
        <h3 class="section-title">📊 验机报告</h3>
        <div class="inspection-content">
          <div class="inspection-grid">
            <div
              v-for="item in inspectionItems"
              :key="item.label"
              class="inspection-item"
            >
              <i :class="item.icon"></i>
              <div class="item-content">
                <span class="item-label">{{ item.label }}</span>
                <span class="item-value" :class="item.className">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 默认验机报告（无验机信息时显示） -->
      <div v-else-if="!product.is_new" class="inspection-section">
        <h3 class="section-title">📊 验机报告</h3>
        <div class="inspection-content">
          <div v-if="displayConditionText" class="inspection-grid">
            <div class="inspection-item">
              <i class="fas fa-star"></i>
              <div class="item-content">
                <span class="item-label">成色</span>
                <span class="item-value condition-grade">{{ displayConditionText }}</span>
              </div>
            </div>
          </div>
          <div class="inspection-empty">
            {{ inspectionEmptyText }}
          </div>
        </div>
      </div>

      <!-- 商品详情 -->
      <div class="detail-section">
        <h3 class="section-title">📝 商品详情</h3>
        <div class="detail-content-inner">
          <p v-if="product.is_new">保修说明：全新机保修1年，人为损坏不保修</p>
          <p v-else>保修说明：二手机保修1月，人为损坏不保修</p>
          <p v-if="product.store_address">门店地址：{{ product.store_address }}</p>
          <p v-if="product.store_phone">联系电话：<a :href="`tel:${product.store_phone}`">{{ product.store_phone }}</a></p>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div v-if="product" class="bottom-bar">
      <!-- 购买按钮组 - 根据direct_buy_enabled控制显示 -->
      <template v-if="config.direct_buy_enabled">
        <el-button v-if="config.cart_enabled" class="cart-btn" @click="handleAddToCart">
          <i class="fas fa-cart-plus"></i>
          加入购物车
        </el-button>
        <el-button type="primary" class="buy-btn" @click="handleBuyNow" :class="{ 'full-width': !config.cart_enabled }">
          立即购买
        </el-button>
      </template>

      <!-- 购买禁用提示 -->
      <div v-else class="purchase-disabled">
        <i class="fas fa-ban"></i>
        <span>商品暂停销售</span>
      </div>
    </div>

    <!-- 内存选择弹窗 -->
    <MobileDialog
      v-model="showMemoryDialog"
      title="选择内存规格"
      width="90%"
      :close-on-click-modal="false"
      dialog-class="memory-dialog"
      :show-default-footer="false"
    >
      <div v-if="loadingMemories" class="loading-memories">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <div v-else-if="memoryOptions.length > 0" class="memory-options">
        <div
          v-for="option in memoryOptions"
          :key="option.phone_id"
          class="memory-option"
          :class="{ selected: selectedPhone?.phone_id === option.phone_id }"
          @click="selectMemory(option)"
        >
          <div class="memory-info">
            <span class="memory-name">{{ option.memory_name }}</span>
            <span class="memory-price">¥{{ option.sale_price }}</span>
          </div>
          <div class="memory-store">
            <span class="store-name">{{ option.store_name }}</span>
            <span v-if="option.quality_grade" class="quality-grade">{{ option.quality_grade }}成</span>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无其他规格" />

      <template #footer>
        <el-button type="default" @click="showMemoryDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmMemorySelection" :disabled="!selectedPhone">
          确认选择
        </el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Pagination, Zoom } from 'swiper/modules'
import { Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import 'swiper/css'
import 'swiper/css/pagination'
import { getProductDetail, getPublicConfig, getProducts } from '@/api/shop-public'
import { useCart } from '@/composables'
import { formatImageUrl } from '@/utils/format'
import Image from '@/components/Image.vue'
import type { ProductDetail } from '@/api/shop-public'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'
const SwiperPagination = Pagination
const SwiperZoom = Zoom

const router = useRouter()
const route = useRoute()

interface Props {
  productId?: number
}

const props = defineProps<Props>()

// 购物车功能
const { addCartItem, refreshCart } = useCart()

// 获取图片 URL - 使用统一的图片URL处理函数
const getImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return ''
  return formatImageUrl(imageUrl)
}

// 数据
const product = ref<ProductDetail | null>(null)
const loading = ref(true)
const loadSequence = ref(0)
const currentImageIndex = ref(0)
const shopConfig = ref<any>({})
const config = ref<any>({ cart_enabled: true, direct_buy_enabled: true })

// 内存选择相关
const showMemoryDialog = ref(false)
const loadingMemories = ref(false)
const memoryOptions = ref<any[]>([])
const selectedPhone = ref<any>(null)
const pendingAction = ref<'cart' | 'buy' | null>(null)

const normalizeText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const getConditionText = (target?: Partial<ProductDetail> | null): string => {
  if (!target || target.is_new) {
    return ''
  }

  const conditionGrade = normalizeText((target as ProductDetail & { condition_grade?: string }).condition_grade)
  if (conditionGrade) {
    return conditionGrade
  }

  if (target.inspection?.condition_grade) {
    const inspectionCondition = normalizeText(target.inspection.condition_grade)
    if (inspectionCondition) {
      return inspectionCondition
    }
  }

  if (target.quality_grade !== null && target.quality_grade !== undefined && `${target.quality_grade}`.trim()) {
    return `${target.quality_grade}成新`
  }

  return ''
}

const getDisplayValue = (value: unknown, fallback = '-'): string => {
  const normalizedValue = normalizeText(value)
  return normalizedValue || fallback
}

const getWarrantyText = (inspection?: ProductDetail['inspection']): string => {
  if (!inspection) {
    return ''
  }

  if (inspection.is_warranty_expired === true) {
    return '已过保'
  }

  return inspection.warranty_date ? formatDate(inspection.warranty_date) : ''
}

const displaySalePrice = computed(() => {
  const currentProduct = product.value
  if (!currentProduct) {
    return null
  }

  const candidatePrices = [currentProduct.actual_sale_price, currentProduct.sale_price]
  for (const price of candidatePrices) {
    const numericPrice = typeof price === 'number' ? price : Number(price)
    if (!Number.isNaN(numericPrice) && numericPrice > 0) {
      return numericPrice
    }
  }

  return null
})

const displayConditionText = computed(() => getConditionText(product.value))

const productTitleItems = computed(() => {
  const currentProduct = product.value
  if (!currentProduct) {
    return []
  }

  return [
    normalizeText(currentProduct.brand_name),
    normalizeText(currentProduct.model_name),
    normalizeText(currentProduct.color_name),
    normalizeText(currentProduct.memory_name),
    displayConditionText.value
  ].filter(Boolean)
})

const machineSpecItems = computed(() => {
  const currentProduct = product.value
  if (!currentProduct) {
    return []
  }

  const items = [
    { label: '品牌', value: getDisplayValue(currentProduct.brand_name) },
    { label: '型号', value: getDisplayValue(currentProduct.model_name) },
    { label: '颜色', value: getDisplayValue(currentProduct.color_name) },
    { label: '内存', value: getDisplayValue(currentProduct.memory_name) },
    {
      label: '上架时间',
      value: currentProduct.created_at ? formatDate(currentProduct.created_at) : '-'
    }
  ]

  if (!currentProduct.is_new) {
    items.splice(4, 0, {
      label: '成色',
      value: displayConditionText.value || '-'
    })
  }

  if (currentProduct.serial_number) {
    items.push({
      label: '序列号',
      value: maskSerialNumber(currentProduct.serial_number)
    })
  }

  return items
})

const inspectionItems = computed(() => {
  const currentProduct = product.value
  if (!currentProduct || currentProduct.is_new) {
    return []
  }

  const items: Array<{ icon: string; label: string; value: string; className?: string }> = []

  if (displayConditionText.value) {
    items.push({
      icon: 'fas fa-star',
      label: '成色',
      value: displayConditionText.value,
      className: 'condition-grade'
    })
  }

  if (currentProduct.inspection?.battery_status) {
    items.push({
      icon: 'fas fa-battery-three-quarters',
      label: '电池',
      value: formatBattery(currentProduct.inspection.battery_status)
    })
  }

  if (currentProduct.inspection?.screen_condition_text) {
    items.push({
      icon: 'fas fa-mobile-alt',
      label: '屏幕',
      value: currentProduct.inspection.screen_condition_text
    })
  }

  if (currentProduct.inspection?.model_version) {
    items.push({
      icon: 'fas fa-tag',
      label: '版本',
      value: currentProduct.inspection.model_version
    })
  }

  const warrantyText = getWarrantyText(currentProduct.inspection)
  if (warrantyText) {
    items.push({
      icon: 'fas fa-shield-alt',
      label: '保修',
      value: warrantyText
    })
  }

  if (currentProduct.inspection?.system_version) {
    items.push({
      icon: 'fas fa-cog',
      label: '系统',
      value: currentProduct.inspection.system_version
    })
  }

  return items
})

const hasInspectionReport = computed(() => inspectionItems.value.length > 0)
const inspectionEmptyText = computed(() => {
  return displayConditionText.value
    ? '暂未上传完整验机报告，其余项目待补充。'
    : '暂未上传验机报告。'
})

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 格式化电池健康度
const formatBattery = (battery: any) => {
  if (!battery) return ''
  // 如果是纯数字，添加%符号
  const numValue = typeof battery === 'number' ? battery : parseInt(battery)
  if (!isNaN(numValue) && numValue > 0) {
    return `${numValue}%`
  }
  // 如果是其他文本（如"电池更换新"），直接返回
  return battery.toString()
}

// 隐藏序列号中间部分
const maskSerialNumber = (serial: string) => {
  if (!serial || serial.length <= 8) return serial
  const start = serial.substring(0, 4)
  const end = serial.substring(serial.length - 4)
  return `${start}****${end}`
}

// 切换slide时暂停所有视频
const handleSlideChange = (swiper: any) => {
  currentImageIndex.value = swiper.activeIndex

  // 暂停所有非当前slide的视频
  // @ts-expect-error - querySelector with class selector is valid
  const swiperContainer = document.querySelector('.image-swiper') as Element | null
  if (swiperContainer) {
    const allVideos = Array.from(swiperContainer.querySelectorAll('video')) as HTMLVideoElement[]
    allVideos.forEach((video, index) => {
      if (index !== swiper.activeIndex) {
        video.pause()
      }
    })

    // 如果当前slide是视频，自动播放
    const currentSlide = product.value?.images[swiper.activeIndex]
    if (currentSlide?.image_type === 'video') {
      const currentVideo = allVideos[swiper.activeIndex] as HTMLVideoElement
      if (currentVideo) {
        currentVideo.play().catch(() => {
          // 自动播放可能需要用户交互
        })
      }
    }
  }
}

const resolvedProductId = computed(() => {
  const rawId = props.productId ?? route.params.id

  if (typeof rawId === 'number') {
    return Number.isFinite(rawId) ? rawId : null
  }

  if (typeof rawId === 'string') {
    const parsedId = Number.parseInt(rawId, 10)
    return Number.isNaN(parsedId) ? null : parsedId
  }

  return null
})

const resetDetailState = () => {
  product.value = null
  currentImageIndex.value = 0
  showMemoryDialog.value = false
  loadingMemories.value = false
  memoryOptions.value = []
  selectedPhone.value = null
  pendingAction.value = null
}

// 获取商品详情
const loadProduct = async (id = resolvedProductId.value) => {
  const sequence = ++loadSequence.value

  if (!id) {
    resetDetailState()
    if (sequence === loadSequence.value) {
      loading.value = false
      ElMessage.error('商品参数错误')
    }
    return
  }

  loading.value = true
  try {
    const response: any = await getProductDetail(id)
    if (sequence !== loadSequence.value) {
      return
    }

    const data: any = response?.data || response || null

    // 确保 images 字段始终是数组
    if (data) {
      if (!Array.isArray(data.images)) {
        data.images = []
      }
      // 确保每个 image 对象有必要的字段
      data.images = data.images.map((img: any, index: number) => {
        if (typeof img === 'string') {
          // 如果是字符串（模板商品旧格式），转换为对象格式
          return {
            id: index,
            image_url: img,
            image_type: 'other',
            is_primary: index === 0
          }
        }
        return img
      })

      if (data.images.length === 0 && data.main_image) {
        data.images = [{
          id: 0,
          image_url: data.main_image,
          image_type: 'other',
          is_primary: true
        }]
      }
    }

    product.value = data
  } catch (error) {
    if (sequence !== loadSequence.value) {
      return
    }
    logger.error('获取商品详情失败:', error)
    ElMessage.error('获取商品详情失败')
  } finally {
    if (sequence === loadSequence.value) {
      loading.value = false
    }
  }
}

// 获取商城配置
const loadConfig = async () => {
  try {
    const response: any = await getPublicConfig()
    shopConfig.value = response?.data || response || {}
    // 设置默认值，防止后端没有返回配置项
    config.value = {
      cart_enabled: shopConfig.value.cart_enabled !== false,
      direct_buy_enabled: shopConfig.value.direct_buy_enabled !== false
    }
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 获取相同品牌+型号+颜色的其他内存选项
const loadMemoryOptions = async () => {
  if (!product.value) return

  loadingMemories.value = true
  try {
    const result = await getProducts({
      brand_id: product.value.brand_id,
      model_id: product.value.model_id,
      // color_id: product.value.color_id,  // 移除这个字段，因为类型定义中没有
      is_new: product.value.is_new === 1,
      page: 1,
      limit: 100
    })

    // 过滤出当前商品并添加选中标记
    // result 是一个包含 data 属性的对象，data 属性是数组
    const products = Array.isArray(result) ? result : ((result as any).data || [])
    memoryOptions.value = products.map((p: any) => ({
      ...p,
      is_current: p.id === product.value!.id
    }))

    // 默认选中当前商品
    selectedPhone.value = memoryOptions.value.find((p: any) => p.is_current) || memoryOptions.value[0]
  } catch (error) {
    logger.error('获取内存选项失败:', error)
  } finally {
    loadingMemories.value = false
  }
}

// 选择内存规格
const selectMemory = (option: any) => {
  selectedPhone.value = option
}

// 确认内存选择
const confirmMemorySelection = () => {
  if (!selectedPhone.value) return

  showMemoryDialog.value = false

  if (pendingAction.value === 'cart') {
    executeAddToCart(selectedPhone.value.id)
  } else if (pendingAction.value === 'buy') {
    executeBuyNow(selectedPhone.value.id)
  }

  pendingAction.value = null
}

// 处理加入购物车点击
const handleAddToCart = async () => {
  if (!product.value) return

  // 二手机直接添加，不显示选择弹窗
  if (!product.value.is_new) {
    executeAddToCart(product.value.id)
    return
  }

  // 全新机检查是否有其他内存选项
  await loadMemoryOptions()

  if (memoryOptions.value.length > 1) {
    // 有多个选项，显示选择弹窗
    pendingAction.value = 'cart'
    showMemoryDialog.value = true
  } else {
    // 只有一个选项，直接添加
    executeAddToCart(product.value.id)
  }
}

// 执行加入购物车
const executeAddToCart = async (phoneId: number) => {
  try {
    const result = await addCartItem(phoneId)
    if (result.success) {
      ElMessage.success('已加入购物车')
      await refreshCart()
    } else {
      ElMessage.error(result.message || '加入购物车失败')
    }
  } catch (error: any) {
    logger.error('添加到购物车失败:', error)
    ElMessage.error(error.message || '加入购物车失败')
  }
}

// 处理立即购买点击
const handleBuyNow = async () => {
  if (!product.value) return

  // 二手机直接购买，不显示选择弹窗
  if (!product.value.is_new) {
    executeBuyNow(product.value.id)
    return
  }

  // 全新机检查是否有其他内存选项
  await loadMemoryOptions()

  if (memoryOptions.value.length > 1) {
    // 有多个选项，显示选择弹窗
    pendingAction.value = 'buy'
    showMemoryDialog.value = true
  } else {
    // 只有一个选项，直接购买
    executeBuyNow(product.value.id)
  }
}

// 执行立即购买
const executeBuyNow = (phoneId: number) => {
  // 将商品信息存储到 sessionStorage，避免 URL 参数暴露
  // 注意：需要存储为数组格式，与购物车保持一致
  const orderItem = [{ phoneId, quantity: 1 }]
  storage.set(H5_STORAGE_KEYS.CHECKOUT_ITEMS, orderItem, 'session')

  // 使用简洁的 URL 跳转
  router.push('/m/checkout')
}

// 添加到购物车（保留原方法供兼容）
const addToCart = async () => {
  handleAddToCart()
}

// 立即购买（保留原方法供兼容）
const buyNow = () => {
  handleBuyNow()
}

watch(resolvedProductId, (newId, oldId) => {
  if (newId === oldId) {
    return
  }

  resetDetailState()
  void loadProduct(newId)
}, { immediate: true })

onMounted(() => {
  void loadConfig()
  void refreshCart()
})
</script>

<style scoped lang="scss">
.product-detail-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 60px;
}

// 加载状态
.loading-state {
  padding: 20px;
}

// 图片/视频轮播
.image-swiper-section {
  position: relative;
  background: #000;

  .image-swiper {
    height: 375px;

    .media-item {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .media-video-label {
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(255, 107, 0, 0.9);
      color: #fff;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 2px 8px rgba(255, 107, 0, 0.3);
      z-index: 10;
      pointer-events: none;

      i {
        font-size: 12px;
      }
    }
  }

  .image-count {
    position: absolute;
    bottom: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  :deep(.swiper-pagination-fraction) {
    color: #fff;
    font-size: 14px;
    bottom: 12px;
    left: 12px;
    right: auto;
    width: auto;
  }
}

// 价格区域
.price-section {
  background: #fff;
  padding: 16px;
  margin-bottom: 12px;

  .price-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .price-label {
      font-size: 14px;
      color: #999;
      font-weight: 500;
    }

    .price {
      font-size: 24px;
      font-weight: 500;
      color: #ff1744;

      &.inquire {
        font-size: 18px;
        color: #ff9800;
      }
    }

    .tag-used {
      background: #ff6b00;
      color: #fff;
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 4px;
    }
  }

  .product-title {
    font-size: clamp(13px, 4.5vw, 18px);
    font-weight: 600;
    color: #333;
    margin: 0;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    white-space: nowrap;
    line-height: 1.3;
    background: linear-gradient(135deg, #f5f7fa 0%, #e8eaf6 100%);
    padding: 12px 16px;
    border-radius: 8px;

    .title-item {
      display: inline-block;
      flex-shrink: 1;
    }

    .title-separator {
      margin: 0 4px;
      color: #999;
      opacity: 0.8;
      flex-shrink: 0;
    }
  }

  .product-subtitle {
    font-size: 14px;
    color: #999;
    margin: 0;
  }
}

// 规格信息
.specs-section {
  background: #fff;
  padding: 16px;
  margin-bottom: 8px;

  .specs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .spec-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .spec-card-title {
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    }

    .spec-card-value {
      font-size: 14px;
      color: #333;
    }
  }
}

// 商家描述
.merchant-description-section {
  background: #fff;
  padding: 16px;
  margin-bottom: 8px;

  .description-content {
    font-size: 14px;
    color: #333;
    line-height: 1.8;
    background: #fff7e6;
    padding: 12px;
    border-radius: 8px;
    border-left: 4px solid #ff6b00;

    p {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }
}

// 验机报告
.inspection-section {
  background: #fff;
  padding: 16px;
  margin-bottom: 8px;

  .inspection-content {
    .inspection-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
    }

    .inspection-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      font-size: 13px;
      color: #333;

      i {
        color: #00c853;
        font-size: 16px;
        flex-shrink: 0;
      }

      .item-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;

        .item-label {
          color: #999;
          font-size: 12px;
        }

        .item-value {
          color: #333;
          font-size: 13px;
        }
      }
    }

    .inspection-empty {
      margin-top: 8px;
      padding: 12px;
      border-radius: 8px;
      background: #fff7e6;
      color: #8c5a00;
      font-size: 13px;
      line-height: 1.6;
    }

    :deep(.condition-grade) {
      color: #ff6b00;
      font-weight: 600;
    }
  }
}

// 商品详情
.detail-section {
  background: #fff;
  padding: 16px;
  margin-bottom: 8px;

  .detail-content-inner {
    font-size: 14px;
    color: #666;
    line-height: 1.8;

    p {
      margin: 8px 0;

      a {
        color: #ff6b00;
        text-decoration: none;
      }
    }
  }
}

// 通用标题
.section-title {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin: 0 0 12px;
}

// 底部操作栏
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 200;

  .cart-btn,
  .buy-btn {
    flex: 1;
    height: 44px;
    border-radius: 22px;
    font-size: 15px;
  }

  .cart-btn {
    background: #fff8f0;
    color: #ff6b00;
    border: 1px solid #ff6b00;

    i {
      margin-right: 4px;
    }
  }

  .buy-btn {
    background: linear-gradient(135deg, #ff6b00 0%, #ff8f00 100%);
    border: none;

    &.full-width {
      flex: 2;
    }
  }

  .purchase-disabled {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    background: #f5f5f5;
    color: #999;
    font-size: 14px;
    border-radius: 22px;
    padding: 0 20px;

    i {
      font-size: 16px;
    }
  }
}

// 内存选择弹窗样式
.memory-dialog {
  .loading-memories {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    gap: 12px;

    .el-icon {
      font-size: 32px;
      color: #ff6b00;
    }

    span {
      color: #666;
      font-size: 14px;
    }
  }

  .memory-options {
    max-height: 400px;
    overflow-y: auto;

    .memory-option {
      padding: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.3s;

      &:last-child {
        margin-bottom: 0;
      }

      &:hover {
        border-color: #ff6b00;
        background: rgba(255, 107, 0, 0.05);
      }

      &.selected {
        border-color: #ff6b00;
        background: rgba(255, 107, 0, 0.1);
      }

      .memory-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .memory-name {
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .memory-price {
          font-size: 18px;
          font-weight: 600;
          color: #ff1744;
        }
      }

      .memory-store {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;

        .store-name {
          color: #666;
        }

        .quality-grade {
          color: #00c853;
          background: rgba(0, 200, 83, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }
      }
    }
  }
}
</style>
