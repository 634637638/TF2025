<template>
  <MobileDialog
    :model-value="visible"
    width="760px"
    dialog-class="optimized-scanner-dialog"
    :show-close="false"
    :show-default-footer="false"
    @update:modelValue="emit('update:visible', $event)"
    @close="handleCancel"
  >
    <template #header>
      <div class="scanner-dialog-header">
        <h3>
          <i class="fas fa-qrcode"></i>
          {{ title }} {{ phone?.brand ? `(${phone.brand})` : '' }}
        </h3>
        <button class="scanner-close" @click="handleCancel" title="关闭">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </template>

    <div class="scanner-body">
      <div class="video-container">
        <video
          ref="videoRef"
          id="scan-video"
          class="scan-video"
          :style="videoStyle"
        ></video>

        <div v-if="lastScannedText" class="scan-result-display">
          <div class="result-label">
            <i class="fas fa-check-circle"></i>
            {{ title }}已识别：
          </div>
          <div class="result-value">
            {{ lastScannedText }}
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="scanner-dialog-footer">
        <div class="btn-group center">
          <button v-if="hasFlash" class="btn btn-info" @click="toggleFlash" :class="{ active: flashOn }">
            <i :class="flashOn ? 'fas fa-lightbulb' : 'far fa-lightbulb'"></i>
            <span>{{ flashOn ? '关闭闪光灯' : '开启闪光灯' }}</span>
          </button>
          <button class="btn btn-danger" @click="handleCancel">
            <i class="fas fa-times"></i>
            <span>取消扫码</span>
          </button>
        </div>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch, type CSSProperties } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { scanOptimizer, type DeviceInfo } from '@/utils/scanOptimizer'
import type { CancelEmits, UpdateVisibleEmits, VisibleProps } from '@/types/component'

interface ScannerPhone {
  brand?: string
}

interface ScannerErrorLike {
  name?: string
  message?: string
}

interface ScannerDecodeResult {
  text?: string
  getText?: () => string
}

interface ScannerTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean
}

interface ScannerTrackConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean
}

interface ScannerMediaTrack extends MediaStreamTrack {
  getCapabilities?: () => ScannerTrackCapabilities
  applyConstraints: (
    constraints?: MediaTrackConstraints & { advanced?: ScannerTrackConstraintSet[] }
  ) => Promise<void>
}

interface ScannerCodeReader {
  reset: () => void
  decodeFromVideoDevice: (
    deviceId: string | undefined,
    videoElement: HTMLVideoElement,
    callback: (result: ScannerDecodeResult | null, error: ScannerErrorLike | null) => void
  ) => Promise<void>
}

interface Props extends VisibleProps {
  scanType: 'imei' | 'serial'
  phone?: ScannerPhone
  showROIDisplay?: boolean
  enableAndroidOptimization?: boolean
  showPerformance?: boolean
}

interface Emits extends UpdateVisibleEmits, CancelEmits {
  success: [value: string]
  manual: []
}

const props = withDefaults(defineProps<Props>(), {
  showROIDisplay: true,
  enableAndroidOptimization: true,
  showPerformance: false
})

const emit = defineEmits<Emits>()

// 响应式数据
const videoRef = ref<HTMLVideoElement>()
const deviceInfo = ref<DeviceInfo>({} as DeviceInfo)
const smartTips = ref<string[]>([])
const flashOn = ref(false)
const hasFlash = ref(false)
const scanCompleted = ref(false)
const lastScannedText = ref('')
const lastScanTime = ref(0)

// 计算属性
const title = computed(() => {
  return props.scanType === 'imei' ? '扫码IMEI号' : '扫码序列号'
})

const videoStyle = computed(() => {
  const style: CSSProperties = {}

  // 应用安卓优化样式
  if (deviceInfo.value.isAndroid) {
    const optimization = scanOptimizer.getAndroidOptimization(deviceInfo.value)
    if (optimization.enableContrastBoost) {
      style.filter = 'contrast(1.2) brightness(1.1) saturate(1.1)'
    } else if (optimization.brightnessBoost) {
      style.filter = 'brightness(1.2) contrast(1.1)'
    }
    // 移除镜像效果，保持正常显示
    // style.transform = 'scaleX(-1)'
  }

  style.objectFit = 'cover'
  style.willChange = 'transform'
  // 明确设置不使用镜像
  style.transform = 'none'

  return style
})

// 计算开发模式
const isDevMode = computed(() => import.meta.env.DEV)

// 摄像头和解码器实例
let codeReader: ScannerCodeReader | null = null
let stream: MediaStream | null = null
let cameraId: string | undefined = undefined

// 静态变量用于记录最后输出时间
let lastNotFoundLog: number = 0

const getScannerErrorMessage = (error: unknown, fallback = '未知错误'): string => {
  if (error instanceof Error) {
    return error.message || fallback
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as ScannerErrorLike).message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  return fallback
}

const getScannerErrorName = (error: unknown): string => {
  if (error instanceof Error) {
    return error.name
  }

  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = (error as ScannerErrorLike).name
    return typeof name === 'string' ? name : ''
  }

  return ''
}

// IMEI校验函数（Luhn算法）
const validateIMEI = (imei: string): boolean => {
  if (!/^\d{15}$/.test(imei)) return false

  let sum = 0
  let doubleDigit = false

  for (let i = imei.length - 1; i >= 0; i--) {
    let digit = parseInt(imei[i])

    if (doubleDigit) {
      digit *= 2
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10)
      }
    }

    sum += digit
    doubleDigit = !doubleDigit
  }

  return sum % 10 === 0
}

// 监听可见性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    startScanning()
  } else {
    stopScanning()
  }
})

// 开始扫码
const startScanning = async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      ElMessage.error('当前浏览器不支持摄像头功能')
      handleCancel()
      return
    }

    // 检查HTTPS环境
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      ElMessage.error('摄像头访问需要HTTPS环境，请使用https://访问或在localhost环境中使用')
      handleCancel()
      return
    }

    // 检测设备信息
    deviceInfo.value = scanOptimizer.detectDevice()

    // 生成智能提示
    smartTips.value = scanOptimizer.generateSmartTips(props.phone, props.scanType, deviceInfo.value)

    // 开始性能监控
    scanOptimizer.startPerformanceMonitoring()

    // 动态导入ZXing库
    const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library')

    // 生成解码器配置
    const scanConfig = scanOptimizer.generateZXingHints(props.scanType, deviceInfo.value)

    // 精准识别IMEI1和序列号的超强化配置
    const hints = new Map()

    // 启用最强识别模式
    hints.set(DecodeHintType.TRY_HARDER, true) // 强制启用更多识别算法
    hints.set(DecodeHintType.PURE_BARCODE, false) // 保留图像上下文，提高识别率
    hints.set(DecodeHintType.ASSUME_CODE_39_CHECK_DIGIT, false) // 不假设校验位
    hints.set(DecodeHintType.ENABLE_CODE_39_EXTENDED_MODE, true) // 启用扩展模式

    // 针对IMEI条形码精准优化 - 只支持最常见的IMEI格式
    if (props.scanType === 'imei') {
      // IMEI码只使用最常见的格式，避免干扰
      const formats = [
        BarcodeFormat.CODE_128, // IMEI最常用的格式
        BarcodeFormat.CODE_39,  // 部分旧包装使用的格式
        BarcodeFormat.EAN_13    // 欧洲标准商品码格式
      ]
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats)
    } else {
      // SN序列号精准识别 - 支持二维码和条形码，但优先QR码
      const formats = [
        BarcodeFormat.QR_CODE,    // SN码最常用的二维码格式
        BarcodeFormat.CODE_128,   // 条形码格式
        BarcodeFormat.CODE_39,    // 简单条形码
        BarcodeFormat.DATA_MATRIX // 数据矩阵码
      ]
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats)
    }

    // 字符编码和校验优化
    hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8')
    hints.set(DecodeHintType.ASSUME_GS1, false) // 不使用GS1标准

    // 如果是安卓设备，添加更多优化
    if (deviceInfo.value.isAndroid) {
      // 安卓优化
    }

    codeReader = new BrowserMultiFormatReader(hints) as ScannerCodeReader

    // 获取优化的摄像头配置
    const cameraConfig = scanOptimizer.generateCameraConfig(deviceInfo.value)

    // 获取最优摄像头设备ID
    cameraId = await scanOptimizer.getOptimalCameraId(codeReader, deviceInfo.value)

    // 获取视频流 - 添加详细的权限检查
    try {
      // 先检查权限状态（如果支持）
      try {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName })

        if (permission.state === 'denied') {
          throw new Error('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头')
        }
      } catch (permQueryError) {
        // 某些浏览器不支持权限查询，直接尝试获取摄像头
      }

      // 获取视频流
      stream = await navigator.mediaDevices.getUserMedia(cameraConfig)
    } catch (permError: unknown) {
      const permissionErrorName = getScannerErrorName(permError)
      const permissionErrorMessage = getScannerErrorMessage(permError)

      if (permissionErrorName === 'NotAllowedError') {
        throw new Error('摄像头权限被拒绝，请点击地址栏左侧的摄像头图标并选择"允许"')
      } else if (permissionErrorName === 'NotFoundError') {
        throw new Error('未检测到摄像头设备，请确保设备有可用的摄像头')
      } else if (permissionErrorName === 'NotSupportedError') {
        throw new Error('当前浏览器不支持摄像头访问，请使用Chrome、Firefox或Safari浏览器')
      } else if (permissionErrorName === 'NotReadableError') {
        throw new Error('摄像头被其他应用占用，请关闭其他使用摄像头的应用后重试')
      } else if (permissionErrorName === 'TypeError') {
        // 尝试使用更简单的配置
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: 'environment' }
          })
        } catch (_fallbackError: unknown) {
          throw new Error(`摄像头访问失败: ${permissionErrorMessage || '未知错误'}`)
        }
      } else {
        throw new Error(`摄像头访问失败: ${permissionErrorMessage || '未知错误'}`)
      }
    }

    if (videoRef.value) {
      videoRef.value.srcObject = stream

      // iOS 特殊处理：确保视频能正常播放
      if (deviceInfo.value.isIOS) {
        videoRef.value.setAttribute('playsinline', 'true')
        videoRef.value.setAttribute('webkit-playsinline', 'true')
        videoRef.value.muted = true // iOS可能要求静音才能自动播放

        // iOS 13+ 需要用户交互才能播放视频
        document.addEventListener('click', function playVideo() {
          videoRef.value?.play().catch((_e) => {
            // 视频播放需要用户交互
          })
          document.removeEventListener('click', playVideo)
        }, { once: true })
      }

      // 检查视频是否已经在播放，避免重复播放
      if (videoRef.value.paused) {
        try {
          await videoRef.value.play()
        } catch (playError) {
          // 视频播放失败，可能需要用户交互
        }
      }

      // 应用安卓视频优化
      if (deviceInfo.value.isAndroid && props.enableAndroidOptimization) {
        scanOptimizer.applyAndroidVideoOptimizations(videoRef.value, deviceInfo.value)
      }

      // 检查闪光灯支持
      const videoTrack = stream.getVideoTracks()[0] as ScannerMediaTrack
      const capabilities = videoTrack.getCapabilities?.()
      hasFlash.value = capabilities?.torch || false


      // 开始解码
      await startDecoding()
    }

  } catch (error) {
    // 显示具体的错误信息
    const errorMessage = getScannerErrorMessage(error)

    // 移动端提供更多选项
    if (deviceInfo.value.isAndroid || deviceInfo.value.isIOS) {
      ElMessageBox.alert(
        `摄像头启动失败：${errorMessage}\n\n建议：\n1. 检查浏览器权限设置\n2. 确保没有其他应用使用摄像头\n3. 尝试使用手动输入功能`,
        '扫码失败',
        {
          confirmButtonText: '确定',
          type: 'warning'
        }
      ).then(() => {
        // 确保关闭扫码器
        handleCancel()
      }).catch(() => {
        handleCancel()
      })
    } else {
      ElMessage.error(`启动摄像头失败：${errorMessage}`)
      setTimeout(() => {
        handleCancel()
      }, 2000)
    }
  }
}

// 开始解码 - 精准识别模式
const startDecoding = async () => {
  if (!videoRef.value || !codeReader) return

  const scanCallback = (result: ScannerDecodeResult | null, error: ScannerErrorLike | null) => {
    if (scanCompleted.value) return

    if (result) {
      const scannedText = (typeof result.getText === 'function' ? result.getText() : result.text || '').trim()
      const currentTime = Date.now()

      // 精准防抖：避免重复处理相同结果，增加防抖时间
      if (scannedText === lastScannedText.value && currentTime - lastScanTime.value < 2000) {
        return
      }

      // 实时显示扫描到的原始数据
      lastScannedText.value = scannedText
      lastScanTime.value = currentTime

      // 预处理：快速判断是否可能是有效结果
      if (!quickValidateResult(scannedText)) {
        return // 快速过滤明显无效的结果
      }

      // 处理扫码结果
      handleScanResult(scannedText)

    } else if (error && error.name !== 'NotFoundException' && error.name !== 'NotFoundException2') {
      // 只记录非NotFoundException错误
    } else if (isDevMode.value && error.name === 'NotFoundException') {
      // 开发模式下每5秒输出一次扫描状态
      const now = Date.now()
      if (!lastNotFoundLog || now - lastNotFoundLog > 5000) {
        lastNotFoundLog = now
      }
    }
  }

  try {
    // 使用指定的摄像头ID进行解码
    await codeReader.decodeFromVideoDevice(cameraId, videoRef.value, scanCallback)
  } catch (error) {
    // 如果指定摄像头失败，尝试使用默认摄像头
    try {
      await codeReader.decodeFromVideoDevice(undefined, videoRef.value, scanCallback)
    } catch (fallbackError) {
      ElMessage.error('无法启动摄像头，请检查设备权限')
    }
  }
}

// 快速验证扫码结果 - 提高识别精准度
const quickValidateResult = (scannedText: string): boolean => {
  if (!scannedText || scannedText.length < 6) return false

  if (props.scanType === 'imei') {
    // IMEI快速验证：是否包含15位数字
    return /\d{15}/.test(scannedText)
  } else {
    // SN序列号快速验证：支持苹果和国产机格式
    // 苹果格式检测：(S)serial No. XXX
    const applePattern = /\(S\)\s*serial\s*No\.?\s*[A-Za-z0-9]{8,}/i
    // 国产机格式检测：SN XXX
    const snPattern = /^(?:SN|S\/N|序列号)\s*[A-Za-z0-9-]{8,}/i

    return (
      applePattern.test(scannedText) ||
      snPattern.test(scannedText) ||
      (scannedText.length >= 8 && scannedText.length <= 50 && /[A-Za-z0-9]/.test(scannedText))
    )
  }
}

// 处理扫码结果 - 精准识别模式
const handleScanResult = async (scannedText: string) => {
  try {
    let finalResult = ''

    // 根据类型验证和处理结果
    if (props.scanType === 'imei') {
      // IMEI1精准识别算法
      let imei = ''

      // 精准匹配15位连续数字（IMEI标准格式）
      const imeiMatch = scannedText.match(/\b\d{15}\b/)
      if (imeiMatch) {
        imei = imeiMatch[0]
      } else {
        // 尝试从复杂字符串中提取15位数字
        const allNumbers = scannedText.match(/\d+/g)
        if (allNumbers) {
          for (const num of allNumbers) {
            if (num.length === 15) {
              imei = num
              break
            }
          }
        }

        // 如果还没找到，尝试提取连续数字
        if (!imei) {
          const digits = scannedText.replace(/\D/g, '')
          if (digits.length >= 15) {
            imei = digits.substring(0, 15)
          }
        }
      }

      // IMEI格式验证
      if (imei && /^\d{15}$/.test(imei)) {
        // 简单IMEI校验位验证（Luhn算法）
        const isValidIMEI = validateIMEI(imei)
        if (isValidIMEI || imei.startsWith('35') || imei.startsWith('49') || imei.startsWith('86') || imei.startsWith('01')) {
          finalResult = imei
        } else {
          finalResult = imei
        }
      } else {
        throw new Error('未能识别到有效的15位IMEI号，请确保对准包装盒上的IMEI条形码')
      }
    } else {
      // SN序列号精准识别算法 - 支持苹果和国产机格式
      let serial = scannedText.trim()

      // 专门处理苹果包装格式: (S)serial No.HN9FJYN74D
      const appleMatch = serial.match(/\(S\)\s*serial\s*No\.?\s*([A-Za-z0-9]+)/i)
      if (appleMatch) {
        serial = appleMatch[1]
      } else {
        // 处理国产机格式: SN 后面直接跟序列号
        const snMatch = serial.match(/^(?:SN|S\/N|序列号)\s*([A-Za-z0-9-]+)/i)
        if (snMatch) {
          serial = snMatch[1]
        } else {
          // 通用前缀移除（更精准的匹配）
          serial = serial.replace(/^(?:SN|S\/N|序列号|Serial[:：]?\s*)/i, '')
          serial = serial.replace(/^[sS][nN]?[:：]?\s*/, '')
          serial = serial.replace(/^Serial[:：]?\s*/i, '')
          serial = serial.replace(/^\(S\)\s*serial\s*No\.?\s*/i, '')

          // 移除前后空格和特殊符号
          serial = serial.trim()

          // 移除常见的干扰字符，但保留有效的SN字符（字母数字连字符）
          serial = serial.replace(/[^A-Za-z0-9-]/g, '')
        }
      }

      // 最终验证和清理
      serial = serial.toUpperCase() // 统一转换为大写
      serial = serial.replace(/^0+/, '') // 移除前导零
      serial = serial.replace(/-+/g, '-') // 合并多个连字符
      serial = serial.replace(/^-|-$/g, '') // 移除首尾连字符

      // SN序列号格式验证
      if (serial.length >= 8 && serial.length <= 20) {
        // 检查是否包含有效字符（至少包含字母或数字）
        if (/[A-Za-z0-9]/.test(serial)) {
          finalResult = serial
        } else {
          throw new Error('SN序列号格式无效，请确保扫描正确的SN码')
        }
      } else {
        throw new Error(`SN序列号长度不正确(${serial.length}位)，通常为8-20位字符，请对准包装盒上的SN码`)
      }
    }

    // 更新显示的识别结果
    lastScannedText.value = finalResult

    // 发送成功事件
    emit('success', finalResult)
    ElMessage.success(`✅ ${props.scanType === 'imei' ? 'IMEI' : '序列号'}识别成功: ${finalResult}`)

    // 延迟关闭
    setTimeout(() => {
      emit('update:visible', false)
    }, 2000) // 增加延迟让用户看到识别结果

  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '扫码结果处理失败')

    // 重置状态继续扫码
    scanCompleted.value = false
  }
}


// 切换闪光灯
const toggleFlash = async () => {
  if (!stream || !hasFlash.value) return

  try {
    const videoTrack = stream.getVideoTracks()[0] as ScannerMediaTrack
    const capabilities = videoTrack.getCapabilities?.()

    if (capabilities.torch) {
      flashOn.value = !flashOn.value
      await videoTrack.applyConstraints({
        advanced: [{ torch: flashOn.value }]
      })

      ElMessage.info(flashOn.value ? '闪光灯已开启' : '闪光灯已关闭')
    }
  } catch (error) {
    ElMessage.error('闪光灯切换失败')
  }
}







// 取消扫码
const handleCancel = () => {
  // 立即标记为已完成以停止扫码循环
  scanCompleted.value = true

  
  // 延迟触发取消事件，让用户看到反馈
  setTimeout(() => {
    emit('cancel')
  }, 300)
}

// 停止扫码
const stopScanning = () => {
  scanCompleted.value = true

  // 停止视频流
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop()
      track.enabled = false
    })
    stream = null
  }

  // 重置视频源和状态
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.srcObject = null
  }

  // 重置解码器
  if (codeReader) {
    codeReader.reset()
    codeReader = null
  }

  // 关闭闪光灯
  if (flashOn.value) {
    flashOn.value = false
  }
}

// 组件卸载时清理
onBeforeUnmount(() => {
  stopScanning()
})
</script>

<style lang="scss">
.optimized-scanner-dialog .el-dialog {
  margin: auto !important;
  width: min(760px, calc(100vw - 32px)) !important;
  max-width: calc(100vw - 32px) !important;
  border-radius: 24px !important;
  overflow: hidden;
}

.optimized-scanner-dialog .el-dialog__header {
  padding: 0 !important;
  margin-right: 0 !important;
  border-bottom: 0 !important;
}

.optimized-scanner-dialog .el-dialog__body,
.optimized-scanner-dialog .el-dialog__footer {
  padding: 0 !important;
}

@media (max-width: 767px) {
  .optimized-scanner-dialog .el-dialog {
    width: calc(100vw - 8px) !important;
    max-width: calc(100vw - 8px) !important;
    border-radius: 18px !important;
  }
}
</style>

<style lang="scss" scoped>
/* 导入统一模态框样式 */
@use '@/assets/css/modal-styles.scss' as *;

.scanner-dialog-header {
  background: linear-gradient(135deg, #6d28d9 0%, #8b5cf6 48%, #ec4899 100%);
  color: #ffffff;
  padding: 20px 24px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 700;
  }
}

.scanner-close {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.24);
  }
}

.scanner-dialog-footer {
  padding: 18px 24px 24px;
  background: linear-gradient(180deg, #ffffff 0%, #faf7ff 100%);
}

/* 扫码器特有的样式 */
.scanner-body {
  padding: 0;
  display: flex;
  flex-direction: column;
}

.video-container {
  position: relative;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 350px;
  width: 100%;
  cursor: crosshair;
}

.scan-video {
  width: 100%;
  max-width: 400px;
  height: auto;
  max-height: 300px;
  border: 2px solid #409eff;
  border-radius: 12px;
  background: #000;
  /* 确保不使用镜像 */
  transform: none !important;
  object-fit: contain;
}

/* 实时识别结果显示 */
.scan-result-display {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  background: linear-gradient(135deg, rgba(40, 167, 69, 0.95), rgba(32, 201, 151, 0.95));
  color: white;
  padding: 16px 20px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.2);
  animation: slideUp 0.3s ease-out;
  z-index: 10;
}

.result-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  opacity: 0.95;
}

.result-label i {
  color: #ffffff;
  font-size: 16px;
}

.result-value {
  font-size: 18px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
  word-break: break-all;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  line-height: 1.4;
}

/* 滑入动画 */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 点击聚焦动画 */
@keyframes focusClick {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
  }
}


.smart-tips {
  padding: 16px 24px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;

  .tip-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    color: #495057;
    line-height: 1.4;

    &:last-child {
      margin-bottom: 0;
    }

    i {
      color: #28a745;
      margin-top: 2px;
      font-size: 12px;
      flex-shrink: 0;
    }
  }
}

.operation-hints {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 12px 24px;
  background: #e3f2fd;
  border-top: 1px solid #bbdefb;

  .hint-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #1565c0;
    font-weight: 500;

    i {
      font-size: 11px;
    }
  }
}


.performance-monitor {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-family: monospace;
  backdrop-filter: blur(4px);

  .perf-item {
    margin-bottom: 2px;

    &:last-child {
      margin-bottom: 0;
    }
  }
}

.btn.btn-outline-primary {
  background: transparent;
  color: #409eff;
  border: 1px solid #409eff;

  &:hover {
    background: rgba(64, 158, 255, 0.1);
  }

  &.active {
    background: #409eff;
    color: white;
  }
}

.btn.btn-outline-info {
  background: transparent;
  color: #909399;
  border: 1px solid #909399;

  &:hover {
    background: rgba(144, 147, 153, 0.1);
  }

  &.active {
    background: #909399;
    color: white;
  }
}

.btn.btn-outline-success {
  background: transparent;
  color: #67c23a;
  border: 1px solid #67c23a;

  &:hover {
    background: rgba(103, 194, 58, 0.1);
  }
}

.btn-group.center {
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

@media (max-width: 767px) {
  .scanner-dialog-header {
    padding: 16px 18px 14px;

    h3 {
      font-size: 16px;
      padding-right: 8px;
    }
  }

  .scanner-close {
    width: 32px;
    height: 32px;
  }

  .scanner-dialog-footer {
    padding: 14px 16px 18px;
  }
}
</style>
