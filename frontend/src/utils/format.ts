/**
 * 格式化工具函数
 * 提供各种数据格式化功能，包括日期、时间、货币、数字等
 * 适配北京时间
 */
import { TimeUtil } from './time'

/**
 * 格式化货币
 * @param amount 金额
 * @param currency 货币符号，默认为'¥'
 * @param decimals 小数位数，默认为2
 * @returns 格式化后的货币字符串
 */
export const formatCurrency = (
  amount: number | string,
  currency: string = '¥',
  decimals: number = 2
): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) {
    return `${currency}0.00`
  }

  return `${currency}${num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/**
 * 格式化数字
 * @param num 数字
 * @param decimals 小数位数
 * @returns 格式化后的数字字符串
 */
export const formatNumber = (num: number | string, decimals: number = 0): string => {
  const number = typeof num === 'string' ? parseFloat(num) : num

  if (isNaN(number)) {
    return '0'
  }

  return number.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 格式化百分比
 * @param value 数值（0-1之间）
 * @param decimals 小数位数，默认为2
 * @returns 格式化后的百分比字符串
 */
export const formatPercentage = (value: number | string, decimals: number = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return '0%'
  }

  return `${(num * 100).toFixed(decimals)}%`
}

/**
 * 格式化日期时间（北京时间）
 * @param date 日期时间字符串或Date对象
 * @param format 格式化模式，默认为'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的日期时间字符串
 */
export const formatDateTime = (
  date: string | Date,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string => {
  if (!date) {
    return '-'
  }

  let dateObj: Date

  if (typeof date === 'string') {
    // 检查是否是纯日期格式 (YYYY-MM-DD)，不包含时间部分
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date)

    if (isDateOnly) {
      // 纯日期格式，使用本地时区解析（已经是北京时间）
      dateObj = new Date(date + 'T00:00:00')
    } else if (date.includes('T')) {
      // ISO 格式 (带时区信息)，直接解析
      dateObj = new Date(date)
    } else {
      // MySQL DATETIME 格式 (YYYY-MM-DD HH:mm:ss)
      // 数据库存储的是北京时间，使用本地时区解析
      dateObj = new Date(date.replace(' ', 'T'))
    }
  } else {
    dateObj = date
  }

  if (isNaN(dateObj.getTime())) {
    return '-'
  }

  // 使用本地时区（北京时间）格式化
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  const seconds = String(dateObj.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 格式化日期（北京时间）
 * @param date 日期字符串或Date对象
 * @returns 格式化后的日期字符串
 */
export const formatDate = (date: string | Date): string => {
  return formatDateTime(date, 'YYYY-MM-DD')
}

/**
 * 格式化时间（北京时间）
 * @param time 时间字符串或Date对象
 * @returns 格式化后的时间字符串
 */
export const formatTime = (time: string | Date): string => {
  return formatDateTime(time, 'HH:mm:ss')
}

/**
 * 格式化相对时间
 * @param date 日期时间字符串或Date对象
 * @returns 相对时间字符串
 */
export const formatRelativeTime = (date: string | Date): string => {
  if (!date) {
    return '-'
  }

  const dateStr = typeof date === 'string' ? date : date.toISOString()
  const dateObj = TimeUtil.parse(dateStr)

  if (!dateObj.isValid()) {
    return '-'
  }

  const now = TimeUtil.now()
  const diffInMinutes = TimeUtil.diff(dateObj, now, 'minute')
  const diffInHours = TimeUtil.diff(dateObj, now, 'hour')
  const diffInDays = TimeUtil.diff(dateObj, now, 'day')

  if (diffInMinutes < 1) {
    return '刚刚'
  } else if (diffInMinutes < 60) {
    return `${Math.floor(diffInMinutes)}分钟前`
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}小时前`
  } else if (diffInDays < 7) {
    return `${Math.floor(diffInDays)}天前`
  } else {
    return formatDate(dateObj.toISOString())
  }
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @param decimals 小数位数，默认为2
 * @returns 格式化后的文件大小字符串
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) {
    return '0 B'
  }

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * 格式化手机号码
 * @param phone 手机号码
 * @returns 格式化后的手机号码
 */
export const formatPhone = (phone: string): string => {
  if (!phone) {
    return '-'
  }

  // 移除所有非数字字符
  const cleaned = phone.replace(/\D/g, '')

  // 中国大陆手机号码格式
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
  }

  return phone
}

/**
 * 格式化身份证号
 * @param idCard 身份证号
 * @param showDigits 显示的位数，默认为前4位
 * @returns 格式化后的身份证号
 */
export const formatIdCard = (idCard: string, showDigits: number = 4): string => {
  if (!idCard) {
    return '-'
  }

  if (idCard.length < showDigits) {
    return idCard
  }

  const visible = idCard.slice(0, showDigits)
  const hidden = '*'.repeat(idCard.length - showDigits)

  return visible + hidden
}

/**
 * 格式化银行卡号
 * @param cardNumber 银行卡号
 * @returns 格式化后的银行卡号
 */
export const formatBankCard = (cardNumber: string): string => {
  if (!cardNumber) {
    return '-'
  }

  // 移除所有非数字字符
  const cleaned = cardNumber.replace(/\D/g, '')

  // 按照四位一组格式化
  const groups = cleaned.match(/\d{4}/g) || []
  const remainder = cleaned.slice(groups.length * 4)

  let formatted = groups.join(' ')
  if (remainder) {
    formatted += ' ' + remainder
  }

  return formatted
}

/**
 * 格式化状态文本
 * @param status 状态值
 * @param statusMap 状态映射
 * @returns 格式化后的状态文本
 */
export const formatStatus = (
  status: string | number,
  statusMap: Record<string | number, string>
): string => {
  return statusMap[status] || String(status)
}

/**
 * 格式化性别
 * @param gender 性别值
 * @returns 格式化后的性别文本
 */
export const formatGender = (gender: string | number): string => {
  const genderMap: Record<string | number, string> = {
    'male': '男',
    'female': '女',
    'unknown': '未知',
    'M': '男',
    'F': '女',
    'U': '未知',
    1: '男',
    2: '女',
    0: '未知'
  }

  return formatStatus(gender, genderMap)
}

/**
 * 格式化布尔值
 * @param value 布尔值
 * @param trueText 真值文本，默认为'是'
 * @param falseText 假值文本，默认为'否'
 * @returns 格式化后的布尔值文本
 */
export const formatBoolean = (
  value: boolean | string | number,
  trueText: string = '是',
  falseText: string = '否'
): string => {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' ? trueText : falseText
  }

  if (typeof value === 'number') {
    return value === 1 ? trueText : falseText
  }

  return value ? trueText : falseText
}

/**
 * 格式化数组为文本
 * @param array 数组
 * @param separator 分隔符，默认为'、'
 * @returns 格式化后的文本
 */
export const formatArray = (array: any[], separator: string = '、'): string => {
  if (!Array.isArray(array) || array.length === 0) {
    return '-'
  }

  return array.join(separator)
}

/**
 * 格式化对象为键值对文本
 * @param obj 对象
 * @param separator 分隔符，默认为'，'
 * @param keyValueSeparator 键值分隔符，默认为'：'
 * @returns 格式化后的文本
 */
export const formatObject = (
  obj: Record<string, any>,
  separator: string = '，',
  keyValueSeparator: string = '：'
): string => {
  if (!obj || typeof obj !== 'object') {
    return '-'
  }

  return Object.entries(obj)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}${keyValueSeparator}${value}`)
    .join(separator)
}

/**
 * 格式化文本长度
 * @param text 文本
 * @param maxLength 最大长度
 * @param suffix 后缀，默认为'...'
 * @returns 格式化后的文本
 */
export const formatTextLength = (
  text: string,
  maxLength: number,
  suffix: string = '...'
): string => {
  if (!text) {
    return '-'
  }

  if (text.length <= maxLength) {
    return text
  }

  return text.slice(0, maxLength) + suffix
}

/**
 * 格式化URL参数
 * @param params 参数对象
 * @returns 格式化后的URL参数字符串
 */
export const formatUrlParams = (params: Record<string, any>): string => {
  return Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

/**
 * 解析URL参数
 * @param url URL字符串
 * @returns 解析后的参数对象
 */
export const parseUrlParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {}
  const urlObj = new URL(url, window.location.origin)

  urlObj.searchParams.forEach((value, key) => {
    params[key] = value
  })

  return params
}

/**
 * 格式化颜色值
 * @param color 颜色值
 * @returns 格式化后的颜色值
 */
export const formatColor = (color: string): string => {
  if (!color) {
    return '#000000'
  }

  // 如果已经是十六进制格式，直接返回
  if (color.startsWith('#')) {
    return color
  }

  // 如果是RGB格式，转换为十六进制
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  }

  return color
}

/**
 * 格式化图片URL（统一处理方案）
 * @param path 图片相对路径或完整URL
 * @returns 完整的图片URL
 *
 * 工作流程：
 * 1. 开发环境：使用相对路径，通过 Vite 代理
 * 2. 生产环境：优先使用相对路径，通过前端 Nginx 代理到后端
 * 3. 如果前端 Nginx 未配置代理，则直接使用后端 URL（仅 HTTP 页面）
 */
const KNOWN_IMAGE_PREFIXES = ['/uploads/', '/upload/', '/images/', '/static/', '/assets/']

const getAbsoluteEnvUrl = (value: string | undefined): string => {
  if (typeof value !== 'string') {
    return ''
  }

  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return ''
  }

  if (normalizedValue.startsWith('http://') || normalizedValue.startsWith('https://')) {
    return normalizedValue
  }

  return ''
}

const extractKnownImagePath = (input: string): string => {
  try {
    const url = new URL(input)
    if (KNOWN_IMAGE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    // ignore invalid absolute urls
  }

  return ''
}

export const formatImageUrl = (path: string | null | undefined): string => {
  if (typeof path !== 'string') {
    return ''
  }

  const normalizedInput = path.trim()
  if (!normalizedInput) return ''

  if (normalizedInput.startsWith('data:') || normalizedInput.startsWith('blob:')) {
    return normalizedInput
  }

  const proxiedImagePath = extractKnownImagePath(normalizedInput)
  if (proxiedImagePath) {
    return formatImageUrl(proxiedImagePath)
  }

  // 如果已经是完整URL，直接返回
  if (normalizedInput.startsWith('http://') || normalizedInput.startsWith('https://')) {
    return normalizedInput
  }

  // 确保路径以 / 开头
  const normalizedPath = normalizedInput.startsWith('/') ? normalizedInput : `/${normalizedInput}`

  // 开发环境：使用相对路径，通过 Vite 代理处理
  if (import.meta.env.DEV) {
    return normalizedPath
  }

  const backendOrigin = getBackendOrigin()
  if (!backendOrigin || typeof window === 'undefined') {
    return normalizedPath
  }

  try {
    const isSameOrigin = backendOrigin === window.location.origin
    const isHttpsPage = window.location.protocol === 'https:'
    const isHttpsBackend = backendOrigin.startsWith('https://')

    // 同源部署或已配置前端反向代理时，继续使用相对路径
    if (isSameOrigin) {
      return normalizedPath
    }

    // HTTPS 页面不能回退到 HTTP 资源，避免混合内容被浏览器拦截
    if (isHttpsPage && !isHttpsBackend) {
      return normalizedPath
    }

    // 海外前端单独部署且未配置 /uploads 代理时，直连后端图片服务
    return `${backendOrigin}${normalizedPath}`
  } catch {
    return normalizedPath
  }
}

export const getBackendOrigin = (): string => {
  const backendUrl = getAbsoluteEnvUrl(import.meta.env.VITE_BACKEND_URL)
  if (backendUrl) {
    try {
      return new URL(backendUrl).origin
    } catch {
      // ignore invalid backend url
    }
  }

  const apiBaseUrl = getAbsoluteEnvUrl(import.meta.env.VITE_API_BASE_URL)
  if (apiBaseUrl) {
    try {
      return new URL(apiBaseUrl).origin
    } catch {
      // ignore invalid api url
    }
  }

  return ''
}

// 品牌颜色映射表（用于生成占位图背景）
const BRAND_COLORS: Record<string, string> = {
  '苹果': '#000000',
  'Apple': '#000000',
  'iphone': '#000000',
  '华为': '#cf0a2c',
  'Huawei': '#cf0a2c',
  '小米': '#ff6900',
  'Xiaomi': '#ff6900',
  '红米': '#ff4c00',
  'Redmi': '#ff4c00',
  'OPPO': '#00a0e9',
  'oppo': '#00a0e9',
  'vivo': '#0057e7',
  'VIVO': '#0057e7',
  '三星': '#1428a0',
  'Samsung': '#1428a0',
  '荣耀': '#00b4f5',
  'Honor': '#00b4f5',
  '一加': '#f5010c',
  'OnePlus': '#f5010c',
  'realme': '#fcpv00',
  'Realme': '#fcpv00',
  'iQOO': '#1e96f6',
  'iqoo': '#1e96f6',
  '魅族': '#00a0e9',
  'Meizu': '#00a0e9',
  '中兴': '#1a9dff',
  'ZTE': '#1a9dff',
  '联想': '#e60012',
  'Lenovo': '#e60012',
  '摩托罗拉': '#e60012',
  'Moto': '#e60012',
  '索尼': '#000000',
  'Sony': '#000000',
  'LG': '#a50034',
  'lg': '#a50034',
  '谷歌': '#4285f4',
  'Google': '#4285f4',
  '诺基亚': '#124189',
  'Nokia': '#124189',
}

// 获取品牌对应的背景色
const getBrandColor = (brand: string): string => {
  if (!brand) return '#607d8b'
  const upperBrand = brand.toUpperCase()
  for (const [key, color] of Object.entries(BRAND_COLORS)) {
    if (upperBrand.includes(key.toUpperCase())) {
      return color
    }
  }
  return '#607d8b'
}

// 生成商品占位图（SVG格式）
export interface ProductPlaceholderOptions {
  brand?: string   // 品牌
  model?: string   // 型号
  color?: string   // 颜色
  memory?: string  // 内存
  size?: number    // 尺寸，默认 200
  layout?: 'vertical' | 'horizontal'  // 布局：垂直或横向，默认垂直
}

/**
 * 生成商品占位图 SVG
 * 当商品没有图片时，使用品牌、型号、颜色、内存生成一个可视化的占位图
 */
export const generateProductPlaceholder = (options: ProductPlaceholderOptions = {}): string => {
  const {
    brand = '',
    model = '',
    color = '',
    memory = '',
    size = 200,
    layout = 'vertical'
  } = options

  // 获取品牌颜色
  const bgColor = getBrandColor(brand)

  // 品牌首字母（用于显示）
  const brandInitial = brand ? brand.charAt(0).toUpperCase() : '?'

  // 型号显示（横向布局用12字符，垂直布局用6字符）
  const modelDisplay = model ? model.substring(0, 12) : ''

  // 组合显示文本
  const mainText = brand || '商品'
  const memoryText = memory || ''

  // 生成渐变色 ID
  const gradientId = `grad_${Date.now()}`
  const filterId = `shadow_${Date.now()}`

  // 根据布局类型生成不同的 SVG
  if (layout === 'horizontal') {
    // 横向布局：适合长方形卡片，上方显示品牌，中间显示型号，底部横向显示颜色+内存
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${adjustColor(bgColor, -30)};stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- 背景（渐变色） -->
  <rect width="${size}" height="${size}" fill="url(#${gradientId})" rx="6"/>
  <!-- 品牌首字母图标（左上角） -->
  <circle cx="${size * 0.12}" cy="${size * 0.12}" r="${size * 0.08}" fill="rgba(255,255,255,0.25)"/>
  <text x="${size * 0.12}" y="${size * 0.12}" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-size="${size * 0.06}" font-weight="bold" fill="white">${brandInitial}</text>
  <!-- 品牌名称（顶部居中） -->
  <text x="${size / 2}" y="${size * 0.25}" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="${size * 0.1}" font-weight="bold" fill="white" opacity="0.95">${escapeHtml(mainText)}</text>
  <!-- 分割线 -->
  <line x1="${size * 0.2}" y1="${size * 0.36}" x2="${size * 0.8}" y2="${size * 0.36}" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
  <!-- 型号（中间区域） -->
  ${modelDisplay ? `<text x="${size / 2}" y="${size * 0.52}" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="${size * 0.075}" fill="white" opacity="0.9">${escapeHtml(modelDisplay)}</text>` : ''}
  <!-- 颜色和内存标签（底部同一行，从左到右排列） -->
  <g>
    <!-- 颜色标签 -->
    ${color ? `<g transform="translate(${size * 0.1}, ${size * 0.68})">
      <rect x="0" y="0" width="${Math.min(color.length * 11 + 16, size * 0.35)}" height="${size * 0.14}" rx="${size * 0.07}" fill="rgba(255,255,255,0.22)"/>
      <text x="${Math.min(color.length * 11 + 16, size * 0.35) / 2}" y="${size * 0.1}" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="${size * 0.065}" fill="white">${escapeHtml(color)}</text>
    </g>` : ''}
    <!-- 内存标签（紧跟在颜色后面） -->
    ${memoryText ? `<g transform="translate(${size * 0.1 + (color ? Math.min(color.length * 11 + 24, size * 0.4) : 0)}, ${size * 0.68})">
      <rect x="0" y="0" width="${Math.min(memoryText.length * 11 + 16, size * 0.28)}" height="${size * 0.14}" rx="${size * 0.07}" fill="rgba(255,255,255,0.3)"/>
      <text x="${Math.min(memoryText.length * 11 + 16, size * 0.28) / 2}" y="${size * 0.1}" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="${size * 0.065}" font-weight="500" fill="white">${escapeHtml(memoryText)}</text>
    </g>` : ''}
  </g>
  <!-- 手机图标（左下角装饰） -->
  <g transform="translate(${size * 0.75}, ${size * 0.72})" opacity="0.2">
    <rect x="0" y="0" width="28" height="42" rx="4" fill="none" stroke="white" stroke-width="1.5"/>
    <rect x="8" y="36" width="12" height="3" rx="1.5" fill="white"/>
    <rect x="5" y="3" width="18" height="28" rx="1.5" fill="none" stroke="white" stroke-width="1"/>
  </g>
</svg>`
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }

  // 垂直布局（原布局）
  const modelVerticalShort = model ? model.substring(0, 6) : ''
  const subText = modelVerticalShort || color || memory || ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${adjustColor(bgColor, -30)};stop-opacity:1" />
    </linearGradient>
    <filter id="${filterId}">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  <!-- 背景 -->
  <rect width="${size}" height="${size}" fill="url(#${gradientId})" rx="8"/>
  <!-- 品牌图标区域 -->
  <circle cx="${size/2}" cy="${size * 0.35}" r="${size * 0.18}" fill="rgba(255,255,255,0.2)" filter="url(#${filterId})"/>
  <!-- 品牌首字母 -->
  <text x="${size/2}" y="${size * 0.35}" text-anchor="middle" dominant-baseline="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${size * 0.12}" font-weight="bold" fill="white" opacity="0.9">${brandInitial}</text>
  <!-- 品牌名称 -->
  <text x="${size/2}" y="${size * 0.58}" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${size * 0.08}" font-weight="600" fill="white" opacity="0.95">${escapeHtml(mainText)}</text>
  <!-- 型号/颜色 -->
  ${subText ? `<text x="${size/2}" y="${size * 0.72}" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${size * 0.06}" fill="rgba(255,255,255,0.8)">${escapeHtml(subText)}</text>` : ''}
  <!-- 内存标签 -->
  ${memoryText ? `<rect x="${size/2 - 24}" y="${size * 0.82}" width="48" height="18" rx="9" fill="rgba(255,255,255,0.25)"/>
  <text x="${size/2}" y="${size * 0.82 + 13}" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="10" font-weight="500" fill="white">${escapeHtml(memoryText)}</text>` : ''}
  <!-- 手机图标 -->
  <g transform="translate(${size/2 - 20}, ${size * 0.82 + (memoryText ? 25 : 15)})" opacity="0.3">
    <rect x="0" y="0" width="40" height="60" rx="6" fill="none" stroke="white" stroke-width="2"/>
    <rect x="12" y="50" width="16" height="4" rx="2" fill="white"/>
    <rect x="8" y="4" width="24" height="40" rx="2" fill="none" stroke="white" stroke-width="1.5"/>
  </g>
</svg>`

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// 调整颜色亮度
const adjustColor = (color: string, amount: number): string => {
  const hex = color.replace('#', '')
  const num = parseInt(hex, 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount))
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// HTML转义
const escapeHtml = (text: string): string => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export default {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatDateTime,
  formatDate,
  formatTime,
  formatRelativeTime,
  formatFileSize,
  formatPhone,
  formatIdCard,
  formatBankCard,
  formatStatus,
  formatGender,
  formatBoolean,
  formatArray,
  formatObject,
  formatTextLength,
  formatUrlParams,
  parseUrlParams,
  formatColor,
  formatImageUrl,
  generateProductPlaceholder
}
