<template>
  <div class="public-price-query sales-price-display">
    <PublicPriceHeader
      title="最新销售价"
      :action-width="112"
      action-size="small"
    >
      <template #search>
        <PublicSearchBox
          v-model="searchKeyword"
          placeholder="搜索品牌、型号、颜色或内存..."
          :loading="loading"
          @search="handleSearch"
          @clear="handleClear"
        />
      </template>

      <template #actions>
        <el-button
          native-type="button"
          class="price-header-action price-header-action--download tf-button--export"
          :loading="isGenerating"
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
            生成中...
          </span>
        </el-button>
      </template>
    </PublicPriceHeader>

    <!-- 结果展示区 -->
    <div class="results-section">
      <div class="container">
        <!-- 加载状态 -->
        <SectionLoading
          v-if="loading"
          text="正在查询价格..."
        />

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
            <h2>销售报价</h2>
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
              v-table-double-tap="priceDetailTapOptions"
              class="data-table"
              :data="searchResults"
              stripe
              border
              @row-dblclick="priceDetailDoubleClick"
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
              />
              <el-table-column
                prop="display_retail_price"
                label="销售价格"
                min-width="70"
                class-name="sales-price-column"
                align="right"
              >
                <template #default="{ row }">
                  <span
                    v-if="hasDisplayRetailPrice(row)"
                    class="price sales-price-value"
                  >{{ formatDisplayRetailPrice(row) }}</span>
                </template>
              </el-table-column>
            </el-table>
            <RecordDetailDialog
              v-model="priceDetailVisible"
              title="销售报价详情"
              :record="priceDetailRow"
              :fields="priceDetailFields"
              :has-actions="false"
            />
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
        <p>{{ siteSettingsStore.settings.siteName || '销售报价系统' }}</p>
        <p class="copyright">
          &copy; {{ TimeUtil.now().year() }} 版权所有
        </p>
      </div>
    </div>

    <MobileDialog
      v-model="showIOSImageModal"
      title="长按图片保存到相册"
      dialog-class="ios-image-dialog"
      :show-default-footer="false"
    >
      <div class="ios-save-container">
        <div class="image-wrapper">
          <img
            class="ios-save-image"
            :src="iosImageUrl"
            :alt="`${siteSettingsStore.settings.siteName || '销售'}报价`"
            draggable="false"
          >
        </div>
      </div>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button
            class="tf-button--neutral"
            @click="toggleIOSImageMode"
          >
            长按保存
          </el-button>
          <el-button
            :loading="isSharingImage"
            class="tf-button--manage"
            @click="shareIOSImage"
          >
            我要分享
          </el-button>
          <el-button
            class="tf-button--neutral"
            @click="closeIOSImageModal"
          >
            关闭
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import { applyPriceTableImageStyles, generateRandomWatermarkPositions } from '@/utils/price-table-image'
import { formatAmount } from '@/utils/format'
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { getAllSalesPrices, searchSalesPrices } from '@/api/price-list'
import { PublicPriceHeader } from '@/components/base'
import PublicSearchBox from '@/components/search/PublicSearchBox.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { useLoadingState } from '@/composables'
import { logger } from '@/utils/logger'

import { loadHtml2Canvas } from '@/utils/html2canvas'
import { useImageGallery } from '@/composables/useImageGallery'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { parsePublicPriceContacts, getDefaultPublicPriceContact, formatPublicPriceWatermark } from '@/utils/publicPriceSettings'
import type { SalesPriceDisplayRow } from '@/types/price-list'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


const IMAGE_CAPTURE_WIDTH = 430
// 状态
const { loading } = useLoadingState()
const siteSettingsStore = useSiteSettingsStore()
const {
  showIOSImageModal, iosImageUrl, isSharingImage,
  closeIOSImageModal, toggleIOSImageMode, shareIOSImage, saveImageToGallery
} = useImageGallery(() => {
  const now = TimeUtil.now()
  const dateStr = TimeUtil.format(now, 'DATE_COMPACT')
  const timeStr = TimeUtil.format(now, 'TIME_COMPACT')
  const siteName = siteSettingsStore.settings.siteName || '销售报价'
  return `${siteName}销售报价_${dateStr}_${timeStr}.png`
})

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
const searchResults = ref<SalesPriceDisplayRow[]>([])
const hasSearched = ref(false)
const isGenerating = ref(false)

// 加载所有数据
const loadAllData = async () => {
  loading.value = true
  try {
    const res = await getAllSalesPrices()
    if (res.success) {
      const rawData = Array.isArray(res.data) ? res.data : []
      searchResults.value = rawData
      hasSearched.value = true
    }
  } catch (error) {
    logger.error('加载数据失败', error)
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = async () => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    // 如果搜索为空，加载所有数据
    loadAllData()
    return
  }

  loading.value = true
  try {
    const res = await searchSalesPrices(keyword)
    if (res.success) {
      const rawData = Array.isArray(res.data) ? res.data : []
      searchResults.value = rawData
        .filter((item: SalesPriceDisplayRow) => hasDisplayRetailPrice(item))
      hasSearched.value = true
    }
  } catch (error) {
    logger.error('搜索失败', error)
  } finally {
    loading.value = false
  }
}

// 清空
const handleClear = () => {
  searchKeyword.value = ''
  loadAllData()
}

const getDisplayRetailPrice = (row: SalesPriceDisplayRow) => {
  return row?.display_retail_price ?? row?.retail_price
}

const hasDisplayRetailPrice = (row: SalesPriceDisplayRow) => {
  const price = getDisplayRetailPrice(row)
  return price !== null && price !== undefined && price !== '' && Number(price) > 0
}

const formatDisplayRetailPrice = (row: SalesPriceDisplayRow) => {
  return formatAmount(getDisplayRetailPrice(row))
}

// 获取当前时间字符串（用于水印）
const _getCurrentTimeString = () => {
  return TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
}

// 下载为图片
const downloadAsImage = async () => {
  if (isGenerating.value) return

  isGenerating.value = true
  try {
    const element = document.getElementById('price-results')
    if (!element) {
      throw new Error('找不到报价元素')
    }

    // 显示水印并设置随机位置
    const watermarkEl = element.querySelector('.image-watermark')
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

    // 让 html2canvas 在克隆后的 430px 响应式布局中测量元素边界，避免沿用桌面端尺寸。
    const canvas = await html2canvas(element, {
      scale: 3, // 提高清晰度，适配手机
      windowWidth: IMAGE_CAPTURE_WIDTH,
      useCORS: true, // 支持跨域图片
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
      onclone: (clonedDocument) => {
        applyPriceTableImageStyles(clonedDocument, IMAGE_CAPTURE_WIDTH)
      }
    })

    // 裁剪画布移除底部白色空白
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
          // 检查是否为非白色或非紫色渐变背景（联系方式卡片）
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          // 检查是否为非纯白色
          if (r < 250 || g < 250 || b < 250) {
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
        const cropHeight = lastNonWhiteRow + 8
        const croppedCanvas = document.createElement('canvas')
        croppedCanvas.width = canvas.width
        croppedCanvas.height = cropHeight
        const croppedCtx = croppedCanvas.getContext('2d')
        if (croppedCtx) {
          croppedCtx.drawImage(canvas, 0, 0, croppedCanvas.width, croppedCanvas.height)
        }

        // 隐藏水印
        if (watermarkEl) {
          (watermarkEl as HTMLElement).style.display = 'none'
        }

        // 恢复原类名
        element.classList.remove('generating-image')

        await saveImageToGallery(croppedCanvas)
        return
      }
    }

    // 隐藏水印
    if (watermarkEl) {
      (watermarkEl as HTMLElement).style.display = 'none'
    }

    // 恢复原类名
    element.classList.remove('generating-image')

    await saveImageToGallery(canvas)
  } catch (error) {
    logger.error('生成图片失败', error)
    globalNotifications.error('生成图片失败，请重试')
  } finally {
    isGenerating.value = false
  }
}

const refreshPublicPriceSettings = () => {
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

onMounted(async () => {
  // 进入公开报价页时强制读取数据库，确保联系人、站点名称和水印使用最新值。
  await refreshPublicPriceSettings()
  // 默认加载所有数据
  await loadAllData()
  document.addEventListener('visibilitychange', handlePublicPriceVisibility)
  window.addEventListener('storage', handlePublicPriceSettingsStorage)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handlePublicPriceVisibility)
  window.removeEventListener('storage', handlePublicPriceSettingsStorage)
})

const { isMobile } = useMobile()
const { detailRow: priceDetailRow, detailVisible: priceDetailVisible, doubleTapOptions: priceDetailTapOptions, handleRowDoubleClick: priceDetailDoubleClick } = useMobileTableDetail<(typeof searchResults.value)[number]>({
  enabled: () => isMobile.value, rows: () => searchResults.value, getKey: row => JSON.stringify([row.brand_name, row.model_number, row.color_name, row.memory])
})
const priceDetailFields = computed<RecordDetailField[]>(() => {
  const row = priceDetailRow.value
  if (!row) return []
  return [
    { key: 'brand_name', label: '品牌', value: row.brand_name, visible: true },
    { key: 'model_number', label: '型号', value: row.model_number, visible: true, wide: true },
    { key: 'color_name', label: '颜色', value: row.color_name, visible: true },
    { key: 'memory', label: '内存', value: row.memory, visible: true },
    { key: 'display_retail_price', label: '销售价格', value: formatDisplayRetailPrice(row), visible: true }
  ]
})

</script>

<style scoped lang="scss" src="./sales-price-display/page.scss"></style>
<style scoped lang="scss" src="./sales-price-display/contact-card.scss"></style>
<style lang="scss">
@use "../../../styles/components/price-contact";

/* 图片水印样式 - 表格内斜向随机位置 */
.image-watermark {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 2;
  mix-blend-mode: multiply;

  .watermark-item {
    position: absolute;
    opacity: 0;
    z-index: 2;
    transform-origin: center;

    .watermark-text {
      display: inline-block;
      opacity: 0.16;
      font-size: var(--tf-font-mobile-scale-label);
      font-weight: 700;
      color: rgba(220, 38, 38, 0.15);
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: clip;
      overflow-wrap: normal;
      word-break: keep-all;
      line-height: 1.2;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.05);
    }
  }
}

/* 生成图片时使用手机响应式样式 */
.results-list.generating-image {
  /* 生成图使用固定安全宽度，避免 375px 等小屏设备裁掉最右侧价格。 */
  width: 430px !important;
  min-width: 430px !important;
  max-width: 430px !important;
  padding: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: white !important;
  position: relative !important;

  > :not(.image-watermark) {
    position: relative;
    z-index: 1;
  }

  .results-header {
    padding: 12px !important;
    background: var(--tf-color-surface) !important;
    flex-wrap: wrap !important;
    border-bottom: none !important;
    border-radius: 0 !important;
    margin-bottom: 0 !important;
    justify-content: space-between !important;
    gap: 8px !important;

    h2 {
      font-size: var(--tf-type-scale-14) !important;
    }

    .count {
      font-size: var(--tf-type-scale-11) !important;
    }

    .hot-badge {
      font-size: var(--tf-type-scale-9) !important;
      height: 16px !important;
      line-height: 16px !important;
      padding: 0 3px !important;
    }
  }

  /* 显示水印 */
  .image-watermark {
    .watermark-item {
      opacity: 1 !important;
    }
  }

  .download-section {
    display: none !important;
  }

  .table-wrapper {
    margin: 0 !important;
    width: 100% !important;
    overflow-x: visible !important;

    :deep(.el-table) {
      width: 430px !important;
      min-width: 430px !important;
      font-size: var(--tf-type-scale-12) !important;
      border-radius: 0 !important;
      border-left: 1px solid var(--el-table-border-color, var(--tf-color-gray-200-alt)) !important;
      border-right: 1px solid var(--el-table-border-color, var(--tf-color-gray-200-alt)) !important;
      display: block !important;
      overflow: visible !important;

      .el-table__inner-wrapper,
      .el-table__header-wrapper,
      .el-table__body-wrapper {
        width: 100% !important;
        overflow-x: visible !important;
        overflow-y: visible !important;
      }

      .el-table__header th {
        padding: 8px 4px !important;
        font-size: var(--tf-type-scale-12) !important;
        white-space: nowrap !important;
        height: auto !important;
      }

      .el-table__body td {
        padding: 8px 4px !important;
        white-space: nowrap !important;
        height: auto !important;
      }

      .el-table__cell {
        padding: 8px 4px !important;
      }

      /* header/body 都是独立 table，Safari 下不能把 body 当作 table-header-group。 */
      .el-table__header,
      .el-table__body {
        width: 100% !important;
        display: table !important;
      }

      .el-table__body tr {
        display: table-row !important;
      }

      table {
        width: 100% !important;
        min-width: 100% !important;
        display: table !important;
        table-layout: fixed !important;
      }

      colgroup {
        display: table-column-group !important;
      }

      col {
        display: table-column !important;
      }

      /* 品牌列 */
      col:nth-child(1) {
        width: 14% !important;
      }

      /* 型号列 */
      col:nth-child(2) {
        width: 27% !important;
      }

      /* 颜色列 */
      col:nth-child(3) {
        width: 14% !important;
      }

      /* 内存列 */
      col:nth-child(4) {
        width: 16% !important;
      }

      /* 价格列 */
      col:nth-child(5) {
        width: 29% !important;
      }

      /* 确保表格内容不换行但完整显示 */
      .el-table__body-wrapper {
        overflow: visible !important;
      }

      /* 确保所有单元格内容可见 */
      .cell {
        box-sizing: border-box !important;
        overflow: visible !important;
        text-overflow: clip !important;
        white-space: nowrap !important;
        word-break: keep-all !important;
      }

      .price {
        display: inline-block !important;
        min-width: max-content !important;
        white-space: nowrap !important;
      }
    }
  }

}

.ios-save-image {
  -webkit-touch-callout: default !important;
  -webkit-user-select: auto !important;
  user-select: auto !important;
  pointer-events: auto !important;
  touch-action: auto !important;
}

.ios-image-dialog {
  .ios-save-container {
    .image-wrapper {
      text-align: center;
      border-radius: 8px;
      overflow: hidden;
      background: white;

      img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0 auto;
      }

      .ios-save-image {
        -webkit-touch-callout: default !important;
        -webkit-user-select: auto !important;
        user-select: auto !important;
        pointer-events: auto !important;
        touch-action: auto !important;
      }
    }
  }
}

</style>
