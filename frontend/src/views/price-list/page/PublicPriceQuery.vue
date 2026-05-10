<template>
  <div class="public-price-query">
    <PublicPriceHeader title="最新同城报价">
      <template #search>
        <div class="custom-search-input" :class="{ 'verified': passwordVerified }">
          <el-icon class="search-icon"><Search /></el-icon>
          <input
            v-model="searchKeyword"
            type="text"
            :placeholder="passwordVerified ? `欢迎${verifiedUserName}使用腾飞数码报价系统` : '搜索品牌或型号'"
            class="search-input-field"
            @keyup.enter="handleSearchInput"
          />
          <div v-if="searchKeyword" class="clear-btn" @click="handleClear">
            <el-icon><Close /></el-icon>
          </div>
          <button class="search-btn-inner" @click="handleSearchInput">搜索</button>
        </div>
      </template>

      <template #actions>
        <button class="notice-trigger-btn" @click="showNoticeDialog = true">
          <span class="btn-icon">⚠️</span>
          <span class="btn-text">调货须知</span>
        </button>
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
          <div class="banner-icon">⚠️</div>
          <div class="banner-text">
            <strong>重要提示：</strong>调货前请务必确认并遵守以下规则，避免产生纠纷！
          </div>
        </div>

        <!-- 规则卡片网格 -->
        <div class="rules-grid">
          <!-- 开箱检查 -->
          <div class="rule-card check">
            <div class="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </div>
            <div class="card-content">
              <h4 class="card-title">开箱检查</h4>
              <div class="card-badge">必须</div>
            </div>
            <ul class="card-list">
              <li>全程录像或监控视频</li>
              <li>检查外观完整性</li>
              <li class="alert">无视频证据恕不受理</li>
            </ul>
          </div>

          <!-- 激活限制 -->
          <div class="rule-card activate">
            <div class="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <div class="card-content">
              <h4 class="card-title">激活限制</h4>
              <div class="card-badge danger">严禁</div>
            </div>
            <ul class="card-list">
              <li>仅限分宜本地激活</li>
              <li>禁止跨市区激活</li>
              <li class="highlight">水印相机拍照：串码同框</li>
              <li class="highlight">使用 WI-FI 网络</li>
              <li class="highlight">激活后拨打电话测试</li>
            </ul>
          </div>

          <!-- 结算要求 -->
          <div class="rule-card payment">
            <div class="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
            </div>
            <div class="card-content">
              <h4 class="card-title">结算要求</h4>
              <div class="card-badge warning">当天</div>
            </div>
            <ul class="card-list">
              <li>货款必须当天结清</li>
              <li class="alert">逾期将终止合作</li>
            </ul>
          </div>

          <!-- 保修说明 -->
          <div class="rule-card warranty">
            <div class="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <div class="card-content">
              <h4 class="card-title">保修说明</h4>
              <div class="card-badge success">1年</div>
            </div>
            <ul class="card-list">
              <li>激活后质量问题保修</li>
              <li>以官方售后结论为准</li>
              <li class="note">人为损坏不予保修</li>
              <li class="note">不含发票无保修服务</li>
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
            <h2>最新报价</h2>
            <el-tag class="hot-badge" type="danger" effect="dark">HOT</el-tag>
            <h2>1320-0790-3333</h2>
            <span class="count">共 {{ searchResults.length }} 条</span>
          </div>

          <!-- 水印（仅生成图片时显示） -->
          <div class="image-watermark" v-show="false">
            <div class="watermark-item watermark-1">
              <span class="watermark-text">腾飞数码 132-0790-3333 {{ getCurrentDateTime() }}</span>
            </div>
            <div class="watermark-item watermark-2">
              <span class="watermark-text">腾飞数码 132-0790-3333 {{ getCurrentDateTime() }}</span>
            </div>
            <div class="watermark-item watermark-3">
              <span class="watermark-text">腾飞数码 132-0790-3333 {{ getCurrentDateTime() }}</span>
            </div>
          </div>

          <!-- 表格视图 -->
          <div class="table-wrapper">
            <el-table :data="searchResults" stripe border @row-dblclick="handleRowDoubleClick" @row-click="handleRowClick" style="cursor: pointer;">
              <el-table-column prop="brand_name" label="品牌" min-width="60" />
              <el-table-column prop="model_number" label="型号" min-width="100" />
              <el-table-column prop="color_name" label="颜色" min-width="50" />
              <el-table-column prop="memory" label="内存" min-width="60">
                <template #default="{ row }">
                  <span>{{ row.memory }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="wholesale_price" label="调货价格" min-width="70" align="right">
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

    <!-- 在库查询结果弹窗 -->
    <InventoryResultDialog
      v-model="showInventoryResult"
      :product="selectedProduct"
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
          <img :src="iosImageUrl" alt="腾飞数码报价" />
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
import { getAllPrices, searchPrices } from '@/api/price-list'
import html2canvas from 'html2canvas'
import InventoryResultDialog from '@/components/InventoryResultDialog.vue'
import { PublicPriceHeader } from '@/components/base'
import { unifiedApi } from '@/utils/unified-api'
import { ElMessage } from 'element-plus'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { useLoadingState } from '@/composables'
import { logger } from '@/utils/logger'
// 状态
const { loading } = useLoadingState()
const searchKeyword = ref('')
const searchResults = ref<any[]>([])
const hasSearched = ref(false)
const showNoticeDialog = ref(false)
const isGenerating = ref(false)

// 在库查询相关状态
const passwordVerified = ref(false)
const verifiedUserName = ref('') // 验证成功的用户名
const showInventoryResult = ref(false)
const selectedProduct = ref<{
  brand: string
  model: string
  color: string
  memory: string
}>({
  brand: '',
  model: '',
  color: '',
  memory: ''
})

// 移动端双击检测
let lastTapTime = 0
let lastTapRowIndex = -1

// 加载所有数据
const loadAllData = async () => {
  loading.value = true
  try {
    const res = await getAllPrices()
    if (res.success) {
      searchResults.value = res.data
      hasSearched.value = true
    }
  } catch (error) {
    logger.error('加载数据失败', error)
  } finally {
    loading.value = false
  }
}

// 处理搜索输入（自动检测密码）
const handleSearchInput = async () => {
  const keyword = searchKeyword.value.trim()

  // 先尝试作为密码验证（静默）
  if (!passwordVerified.value && keyword.length > 0) {
    const verified = await verifyInventoryPassword(keyword)
    if (verified) {
      searchKeyword.value = '' // 验证成功后清空输入
      loadAllData() // 重新加载所有数据
      return
    }
    // 如果验证失败，继续作为搜索关键词
  }

  // 正常搜索
  await handleSearch()
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
    const res = await searchPrices(keyword)
    if (res.success) {
      // 后端已经按 show_price 过滤，前端直接使用返回的数据
      searchResults.value = res.data
      hasSearched.value = true

      // 如果没有搜索结果，显示友好提示（和正常搜索行为一致）
      if (searchResults.value.length === 0) {
        ElMessage.warning({
          message: '未检索到相关数据',
          duration: 2000,
          offset: 60
        })
      }
    }
  } catch (error) {
    logger.error('搜索失败', error)
  } finally {
    loading.value = false
  }
}

// 验证在库查询密码（仅使用后端验证）
const verifyInventoryPassword = async (password: string): Promise<boolean> => {
  // 使用后端验证
  try {
    const response = await unifiedApi.post('/screen-lock/verify-inventory-query', {
      password: password
    }, {
      showError: false  // 禁用错误提示，保持静默
    })

    if (response.success) {
      passwordVerified.value = true
      // 从后端返回的用户名
      verifiedUserName.value = response.data?.userName || '用户'
      return true
    } else {
      // 静默失败，作为搜索关键词
      return false
    }
  } catch (error: any) {
    // 完全忽略所有错误，不打印错误日志，不显示任何提示
    // 这样可以让密码验证完全静默，和普通搜索无结果无法区分

    // 如果验证失败，静默返回 false，让输入作为搜索关键词
    return false
  }
}

// 清空
const handleClear = () => {
  searchKeyword.value = ''
  loadAllData()
}

const hasWholesalePrice = (row: any) => {
  const price = row?.display_wholesale_price ?? row?.wholesale_price
  return price !== null && price !== undefined && price !== '' && Number(price) > 0
}

const formatWholesalePrice = (row: any) => {
  const price = Number(row?.display_wholesale_price ?? row?.wholesale_price ?? 0)
  return Math.round(price)
}

// 获取当前日期时间字符串
const getCurrentDateTime = () => {
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

// 检测是否为 iOS 设备
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// iOS 图片保存弹窗状态
const showIOSImageModal = ref(false)
const iosImageUrl = ref('')

// 关闭 iOS 图片弹窗
const closeIOSImageModal = () => {
  showIOSImageModal.value = false
  if (iosImageUrl.value) {
    URL.revokeObjectURL(iosImageUrl.value)
    iosImageUrl.value = ''
  }
}

// 保存图片到相册（兼容 iOS 和 Android）
const saveImageToGallery = async (canvas: HTMLCanvasElement) => {
  const now = TimeUtil.now()
  const dateStr = now.format('YYYYMMDD')
  const timeStr = now.format('HHmm')
  const fileName = `腾飞数码报价_${dateStr}_${timeStr}.png`

  return new Promise<void>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('生成图片失败'))
        return
      }

      // iOS 特殊处理
      if (isIOS()) {
        // iOS：在当前页面显示图片弹窗，用户可以长按保存到相册
        const url = URL.createObjectURL(blob)
        iosImageUrl.value = url
        showIOSImageModal.value = true
        // iOS 显示弹窗提示
        ElMessage.success({
          message: '请长按图片保存到相册',
          duration: 3000
        })
        resolve()
        return
      }

      // Android 和其他平台：尝试使用 Web Share API
      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: '腾飞数码报价',
            text: `报价单 ${dateStr} ${timeStr}`
          })
          // Android 分享成功提示
          ElMessage.success({
            message: '图片已保存',
            duration: 2000
          })
          resolve()
          return
        } catch (shareError) {
          if ((shareError as Error).name !== 'AbortError') {
            // 静默处理
          }
        }
      }

      // 降级方案：使用传统下载方式
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

        // 隐藏水印
        if (watermarkEl) {
          (watermarkEl as HTMLElement).style.display = 'none'
        }

        // 恢复原类名
        element.classList.remove('generating-image')

        // 转换为 blob 并保存
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

    // 转换为 blob 并保存
    await saveImageToGallery(canvas)
  } catch (error) {
    logger.error('生成图片失败', error)
    alert('生成图片失败，请重试')
  } finally {
    isGenerating.value = false
  }
}

// 表格行双击处理
const handleRowDoubleClick = (row: any) => {
  // 只有已验证密码才显示在库信息
  if (passwordVerified.value) {
    showInventoryResultDialog(row)
  }
  // 未验证时不做任何提示，保持静默
}

// 表格行点击处理（支持移动端双击）
const handleRowClick = (row: any, column: any, event: Event) => {
  const currentTime = Date.now()
  const tapInterval = currentTime - lastTapTime

  // 找到当前行的索引
  const rowIndex = searchResults.value.findIndex(r =>
    r.brand_name === row.brand_name &&
    r.model_number === row.model_number &&
    r.color_name === row.color_name &&
    r.memory === row.memory
  )

  // 检测双击（400ms内的两次点击同一行）
  if (tapInterval < 400 && tapInterval > 0 && lastTapRowIndex === rowIndex) {
    if (passwordVerified.value) {
      showInventoryResultDialog(row)
    }
    // 重置
    lastTapTime = 0
    lastTapRowIndex = -1
    event?.stopPropagation()
  } else {
    lastTapTime = currentTime
    lastTapRowIndex = rowIndex
  }
}

// 双击型号处理（保留备用，已废弃）
// 已移除此功能，统一使用表格行双击

// 显示在库查询结果弹窗
const showInventoryResultDialog = (row: any) => {
  selectedProduct.value = {
    brand: row.brand_name,
    model: row.model_number,
    color: row.color_name,
    memory: row.memory
  }
  showInventoryResult.value = true
}

onMounted(() => {
  // 默认加载所有数据
  loadAllData()

  // 防止 Safari 橡皮筋效果导致页面左右移动
  const preventRubberBand = (e: TouchEvent) => {
    const touch = e.touches[0] || e.changedTouches[0]
    if (!touch) return

    const windowWidth = window.innerWidth
    // 如果触摸点在页面边缘10px内，阻止默认行为
    if (touch.clientX <= 10 || touch.clientX >= windowWidth - 10) {
      // 但表格容器内允许水平滑动
      const target = e.target as HTMLElement
      const tableWrapper = target.closest('.table-wrapper')
      if (!tableWrapper) {
        e.preventDefault()
      }
    }
  }

  // 监听触摸事件
  document.addEventListener('touchstart', preventRubberBand, { passive: false })
  document.addEventListener('touchmove', preventRubberBand, { passive: false })

  // 保存清理函数
  window.__priceQueryCleanup = () => {
    document.removeEventListener('touchstart', preventRubberBand)
    document.removeEventListener('touchmove', preventRubberBand)
  }
})

onBeforeUnmount(() => {
  // 清理事件监听器
  if (window.__priceQueryCleanup) {
    window.__priceQueryCleanup()
    delete window.__priceQueryCleanup
  }
})

// 声明全局类型
declare global {
  interface Window {
    __priceQueryCleanup?: () => void
  }
}
</script>

<style scoped lang="scss">
.public-price-query {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  // 防止页面左右移动
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  position: relative;
}

.header-section {
  padding: 60px 20px 40px;
  text-align: center;
  color: white;

  .container {
    max-width: 800px;
    margin: 0 auto;
    // 防止左右移动
    width: 100%;
    overflow-x: hidden;
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

        // 移动端图标大小
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
    // 防止左右移动
    overflow-x: hidden;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;

    // 移动端全宽
    @media (max-width: 768px) {
      padding: 0;
      max-width: 100%;
      // 防止左右移动
      width: 100%;
      overflow-x: hidden;
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
      flex-wrap: nowrap;
      // 防止内容溢出
      min-width: 0;

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
        gap: 4px;
        padding: 8px 6px;
      }

      @media (max-width: 380px) {
        gap: 3px;
        padding: 6px 4px;
      }

      h2 {
        margin: 0;
        font-size: 20px;
        color: #333;
        white-space: nowrap;
        flex-shrink: 0;

        @media (max-width: 768px) {
          font-size: 15px;
        }

        @media (max-width: 480px) {
          font-size: 13px;
        }

        @media (max-width: 380px) {
          font-size: 12px;
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
        white-space: nowrap;
        flex-shrink: 0;

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

    // 下载按钮区域
    .download-section {
      margin-bottom: 16px;
      padding: 0 4px;

      .download-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
        border: none;
        border-radius: 10px;
        color: white;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3);

        @media (max-width: 768px) {
          padding: 10px 20px;
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
          opacity: 0.7;
          cursor: not-allowed;
        }

        .btn-content {
          display: flex;
          align-items: center;
          gap: 8px;

          &.loading {
            .loading-spinner {
              width: 18px;
              height: 18px;
              animation: spin 1s linear infinite;
            }
          }

          .download-icon {
            width: 18px;
            height: 18px;

            @media (max-width: 768px) {
              width: 16px;
              height: 16px;
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
  }

  // 表格包装器
  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;

    // 移动端负边距让表格靠边
    @media (max-width: 768px) {
      margin: 0;
      width: 100%;
      // 允许表格内部水平滚动
      overflow-x: auto;
      overflow-y: hidden;
      // 隐藏滚动条
      -ms-overflow-style: none;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    :deep(.el-table) {
      font-size: 13px;
      // 确保表格不会超出容器
      width: 100%;
      table-layout: auto;

      // 移动端去除表格边框圆角
      @media (max-width: 768px) {
        border-radius: 0;
        border-left: none;
        border-right: none;
        // 表格自动宽度，允许超出容器
        width: auto;
        min-width: 100%;
        table-layout: auto;
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
          // 保持正常显示，不换行
          overflow: visible;
          word-break: normal;
          white-space: nowrap;
        }
      }

      @media (max-width: 480px) {
        font-size: 11px;

        .el-table__cell {
          padding: 6px 3px;
          overflow: visible;
          word-break: normal;
          white-space: nowrap;
        }
      }

      @media (max-width: 380px) {
        font-size: 10px;

        .el-table__cell {
          padding: 5px 2px;
          overflow: visible;
          word-break: normal;
          white-space: nowrap;
        }
      }

      // 确保表格列宽度合理分配
      .el-table__header-wrapper,
      .el-table__body-wrapper {
        width: 100%;
      }

      // 单元格内容防止溢出
      .cell {
        overflow: visible;
        word-break: normal;
        white-space: nowrap;
      }
    }
  }

  .price {
    font-weight: bold;

    &.wholesale {
      color: #67c23a;

      // 有库存且已验证密码时显示红色
      &.has-stock {
        color: #f56c6c; // 红色
        font-weight: 800;
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
      // 防止左右移动
      width: 100%;
      overflow-x: hidden;
    }

    // 按钮容器
    .action-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      align-items: center;

      @media (max-width: 768px) {
        flex-direction: row;
        gap: 10px;
        padding: 0 12px;
      }

      // 小屏幕手机适配
      @media (max-width: 420px) {
        gap: 8px;
        padding: 0 8px;
      }

      // 超小屏幕适配
      @media (max-width: 380px) {
        gap: 6px;
        padding: 0 6px;
      }
    }

    // 调货须知按钮
    .notice-trigger-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      flex: 1;
      max-width: 400px;
      padding: 14px 24px;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

      @media (max-width: 768px) {
        max-width: none;
        flex: 1;
        min-width: 0;
        padding: 10px 12px;
        border-radius: 8px;

        &:hover {
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          transform: none;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        &:active {
          transform: none;
        }
      }

      // 小屏幕手机适配
      @media (max-width: 420px) {
        padding: 9px 10px;
        gap: 6px;
      }

      // 超小屏幕适配
      @media (max-width: 380px) {
        padding: 8px 8px;
        gap: 5px;
      }

      &:hover {
        background: linear-gradient(135deg, #e8ecf1 0%, #b8c5d6 100%);
        transform: translateY(-2px);
        box-shadow: 0 6px 25px rgba(0, 0, 0, 0.15);
      }

      &:active {
        transform: translateY(0);
      }

      .btn-icon {
        font-size: 24px;

        @media (max-width: 768px) {
          font-size: 18px;
        }

        @media (max-width: 420px) {
          font-size: 16px;
        }

        @media (max-width: 380px) {
          font-size: 14px;
        }
      }

      .btn-text {
        font-size: 18px;
        font-weight: bold;
        color: #333;

        @media (max-width: 768px) {
          font-size: 14px;
        }

        @media (max-width: 420px) {
          font-size: 13px;
        }

        @media (max-width: 380px) {
          font-size: 12px;
        }
      }

      .btn-hint {
        font-size: 14px;
        color: #e6a23c;
        font-weight: normal;

        @media (max-width: 768px) {
          font-size: 12px;
        }
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
        max-width: none;
        flex: 1;
        min-width: 0;
        padding: 10px 12px;
        font-size: 14px;
        border-radius: 8px;

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
          box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3);
          transform: none;
        }

        &:active:not(:disabled) {
          transform: none;
        }
      }

      // 小屏幕手机适配
      @media (max-width: 420px) {
        padding: 9px 10px;
        gap: 6px;
      }

      // 超小屏幕适配
      @media (max-width: 380px) {
        padding: 8px 8px;
        gap: 5px;
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
            width: 16px;
            height: 16px;
          }

          @media (max-width: 420px) {
            width: 14px;
            height: 14px;
          }

          @media (max-width: 380px) {
            width: 12px;
            height: 12px;
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

          @media (max-width: 420px) {
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

// 弹窗样式
:deep(.notice-dialog) {
  .el-dialog__body {
    padding: 0;
    max-height: 70vh;
    overflow-y: auto;
  }

  // 移动端适配 - 使用 flex 确保垂直居中
  @media (max-width:  768px) {
    .el-dialog {
      width: 95% !important;
    }

    .el-dialog__body {
      max-height: 75vh;
    }
  }
}

// 弹窗内容样式
.notice-content {
  background: #f8f9fa;
  padding: 0;

  // 警告横幅
  .warning-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
    border-left: 4px solid #ffc107;

    .banner-icon {
      font-size: 18px;
      flex-shrink: 0;
      animation: shake 0.5s ease;
    }

    .banner-text {
      font-size: 14px;
      color: #856404;
      line-height: 1.4;

      strong {
        font-weight: 600;
      }
    }

    @media (max-width: 600px) {
      padding: 12px 15px;
      gap: 8px;

      .banner-icon {
        font-size: 16px;
      }

      .banner-text {
        font-size: 12px;
      }
    }
  }

  // 规则网格
  .rules-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    padding: 20px;

    @media (max-width: 600px) {
      grid-template-columns: 1fr;
      gap: 12px;
      padding: 15px;
    }
  }

  // 规则卡片
  .rule-card {
    background: white;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    border: 2px solid transparent;

    @media (max-width: 600px) {
      padding: 14px;

      &:hover {
        transform: none;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      }
    }

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
    }

    &.check {
      border-color: #409eff;

      .card-icon {
        background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
      }

      .card-badge {
        background: #409eff;
      }
    }

    &.activate {
      border-color: #f56c6c;

      .card-icon {
        background: linear-gradient(135deg, #f56c6c 0%, #f89898 100%);
      }

      .card-badge {
        &.danger {
          background: #f56c6c;
        }
      }
    }

    &.payment {
      border-color: #e6a23c;

      .card-icon {
        background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%);
      }

      .card-badge {
        &.warning {
          background: #e6a23c;
        }
      }
    }

    &.warranty {
      border-color: #67c23a;

      .card-icon {
        background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
      }

      .card-badge {
        &.success {
          background: #67c23a;
        }
      }
    }

    .card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      color: white;

      svg {
        width: 22px;
        height: 22px;
      }
    }

    .card-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      .card-title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }

      .card-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        color: white;
        text-transform: uppercase;
      }
    }

    .card-list {
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        position: relative;
        padding: 4px 0 4px 18px;
        font-size: 13px;
        color: #606266;
        line-height: 1.5;

        &:before {
          content: '•';
          position: absolute;
          left: 0;
          color: #909399;
          font-weight: bold;
        }

        &.alert {
          color: #f56c6c;
          font-weight: 500;

          &:before {
            content: '⚠';
            font-size: 12px;
          }
        }

        &.highlight {
          color: #409eff;
          background: rgba(64, 158, 255, 0.08);
          padding: 4px 8px;
          border-radius: 4px;
          margin-top: 4px;

          &:before {
            content: '✓';
            color: #409eff;
          }
        }

        &.note {
          color: #909399;
          font-size: 12px;
        }
      }
    }
  }

  // 底部提示
  .notice-footer {
    text-align: center;
    padding: 16px 20px;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 0 0 12px 12px;

    p {
      margin: 4px 0;
      font-size: 14px;
      color: #606266;

      &:first-child {
        font-size: 15px;
        font-weight: 500;
        color: #409eff;
      }
    }

    @media (max-width: 600px) {
      padding: 14px 16px;

      p {
        font-size: 12px;

        &:first-child {
          font-size: 13px;
        }
      }
    }
  }
}

@keyframes shake {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-10deg);
  }
  75% {
    transform: rotate(10deg);
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

          &:hover {
            background: rgba(255, 255, 255, 0.15);
            transform: none;
          }

          &:active {
            transform: none;
          }
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

// 搜索框样式
.custom-search-input {
  position: relative;
}

// iOS 图片保存弹窗样式
.ios-image-dialog {
  .el-dialog__body {
    padding: 10px 20px 20px;
  }

  .ios-save-container {
    .success-message {
      text-align: center;
      padding: 12px 20px;
      background: #34c759;
      color: white;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 20px;
    }

    .instructions {
      text-align: center;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 12px;
      margin-bottom: 20px;

      h3 {
        font-size: 16px;
        color: #333;
        margin: 0 0 15px 0;
      }

      p {
        font-size: 13px;
        color: #666;
        line-height: 1.8;
        margin: 5px 0;

        .highlight {
          color: #007aff;
          font-weight: 600;
        }
      }
    }

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
    }
  }
}

@media (max-width: 768px) {
  .ios-image-dialog {
    .el-dialog {
      width: 95% !important;
      margin: 20px auto !important;
    }

    .ios-save-container {
      .instructions {
        padding: 15px;

        h3 {
          font-size: 14px;
        }

        p {
          font-size: 12px;
        }
      }
    }
  }
}

// ========== 防止移动端左右移动 ==========
// 针对Safari浏览器的特殊处理
@media (max-width: 768px) {
  // 页面根元素固定，完全禁止左右移动
  .public-price-query {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    min-width: 100vw;
    max-width: 100vw;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    // 防止 Safari 橡皮筋效果
    touch-action: pan-y pinch-zoom;
  }

  // 确保所有容器不会溢出页面
  .container {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
  }

  // 禁用所有水平滑动，只在表格容器内允许
  * {
    touch-action: pan-y pinch-zoom;
  }

  // 表格包装器内部可以滚动，但不影响页面
  .table-wrapper {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    // 隐藏滚动条但保留滚动功能
    -ms-overflow-style: none;
    scrollbar-width: none;
    // 允许表格内水平滑动
    touch-action: pan-x pan-y pinch-zoom;

    &::-webkit-scrollbar {
      display: none;
    }

    :deep(.el-table) {
      // 表格使用自动布局，列宽自适应内容
      width: auto !important;
      min-width: 100% !important;
      max-width: none !important;
      table-layout: auto !important;

      .el-table__header-wrapper,
      .el-table__body-wrapper {
        overflow-x: auto !important;
        overflow-y: visible !important;
        -ms-overflow-style: none;
        scrollbar-width: none;

        &::-webkit-scrollbar {
          display: none;
        }
      }

      .cell {
        overflow: visible !important;
        word-break: normal !important;
        white-space: nowrap !important;
      }
    }
  }

  // 确保结果区域不溢出
  .results-list {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
  }
}

// iOS Safari 特殊处理
@supports (-webkit-touch-callout: none) {
  .public-price-query {
    // 防止 iOS Safari 的橡皮筋效果导致左右移动
    width: 100vw;
    min-width: 100vw;
    max-width: 100vw;
    overflow-x: hidden;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
}
</style>

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
