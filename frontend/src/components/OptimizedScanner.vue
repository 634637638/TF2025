<template>
  <MobileDialog
    :model-value="visible"
    :title="dialogTitle"
    width="760px"
    dialog-class="optimized-scanner-dialog"
    :show-default-footer="false"
    @update:modelValue="handleDialogVisibilityChange"
    @close="handleCancel"
  >
    <div class="scanner-body">
      <div class="video-container">
        <video
          ref="videoRef"
          id="scan-video"
          class="scan-video"
          :style="videoStyle"
          @click="focusAtCenter"
          autoplay
          muted
          playsinline
        ></video>

        <div
          v-if="showROIDisplay && !lastScannedText"
          ref="scannerGuideRef"
          class="scanner-guide"
          :class="`scanner-guide--${scanType}`"
        >
          <span class="scanner-guide__corner scanner-guide__corner--top-left"></span>
          <span class="scanner-guide__corner scanner-guide__corner--top-right"></span>
          <span class="scanner-guide__corner scanner-guide__corner--bottom-left"></span>
          <span class="scanner-guide__corner scanner-guide__corner--bottom-right"></span>
          <span ref="scannerLineRef" class="scanner-guide__line"></span>
          <span class="scanner-guide__label">{{ scanInstruction }}</span>
        </div>

        <div v-if="candidateText && !lastScannedText" class="scan-candidate-display">
          <i class="fas fa-crosshairs"></i>
          <span>{{ candidateText }}</span>
          <small>{{ scanFeedback }}</small>
        </div>

        <div v-else-if="scanIssue && !lastScannedText" class="scan-issue-display">
          <i :class="lastDecodedRaw ? 'fas fa-barcode' : 'fas fa-exclamation-circle'"></i>
          <span>
            <strong v-if="lastDecodedRaw">已读取：{{ lastDecodedRaw }}</strong>
            <strong v-else>暂未识别到有效内容</strong>
            <small>{{ scanIssue }}</small>
          </span>
        </div>

        <div v-else-if="decoderReady && !lastScannedText" class="scan-engine-status">
          <span class="scan-engine-status__dot"></span>
          <span>识别器运行中 {{ videoResolution }}</span>
        </div>

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
      <div class="tf-dialog-actions">
        <el-button @click="openManualInput">
          <i class="fas fa-keyboard"></i>
          <span>输入</span>
        </el-button>
        <el-button v-if="hasFlash" type="info" @click="toggleFlash" :class="{ active: flashOn }">
          <i :class="flashOn ? 'fas fa-lightbulb' : 'far fa-lightbulb'"></i>
          <span>{{ flashOn ? '关灯' : '闪光灯' }}</span>
        </el-button>
        <el-button type="danger" @click="handleCancel">
          <i class="fas fa-times"></i>
          <span>取消</span>
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch, type CSSProperties } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { scanOptimizer, type DeviceInfo } from '@/utils/scanOptimizer'
import { parseDeviceScanResult } from '@/utils/device-scan-result'
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import type { CancelEmits, UpdateVisibleEmits, VisibleProps } from '@/types/component'

interface ScannerPhone {
  brand?: string
}

interface ScannerErrorLike {
  name?: string
  message?: string
}

interface NativeBarcodeResult {
  rawValue?: string
}

interface NativeBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<NativeBarcodeResult[]>
}

interface NativeBarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): NativeBarcodeDetector
  getSupportedFormats?: () => Promise<string[]>
}

interface CropBarcodeReader {
  setHints(hints: Map<unknown, unknown>): void
  decodeWithState(bitmap: unknown): { getText?: () => string }
  reset(): void
}

interface ScanCropRect {
  left: number
  top: number
  width: number
  height: number
}

interface WasmBarcodeResult {
  text?: string
  isValid?: boolean
}

type TorchMediaTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean
  focusMode?: string[]
  zoom?: { min: number; max: number; step?: number }
}

type TorchMediaTrackConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean
  focusMode?: string
  zoom?: number
}

type TorchMediaTrack = MediaStreamTrack & {
  getCapabilities: () => TorchMediaTrackCapabilities
  applyConstraints: (constraints?: MediaTrackConstraints & { advanced?: TorchMediaTrackConstraintSet[] }) => Promise<void>
}

const getTorchCapabilities = (track: MediaStreamTrack): TorchMediaTrackCapabilities => (
  typeof track.getCapabilities === 'function'
    ? track.getCapabilities() as TorchMediaTrackCapabilities
    : {}
)

interface Props extends VisibleProps {
  scanType: 'imei' | 'serial'
  phone?: ScannerPhone
  showROIDisplay?: boolean
  enableAndroidOptimization?: boolean
}

interface Emits extends UpdateVisibleEmits, CancelEmits {
  success: [value: string]
  manual: []
}

const props = withDefaults(defineProps<Props>(), {
  showROIDisplay: true,
  enableAndroidOptimization: true
})

const emit = defineEmits<Emits>()

// 响应式数据
const videoRef = ref<HTMLVideoElement>()
const scannerGuideRef = ref<HTMLElement>()
const scannerLineRef = ref<HTMLElement>()
const deviceInfo = ref<DeviceInfo>({} as DeviceInfo)
const flashOn = ref(false)
const hasFlash = ref(false)
const scanCompleted = ref(false)
const lastScannedText = ref('')
const candidateText = ref('')
const scanFeedback = ref('已通过格式校验')
const scanIssue = ref('')
const lastScanTime = ref(0)
const decoderReady = ref(false)
const videoResolution = ref('')
const lastDecodedRaw = ref('')

// 计算属性
const title = computed(() => {
  return props.scanType === 'imei' ? '扫码IMEI号' : '扫码序列号'
})

const dialogTitle = computed(() => (
  props.phone?.brand ? `${title.value} (${props.phone.brand})` : title.value
))

const isAppleDevice = computed(() => /apple|iphone|ipad|苹果/i.test(props.phone?.brand || ''))

const scanInstruction = computed(() => (
  props.scanType === 'imei'
    ? '将对应的IMEI条码横向对准蓝线'
    : '将SN序列号条码横向对准蓝线'
))

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

// 摄像头和解码器实例
let stream: MediaStream | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let cropScanTimer: ReturnType<typeof setTimeout> | null = null
let cropReader: CropBarcodeReader | null = null
let cropCanvas: HTMLCanvasElement | null = null
let nativeDetector: NativeBarcodeDetector | null = null
let wasmDecodeBusy = false
let scanSession = 0
let closing = false

prepareZXingModule({
  overrides: {
    locateFile: path => path.endsWith('.wasm') ? zxingReaderWasmUrl : path
  }
})

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

// 监听可见性变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    void startScanning()
  } else {
    stopScanning()
  }
})

const resetScanState = () => {
  closing = false
  scanCompleted.value = false
  lastScannedText.value = ''
  candidateText.value = ''
  scanFeedback.value = '已通过格式校验'
  scanIssue.value = ''
  lastScanTime.value = 0
  decoderReady.value = false
  videoResolution.value = ''
  lastDecodedRaw.value = ''
  flashOn.value = false
  hasFlash.value = false
}

const configureActiveVideoTrack = async () => {
  if (!videoRef.value?.srcObject) return

  stream = videoRef.value.srcObject as MediaStream
  const videoTrack = stream.getVideoTracks()[0] as TorchMediaTrack | undefined
  if (!videoTrack) return

  const capabilities = getTorchCapabilities(videoTrack)
  hasFlash.value = Boolean(capabilities.torch)

  const advanced: TorchMediaTrackConstraintSet[] = []
  if (capabilities.focusMode?.includes('continuous')) {
    advanced.push({ focusMode: 'continuous' })
  }
  if (advanced.length > 0) {
    await videoTrack.applyConstraints({ advanced }).catch(() => undefined)
  }

  if (deviceInfo.value.isAndroid && props.enableAndroidOptimization) {
    scanOptimizer.applyAndroidVideoOptimizations(videoRef.value, deviceInfo.value)
  }
}

const formatCameraError = (error: unknown): string => {
  const name = getScannerErrorName(error)
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return '未检测到可用摄像头'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '摄像头可能被其他应用占用'
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return '当前摄像头不支持所需参数'
  }
  return getScannerErrorMessage(error, '摄像头启动失败')
}

// 开始扫码
const startScanning = async () => {
  stopScanning()
  const session = ++scanSession
  resetScanState()

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持摄像头功能')
    }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      throw new Error('摄像头访问需要HTTPS环境')
    }

    deviceInfo.value = scanOptimizer.detectDevice()

    const {
      DecodeHintType,
      BarcodeFormat,
      MultiFormatReader,
      HTMLCanvasElementLuminanceSource,
      HybridBinarizer,
      BinaryBitmap
    } = await import('@zxing/library')
    if (session !== scanSession || !props.visible) return

    const hints = new Map()
    hints.set(DecodeHintType.TRY_HARDER, true)
    hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8')
    if (props.scanType === 'serial') {
      hints.set(DecodeHintType.ENABLE_CODE_39_EXTENDED_MODE, true)
    }

    // IMEI 与序列号入口分别限制候选码制，并由解析器继续校验具体内容。
    // 手机包装上的 IMEI 条码按 Code128 读取，避免模糊条纹被 Code39 误判为 CCCCC 等字母。
    const serialOneDimensionalFormats = [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.RSS_14,
      BarcodeFormat.RSS_EXPANDED
    ]
    hints.set(
      DecodeHintType.POSSIBLE_FORMATS,
      props.scanType === 'imei'
        ? [BarcodeFormat.CODE_128]
        : [
            ...serialOneDimensionalFormats,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.DATA_MATRIX,
            BarcodeFormat.PDF_417,
            BarcodeFormat.AZTEC
          ]
    )

    await startDecoding(scanOptimizer.generateCameraConfig(deviceInfo.value))
    if (session !== scanSession || !props.visible) return
    await configureActiveVideoTrack()
    await initializeNativeDetector()
    startCropDecoding(
      session,
      hints,
      MultiFormatReader,
      HTMLCanvasElementLuminanceSource,
      HybridBinarizer,
      BinaryBitmap
    )
    decoderReady.value = true
    videoResolution.value = videoRef.value
      ? `${videoRef.value.videoWidth}x${videoRef.value.videoHeight}`
      : ''
  } catch (error) {
    if (session !== scanSession || !props.visible) return
    stopScanning()
    const errorMessage = formatCameraError(error)

    void ElMessageBox.confirm(
      `摄像头启动失败：${errorMessage}`,
      '扫码失败',
      {
        confirmButtonText: '手动输入',
        cancelButtonText: '关闭',
        type: 'warning'
      }
    ).then(openManualInput).catch(handleCancel)
  }
}

const confirmScanResult = (value: string) => {
  if (scanCompleted.value) return

  scanCompleted.value = true
  closing = true
  lastScannedText.value = value
  candidateText.value = ''

  if ('vibrate' in navigator) navigator.vibrate(120)
  emit('success', value)
  ElMessage.success(`${props.scanType === 'imei' ? 'IMEI' : '序列号'}识别成功：${value}`)

  closeTimer = setTimeout(() => {
    emit('update:visible', false)
  }, 650)
}

const processDecodedText = (rawText: string) => {
  const now = Date.now()
  lastDecodedRaw.value = rawText
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 48)
  const parsed = parseDeviceScanResult(props.scanType, rawText, {
    appleSerialBarcode: props.scanType === 'serial' && isAppleDevice.value
  })
  if (!parsed.value) {
    if (candidateText.value && now - lastScanTime.value > 4000) {
      candidateText.value = ''
    }
    scanIssue.value = parsed.error || ''
    return
  }

  scanIssue.value = ''
  candidateText.value = parsed.value
  lastScanTime.value = now
  confirmScanResult(parsed.value)
}

const requestCameraFocus = async (showFeedback: boolean) => {
  if (!videoRef.value || !stream) return

  const track = stream.getVideoTracks()[0] as TorchMediaTrack | undefined
  if (!track) return
  const capabilities = getTorchCapabilities(track)
  if (!capabilities.focusMode?.length) return

  const focusMode = capabilities.focusMode.includes('single-shot')
    ? 'single-shot'
    : capabilities.focusMode.includes('continuous')
      ? 'continuous'
      : undefined
  if (!focusMode) return

  await track.applyConstraints({ advanced: [{ focusMode }] }).catch(() => undefined)
  if (showFeedback) {
    ElMessage.info('已重新对焦，请将条码放大后保持稳定')
  }
}

const focusAtCenter = () => requestCameraFocus(true)

const initializeNativeDetector = async () => {
  const BarcodeDetectorConstructor = (globalThis as typeof globalThis & {
    BarcodeDetector?: NativeBarcodeDetectorConstructor
  }).BarcodeDetector
  if (!BarcodeDetectorConstructor) return

  const formats = props.scanType === 'imei'
    ? ['code_128']
    : ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix', 'pdf417', 'aztec']

  try {
    const supported = await BarcodeDetectorConstructor.getSupportedFormats?.()
    const usableFormats = supported?.length
      ? formats.filter(format => supported.includes(format))
      : formats
    nativeDetector = new BarcodeDetectorConstructor({ formats: usableFormats })
  } catch {
    nativeDetector = null
  }
}

const clampCropValue = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
)

const getGuideCropRect = (video: HTMLVideoElement): ScanCropRect => {
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  const videoRect = video.getBoundingClientRect()
  const guideRect = scannerGuideRef.value?.getBoundingClientRect()
  const lineRect = scannerLineRef.value?.getBoundingClientRect()

  if (!guideRect || videoRect.width <= 0 || videoRect.height <= 0) {
    const width = Math.floor(sourceWidth * 0.96)
    const height = Math.floor(sourceHeight * 0.22)
    return {
      left: Math.floor((sourceWidth - width) / 2),
      top: Math.floor((sourceHeight - height) / 2),
      width,
      height
    }
  }

  // video 使用 object-fit: cover，原始画面可能在上下或左右被裁掉。
  // 这里把可见的蓝线取景框反向映射到摄像头原始像素，保证视觉和解码区域一致。
  const coverScale = Math.max(videoRect.width / sourceWidth, videoRect.height / sourceHeight)
  const renderedWidth = sourceWidth * coverScale
  const renderedHeight = sourceHeight * coverScale
  const renderedLeft = videoRect.left + (videoRect.width - renderedWidth) / 2
  const renderedTop = videoRect.top + (videoRect.height - renderedHeight) / 2

  const horizontalPadding = guideRect.width * 0.06
  const displayLeft = guideRect.left - horizontalPadding
  const displayRight = guideRect.right + horizontalPadding
  const displayCenterY = lineRect
    ? lineRect.top + lineRect.height / 2
    : guideRect.top + guideRect.height / 2
  // 一维条码只需要穿过条纹的横向像素带。识别带保持在蓝线上下约 28-38px，
  // 避免 Apple 包装上紧邻的 SN、IMEI2 和 IMEI/MEID 同时进入解码画面。
  const displayHeight = clampCropValue(guideRect.height * 0.55, 56, 76)

  const rawLeft = (displayLeft - renderedLeft) / coverScale
  const rawRight = (displayRight - renderedLeft) / coverScale
  const rawTop = (displayCenterY - displayHeight / 2 - renderedTop) / coverScale
  const rawBottom = (displayCenterY + displayHeight / 2 - renderedTop) / coverScale

  const left = clampCropValue(Math.floor(rawLeft), 0, sourceWidth - 1)
  const right = clampCropValue(Math.ceil(rawRight), left + 1, sourceWidth)
  const top = clampCropValue(Math.floor(rawTop), 0, sourceHeight - 1)
  const bottom = clampCropValue(Math.ceil(rawBottom), top + 1, sourceHeight)

  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  }
}

const startCropDecoding = (
  session: number,
  hints: Map<unknown, unknown>,
  MultiFormatReader: new () => CropBarcodeReader,
  CanvasLuminanceSource: new (canvas: HTMLCanvasElement, doAutoInvert?: boolean) => unknown,
  HybridBinarizer: new (source: unknown) => unknown,
  BinaryBitmap: new (binarizer: unknown) => unknown
) => {
  if (!videoRef.value || !props.visible) return

  cropReader = new MultiFormatReader()
  cropReader.setHints(hints)
  cropCanvas = document.createElement('canvas')
  const reader = cropReader
  const canvas = cropCanvas
  const wasmFormats = props.scanType === 'imei'
    ? ['Code128'] as const
    : ['Code128', 'Code39', 'Code93', 'EAN13', 'EAN8', 'UPCA', 'UPCE', 'ITF', 'Codabar', 'QRCode', 'DataMatrix', 'PDF417', 'Aztec'] as const
  let decodeAttempt = 0
  let lastAutoFocusAt = Date.now()
  // 明确使用 2D Canvas 上下文，保留带源裁剪区域的 9 参数 drawImage 重载。
  const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null
  if (!context) return
  const drawCroppedFrame = (
    source: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ) => {
    // 某些项目依赖的 DOM 类型只暴露了简化的 drawImage 重载，运行时仍使用浏览器标准 9 参数签名。
    ;(context as unknown as { drawImage: (...args: [CanvasImageSource, number, number, number, number, number, number, number, number]) => void })
      .drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
  }

  const decodeFrame = async () => {
    if (session !== scanSession || !props.visible || scanCompleted.value || !videoRef.value || !reader) {
      cropScanTimer = null
      return
    }

    const video = videoRef.value
    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight
    if (sourceWidth > 0 && sourceHeight > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      decodeAttempt += 1
      const crop = getGuideCropRect(video)
      const outputWidth = Math.min(1280, Math.max(720, crop.width))
      const outputHeight = Math.max(160, Math.round(crop.height * outputWidth / crop.width))

      if (canvas.width !== outputWidth || canvas.height !== outputHeight) {
        canvas.width = outputWidth
        canvas.height = outputHeight
      }
      context.imageSmoothingEnabled = false
      context.filter = 'contrast(1.12) brightness(1.04)'
      drawCroppedFrame(
        video as CanvasImageSource,
        crop.left,
        crop.top,
        crop.width,
        crop.height,
        0,
        0,
        outputWidth,
        outputHeight
      )
      context.filter = 'none'

      // JS 解码器隔帧执行，作为原生和 WASM 的兜底，避免持续占用手机 CPU。
      if (decodeAttempt % 2 === 1) {
        try {
          const source = new CanvasLuminanceSource(canvas, false)
          const bitmap = new BinaryBitmap(new HybridBinarizer(source))
          const result = reader.decodeWithState(bitmap)
          const text = result?.getText?.()?.trim()
          if (text) processDecodedText(text)
        } catch {
          // 当前帧未找到条码时继续扫描。
        } finally {
          reader.reset()
        }
      }

      if (!scanCompleted.value) {
        const processNativeResults = async () => {
          if (!nativeDetector) return
          try {
            const results = await nativeDetector.detect(canvas)
            if (session !== scanSession || !props.visible || scanCompleted.value) return
            for (const result of results) {
              if (result.rawValue?.trim()) {
                processDecodedText(result.rawValue)
                if (scanCompleted.value) break
              }
            }
          } catch {
            // 浏览器原生识别仅作为固定 ROI 的加速通道。
          }
        }

        const processWasmResults = async () => {
          if (wasmDecodeBusy) return
          wasmDecodeBusy = true
          try {
            const imageData = context.getImageData(0, 0, outputWidth, outputHeight)
            const results = await readBarcodes(imageData, {
              formats: [...wasmFormats],
              tryHarder: true,
              tryRotate: false,
              tryInvert: false,
              tryDownscale: false,
              minLineCount: 1,
              maxNumberOfSymbols: 1,
              returnErrors: false
            }) as WasmBarcodeResult[]
            if (session !== scanSession || !props.visible || scanCompleted.value) return
            for (const result of results) {
              if (result.isValid !== false && result.text?.trim()) {
                processDecodedText(result.text)
                if (scanCompleted.value) break
              }
            }
          } catch {
            // WASM 单帧失败时继续使用其他解码器。
          } finally {
            wasmDecodeBusy = false
          }
        }

        await Promise.all([processNativeResults(), processWasmResults()])
      }

      if (!scanCompleted.value && Date.now() - lastAutoFocusAt >= 2800) {
        lastAutoFocusAt = Date.now()
        void requestCameraFocus(false)
      }
    }

    if (session === scanSession && props.visible && !scanCompleted.value) {
      cropScanTimer = setTimeout(() => void decodeFrame(), deviceInfo.value.isLowEnd ? 120 : 70)
    }
  }

  void decodeFrame()
}

const waitForVideoFrame = (video: HTMLVideoElement): Promise<void> => {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error('摄像头画面加载超时')), 8000)
    const finish = (error?: Error) => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadeddata', handleReady)
      video.removeEventListener('canplay', handleReady)
      video.removeEventListener('error', handleError)
      if (error) reject(error)
      else resolve()
    }
    const handleReady = () => finish()
    const handleError = () => finish(new Error('摄像头画面加载失败'))

    video.addEventListener('loadeddata', handleReady)
    video.addEventListener('canplay', handleReady)
    video.addEventListener('error', handleError)
  })
}

const startDecoding = async (cameraConfig: MediaStreamConstraints) => {
  if (!videoRef.value) return
  const video = videoRef.value

  try {
    stream = await navigator.mediaDevices.getUserMedia(cameraConfig)
  } catch (error) {
    const errorName = getScannerErrorName(error)
    if (errorName === 'NotAllowedError' || errorName === 'SecurityError') throw error
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } }
    })
  }

  if (!stream || !props.visible) return
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()
  await waitForVideoFrame(video)
}

// 切换闪光灯
const toggleFlash = async () => {
  if (!stream || !hasFlash.value) return

  try {
    const videoTrack = stream.getVideoTracks()[0] as TorchMediaTrack
    const capabilities = getTorchCapabilities(videoTrack)

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

const openManualInput = () => {
  if (closing) return
  closing = true
  stopScanning()
  emit('update:visible', false)
  emit('manual')
}

const handleDialogVisibilityChange = (value: boolean) => {
  if (value) {
    emit('update:visible', true)
    return
  }
  handleCancel()
}

// 取消扫码
const handleCancel = () => {
  if (closing) return
  closing = true
  stopScanning()
  emit('update:visible', false)
  emit('cancel')
}

// 停止扫码
const stopScanning = () => {
  scanSession += 1
  scanCompleted.value = true

  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }

  if (cropScanTimer) {
    clearTimeout(cropScanTimer)
    cropScanTimer = null
  }
  cropReader?.reset()
  cropReader = null
  cropCanvas = null
  nativeDetector = null
  wasmDecodeBusy = false

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

  flashOn.value = false
  hasFlash.value = false
  decoderReady.value = false
  videoResolution.value = ''
  lastDecodedRaw.value = ''
}

// 组件卸载时清理
onBeforeUnmount(() => {
  stopScanning()
})
</script>

<style lang="scss" scoped>
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
  height: min(58vh, 520px);
  width: 100%;
  overflow: hidden;
}

.scan-video {
  width: 100%;
  max-width: none;
  height: 100%;
  background: #000;
  transform: none !important;
  object-fit: cover;
}

.scanner-guide {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(82%, 540px);
  height: 132px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.scanner-guide--serial {
  width: min(86%, 560px);
  height: 118px;
  max-height: 118px;
}

.scanner-guide__corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border-color: #60a5fa;
  border-style: solid;
  filter: drop-shadow(0 0 4px rgba(37, 99, 235, 0.7));
}

.scanner-guide__corner--top-left {
  top: 0;
  left: 0;
  border-width: 3px 0 0 3px;
}

.scanner-guide__corner--top-right {
  top: 0;
  right: 0;
  border-width: 3px 3px 0 0;
}

.scanner-guide__corner--bottom-left {
  bottom: 0;
  left: 0;
  border-width: 0 0 3px 3px;
}

.scanner-guide__corner--bottom-right {
  right: 0;
  bottom: 0;
  border-width: 0 3px 3px 0;
}

.scanner-guide__line {
  position: absolute;
  right: 10px;
  left: 10px;
  top: 50%;
  height: 2px;
  background: #60a5fa;
  box-shadow: 0 0 10px rgba(96, 165, 250, 0.9);
  transform: translateY(-50%);
}

.scanner-guide__label {
  position: absolute;
  top: calc(100% + 14px);
  left: 50%;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.78);
  color: #fff;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  transform: translateX(-50%);
}

.scan-candidate-display {
  position: absolute;
  right: 16px;
  bottom: 16px;
  left: 16px;
  min-width: 0;
  padding: 10px 12px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 8px;
  align-items: center;
  border: 1px solid rgba(147, 197, 253, 0.65);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.88);
  color: #fff;
  backdrop-filter: blur(8px);
}

.scan-candidate-display i {
  grid-row: 1 / span 2;
  color: #93c5fd;
}

.scan-candidate-display span {
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scan-candidate-display small {
  color: #bfdbfe;
  font-size: 11px;
}

.scan-issue-display {
  position: absolute;
  right: 16px;
  bottom: 16px;
  left: 16px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(96, 165, 250, 0.72);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.9);
  color: #dbeafe;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  backdrop-filter: blur(8px);
}

.scan-issue-display span {
  min-width: 0;
}

.scan-issue-display strong {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scan-issue-display small {
  display: block;
  max-width: 100%;
  margin-top: 2px;
  overflow: hidden;
  color: #fcd34d;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scan-engine-status {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.72);
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  line-height: 16px;
  pointer-events: none;
}

.scan-engine-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.8);
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

@media (max-width: 767px) {
  .video-container {
    min-height: 360px;
    height: min(62vh, 520px);
  }

  .scanner-guide {
    width: calc(100% - 32px);
    height: 116px;
  }

  .scanner-guide--serial {
    width: calc(100% - 36px);
    height: 108px;
    max-height: 108px;
  }

  .scanner-guide__label {
    max-width: calc(100vw - 48px);
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
  }

}
</style>
