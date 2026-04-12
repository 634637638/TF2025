/**
 * 扫码优化工具类 - 针对安卓设备优化
 * 解决安卓扫码识别慢的问题
 */

export interface DeviceInfo {
  isAndroid: boolean
  isIOS: boolean
  androidVersion: number
  manufacturer: string
  isLowEnd: boolean
}

export interface ScanConfig {
  type: 'imei' | 'serial'
  phone?: any
  enableROIDisplay?: boolean
  enableAndroidOptimization?: boolean
  maxScanTime?: number
}
import { logger } from '@/utils/logger'

export class ScanOptimizer {
  private static instance: ScanOptimizer
  private scanConfig: ScanConfig | null = null
  private performanceMetrics = {
    startTime: 0,
    frameCount: 0,
    decodeTime: 0,
    errorCount: 0
  }

  static getInstance(): ScanOptimizer {
    if (!ScanOptimizer.instance) {
      ScanOptimizer.instance = new ScanOptimizer()
    }
    return ScanOptimizer.instance
  }

  /**
   * 检测设备信息
   */
  detectDevice(): DeviceInfo {
    const userAgent = navigator.userAgent
    const isAndroid = /Android/.test(userAgent)
    const isIOS = /iPhone|iPad|iPod/.test(userAgent)

    let androidVersion = 0
    let manufacturer = 'unknown'
    let isLowEnd = false

    if (isAndroid) {
      // 获取Android版本
      const versionMatch = userAgent.match(/Android (\d+\.?\d*)/)
      androidVersion = parseFloat(versionMatch?.[1] || '0')

      // 获取制造商
      const manufacturerMatch = /Android; ([^)]+)/.exec(userAgent)?.[1] || 'unknown'
      manufacturer = manufacturerMatch.toLowerCase()

      // 判断是否为低端设备
      isLowEnd = androidVersion < 8.0 ||
                 ['huawei', 'xiaomi', 'vivo', 'oppo', 'realme'].includes(manufacturer) ||
                 navigator.hardwareConcurrency <= 4
    }

    return {
      isAndroid,
      isIOS,
      androidVersion,
      manufacturer,
      isLowEnd
    }
  }

  /**
   * 生成优化的摄像头配置 - 精准识别优化
   */
  generateCameraConfig(deviceInfo: DeviceInfo): MediaStreamConstraints {
    // 超高分辨率配置，确保条形码最清晰
    const baseConfig: MediaStreamConstraints = {
      audio: false,
      video: {
        width: { ideal: 2560, min: 1920 },
        height: { ideal: 1440, min: 1080 },
        facingMode: 'environment'
      }
    }

    // 移动设备精准优化配置
    if (deviceInfo.isAndroid || deviceInfo.isIOS) {
      const videoConstraints: any = {
        width: { ideal: 2560, min: 1920 },
        height: { ideal: 1440, min: 1080 },
        facingMode: 'environment'
      }

      // 安卓设备精准优化
      if (deviceInfo.isAndroid) {
        videoConstraints.frameRate = { ideal: 24, max: 30 } // 稳定帧率，减少模糊
        videoConstraints.zoom = { ideal: 1.0, max: 2.0 } // 允许适度放大
        // 强制连续自动对焦
        videoConstraints.focusMode = 'continuous'
        // 优化曝光和白平衡
        videoConstraints.exposureMode = 'continuous'
        videoConstraints.whiteBalanceMode = 'continuous'

        // 制造商特殊优化
        if (['xiaomi', 'huawei'].includes(deviceInfo.manufacturer)) {
          videoConstraints.frameRate = { ideal: 20, max: 25 } // 小米华为设备降低帧率提高清晰度
        }
      } else if (deviceInfo.isIOS) {
        // iOS设备精准优化
        videoConstraints.frameRate = { ideal: 30, max: 60 }
        videoConstraints.focusMode = 'continuous-auto'
        videoConstraints.exposureMode = 'continuous-auto'
      }

      baseConfig.video = videoConstraints
    }

    return baseConfig
  }

  /**
   * 获取安卓优化配置
   */
  getAndroidOptimization(deviceInfo: DeviceInfo): any {
    if (!deviceInfo.isAndroid) return {}

    const optimizations: any = {
      frameRate: { ideal: 30 },
      scanInterval: deviceInfo.isLowEnd ? 300 : 200,
      maxDecodeAttempts: deviceInfo.isLowEnd ? 3 : 5,
      enableContrastBoost: ['xiaomi', 'huawei'].includes(deviceInfo.manufacturer),
      tryHarder: true
    }

    // 根据制造商特殊优化
    switch (deviceInfo.manufacturer) {
      case 'huawei':
        optimizations.cameraTimeout = 25000
        optimizations.useLegacyDecoder = deviceInfo.androidVersion < 9
        break
      case 'xiaomi':
        optimizations.brightnessBoost = true
        optimizations.contrastBoost = true
        break
      case 'samsung':
        optimizations.frameRate = { ideal: 20 }
        optimizations.enableHDR = true
        break
    }

    return optimizations
  }

  /**
   * 生成ZXing解码器提示 - 精准识别优化
   */
  generateZXingHints(type: 'imei' | 'serial', deviceInfo: DeviceInfo): any {
    // 生成浏览器兼容的配置对象
    const hints: any = {}

    // 超强化识别配置
    hints.tryHarder = true // 强制启用最强识别模式
    hints.characterSet = 'UTF-8'

    // 根据扫描类型设置格式 - 精准匹配，减少干扰
    if (type === 'imei') {
      // IMEI码只使用最准确的格式，避免错误识别
      hints.formats = ['CODE_128', 'CODE_39', 'EAN_13'] // 最精准的IMEI格式
      hints.maxLength = 15
      hints.minLength = 15
    } else {
      // SN序列号优先二维码，条形码为辅
      hints.formats = ['QR_CODE', 'CODE_128', 'DATA_MATRIX', 'CODE_39'] // SN常用格式
      hints.maxLength = 50
      hints.minLength = 6
    }

    // 精准识别优化
    if (deviceInfo.isAndroid) {
      // 安卓设备精准优化
      hints.pureBarcode = false // 保留图像上下文，提高复杂场景识别率
      hints.tryHarder = true // 强制最强识别算法
      hints.delayBetweenScanAttempts = deviceInfo.isLowEnd ? 250 : 180 // 平衡速度和准确率

      // 制造商特殊精准优化
      if (['xiaomi', 'huawei'].includes(deviceInfo.manufacturer)) {
        hints.delayBetweenScanAttempts = 220 // 小米华为设备精准调优
      } else if (deviceInfo.manufacturer === 'samsung') {
        hints.delayBetweenScanAttempts = 200 // 三星设备优化
      }
    } else {
      hints.delayBetweenScanAttempts = 120 // iOS设备快速精准扫描
    }

    return hints
  }

  /**
   * 获取优化的摄像头设备ID
   */
  async getOptimalCameraId(codeReader: any, _deviceInfo: DeviceInfo): Promise<string | undefined> {
    try {
      const videoDevices = await codeReader.listVideoInputDevices()

      if (videoDevices.length === 0) return undefined
      if (videoDevices.length === 1) return videoDevices[0].deviceId

      // 优先选择后置摄像头
      const backCamera = videoDevices.find(device => {
        const label = device.label.toLowerCase()
        return label.includes('back') ||
               label.includes('后置') ||
               label.includes('rear') ||
               label.includes('environment') ||
               label.includes('camera 0')
      })

      if (backCamera) {
        return backCamera.deviceId
      }

      // 如果没有找到后置摄像头，选择第一个
      return videoDevices[0].deviceId

    } catch (error) {
      logger.warn('获取摄像头设备失败:', error)
      return undefined
    }
  }

  /**
   * 应用安卓特定的视频优化
   */
  applyAndroidVideoOptimizations(video: HTMLVideoElement, deviceInfo: DeviceInfo): void {
    if (!deviceInfo.isAndroid) return

    const optimization = this.getAndroidOptimization(deviceInfo)

    // 设置CSS滤镜提升对比度
    if (optimization.enableContrastBoost) {
      video.style.filter = 'contrast(1.2) brightness(1.1) saturate(1.1)'
    }

    if (optimization.brightnessBoost) {
      video.style.filter = 'brightness(1.2) contrast(1.1)'
    }

    // 设置视频优化属性
    // 保持正常显示，不使用镜像
    video.style.objectFit = 'cover'
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')

    // 强制硬件加速（但不使用镜像）
    video.style.willChange = 'transform'
    video.style.transform = 'translateZ(0)'
  }

  /**
   * 开始性能监控
   */
  startPerformanceMonitoring(): void {
    this.performanceMetrics = {
      startTime: Date.now(),
      frameCount: 0,
      decodeTime: 0,
      errorCount: 0
    }
  }

  /**
   * 记录解码时间
   */
  recordDecodeTime(time: number): void {
    this.performanceMetrics.decodeTime += time
    this.performanceMetrics.frameCount++
  }

  /**
   * 记录错误
   */
  recordError(): void {
    this.performanceMetrics.errorCount++
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): any {
    const duration = Date.now() - this.performanceMetrics.startTime
    const avgDecodeTime = this.performanceMetrics.decodeTime / Math.max(this.performanceMetrics.frameCount, 1)
    const fps = (this.performanceMetrics.frameCount / duration) * 1000
    const successRate = ((this.performanceMetrics.frameCount - this.performanceMetrics.errorCount) / Math.max(this.performanceMetrics.frameCount, 1)) * 100

    return {
      duration: duration,
      frames: this.performanceMetrics.frameCount,
      fps: fps.toFixed(2),
      avgDecodeTime: avgDecodeTime.toFixed(2),
      errors: this.performanceMetrics.errorCount,
      successRate: successRate.toFixed(2) + '%'
    }
  }

  /**
   * 记录性能报告到控制台
   */
  logPerformanceReport(): void {
    const report = this.getPerformanceReport()
    logger.debug('扫码性能报告', {
      '扫描时长(ms)': report.duration,
      '总帧数': report.frames,
      'FPS': report.fps,
      '平均解码时间(ms)': report.avgDecodeTime,
      '错误次数': report.errors,
      '成功率': report.successRate
    })
  }

  /**
   * 生成智能提示
   */
  generateSmartTips(phone: any, type: 'imei' | 'serial', deviceInfo: DeviceInfo): string[] {
    const brand = phone?.brand?.toLowerCase() || ''
    const isApple = brand.includes('apple')
    const isAndroid = deviceInfo.isAndroid

    if (type === 'imei') {
      // IMEI1扫码提示
      if (isApple) {
        return [
          "📱 请对准包装盒第三排IMEI1条形码",
          "💡 苹果包装有三排数字，IMEI1在第3排，通常是15位数字",
          "⚡ 确保条形码完整，光线充足，避免反光",
          "🎯 建议距离15-20厘米，水平放置条形码"
        ]
      } else if (isAndroid) {
        const manufacturer = deviceInfo.manufacturer
        if (['huawei', 'honor'].includes(manufacturer)) {
          return [
            "📱 华为设备请扫描IMEI1条形码",
            "💡 通常在包装盒背面，标签为'IMEI1'的条形码",
            "⚡ 建议开启手电筒，确保光线充足",
            "🎯 条形码水平放置效果更佳"
          ]
        } else if (['xiaomi', 'redmi'].includes(manufacturer)) {
          return [
            "📱 小米设备请扫描IMEI1条形码",
            "💡 在包装盒或手机背面找到IMEI1标识",
            "⚡ 保持摄像头稳定，避免晃动",
            "🎯 建议距离10-15厘米扫描"
          ]
        } else {
          return [
            "📱 请扫描包装上的IMEI1条形码",
            "💡 找到标识为'IMEI1'的条形码，通常是15位数字",
            "⚡ 确保光线充足，避免阴影遮挡",
            "🎯 扫描时保持手机稳定，条形码水平"
          ]
        }
      }
    } else {
      // SN序列号扫码提示
      if (isApple) {
        return [
          "📱 请对准包装盒第二排SN序列号",
          "💡 苹果包装第2排是SN码，通常是二维码或条形码",
          "⚡ 系统会自动识别并移除SN前缀",
          "🎯 建议距离10-15厘米，确保二维码完整"
        ]
      } else {
        return [
          "📱 请扫描SN序列号（二维码或条形码）",
          "💡 找到包装上标识为'SN'或'序列号'的码",
          "⚡ 支持QR码、条形码多种格式",
          "🎯 保持摄像头与码面平行，光线充足"
        ]
      }
    }

    return []
  }
}

// 导出单例实例
export const scanOptimizer = ScanOptimizer.getInstance()