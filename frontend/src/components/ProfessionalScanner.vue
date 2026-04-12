<template>
  <!-- 专业扫码组件 -->
  <div v-if="visible" class="scanner-overlay" @click.self="handleCancel">
    <div class="scanner-container">
      <!-- 扫码头部 -->
      <div class="scanner-header">
        <h3 class="scanner-title">
          <i class="fas fa-qrcode"></i>
          {{ title }}
          <span v-if="phone?.brand" class="phone-brand">({{ phone.brand }})</span>
        </h3>
        <div class="header-actions">
          <button
            v-if="hasFlash"
            class="icon-btn flash-btn"
            :class="{ active: flashOn }"
            @click="toggleFlash"
            title="闪光灯"
          >
            <i :class="flashOn ? 'fas fa-lightbulb' : 'far fa-lightbulb'"></i>
          </button>
          <button class="icon-btn close-btn" @click="handleCancel" title="关闭">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 主扫码区域 -->
      <div class="scanner-main">
        <!-- 视频容器 -->
        <div class="video-wrapper" @click="handleVideoClick" @dblclick="handleVideoDoubleClick">
          <video
            ref="videoRef"
            class="scanner-video"
            :style="videoStyle"
            playsinline
            muted
          ></video>

          <!-- 扫描框 -->
          <div class="scan-frame" :class="{ active: isScanning }">
            <div class="scan-corners">
              <div class="corner corner-tl"></div>
              <div class="corner corner-tr"></div>
              <div class="corner corner-br"></div>
              <div class="corner corner-bl"></div>
            </div>
            <div class="scan-line" :class="{ scanning: isScanning }"></div>
          </div>

          <!-- 状态指示器 -->
          <div class="status-overlay">
            <div class="status-item camera-status">
              <i class="fas fa-video"></i>
              <span>{{ cameraStatus }}</span>
            </div>
            <div class="status-item scan-status" :class="statusClass">
              <i :class="statusIcon"></i>
              <span>{{ statusText }}</span>
            </div>
          </div>

          <!-- 设备信息 -->
          <div v-if="deviceInfo.isAndroid" class="device-badge">
            <i class="fab fa-android"></i>
            <span>安卓优化</span>
          </div>
        </div>

        <!-- 控制面板 -->
        <div class="control-panel">
          <div class="control-group">
            <button
              class="control-btn"
              @click="toggleRegion"
              :class="{ active: showRegion }"
            >
              <i class="fas fa-crop-alt"></i>
              <span>扫描框</span>
            </button>
            <button
              class="control-btn"
              @click="toggleAutoFocus"
              :class="{ active: autoFocus }"
            >
              <i class="fas fa-crosshairs"></i>
              <span>自动对焦</span>
            </button>
            <button
              class="control-btn"
              @click="takeSnapshot"
            >
              <i class="fas fa-camera"></i>
              <span>拍照</span>
            </button>
          </div>

          <div class="control-group">
            <button
              class="control-btn manual-btn"
              @click="handleManualInput"
            >
              <i class="fas fa-keyboard"></i>
              <span>手动输入</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 底部信息 -->
      <div class="scanner-footer">
        <!-- 智能提示 -->
        <div v-if="smartTips.length > 0" class="tips-container">
          <div v-for="(tip, index) in smartTips" :key="index" class="tip-item">
            <i class="fas fa-info-circle"></i>
            <span>{{ tip }}</span>
          </div>
        </div>

        <!-- 操作提示 -->
        <div class="action-hints">
          <div class="hint-item">
            <i class="fas fa-mouse-pointer"></i>
            <span>单击聚焦</span>
          </div>
          <div class="hint-item">
            <i class="fas fa-hand-pointer"></i>
            <span>双击取消</span>
          </div>
          <div class="hint-item">
            <i class="fas fa-search-plus"></i>
            <span>双指缩放</span>
          </div>
        </div>

        <!-- 调试信息 -->
        <div v-if="isDevMode" class="debug-panel">
          <div class="debug-item">
            <span>设备: {{ deviceInfo.isAndroid ? 'Android' : deviceInfo.isIOS ? 'iOS' : 'PC' }}</span>
          </div>
          <div class="debug-item">
            <span>格式: {{ props.scanType === 'imei' ? 'IMEI条形码' : '序列号' }}</span>
          </div>
          <div class="debug-item">
            <span>摄像头: {{ cameraId || '默认' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, type CSSProperties } from 'vue'
import { ElMessage } from 'element-plus'
import { scanOptimizer, type DeviceInfo } from '@/utils/scanOptimizer'
import type { CancelEmits, UpdateVisibleEmits, VisibleProps } from '@/types/component'
import { logger } from '@/utils/logger'

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

interface FocusPoint {
  x: number
  y: number
}

interface ScannerTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean
  focusMode?: string[]
}

interface ScannerTrackConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean
  focusMode?: string
  pointsOfInterest?: FocusPoint[]
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
  enableAndroidOptimization?: boolean
  showPerformance?: boolean
}

interface Emits extends UpdateVisibleEmits, CancelEmits {
  success: [value: string]
  manual: []
}

const props = withDefaults(defineProps<Props>(), {
  enableAndroidOptimization: true,
  showPerformance: false
})

const emit = defineEmits<Emits>()

// 响应式数据
const videoRef = ref<HTMLVideoElement>()
const deviceInfo = ref<DeviceInfo>({} as DeviceInfo)
const statusText = ref('初始化摄像头...')
const statusClass = ref('status-waiting')
const statusIcon = ref('fas fa-circle-notch fa-spin')
const smartTips = ref<string[]>([])
const showRegion = ref(true)
const autoFocus = ref(true)
const flashOn = ref(false)
const hasFlash = ref(false)
const isScanning = ref(false)
const scanCompleted = ref(false)
const cameraId = ref<string>()
const cameraStatus = ref('未连接')

// 计算属性
const title = computed(() => {
  return props.scanType === 'imei' ? 'IMEI条形码扫描' : '序列号扫描'
})

const isDevMode = computed(() => import.meta.env.DEV)

const videoStyle = computed(() => {
  const style: CSSProperties = {
    objectFit: 'cover',
    transform: 'none'
  }

  // 应用设备优化
  if (deviceInfo.value.isAndroid && props.enableAndroidOptimization) {
    const optimization = scanOptimizer.getAndroidOptimization(deviceInfo.value)
    if (optimization.enableContrastBoost) {
      style.filter = 'contrast(1.2) brightness(1.1) saturate(1.1)'
    } else if (optimization.brightnessBoost) {
      style.filter = 'brightness(1.2) contrast(1.1)'
    }
  }

  return style
})

// 摄像头和解码器实例
let codeReader: ScannerCodeReader | null = null
let stream: MediaStream | null = null
let scanHistory: string[] = []
let lastScanTime = 0

// 监听可见性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    startScanning()
  } else {
    stopScanning()
  }
})

const getScannerText = (result: ScannerDecodeResult): string => {
  if (typeof result.getText === 'function') {
    return result.getText().trim()
  }

  return (result.text || '').trim()
}

// 开始扫码
const startScanning = async () => {
  try {
    scanCompleted.value = false
    isScanning.value = false
    updateStatus('正在启动摄像头...', 'status-starting', 'fas fa-circle-notch fa-spin')

    // 检查浏览器支持
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持摄像头功能')
    }

    // 检查HTTPS
    if (location.protocol !== 'https:' &&
        location.hostname !== 'localhost' &&
        location.hostname !== '127.0.0.1') {
      throw new Error('摄像头访问需要HTTPS环境')
    }

    // 设备检测
    deviceInfo.value = scanOptimizer.detectDevice()

    // 生成智能提示
    smartTips.value = scanOptimizer.generateSmartTips(props.phone, props.scanType, deviceInfo.value)

    // 动态导入ZXing
    const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library')

    // 配置解码器
    const hints = new Map()

    // 基础优化
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.PURE_BARCODE, true)
    hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8')

    // 格式优化
    if (props.scanType === 'imei') {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF
      ])
    } else {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.PDF_417
      ])
    }

    codeReader = new BrowserMultiFormatReader(hints) as ScannerCodeReader

    // 获取摄像头配置
    const cameraConfig = scanOptimizer.generateCameraConfig(deviceInfo.value)

    // 获取摄像头ID
    cameraId.value = await scanOptimizer.getOptimalCameraId(codeReader, deviceInfo.value)

    // 启动视频流
    stream = await navigator.mediaDevices.getUserMedia(cameraConfig)
    cameraStatus.value = '已连接'

    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play()

      // 应用设备优化
      if (deviceInfo.value.isAndroid && props.enableAndroidOptimization) {
        scanOptimizer.applyAndroidVideoOptimizations(videoRef.value, deviceInfo.value)
      }

      // 检查闪光灯
      const videoTrack = stream.getVideoTracks()[0] as ScannerMediaTrack
      const capabilities = videoTrack.getCapabilities?.()
      hasFlash.value = capabilities?.torch || false
    }

    updateStatus('准备就绪', 'status-ready', 'fas fa-check-circle')

    // 开始解码
    setTimeout(() => {
      startDecoding()
    }, 1000)

  } catch (error) {
    logger.error('扫码启动失败:', error)
    updateStatus('启动失败', 'status-error', 'fas fa-exclamation-triangle')
    cameraStatus.value = '连接失败'

    setTimeout(() => {
      handleCancel()
    }, 2000)
  }
}

// 开始解码
const startDecoding = async () => {
  if (!codeReader || !videoRef.value) return

  isScanning.value = true
  updateStatus('正在扫描...', 'status-scanning', 'fas fa-qrcode')

  const scanCallback = (result: ScannerDecodeResult | null, error: ScannerErrorLike | null) => {
    if (result) {
      handleScanSuccess(getScannerText(result))
    } else if (error) {
      if (error.name === 'NotFoundException') {
        // 正常扫描中，不显示错误
        return
      }
      logger.warn('扫码错误:', error)
    }
  }

  try {
    await codeReader.decodeFromVideoDevice(cameraId.value, videoRef.value, scanCallback)
  } catch (error) {
    logger.error('解码失败:', error)
    // 尝试使用默认摄像头
    if (cameraId.value) {
      await codeReader.decodeFromVideoDevice(undefined, videoRef.value, scanCallback)
    }
  }
}

// 处理扫码成功
const handleScanSuccess = async (scannedText: string) => {
  // 防重复扫描
  const now = Date.now()
  if (scanHistory.includes(scannedText) && (now - lastScanTime) < 2000) {
    return
  }

  scanHistory.push(scannedText)
  lastScanTime = now

  // 保持最近10次记录
  if (scanHistory.length > 10) {
    scanHistory.shift()
  }

  scanCompleted.value = true
  isScanning.value = false

  // 数据处理
  let processedText = scannedText.trim()

  if (props.scanType === 'imei') {
    // IMEI处理：只保留数字
    processedText = processedText.replace(/\D/g, '').slice(0, 15)
  } else {
    // SN处理：移除SN前缀
    processedText = processedText.replace(/^SN[:\s]*/i, '').trim()
  }

  updateStatus('扫描成功', 'status-success', 'fas fa-check-circle')

  // 震动反馈（如果支持）
  if ('vibrate' in navigator) {
    navigator.vibrate(200)
  }

  // 播放成功音效
  playSuccessSound()

  setTimeout(() => {
    emit('success', processedText)
    emit('update:visible', false)
  }, 500)
}

// 更新状态
const updateStatus = (text: string, className: string, icon: string) => {
  statusText.value = text
  statusClass.value = className
  statusIcon.value = icon
}

// 点击聚焦
const handleVideoClick = async (event: MouseEvent) => {
  if (!videoRef.value || !stream || !autoFocus.value) return

  const rect = videoRef.value.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 100
  const y = ((event.clientY - rect.top) / rect.height) * 100

  // 创建聚焦指示器
  createFocusIndicator(x, y)

  // 尝试设置对焦点
  try {
    const videoTrack = stream.getVideoTracks()[0] as ScannerMediaTrack
    const capabilities = videoTrack.getCapabilities?.()

    if (capabilities?.focusMode) {
      await videoTrack.applyConstraints({
        advanced: [
          { focusMode: 'manual' },
          { pointsOfInterest: [{ x: x / 100, y: y / 100 }] }
        ]
      })

      // 1秒后切换回自动对焦
      setTimeout(async () => {
        try {
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          })
        } catch (e) {
          // 静默处理
        }
      }, 1000)
    }
  } catch (error) {
    // 静默处理
  }
}

// 双击取消
const handleVideoDoubleClick = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (!scanCompleted.value) {
    createCancelIndicator()
    handleCancel()
  }
}

// 创建聚焦指示器
const createFocusIndicator = (x: number, y: number) => {
  const indicator = document.createElement('div')
  indicator.className = 'focus-indicator'
  indicator.style.cssText = `
    position: absolute;
    left: ${x}%;
    top: ${y}%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    border: 3px solid #4CAF50;
    border-radius: 50%;
    background: rgba(76, 175, 80, 0.2);
    pointer-events: none;
    animation: focusPulse 0.8s ease-out;
    z-index: 1000;
  `

  videoRef.value?.parentElement.appendChild(indicator)
  setTimeout(() => {
    indicator.remove()
  }, 800)
}

// 创建取消指示器
const createCancelIndicator = () => {
  const indicator = document.createElement('div')
  indicator.className = 'cancel-indicator'
  indicator.textContent = '扫码已取消'
  indicator.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(244, 67, 54, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 1001;
    pointer-events: none;
    animation: fadeInOut 0.6s ease-out;
  `

  videoRef.value?.parentElement.appendChild(indicator)
  setTimeout(() => {
    indicator.remove()
  }, 600)
}

// 播放成功音效
const playSuccessSound = () => {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGS0fPTgjMGHm7A7+OZURE')
    audio.volume = 0.3
    audio.play().catch(() => {})
  } catch (error) {
    // 静默处理
  }
}

// 切换扫描框
const toggleRegion = () => {
  showRegion.value = !showRegion.value
}

// 切换自动对焦
const toggleAutoFocus = () => {
  autoFocus.value = !autoFocus.value
  updateStatus(autoFocus.value ? '自动对焦已开启' : '自动对焦已关闭', 'status-info', 'fas fa-crosshairs')

  setTimeout(() => {
    if (!scanCompleted.value) {
      updateStatus('正在扫描...', 'status-scanning', 'fas fa-qrcode')
    }
  }, 1500)
}

// 拍照功能
const takeSnapshot = () => {
  if (!videoRef.value) return

  const canvas = document.createElement('canvas')
  canvas.width = videoRef.value.videoWidth
  canvas.height = videoRef.value.videoHeight
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.drawImage(videoRef.value, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `scan-${Date.now()}.jpg`
        a.click()
        URL.revokeObjectURL(url)
        ElMessage.success('截图已保存')
      }
    }, 'image/jpeg', 0.9)
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
    }
  } catch (error) {
    logger.error('闪光灯切换失败:', error)
    ElMessage.error('闪光灯切换失败')
  }
}

// 手动输入
const handleManualInput = () => {
  scanCompleted.value = true
  emit('manual')
}

// 取消扫码
const handleCancel = () => {
  scanCompleted.value = true
  updateStatus('扫码已取消', 'status-cancelled', 'fas fa-times-circle')

  setTimeout(() => {
    emit('cancel')
  }, 300)
}

// 停止扫码
const stopScanning = () => {
  scanCompleted.value = true
  isScanning.value = false

  // 停止视频流
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop()
    })
    stream = null
  }

  // 重置视频源
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }

  // 重置解码器
  if (codeReader) {
    codeReader.reset()
    codeReader = null
  }

  cameraStatus.value = '未连接'
  flashOn.value = false
  scanHistory = []
}

// 组件卸载时清理
onBeforeUnmount(() => {
  stopScanning()
})
</script>

<style lang="scss" scoped>
.scanner-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.scanner-container {
  width: 90vw;
  max-width: 500px;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;

  .scanner-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 18px;
    font-weight: 600;

    .phone-brand {
      font-size: 14px;
      opacity: 0.9;
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;

    .icon-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }

      &.flash-btn.active {
        background: rgba(255, 193, 7, 0.8);
      }
    }
  }
}

.scanner-main {
  background: #000;
  position: relative;

  .video-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    overflow: hidden;
    cursor: crosshair;

    .scanner-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #000;
    }
  }

  .scan-frame {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 280px;
    height: 120px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;

    &.active {
      opacity: 1;
    }

    .scan-corners {
      position: absolute;
      width: 100%;
      height: 100%;

      .corner {
        position: absolute;
        width: 20px;
        height: 20px;
        border: 3px solid #4CAF50;

        &.corner-tl {
          top: 0;
          left: 0;
          border-right: none;
          border-bottom: none;
        }

        &.corner-tr {
          top: 0;
          right: 0;
          border-left: none;
          border-bottom: none;
        }

        &.corner-br {
          bottom: 0;
          right: 0;
          border-left: none;
          border-top: none;
        }

        &.corner-bl {
          bottom: 0;
          left: 0;
          border-right: none;
          border-top: none;
        }
      }
    }

    .scan-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, #4CAF50, transparent);
      opacity: 0;
      transition: opacity 0.3s ease;

      &.scanning {
        opacity: 1;
        animation: scanLine 2s linear infinite;
      }
    }

    @keyframes scanLine {
      0% { top: 0; }
      100% { top: calc(100% - 2px); }
    }
  }

  .status-overlay {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    pointer-events: none;

    .status-item {
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      backdrop-filter: blur(4px);

      &.scan-status {
        &.status-starting { color: #ff9800; }
        &.status-ready { color: #4caf50; }
        &.status-scanning { color: #2196f3; }
        &.status-success { color: #4caf50; }
        &.status-error { color: #f44336; }
        &.status-cancelled { color: #9e9e9e; }
      }
    }
  }

  .device-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(76, 175, 80, 0.9);
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    backdrop-filter: blur(4px);
  }

  .control-panel {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .control-group {
      display: flex;
      gap: 8px;

      .control-btn {
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        &.active {
          background: rgba(33, 150, 243, 0.8);
          border-color: #2196f3;
        }

        &.manual-btn {
          background: rgba(255, 152, 0, 0.8);
          border-color: #ff9800;
        }
      }
    }
  }
}

.scanner-footer {
  background: #f8f9fa;
  padding: 16px 20px;

  .tips-container {
    margin-bottom: 12px;

    .tip-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 13px;
      color: #495057;
      line-height: 1.4;

      i {
        color: #28a745;
        margin-top: 2px;
        font-size: 12px;
        flex-shrink: 0;
      }
    }
  }

  .action-hints {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-bottom: 12px;

    .hint-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #6c757d;

      i {
        font-size: 11px;
      }
    }
  }

  .debug-panel {
    background: #212529;
    color: #adb5bd;
    padding: 8px;
    border-radius: 6px;
    font-family: monospace;
    font-size: 11px;

    .debug-item {
      margin-bottom: 2px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}

// 聚焦和取消动画
@keyframes focusPulse {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.3);
    opacity: 0;
  }
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
}

// 响应式设计
@media (max-width: 768px) {
  .scanner-container {
    width: 95vw;
    margin: 20px;
  }

  .scanner-header {
    padding: 12px 16px;

    .scanner-title {
      font-size: 16px;
    }
  }

  .scan-frame {
    width: 240px;
    height: 100px;
  }

  .control-panel {
    .control-group {
      .control-btn {
        padding: 6px 12px;
        font-size: 11px;

        span {
          display: none;
        }
      }
    }
  }

  .action-hints {
    gap: 16px;
    font-size: 11px;
  }
}
</style>
