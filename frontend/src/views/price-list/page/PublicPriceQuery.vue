<template>
  <div class="public-price-query">
    <PublicPriceHeader title="最新同城报价">
      <template #search>
        <PublicSearchBox
          v-model="searchKeyword"
          :placeholder="passwordVerified ? `欢迎${verifiedUserName}使用${siteSettingsStore.settings.siteName || '报价系统'}` : '搜索品牌或型号'"
          :verified="passwordVerified"
          :loading="loading || searchSubmitting"
          :disabled="loading || searchSubmitting"
          @search="handleSearchInput"
          @clear="handleClear"
        />
      </template>

      <template #actions>
        <button
          type="button"
          class="price-header-action price-header-action--notice"
          @click="showNoticeDialog = true"
        >
          <el-icon class="btn-icon">
            <WarningFilled />
          </el-icon>
          <span class="btn-text">调货须知</span>
        </button>
        <button
          v-if="passwordVerified"
          type="button"
          class="price-header-action price-header-action--inventory"
          :class="{ active: showInStockOnly }"
          :disabled="isGenerating || allResults.length === 0"
          :aria-pressed="showInStockOnly"
          @click="toggleInStockFilter"
        >
          <el-icon class="btn-icon">
            <Grid v-if="showInStockOnly" />
            <Box v-else />
          </el-icon>
          <span class="btn-text">{{ showInStockOnly ? '全部' : '在库' }}</span>
        </button>
        <button
          type="button"
          class="price-header-action price-header-action--download"
          :disabled="isGenerating || searchResults.length === 0"
          @click="downloadAsImage"
        >
          <span
            v-if="!isGenerating"
            class="btn-content"
          >
            <el-icon class="btn-icon"><Download /></el-icon>
            <span class="btn-text">保存图片</span>
          </span>
          <span
            v-else
            class="btn-content loading"
          >
            <InlineLoading
              text="生成中..."
              size="small"
            />
          </span>
        </button>
      </template>
    </PublicPriceHeader>

    <!-- 调货须知弹窗 -->
    <MobileDialog
      v-model="showNoticeDialog"
      title="调货须知"
      width="650px"
      :close-on-click-modal="true"
      dialog-class="notice-dialog"
      :show-default-footer="false"
    >
      <div class="notice-content">
        <!-- 重要警告横幅 -->
        <div class="warning-banner">
          <div class="banner-icon">
            ⚠️
          </div>
          <div class="banner-text">
            <strong>重要提示：</strong>调货前请务必确认并遵守以下规则，避免产生纠纷！
          </div>
        </div>

        <!-- 规则卡片网格 -->
        <div class="rules-grid">
          <!-- 开箱检查 -->
          <div class="rule-card check">
            <div class="card-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                />
              </svg>
            </div>
            <div class="card-content">
              <h4 class="card-title">
                开箱检查
              </h4>
              <div class="card-badge">
                必须
              </div>
            </div>
            <ul class="card-list">
              <li>全程录像或监控视频</li>
              <li>检查外观完整性</li>
              <li class="alert">
                无视频证据恕不受理
              </li>
            </ul>
          </div>

          <!-- 激活限制 -->
          <div class="rule-card activate">
            <div class="card-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div class="card-content">
              <h4 class="card-title">
                激活限制
              </h4>
              <div class="card-badge danger">
                严禁
              </div>
            </div>
            <ul class="card-list">
              <li>仅限分宜本地激活</li>
              <li>禁止跨市区激活</li>
              <li class="highlight">
                水印相机拍照：串码同框
              </li>
              <li class="highlight">
                使用 WI-FI 网络
              </li>
              <li class="highlight">
                激活后拨打电话测试
              </li>
            </ul>
          </div>

          <!-- 结算要求 -->
          <div class="rule-card payment">
            <div class="card-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect
                  x="1"
                  y="4"
                  width="22"
                  height="16"
                  rx="2"
                  ry="2"
                />
                <line
                  x1="1"
                  y1="10"
                  x2="23"
                  y2="10"
                />
              </svg>
            </div>
            <div class="card-content">
              <h4 class="card-title">
                结算要求
              </h4>
              <div class="card-badge warning">
                当天
              </div>
            </div>
            <ul class="card-list">
              <li>货款必须当天结清</li>
              <li class="alert">
                逾期将终止合作
              </li>
            </ul>
          </div>

          <!-- 保修说明 -->
          <div class="rule-card warranty">
            <div class="card-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div class="card-content">
              <h4 class="card-title">
                保修说明
              </h4>
              <div class="card-badge success">
                1年
              </div>
            </div>
            <ul class="card-list">
              <li>激活后质量问题保修</li>
              <li>以官方售后结论为准</li>
              <li class="note">
                人为损坏不予保修
              </li>
              <li class="note">
                不含发票无保修服务
              </li>
            </ul>
          </div>
        </div>

        <!-- 底部提示 -->
        <div class="notice-footer">
          <p>🤝 同行售后自行开票处理！</p>
          <p>如有疑问，请及时联系我们</p>
        </div>
      </div>
    </MobileDialog>

    <!-- 结果展示区 -->
    <div class="results-section">
      <div class="container">
        <!-- 加载状态 -->
        <div
          v-if="loading"
          class="loading-container"
        >
          <InlineLoading text="正在查询价格..." />
        </div>

        <!-- 空状态 -->
        <DataEmptyState
          v-else-if="!hasSearched"
          state="initial"
          description="请输入关键词搜索价格"
        />

        <!-- 无结果 -->
        <DataEmptyState
          v-else-if="searchResults.length === 0"
          state="filtered"
          description="未找到相关价格信息"
        />

        <!-- 结果列表 -->
        <div
          v-else
          id="price-results"
          class="results-list"
        >
          <div class="results-header">
            <h2>最新报价</h2>
            <el-tag
              class="hot-badge"
              type="danger"
              effect="dark"
            >
              HOT
            </el-tag>
            <h2>{{ primaryPriceContact?.phone || '' }}</h2>
            <span class="count">共 {{ searchResults.length }} 条</span>
          </div>

          <!-- 水印（仅生成图片时显示） -->
          <div
            v-if="watermarkEnabled"
            v-show="false"
            class="image-watermark"
          >
            <div class="watermark-item watermark-1">
              <span
                class="watermark-text"
                :style="{ color: watermarkColor }"
              >{{ watermarkText }}</span>
            </div>
            <div class="watermark-item watermark-2">
              <span
                class="watermark-text"
                :style="{ color: watermarkColor }"
              >{{ watermarkText }}</span>
            </div>
            <div class="watermark-item watermark-3">
              <span
                class="watermark-text"
                :style="{ color: watermarkColor }"
              >{{ watermarkText }}</span>
            </div>
          </div>

          <!-- 表格视图 -->
          <div class="table-wrapper">
            <el-table
              class="data-table"
              :data="searchResults"
              stripe
              border
              style="cursor: pointer;"
              @row-dblclick="handleRowDoubleClick"
              @row-click="handleRowClick"
            >
              <el-table-column
                prop="brand_name"
                label="品牌"
                min-width="60"
              />
              <el-table-column
                prop="model_number"
                label="型号"
                min-width="100"
              />
              <el-table-column
                prop="color_name"
                label="颜色"
                min-width="50"
              />
              <el-table-column
                prop="memory"
                label="内存"
                min-width="60"
              >
                <template #default="{ row }">
                  <span>{{ row.memory }}</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="wholesale_price"
                label="调货价格"
                min-width="70"
                align="right"
              >
                <template #default="{ row }">
                  <span
                    v-if="hasWholesalePrice(row)"
                    class="price wholesale"
                    :class="{ 'has-stock': passwordVerified && row.stock_quantity > 0 }"
                  >
                    {{ formatWholesalePrice(row) }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 联系方式 -->
          <div
            v-if="priceContacts.length"
            class="contact-card"
          >
            <div class="contact-header">
              <span class="contact-icon">📞</span>
              <span class="contact-title">联系电话</span>
            </div>
            <div class="contact-grid">
              <a
                v-for="contact in priceContacts"
                :key="`${contact.name}-${contact.phone}`"
                :href="`tel:${phoneHref(contact.phone)}`"
                class="contact-link"
              >
                <span class="contact-name">{{ contact.name }}</span>
                <span class="contact-number">{{ contact.phone }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 页脚 -->
    <div class="footer">
      <div class="container">
        <p>{{ siteSettingsStore.settings.siteName || '报价系统' }}</p>
        <p class="copyright">
          &copy; {{ TimeUtil.now().year() }} 版权所有
        </p>
      </div>
    </div>

    <!-- 在库查询结果弹窗 -->
    <InventoryResultDialog
      v-model="showInventoryResult"
      :product="selectedProduct"
      :query-token="inventoryQueryToken"
      @authorization-expired="handleInventoryAuthorizationExpired"
    />

    <!-- iOS 图片保存弹窗 -->
    <MobileDialog
      v-model="showIOSImageModal"
      title="长按图片保存到相册"
      width="90%"
      :close-on-click-modal="false"
      dialog-class="ios-image-dialog"
      :show-default-footer="false"
    >
      <div class="ios-save-container">
        <div class="image-wrapper">
          <img
            class="ios-save-image"
            :src="iosImageUrl"
            :alt="`${siteSettingsStore.settings.siteName || '报价'}报价`"
            draggable="false"
          >
        </div>
      </div>
      <template #footer>
        <el-button @click="toggleIOSImageMode">
          长按保存
        </el-button>
        <el-button
          type="primary"
          @click="shareIOSImage"
        >
          我要分享
        </el-button>
        <el-button
          type="primary"
          @click="closeIOSImageModal"
        >
          关闭
        </el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { WarningFilled, Box, Grid, Download } from '@element-plus/icons-vue'
import { getAllPrices, searchPrices } from '@/api/price-list'
import { PublicPriceHeader } from '@/components/base'
import PublicSearchBox from '@/components/search/PublicSearchBox.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import { unifiedApi } from '@/utils/unified-api'
import { ElMessage } from 'element-plus'
import { TimeUtil } from '@/utils/time'
import { useLoadingState } from '@/composables'
import { useMobile } from '@/composables/mobile'
import { logger } from '@/utils/logger'
import { loadHtml2Canvas } from '@/utils/html2canvas'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { parsePublicPriceContacts, getDefaultPublicPriceContact, formatPublicPriceWatermark } from '@/utils/publicPriceSettings'

const InventoryResultDialog = defineAsyncComponent(() => import('@/components/InventoryResultDialog.vue'))
const IMAGE_CAPTURE_WIDTH = 430
// 状态
const { loading } = useLoadingState()
const { isMobile, isTablet, isTouchDevice } = useMobile()
const siteSettingsStore = useSiteSettingsStore()
const priceContacts = computed(() => {
  const configured = parsePublicPriceContacts(siteSettingsStore.settings.publicPriceContacts)
  return configured
})
const primaryPriceContact = computed(() => getDefaultPublicPriceContact(
  priceContacts.value,
  siteSettingsStore.settings.publicPriceDefaultContact
))
const watermarkEnabled = computed(() => siteSettingsStore.settings.publicPriceWatermarkEnabled !== '0')
const watermarkText = computed(() => formatPublicPriceWatermark(siteSettingsStore.settings.publicPriceWatermark, primaryPriceContact.value, siteSettingsStore.settings.publicPriceWatermarkTimeEnabled !== '0'))
const watermarkColor = computed(() => siteSettingsStore.settings.publicPriceWatermarkColor || '#6b7280')
const phoneHref = (phone: string) => String(phone || '').replace(/[^\d+]/g, '')
const searchKeyword = ref('')
const searchSubmitting = ref(false)
const allResults = ref<any[]>([])
const searchResults = ref<any[]>([])
const hasSearched = ref(false)
const showNoticeDialog = ref(false)
const isGenerating = ref(false)
const showInStockOnly = ref(false)

// 在库查询相关状态
const passwordVerified = ref(false)
const verifiedUserName = ref('') // 验证成功的用户名
const inventoryQueryToken = ref('')
const showInventoryResult = ref(false)
let inventoryTokenExpiryTimer: ReturnType<typeof setTimeout> | null = null
let activePriceRequestId = 0
const selectedProduct = ref<{
  brand_id?: number
  model_id?: number
  color_id?: number
  memory_id?: number
  brand: string
  model: string
  color: string
  memory: string
}>({
  brand_id: undefined,
  model_id: undefined,
  color_id: undefined,
  memory_id: undefined,
  brand: '',
  model: '',
  color: '',
  memory: ''
})

const applyInventoryFilter = () => {
  const source = Array.isArray(allResults.value) ? allResults.value : []

  if (passwordVerified.value && showInStockOnly.value) {
    searchResults.value = source.filter((item: any) => Number(item?.stock_quantity || 0) > 0)
    return
  }

  searchResults.value = [...source]
}

const normalizePriceRows = (rows: unknown): any[] => {
  if (!Array.isArray(rows)) return []

  const uniqueRows = new Map<string, any>()
  for (const row of rows) {
    const key = [row?.brand_id, row?.model_id, row?.color_id, row?.memory_id].join(':')
    if (uniqueRows.has(key)) {
      logger.warn('公开报价存在重复规格，已忽略重复行', { key })
      continue
    }
    uniqueRows.set(key, row)
  }
  return [...uniqueRows.values()]
}

const toggleInStockFilter = () => {
  if (!passwordVerified.value) return

  showInStockOnly.value = !showInStockOnly.value
  applyInventoryFilter()
}

// 触屏设备双击检测。iPad 在部分 Safari 版本不会可靠触发 row-dblclick，
// 因此统一保留 row-click 兜底；桌面端仍直接使用 row-dblclick。
let lastTapTime = 0
let lastTapRowKey = ''
let lastOpenedRowKey = ''
let lastOpenedAt = 0

const isTouchInteraction = computed(() => isMobile.value || isTablet.value || isTouchDevice.value)

const getProductRowKey = (row: any) => (
  [row?.brand_id, row?.model_id, row?.color_id, row?.memory_id,
    row?.brand_name, row?.model_number, row?.color_name, row?.memory]
    .map(value => String(value ?? '').trim())
    .join(':')
)

// 加载所有数据
const loadAllData = async () => {
  const requestId = ++activePriceRequestId
  loading.value = true
  try {
    const res = await getAllPrices()
    if (requestId !== activePriceRequestId) return
    if (res.success) {
      allResults.value = normalizePriceRows(res.data)
      applyInventoryFilter()
      hasSearched.value = true
    } else {
      allResults.value = []
      applyInventoryFilter()
      hasSearched.value = true
      ElMessage.error(res.message || '报价数据加载失败')
    }
  } catch (error) {
    if (requestId !== activePriceRequestId) return
    logger.error('加载数据失败', error)
    allResults.value = []
    applyInventoryFilter()
    hasSearched.value = true
    ElMessage.error('报价数据加载失败，请稍后重试')
  } finally {
    if (requestId === activePriceRequestId) loading.value = false
  }
}

// 处理搜索输入（自动检测密码）
const handleSearchInput = async () => {
  if (searchSubmitting.value || loading.value) return
  searchSubmitting.value = true

  try {
    const keyword = searchKeyword.value.trim()

    if (!keyword || passwordVerified.value) {
      await handleSearch()
      return
    }

    // 普通关键词优先搜索，避免每次查询都消耗密码验证限流额度。
    const searchResult = keyword.length >= 2 ? await handleSearch(false) : false
    if (searchResult !== false) return

    const verified = await verifyInventoryPassword(keyword)
    if (verified) {
      searchKeyword.value = ''
      await loadAllData()
      return
    }

    if (verified === null) return

    ElMessage.warning({
      message: keyword.length < 2 ? '搜索关键词至少需要 2 个字符' : '未检索到相关数据',
      duration: 2000,
      offset: 60
    })
  } finally {
    searchSubmitting.value = false
  }
}

// 搜索
const handleSearch = async (notifyNoResults = true): Promise<boolean | null> => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    // 如果搜索为空，加载所有数据
    await loadAllData()
    return true
  }

  if (keyword.length < 2) {
    if (notifyNoResults) ElMessage.warning('搜索关键词至少需要 2 个字符')
    return false
  }

  const requestId = ++activePriceRequestId
  loading.value = true
  try {
    const res = await searchPrices(keyword)
    if (requestId !== activePriceRequestId) return null
    if (res.success) {
      // 后端已经按 show_price 过滤，前端直接使用返回的数据
      allResults.value = normalizePriceRows(res.data)
      applyInventoryFilter()
      hasSearched.value = true

      // 如果没有搜索结果，显示友好提示（和正常搜索行为一致）
      if (searchResults.value.length === 0) {
        if (notifyNoResults) {
          ElMessage.warning({
            message: '未检索到相关数据',
            duration: 2000,
            offset: 60
          })
        }
        return false
      }
      return true
    } else {
      allResults.value = []
      applyInventoryFilter()
      hasSearched.value = true
      ElMessage.error(res.message || '搜索失败')
      return null
    }
  } catch (error) {
    if (requestId !== activePriceRequestId) return null
    logger.error('搜索失败', error)
    allResults.value = []
    applyInventoryFilter()
    hasSearched.value = true
    ElMessage.error('搜索失败，请稍后重试')
    return null
  } finally {
    if (requestId === activePriceRequestId) loading.value = false
  }
}

const resetInventoryAccess = (showExpiredMessage = false) => {
  if (inventoryTokenExpiryTimer) {
    clearTimeout(inventoryTokenExpiryTimer)
    inventoryTokenExpiryTimer = null
  }
  passwordVerified.value = false
  verifiedUserName.value = ''
  inventoryQueryToken.value = ''
  showInStockOnly.value = false
  showInventoryResult.value = false
  applyInventoryFilter()
  if (showExpiredMessage) ElMessage.info('在库查询验证已失效，请重新验证')
}

// 验证在库查询密码（仅使用后端验证）
const verifyInventoryPassword = async (password: string): Promise<boolean | null> => {
  // 使用后端验证
  try {
    const response = await unifiedApi.post('/screen-lock/verify-inventory-query', {
      password: password
    }, {
      showError: false  // 禁用错误提示，保持静默
    })

    if (response.success) {
      const queryToken = String(response.data?.queryToken || '')
      if (!queryToken) return false
      passwordVerified.value = true
      inventoryQueryToken.value = queryToken
      // 从后端返回的用户名
      verifiedUserName.value = response.data?.userName || '用户'
      if (inventoryTokenExpiryTimer) clearTimeout(inventoryTokenExpiryTimer)
      const expiresInSeconds = Math.max(1, Number(response.data?.expiresIn) || 600)
      inventoryTokenExpiryTimer = setTimeout(() => resetInventoryAccess(true), expiresInSeconds * 1000)
      applyInventoryFilter()
      return true
    } else {
      // 静默失败，作为搜索关键词
      return false
    }
  } catch (error: any) {
    const status = Number(error?.status || error?.response?.status || error?.response?.data?.status)
    if (status === 429) {
      ElMessage.warning(error?.response?.data?.message || '密码验证尝试过多，请稍后再试')
      return null
    }

    // 普通密码错误保持静默，让密码输入和无结果搜索的反馈一致。
    return false
  }
}

// 清空
const handleClear = () => {
  searchKeyword.value = ''
  void loadAllData()
}

const hasWholesalePrice = (row: any) => {
  const price = row?.display_wholesale_price ?? row?.wholesale_price
  return price !== null && price !== undefined && price !== '' && Number(price) > 0
}

const formatWholesalePrice = (row: any) => {
  const price = Number(row?.display_wholesale_price ?? row?.wholesale_price ?? 0)
  return Math.round(price)
}

// 固定安全区域并轻微倾斜，避免随机位置靠近边缘导致水印被裁剪。
interface WatermarkPosition {
  top: number
  left: number
  right: number
  rotation: number
}

const generateRandomWatermarkPositions = (): WatermarkPosition[] => {
  return Array.from({ length: 3 }, () => ({
    // 12%-72% 的安全区间保留随机性，同时避开上下边缘。
    top: Math.floor(Math.random() * 61) + 12,
    left: 8,
    right: 8,
    rotation: -8
  }))
}

// 检测是否为 iOS 设备
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// iOS 图片保存弹窗状态
const showIOSImageModal = ref(false)
const EMPTY_IMAGE_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
const iosImageUrl = ref('')
const iosImageFile = ref<File | null>(null)
const iosBlobImageUrl = ref('')
const iosDataImageUrl = ref('')
const iosUseDataImage = ref(false)

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error || new Error('图片读取失败'))
  reader.readAsDataURL(blob)
})

const getIOSMajorVersion = () => {
  const match = navigator.userAgent.match(/(?:iPhone OS|CPU OS|CPU iPhone OS)\s(\d+)[_\d]*/i)
  return match ? Number(match[1]) : null
}

const shouldUseDataImageForIOS = () => {
  const major = getIOSMajorVersion()
  return major !== null && major < 15
}

const syncIOSImageUrl = () => {
  iosImageUrl.value = iosUseDataImage.value ? iosDataImageUrl.value : iosBlobImageUrl.value
}

const toggleIOSImageMode = () => {
  iosUseDataImage.value = !iosUseDataImage.value
  syncIOSImageUrl()
  ElMessage.info(iosUseDataImage.value ? '已切换为兼容模式，请长按图片保存' : '已切换为新系统模式，请长按图片保存')
}

// 关闭 iOS 图片弹窗
const closeIOSImageModal = () => {
  showIOSImageModal.value = false
  if (iosBlobImageUrl.value) {
    URL.revokeObjectURL(iosBlobImageUrl.value)
  }
  iosImageUrl.value = EMPTY_IMAGE_SRC
  iosBlobImageUrl.value = ''
  iosDataImageUrl.value = ''
  iosImageFile.value = null
}

const shareIOSImage = async () => {
  const file = iosImageFile.value
  if (!file || !navigator.share) {
    ElMessage.warning('当前浏览器不支持系统分享，请长按图片保存')
    return
  }

  try {
    const siteName = siteSettingsStore.settings.siteName || '报价系统'
    const shareData = { files: [file], title: `${siteName}报价`, text: '报价单图片' }
    if (navigator.canShare && !navigator.canShare(shareData)) {
      ElMessage.warning('当前浏览器不支持系统分享，请长按图片保存')
      return
    }
    await navigator.share(shareData)
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      ElMessage.warning('系统分享未成功，请长按图片保存')
    }
  }
}

// 保存图片到相册（兼容 iOS 和 Android）
const saveImageToGallery = async (canvas: HTMLCanvasElement) => {
  const now = TimeUtil.now()
  const dateStr = TimeUtil.format(now, 'DATE_COMPACT')
  const timeStr = TimeUtil.format(now, 'TIME_COMPACT')
  const siteName = siteSettingsStore.settings.siteName || '报价系统'
  const fileName = `${siteName}报价_${dateStr}_${timeStr}.png`

  return new Promise<void>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('生成图片失败'))
        return
      }

      // iOS 特殊处理
      if (isIOS()) {
        try {
          const file = new File([blob], fileName, { type: 'image/png' })
          iosImageFile.value = file
          iosBlobImageUrl.value = URL.createObjectURL(blob)
          iosDataImageUrl.value = await blobToDataUrl(blob)
          iosUseDataImage.value = shouldUseDataImageForIOS()
          syncIOSImageUrl()
          showIOSImageModal.value = true
          ElMessage.success({
            message: '图片已生成，请长按保存到相册',
            duration: 3000
          })
          resolve()
        } catch (error) {
          reject(error)
        }
        return
      }

      // Android 和 PC：直接触发浏览器下载。
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = fileName
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      // 下载成功提示
      ElMessage.success({
        message: '图片已下载',
        duration: 2000
      })
      resolve()
    }, 'image/png', 0.95)
  })
}

const applyContactImageStyles = (clonedDocument: Document) => {
  const card = clonedDocument.querySelector<HTMLElement>('.contact-card')
  if (!card) return

  card.style.setProperty('background', 'linear-gradient(135deg, #e6f0f4 0%, #dce9ee 100%)', 'important')
  card.style.setProperty('border', '1px solid #c7d8e0', 'important')
  card.style.setProperty('border-radius', '10px', 'important')
  card.style.setProperty('box-shadow', 'none', 'important')
  card.style.setProperty('display', 'block', 'important')
  card.style.setProperty('height', 'auto', 'important')
  card.style.setProperty('min-height', '0', 'important')
  card.style.setProperty('overflow', 'visible', 'important')
  const grid = card.querySelector<HTMLElement>('.contact-grid')
  grid?.style.setProperty('display', 'grid', 'important')
  grid?.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important')
  grid?.style.setProperty('visibility', 'visible', 'important')
  card.querySelectorAll<HTMLElement>('.contact-title').forEach((el) => {
    el.style.setProperty('color', '#334155', 'important')
  })
  card.querySelectorAll<HTMLElement>('.contact-link').forEach((el) => {
    el.style.setProperty('display', 'flex', 'important')
    el.style.setProperty('justify-content', 'space-between', 'important')
    el.style.setProperty('height', 'auto', 'important')
    el.style.setProperty('min-height', '48px', 'important')
    el.style.setProperty('visibility', 'visible', 'important')
    el.style.setProperty('opacity', '1', 'important')
  })
}

// Safari 对 html2canvas 克隆后的表格布局会重新计算，显式固定生成图宽度和五列宽度，避免价格列被裁切。
const applyPriceTableImageStyles = (clonedDocument: Document) => {
  const results = clonedDocument.querySelector<HTMLElement>('.results-list.generating-image')
  const tableWrapper = results?.querySelector<HTMLElement>('.table-wrapper')
  const table = tableWrapper?.querySelector<HTMLElement>('.el-table')
  if (!results || !tableWrapper || !table) return

  const width = `${IMAGE_CAPTURE_WIDTH}px`
  let ancestor = results.parentElement
  while (ancestor && ancestor !== clonedDocument.documentElement) {
    ancestor.style.setProperty('overflow', 'visible', 'important')
    if (ancestor.matches('.container, .results-section, .public-price-query, #app')) {
      ancestor.style.setProperty('width', width, 'important')
      ancestor.style.setProperty('min-width', width, 'important')
      ancestor.style.setProperty('max-width', 'none', 'important')
    }
    if (ancestor.matches('.public-price-query')) {
      ancestor.style.setProperty('position', 'static', 'important')
      ancestor.style.setProperty('height', 'auto', 'important')
      ancestor.style.setProperty('min-height', '0', 'important')
    }
    ancestor = ancestor.parentElement
  }

  clonedDocument.documentElement.style.setProperty('overflow', 'visible', 'important')
  clonedDocument.body.style.setProperty('overflow', 'visible', 'important')
  results.style.setProperty('width', width, 'important')
  results.style.setProperty('min-width', width, 'important')
  results.style.setProperty('max-width', width, 'important')
  results.style.setProperty('box-sizing', 'border-box', 'important')
  results.style.setProperty('overflow', 'visible', 'important')
  tableWrapper.style.setProperty('width', width, 'important')
  tableWrapper.style.setProperty('box-sizing', 'border-box', 'important')
  tableWrapper.style.setProperty('padding', '0', 'important')
  tableWrapper.style.setProperty('overflow', 'visible', 'important')
  table.style.setProperty('display', 'block', 'important')
  table.style.setProperty('width', width, 'important')
  table.style.setProperty('min-width', width, 'important')
  table.style.setProperty('box-sizing', 'border-box', 'important')
  table.style.setProperty('overflow', 'visible', 'important')

  table.querySelectorAll<HTMLElement>('.el-table__inner-wrapper, .el-table__header-wrapper, .el-table__body-wrapper').forEach((wrapper) => {
    wrapper.style.setProperty('width', width, 'important')
    wrapper.style.setProperty('min-width', width, 'important')
    wrapper.style.setProperty('box-sizing', 'border-box', 'important')
    wrapper.style.setProperty('overflow', 'visible', 'important')
  })
  table.querySelectorAll<HTMLElement>('.el-scrollbar, .el-scrollbar__wrap, .el-scrollbar__view').forEach((scrollContainer) => {
    scrollContainer.style.setProperty('width', width, 'important')
    scrollContainer.style.setProperty('min-width', width, 'important')
    scrollContainer.style.setProperty('max-width', width, 'important')
    scrollContainer.style.setProperty('box-sizing', 'border-box', 'important')
    scrollContainer.style.setProperty('margin', '0', 'important')
    scrollContainer.style.setProperty('overflow', 'visible', 'important')
  })
  table.querySelectorAll<HTMLElement>('.el-scrollbar__bar').forEach((scrollbar) => {
    scrollbar.style.setProperty('display', 'none', 'important')
  })
  const innerWrapper = table.querySelector<HTMLElement>('.el-table__inner-wrapper')
  innerWrapper?.style.setProperty('position', 'relative', 'important')
  innerWrapper?.style.setProperty('border', '1px solid var(--el-table-border-color, var(--tf-color-gray-200-alt))', 'important')
  const captureTableStyle = clonedDocument.createElement('style')
  captureTableStyle.textContent = `
    .results-list.generating-image .el-table::before,
    .results-list.generating-image .el-table::after,
    .results-list.generating-image .el-table__inner-wrapper::before,
    .results-list.generating-image .el-table__inner-wrapper::after,
    .results-list.generating-image .el-table__header th::after { display: none !important; }
    .results-list.generating-image .el-table__header,
    .results-list.generating-image .el-table__header tr,
    .results-list.generating-image .el-table__header th,
    .results-list.generating-image .el-table__header td,
    .results-list.generating-image .el-table__header-wrapper,
    .results-list.generating-image .el-table__header-wrapper * {
      border-bottom: 0 !important;
      box-shadow: none !important;
    }
  `
  clonedDocument.head.appendChild(captureTableStyle)
  const rootStyle = clonedDocument.defaultView?.getComputedStyle(clonedDocument.documentElement)
  const headerBackground = rootStyle?.getPropertyValue('--admin-data-table-header-bg').trim()
    || 'linear-gradient(135deg, #495057 0%, #343a40 100%)'
  const headerColor = rootStyle?.getPropertyValue('--admin-data-table-header-color').trim() || '#ffffff'
  table.querySelectorAll<HTMLElement>('.el-table__header th').forEach((cell) => {
    cell.style.setProperty('background', headerBackground, 'important')
    cell.style.setProperty('color', headerColor, 'important')
    cell.querySelector<HTMLElement>('.cell')?.style.setProperty('color', headerColor, 'important')
  })
  const headerWrapper = table.querySelector<HTMLElement>('.el-table__header-wrapper')
  if (headerWrapper) {
    headerWrapper.style.setProperty('position', 'relative', 'important')
    headerWrapper.style.setProperty('overflow', 'visible', 'important')
    headerWrapper.style.setProperty('border-bottom', '2px solid var(--admin-data-table-header-accent, var(--tf-color-violet-500))', 'important')
  }
  if (innerWrapper) {
    const rightBorder = clonedDocument.createElement('span')
    rightBorder.setAttribute('aria-hidden', 'true')
    rightBorder.style.cssText = 'position:absolute;top:0;right:0;bottom:0;width:2px;background:var(--el-table-border-color,var(--tf-color-gray-200-alt));z-index:10000;pointer-events:none;'
    innerWrapper.appendChild(rightBorder)
  }
  // Element Plus 会为纵向滚动条渲染 gutter 占位列。截图时直接移除，避免 Safari 仍把它计入表格布局。
  table.querySelectorAll<HTMLElement>('.gutter, col.gutter, col[name="gutter"]').forEach((gutter) => gutter.remove())

  const columnWidths = ['14%', '27%', '14%', '16%', '29%']
  table.querySelectorAll<HTMLTableElement>('table').forEach((innerTable) => {
    innerTable.style.setProperty('display', 'table', 'important')
    innerTable.style.setProperty('width', width, 'important')
    innerTable.style.setProperty('min-width', width, 'important')
    innerTable.style.setProperty('table-layout', 'fixed', 'important')
    innerTable.querySelectorAll<HTMLTableColElement>('col').forEach((column, index) => {
      const columnWidth = columnWidths[index]
      if (!columnWidth) return
      column.style.setProperty('width', columnWidth, 'important')
      column.style.setProperty('min-width', '0', 'important')
    })
  })

  table.querySelectorAll<HTMLElement>('.el-table__header, .el-table__body').forEach((innerTable) => {
    innerTable.style.setProperty('display', 'table', 'important')
    innerTable.style.setProperty('width', width, 'important')
  })
  table.querySelectorAll<HTMLElement>('.el-table__header th:last-child, .el-table__body td:last-child').forEach((cell) => {
    cell.style.setProperty('border-right', '1px solid var(--el-table-border-color, var(--tf-color-gray-200-alt))', 'important')
  })
  table.querySelectorAll<HTMLElement>('.el-table__cell, .cell, .price').forEach((cell) => {
    cell.style.setProperty('box-sizing', 'border-box', 'important')
    cell.style.setProperty('white-space', 'nowrap', 'important')
    cell.style.setProperty('word-break', 'keep-all', 'important')
    cell.style.setProperty('overflow', 'visible', 'important')
    cell.style.setProperty('text-overflow', 'clip', 'important')
  })
}

// 下载为图片
const downloadAsImage = async () => {
  if (isGenerating.value) return

  const element = document.getElementById('price-results')
  if (!element) {
    ElMessage.error('当前没有可生成的报价内容')
    return
  }

  const watermarkEl = element.querySelector<HTMLElement>('.image-watermark')
  isGenerating.value = true
  try {
    // 显示水印并设置随机位置
    const watermarkItems = element.querySelectorAll('.watermark-item')
    if (watermarkEl && watermarkItems.length > 0) {
      (watermarkEl as HTMLElement).style.display = 'block'
      // 生成随机位置
      const positions = generateRandomWatermarkPositions()
      watermarkItems.forEach((item, index) => {
        if (positions[index]) {
          const pos = positions[index]
          const el = item as HTMLElement
          // 偶数使用 left，奇数使用 right
          if (index % 2 === 0) {
            el.style.top = `${pos.top}%`
            el.style.left = `${pos.left}%`
            el.style.right = 'auto'
          } else {
            el.style.top = `${pos.top}%`
            el.style.right = `${pos.right}%`
            el.style.left = 'auto'
          }
          el.style.width = '92%'
          el.style.maxWidth = '92%'
          el.style.boxSizing = 'border-box'
          el.style.textAlign = 'center'
          el.style.transform = `rotate(${pos.rotation}deg)`
        }
      })
    }

    // 临时添加移动端样式类用于生成图片
    element.classList.add('generating-image')

    // 等待样式应用和水印显示
    await new Promise(resolve => setTimeout(resolve, 150))

    const html2canvas = await loadHtml2Canvas()
    const captureWidth = Math.max(IMAGE_CAPTURE_WIDTH, Math.ceil(element.scrollWidth))
    const captureHeight = Math.ceil(element.scrollHeight)

    // 使用 html2canvas 生成图片（完整捕获）
    const canvas = await html2canvas(element, {
      scale: 3, // 提高清晰度，适配手机
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      useCORS: true, // 支持跨域图片
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
      onclone: (clonedDocument) => {
        applyContactImageStyles(clonedDocument)
        applyPriceTableImageStyles(clonedDocument)
      }
    })

    // 裁剪画布移除底部空白
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // 从底部向上扫描找到最后一个非白色像素
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      let lastNonWhiteRow = canvas.height - 1

      for (let y = canvas.height - 1; y >= 0; y--) {
        let hasContent = false
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4
          // 检查是否为非白色像素（考虑渐变背景）
          if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
            hasContent = true
            break
          }
        }
        if (hasContent) {
          lastNonWhiteRow = y
          break
        }
      }

      // 如果找到空白区域，裁剪画布
      if (lastNonWhiteRow < canvas.height - 10) {
        const cropHeight = lastNonWhiteRow + 20
        const croppedCanvas = document.createElement('canvas')
        croppedCanvas.width = canvas.width
        croppedCanvas.height = cropHeight
        const croppedCtx = croppedCanvas.getContext('2d')
        if (croppedCtx) {
          croppedCtx.drawImage(canvas, 0, 0, croppedCanvas.width, croppedCanvas.height)
        }

        // 转换为 blob 并保存
        await saveImageToGallery(croppedCanvas)
        return
      }
    }

    // 转换为 blob 并保存
    await saveImageToGallery(canvas)
  } catch (error) {
    logger.error('生成图片失败', error)
    ElMessage.error('生成图片失败，请重试')
  } finally {
    if (watermarkEl) watermarkEl.style.display = 'none'
    element.classList.remove('generating-image')
    isGenerating.value = false
  }
}

// 表格行双击处理
const handleRowDoubleClick = (row: any, _column?: any, event?: Event) => {
  if (isTouchInteraction.value) return
  if (passwordVerified.value) {
    showInventoryResultDialog(row)
    event?.stopPropagation()
  }
}

// 表格行点击处理（支持手机、iPad 及其他触屏浏览器双击）
const handleRowClick = (row: any, _column: any, event: Event) => {
  if (!isTouchInteraction.value) return

  const currentTime = Date.now()
  const tapInterval = currentTime - lastTapTime
  const rowKey = getProductRowKey(row)

  // 检测双击（400ms内的两次点击同一行）
  if (tapInterval < 450 && tapInterval > 0 && lastTapRowKey === rowKey) {
    if (passwordVerified.value) {
      showInventoryResultDialog(row)
    }
    // 重置
    lastTapTime = 0
    lastTapRowKey = ''
    event?.stopPropagation()
  } else {
    lastTapTime = currentTime
    lastTapRowKey = rowKey
  }
}

// 显示在库查询结果弹窗
const showInventoryResultDialog = (row: any) => {
  const rowKey = getProductRowKey(row)
  const now = Date.now()
  if (rowKey === lastOpenedRowKey && now - lastOpenedAt < 450) return
  lastOpenedRowKey = rowKey
  lastOpenedAt = now

  selectedProduct.value = {
    brand_id: Number(row.brand_id),
    model_id: Number(row.model_id),
    color_id: Number(row.color_id),
    memory_id: Number(row.memory_id),
    brand: row.brand_name,
    model: row.model_number,
    color: row.color_name,
    memory: row.memory
  }
  showInventoryResult.value = true
}

const handleInventoryAuthorizationExpired = () => resetInventoryAccess(true)

const refreshPublicPriceSettings = () => {
  // 公开页面可能在后台设置页保存后才打开，不能依赖应用启动时的设置快照。
  return siteSettingsStore.loadSiteSettings(true)
}

const handlePublicPriceVisibility = () => {
  if (document.visibilityState === 'visible') {
    void refreshPublicPriceSettings()
  }
}

const handlePublicPriceSettingsStorage = (event: StorageEvent) => {
  if (event.key === 'tf2025:site-settings-version' && event.newValue) {
    void refreshPublicPriceSettings()
  }
}

const preventRubberBand = (event: TouchEvent) => {
  const touch = event.touches[0] || event.changedTouches[0]
  if (!touch) return

  const windowWidth = window.innerWidth
  if (touch.clientX <= 10 || touch.clientX >= windowWidth - 10) {
    const target = event.target as HTMLElement
    if (!target.closest('.table-wrapper') && event.cancelable) event.preventDefault()
  }
}

onMounted(async () => {
  // 站点设置不可用时不能阻塞报价数据首屏加载。
  await Promise.allSettled([refreshPublicPriceSettings(), loadAllData()])

  document.addEventListener('touchstart', preventRubberBand, { passive: false })
  document.addEventListener('touchmove', preventRubberBand, { passive: false })
  document.addEventListener('visibilitychange', handlePublicPriceVisibility)
  window.addEventListener('storage', handlePublicPriceSettingsStorage)
})

onBeforeUnmount(() => {
  activePriceRequestId += 1
  if (inventoryTokenExpiryTimer) clearTimeout(inventoryTokenExpiryTimer)
  inventoryTokenExpiryTimer = null
  document.removeEventListener('touchstart', preventRubberBand)
  document.removeEventListener('touchmove', preventRubberBand)
  document.removeEventListener('visibilitychange', handlePublicPriceVisibility)
  window.removeEventListener('storage', handlePublicPriceSettingsStorage)
})
</script>

<style lang="scss" scoped src="./PublicPriceQuery.scoped.scss"></style>

<style lang="scss" src="./PublicPriceQuery.global.scss"></style>

<style lang="scss">
// 全局 Safari 防止左右移动（非 scoped）
// 针对所有 Safari 浏览器
@supports (-webkit-touch-callout: none) {
  html,
  body {
    overflow-x: hidden !important;
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    position: relative !important;
  }

  #app {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100% !important;
  }
}
</style>
