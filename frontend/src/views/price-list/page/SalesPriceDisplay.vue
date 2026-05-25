<template>
  <div class="public-price-query">
    <PublicPriceHeader title="最新销售报价">
      <template #search>
        <div class="custom-search-input">
          <el-icon class="search-icon"><Search /></el-icon>
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索品牌或型号..."
            class="search-input-field"
            @keyup.enter="handleSearch"
          />
          <div v-if="searchKeyword" class="clear-btn" @click="handleClear">
            <el-icon><Close /></el-icon>
          </div>
          <button class="search-btn-inner" @click="handleSearch">搜索</button>
        </div>
      </template>

      <template #actions>
        <button class="download-trigger-btn" @click="downloadAsImage" :disabled="isGenerating || searchResults.length === 0">
          <span v-if="!isGenerating" class="btn-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="btn-text">保存为图片</span>
          </span>
          <span v-else class="btn-content loading">
            <svg class="btn-icon loading-spinner" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" fill="none"></path>
            </svg>
            <span class="btn-text">生成中...</span>
          </span>
        </button>
      </template>
    </PublicPriceHeader>

    <!-- 结果展示区 -->
    <div class="results-section">
      <div class="container">
        <!-- 加载状态 -->
        <div v-if="loading" class="loading-container">
          <el-icon class="is-loading"><Loading /></el-icon>
          <p>正在查询价格...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="!hasSearched" class="empty-state">
          <span class="empty-icon">🔍</span>
          <p>请输入关键词搜索价格</p>
        </div>

        <!-- 无结果 -->
        <div v-else-if="searchResults.length === 0" class="no-results">
          <span class="empty-icon">😔</span>
          <p>未找到相关价格信息</p>
        </div>

        <!-- 结果列表 -->
        <div v-else class="results-list" id="price-results">
          <div class="results-header">
            <h2>销售报价</h2>
            <el-tag class="hot-badge" type="danger" effect="dark">HOT</el-tag>
            <h2>1320-0790-3333</h2>
            <span class="count">共 {{ searchResults.length }} 条</span>
          </div>

          <!-- 水印（仅生成图片时显示） -->
          <div class="image-watermark" v-show="false">
            <div class="watermark-item watermark-1">
              <span class="watermark-text">腾飞数码 132-0790-3333 {{ getCurrentTimeString() }}</span>
            </div>
            <div class="watermark-item watermark-2">
              <span class="watermark-text">腾飞数码 132-0790-3333 {{ getCurrentTimeString() }}</span>
            </div>
            <div class="watermark-item watermark-3">
              <span class="watermark-text">腾飞数码 132-0790-3333 {{ getCurrentTimeString() }}</span>
            </div>
          </div>

          <!-- 表格视图 -->
          <div class="table-wrapper">
            <el-table :data="searchResults" stripe border>
              <el-table-column prop="brand_name" label="品牌" min-width="80" />
              <el-table-column prop="model_number" label="型号" min-width="100" />
              <el-table-column prop="color_name" label="颜色" min-width="60" />
              <el-table-column prop="memory" label="内存" min-width="70" />
              <el-table-column prop="retail_price" label="销售价格" min-width="80" align="right">
                <template #default="{ row }">
                  <span v-if="row.retail_price" class="price wholesale">{{ Math.round(Number(row.retail_price)) }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 联系方式 -->
          <div class="contact-card">
            <div class="contact-header">
              <span class="contact-icon">📞</span>
              <span class="contact-title">联系电话</span>
            </div>
            <div class="contact-grid">
              <a href="tel:13207903333" class="contact-link">
                <span class="contact-name">饶先生</span>
                <span class="contact-number">132-0790-3333</span>
              </a>
              <a href="tel:13207903335" class="contact-link">
                <span class="contact-name">刘女士</span>
                <span class="contact-number">132-0790-3335</span>
              </a>
              <a href="tel:15679079373" class="contact-link">
                <span class="contact-name">三小店</span>
                <span class="contact-number">156-7907-9373</span>
              </a>
              <a href="tel:15607909320" class="contact-link">
                <span class="contact-name">广场店</span>
                <span class="contact-number">156-0790-9320</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 页脚 -->
    <div class="footer">
      <div class="container">
        <p>腾飞数码报价系统</p>
        <p class="copyright">&copy; {{ TimeUtil.now().year() }} 版权所有</p>
      </div>
    </div>

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
          <img :src="iosImageUrl" alt="腾飞数码销售报价" />
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="closeIOSImageModal">关闭</el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Search, Loading, Close } from '@element-plus/icons-vue'
import { getAllSalesPrices, searchSalesPrices } from '@/api/price-list'
import html2canvas from 'html2canvas'
import { PublicPriceHeader } from '@/components/base'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { useLoadingState } from '@/composables'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'
// 状态
const { loading } = useLoadingState()
const searchKeyword = ref('')
const searchResults = ref<any[]>([])
const hasSearched = ref(false)
const isGenerating = ref(false)
const showIOSImageModal = ref(false)
const iosImageUrl = ref('')

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
        .filter((item: any) => item.retail_price && Number(item.retail_price) > 0)
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

// 获取当前时间字符串（用于水印）
const getCurrentTimeString = () => {
  return TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
}

// 生成随机水印位置
interface WatermarkPosition {
  top: number
  left: number
  right: number
  rotation: number
}

const generateRandomWatermarkPositions = (): WatermarkPosition[] => {
  const positions: WatermarkPosition[] = []
  for (let i = 0; i < 3; i++) {
    positions.push({
      top: Math.floor(Math.random() * 60) + 15, // 15% - 75%
      left: Math.floor(Math.random() * 60) + 10, // 10% - 70%
      right: Math.floor(Math.random() * 60) + 10, // 10% - 70%
      rotation: Math.floor(Math.random() * 30) - 40 // -40deg 到 -10deg
    })
  }
  return positions
}

const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

const closeIOSImageModal = () => {
  showIOSImageModal.value = false
  if (iosImageUrl.value) {
    URL.revokeObjectURL(iosImageUrl.value)
    iosImageUrl.value = ''
  }
}

const saveImageToGallery = async (canvas: HTMLCanvasElement) => {
  const now = TimeUtil.now()
  const dateStr = now.format('YYYYMMDD')
  const timeStr = now.format('HHmm')
  const fileName = `腾飞数码销售报价_${dateStr}_${timeStr}.png`

  return new Promise<void>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('生成图片失败'))
        return
      }

      if (isIOS()) {
        const url = URL.createObjectURL(blob)
        iosImageUrl.value = url
        showIOSImageModal.value = true
        ElMessage.success({
          message: '请长按图片保存到相册',
          duration: 3000
        })
        resolve()
        return
      }

      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: '腾飞数码销售报价',
            text: `报价单 ${dateStr} ${timeStr}`
          })
          ElMessage.success({
            message: '图片已保存',
            duration: 2000
          })
          resolve()
          return
        } catch (shareError) {
          if ((shareError as Error).name !== 'AbortError') {
            // ignore and fall back to download
          }
        }
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = fileName
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      ElMessage.success({
        message: '图片已下载',
        duration: 2000
      })
      resolve()
    }, 'image/png', 0.95)
  })
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
          el.style.transform = `rotate(${pos.rotation}deg)`
        }
      })
    }

    // 临时添加移动端样式类用于生成图片
    element.classList.add('generating-image')

    // 等待样式应用和水印显示
    await new Promise(resolve => setTimeout(resolve, 150))

    // 使用 html2canvas 生成图片（完整捕获）
    const canvas = await html2canvas(element, {
      scale: 3, // 提高清晰度，适配手机
      useCORS: true, // 支持跨域图片
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true
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
    alert('生成图片失败，请重试')
  } finally {
    isGenerating.value = false
  }
}

onMounted(() => {
  // 默认加载所有数据
  loadAllData()
})

onBeforeUnmount(() => {
  closeIOSImageModal()
})
</script>

<style scoped lang="scss">
.public-price-query {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-section {
  padding: 60px 20px 40px;
  text-align: center;
  color: white;

  .container {
    max-width: 800px;
    margin: 0 auto;
  }

  .title {
    font-size: 42px;
    font-weight: bold;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;

    .title-icon {
      font-size: 48px;
    }
  }

  .subtitle {
    font-size: 18px;
    opacity: 0.9;
    margin-bottom: 40px;
  }

  .search-box {
    max-width: 600px;
    margin: 0 auto 20px;

    // 移动端适配
    @media (max-width: 768px) {
      max-width: 100%;
      padding: 0 15px;
      margin-bottom: 15px;
    }

    // 自定义搜索框
    .custom-search-input {
      position: relative;
      display: flex;
      align-items: center;
      height: 52px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      padding: 0 16px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      transition: all 0.3s ease;

      // 移动端高度调整
      @media (max-width: 768px) {
        height: 48px;
        padding: 0 8px;
        border-radius: 8px;
      }

      // 小屏幕手机适配 (iPhone 12/13/14 Pro 等)
      @media (max-width: 420px) {
        padding: 0 6px;
      }

      // iPhone 16 Pro / 15 Pro (393px) 适配
      @media (max-width: 400px) and (min-width: 390px) {
        padding: 0 5px;
      }

      // iPhone SE 375x677 适配
      @media (max-width: 390px) {
        padding: 0 4px;
        height: 46px;
      }

      &:hover {
        border-color: rgba(255, 255, 255, 0.4);
        box-shadow: 0 6px 25px rgba(0, 0, 0, 0.15);
      }

      &:focus-within {
        border-color: rgba(255, 255, 255, 0.6);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
      }

      .search-icon {
        color: #667eea;
        font-size: 18px;
        flex-shrink: 0;
        margin-right: 8px;

        @media (max-width: 768px) {
          font-size: 16px;
          margin-right: 6px;
        }

        // iPhone SE 适配
        @media (max-width: 390px) {
          font-size: 14px;
          margin-right: 4px;
        }
      }

      .search-input-field {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-size: 16px;
        color: #333;
        padding: 0 8px;
        // 预留清除按钮 + 间距的空间，防止输入文字后移位
        min-width: 60px;

        &::placeholder {
          color: #999;
        }

        // 移动端字体大小
        @media (max-width: 768px) {
          font-size: 14px;
          padding: 0 4px;
          min-width: 50px;
        }

        // iPhone 16 Pro / 15 Pro (393px) 适配
        @media (max-width: 400px) and (min-width: 390px) {
          font-size: 13px;
          padding: 0 3px;
          min-width: 45px;
        }

        // iPhone SE 适配
        @media (max-width: 390px) {
          font-size: 13px;
          padding: 0 2px 0 4px;
          min-width: 40px;
        }
      }

      .clear-btn {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #f0f0f0;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #999;
        font-size: 14px;
        margin-right: 8px;

        @media (max-width: 768px) {
          width: 20px;
          height: 20px;
          font-size: 12px;
          margin-right: 6px;
        }

        // 小屏幕手机适配
        @media (max-width: 420px) {
          width: 18px;
          height: 18px;
          margin-right: 5px;
          font-size: 11px;
        }

        // iPhone 16 Pro / 15 Pro (393px) 适配
        @media (max-width: 400px) and (min-width: 390px) {
          width: 18px;
          height: 18px;
          margin-right: 4px;
          font-size: 11px;
        }

        // iPhone SE 375x677 适配
        @media (max-width: 390px) {
          width: 17px;
          height: 17px;
          margin-right: 4px;
          font-size: 11px;
        }

        &:hover {
          background: #e0e0e0;
          color: #666;
        }

        &:active {
          transform: scale(0.95);
        }
      }

      .search-btn-inner {
        flex-shrink: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 20px;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: none;
        // 固定宽度，确保清除按钮位置准确
        min-width: 68px;
        text-align: center;

        @media (max-width: 768px) {
          font-size: 14px;
          padding: 6px 12px;
          border-radius: 4px;
          min-width: 58px;
        }

        // 小屏幕手机适配
        @media (max-width: 420px) {
          padding: 6px 10px;
          min-width: 54px;
        }

        // iPhone 16 Pro / 15 Pro (393px) 适配
        @media (max-width: 400px) and (min-width: 390px) {
          padding: 5px 9px;
          font-size: 13px;
          min-width: 52px;
        }

        // iPhone SE 375x677 适配
        @media (max-width: 390px) {
          padding: 5px 8px;
          font-size: 13px;
          min-width: 50px;
        }

        &:hover {
          background: linear-gradient(135deg, #7b8ef0 0%, #8559b8 100%);
          box-shadow: none;
        }

        &:active {
          transform: scale(0.98);
          background: linear-gradient(135deg, #5a6ad8 0%, #6a4190 100%);
        }
      }
    }
  }

  .search-hint {
    text-align: center;
    margin-top: 12px;
    opacity: 0.85;
    font-size: 13px;

    @media (max-width: 768px) {
      font-size: 12px;
      padding: 0 15px;
      line-height: 1.6;
    }
  }

  .quick-brands {
    .label {
      margin-right: 10px;
      opacity: 0.9;
    }

    .brand-tag {
      margin: 5px;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
    }
  }
}

.results-section {
  padding: 40px 20px;
  min-height: 400px;

  // 移动端去除边距
  @media (max-width: 768px) {
    padding: 20px 0;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;

    // 移动端全宽
    @media (max-width: 768px) {
      padding: 0;
      max-width: 100%;
    }
  }

  .loading-container,
  .empty-state,
  .no-results {
    text-align: center;
    padding: 60px 20px;
    color: white;

    .el-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    .empty-icon {
      font-size: 64px;
      display: block;
      margin-bottom: 20px;
    }

    p {
      font-size: 18px;
      opacity: 0.8;
    }
  }

  .results-list {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);

    // 移动端去除内边距和圆角
    @media (max-width: 768px) {
      padding: 0;
      border-radius: 0;
      box-shadow: none;
    }

  .results-header {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
    flex-wrap: wrap;

    // 移动端头部样式
    @media (max-width: 768px) {
      margin: 0;
      padding: 12px;
      background: #f5f7fa;
      border-bottom: 1px solid #ddd;
      gap: 8px;
    }

    // 小尺寸响应式
    @media (max-width: 480px) {
      gap: 6px;
      padding: 10px 8px;
    }

    @media (max-width: 380px) {
      gap: 4px;
      padding: 8px 6px;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      color: #333;

      @media (max-width: 768px) {
        font-size: 16px;
      }

      @media (max-width: 480px) {
        font-size: 14px;
      }

      @media (max-width: 380px) {
        font-size: 13px;
      }
    }

    .hot-badge {
      font-size: 12px;
      font-weight: bold;
      padding: 0 6px;
      height: 20px;
      line-height: 20px;
      border-radius: 4px;
      animation: pulse 2s infinite;

      @media (max-width: 768px) {
        font-size: 10px;
        height: 18px;
        line-height: 18px;
        padding: 0 4px;
      }

      @media (max-width: 480px) {
        font-size: 9px;
        height: 16px;
        line-height: 16px;
        padding: 0 3px;
      }

      @media (max-width: 380px) {
        font-size: 8px;
        height: 14px;
        line-height: 14px;
        padding: 0 2px;
      }
    }

    .count {
      color: #909399;
      font-size: 14px;

      @media (max-width: 768px) {
        font-size: 12px;
      }

      @media (max-width: 480px) {
        font-size: 11px;
      }

      @media (max-width: 380px) {
        font-size: 10px;
      }
    }
  }

  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;

    // 移动端负边距让表格靠边
    @media (max-width: 768px) {
      margin: 0;
      width: 100%;
    }

    :deep(.el-table) {
      font-size: 13px;

      // 移动端去除表格边框圆角
      @media (max-width: 768px) {
        border-radius: 0;
        border-left: none;
        border-right: none;
      }

      .el-table__header th {
        padding: 8px 5px;
        font-size: 13px;

        @media (max-width: 768px) {
          padding: 8px 4px;
          font-size: 12px;
        }

        @media (max-width: 480px) {
          padding: 6px 3px;
          font-size: 11px;
        }

        @media (max-width: 380px) {
          padding: 5px 2px;
          font-size: 10px;
        }
      }

      .el-table__body td {
        padding: 8px 5px;

        @media (max-width: 768px) {
          padding: 8px 4px;
        }

        @media (max-width: 480px) {
          padding: 6px 3px;
        }

        @media (max-width: 380px) {
          padding: 5px 2px;
        }
      }

      // 移动端优化
      @media (max-width: 768px) {
        font-size: 12px;

        .el-table__body-wrapper {
          overflow-x: visible;
        }

        .el-table__cell {
          padding: 8px 4px;
        }
      }

      @media (max-width: 480px) {
        font-size: 11px;

        .el-table__cell {
          padding: 6px 3px;
        }
      }

      @media (max-width: 380px) {
        font-size: 10px;

        .el-table__cell {
          padding: 5px 2px;
        }
      }
    }
  }

  .price {
    font-weight: bold;

    &.wholesale {
      color: #67c23a;
    }
  }
}
}

.footer {
  text-align: center;
  padding: 30px 20px;
  color: rgba(255, 255, 255, 0.8);

  p {
    margin: 5px 0;
    font-size: 14px;
  }

  .copyright {
    opacity: 0.6;
  }
}

.notice-section {
  padding: 20px 20px 30px;

  .container {
    max-width: 1000px;
    margin: 0 auto;

    @media (max-width: 768px) {
      padding: 0;
      max-width: 100%;
    }

    // 按钮容器
    .action-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      align-items: center;

      @media (max-width: 768px) {
        flex-direction: column;
        gap: 12px;
        padding: 0 12px;
      }
    }

    // 保存图片按钮
    .download-trigger-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex: 1;
      max-width: 400px;
      padding: 14px 24px;
      background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3);

      @media (max-width: 768px) {
        max-width: 100%;
        width: 100%;
        padding: 12px 20px;
        font-size: 14px;
        border-radius: 8px;
      }

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #5daf34 0%, #73c24f 100%);
        box-shadow: 0 6px 16px rgba(103, 194, 58, 0.4);
        transform: translateY(-2px);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-content {
        display: flex;
        align-items: center;
        gap: 8px;

        .btn-icon {
          width: 20px;
          height: 20px;

          @media (max-width: 768px) {
            width: 18px;
            height: 18px;
          }

          &.loading-spinner {
            animation: spin 1s linear infinite;
          }
        }

        .btn-text {
          font-size: 16px;
          font-weight: 600;

          @media (max-width: 768px) {
            font-size: 14px;
          }
        }
      }
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

// 结果列表中的联系电话卡片
.results-list {
  .contact-card {
    margin-top: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 20px;

    @media (max-width: 768px) {
      margin-top: 0;
      padding: 16px;
      border-radius: 0;
    }

    @media (max-width: 480px) {
      padding: 12px;
    }

    @media (max-width: 380px) {
      padding: 10px;
    }

    .contact-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;

      @media (max-width: 480px) {
        margin-bottom: 12px;
        gap: 8px;
      }

      @media (max-width: 380px) {
        margin-bottom: 10px;
        gap: 6px;
      }

      .contact-icon {
        font-size: 22px;

        @media (max-width: 768px) {
          font-size: 18px;
        }

        @media (max-width: 480px) {
          font-size: 16px;
        }

        @media (max-width: 380px) {
          font-size: 14px;
        }
      }

      .contact-title {
        font-size: 16px;
        font-weight: bold;
        color: white;

        @media (max-width: 768px) {
          font-size: 14px;
        }

        @media (max-width: 480px) {
          font-size: 13px;
        }

        @media (max-width: 380px) {
          font-size: 12px;
        }
      }
    }

    .contact-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;

      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      @media (max-width: 480px) {
        gap: 6px;
      }

      @media (max-width: 380px) {
        gap: 4px;
      }

      .contact-link {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 14px 16px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 10px;
        text-decoration: none;
        transition: all 0.3s ease;
        text-align: center;

        @media (max-width: 768px) {
          padding: 12px 8px;
          border-radius: 8px;
        }

        @media (max-width: 480px) {
          padding: 10px 6px;
          border-radius: 6px;
        }

        @media (max-width: 380px) {
          padding: 8px 4px;
          border-radius: 4px;
        }

        &:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
        }

        &:active {
          transform: scale(0.98);
        }

        .contact-name {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 6px;
          font-weight: 500;

          @media (max-width: 768px) {
            font-size: 13px;
            margin-bottom: 4px;
          }

          @media (max-width: 480px) {
            font-size: 12px;
            margin-bottom: 3px;
          }

          @media (max-width: 380px) {
            font-size: 11px;
            margin-bottom: 2px;
          }
        }

        .contact-number {
          font-size: 16px;
          font-weight: bold;
          color: white;
          letter-spacing: 0.5px;

          @media (max-width: 768px) {
            font-size: 14px;
          }

          @media (max-width: 480px) {
            font-size: 13px;
          }

          @media (max-width: 380px) {
            font-size: 12px;
          }
        }
      }
    }
  }
}

</style>

<style lang="scss">
// 图片水印样式 - 表格内斜向随机位置
.image-watermark {
  pointer-events: none;

  .watermark-item {
    position: absolute;
    opacity: 0;
    z-index: 5;
    transform-origin: center;

    .watermark-text {
      display: inline-block;
      font-size: 14px;
      font-weight: 700;
      color: rgba(220, 38, 38, 0.15);
      white-space: nowrap;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.05);
    }
  }
}

// 生成图片时使用手机响应式样式
.results-list.generating-image {
  width: 100% !important;
  min-width: 375px !important;
  max-width: 430px !important;
  padding: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: white !important;
  position: relative !important;

  .results-header {
    padding: 12px !important;
    background: #f5f7fa !important;
    flex-wrap: wrap !important;
    border-bottom: 1px solid #ddd !important;
    border-radius: 0 !important;
    margin-bottom: 0 !important;
    justify-content: space-between !important;
    gap: 8px !important;

    h2 {
      font-size: 14px !important;
    }

    .count {
      font-size: 11px !important;
    }

    .hot-badge {
      font-size: 9px !important;
      height: 16px !important;
      line-height: 16px !important;
      padding: 0 3px !important;
    }
  }

  // 显示水印
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
      width: 100% !important;
      font-size: 12px !important;
      border-radius: 0 !important;
      border-left: none !important;
      border-right: none !important;
      display: table !important;

      .el-table__header-wrapper,
      .el-table__body-wrapper {
        overflow-x: visible !important;
      }

      .el-table__header th {
        padding: 8px 4px !important;
        font-size: 12px !important;
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

      // 确保所有列都显示
      .el-table__header,
      .el-table__body {
        width: 100% !important;
        display: table-header-group !important;
      }

      .el-table__body tr {
        display: table-row !important;
      }

      table {
        width: 100% !important;
        display: table !important;
        table-layout: fixed !important;
      }

      colgroup {
        display: table-column-group !important;
      }

      col {
        display: table-column !important;
      }

      // 品牌列
      col:nth-child(1) {
        width: 15% !important;
        min-width: 50px !important;
      }

      // 型号列
      col:nth-child(2) {
        width: 25% !important;
        min-width: 80px !important;
      }

      // 颜色列
      col:nth-child(3) {
        width: 15% !important;
        min-width: 45px !important;
      }

      // 内存列
      col:nth-child(4) {
        width: 15% !important;
        min-width: 50px !important;
      }

      // 价格列
      col:nth-child(5) {
        width: 20% !important;
        min-width: 60px !important;
      }

      // 确保表格内容不换行但完整显示
      .el-table__body-wrapper {
        overflow: visible !important;
      }

      // 确保所有单元格内容可见
      .cell {
        overflow: visible !important;
        text-overflow: clip !important;
      }
    }
  }

  .contact-card {
    margin-top: 0 !important;
    margin-bottom: 0 !important;
    padding: 10px 12px !important;
    padding-bottom: 8px !important;
    border-radius: 0 !important;

    .contact-header {
      margin-bottom: 6px !important;
      gap: 6px !important;

      .contact-icon {
        font-size: 14px !important;
      }

      .contact-title {
        font-size: 12px !important;
      }
    }

    .contact-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 5px !important;

      .contact-link {
        padding: 8px 5px !important;
        border-radius: 4px !important;

        .contact-name {
          font-size: 11px !important;
        }

        .contact-number {
          font-size: 12px !important;
        }
      }
    }
  }
}
</style>
