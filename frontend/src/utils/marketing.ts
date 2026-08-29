import { TimeUtil } from '@/utils/time'

export type MarketingMode = 'opening' | 'sales'
export type MarketingCondition = 'new' | 'used' | 'mixed'
export type MarketingWeatherType = 'clear' | 'cloudy' | 'light_rain' | 'heavy_rain' | 'thunderstorm' | 'snow' | 'fog' | 'normal'
export type MarketingCopyType =
  | 'cute'
  | 'lyrical'
  | 'gratitude'
  | 'culture'
  | 'cool'
  | 'retro'
  | 'trendy'
  | 'deep_night'
  | 'playful'
  | 'sales_record'
  | 'opening'
  | 'friend_circle'

export interface MarketingLexicon {
  /** 是否启用国补应景语句；关闭时公开页不会读取国补词库。 */
  subsidyEnabled?: boolean
  /** 是否启用颜色应景语句；由公开页销售模式的颜色开关控制。 */
  colorEnabled?: boolean
  /** 是否启用天气应景语句；由公开页销售模式的天气开关控制。 */
  weatherEnabled?: boolean
  /** 是否启用节气应景语句；由公开页销售模式的节气开关控制。 */
  solarTermEnabled?: boolean
  /** 模式通用句式，所有开头、正文和收束句均由数据库维护 */
  modeLexicon?: Partial<Record<MarketingMode, {
    lines: string[]
    nightLines?: string[]
    salesTalks?: string[]
  }>>
  /** 每个文案类型独立维护，避免可爱/文化/成交等语气串线 */
  typeLexicon?: Partial<Record<MarketingCopyType, {
    lines: string[]
  }>>
  /** 应景词库独立维护，生成时只取当前命中的类别 */
  contextLexicon?: {
    holiday?: string[] | Partial<Record<string, string[]>>
    solarTerm?: string[] | Partial<Record<string, string[]>>
    /** 兼容旧版数组；新版按天气分类保存。 */
    weather?: string[] | Partial<Record<MarketingWeatherType | 'all', string[]>>
    timeSegment?: Partial<Record<string, string[]>>
    color?: string[] | Partial<Record<string, string[]>>
    /** 国补表达，通常使用 all 分类；是否参与生成由 subsidyEnabled 控制。 */
    subsidy?: string[] | Partial<Record<string, string[]>>
  }
  /** 节气、传统节日、历史纪念日按事件名称独立维护 */
  eventLexicon?: {
    solarTerms?: Partial<Record<string, string[]>>
    traditionalHolidays?: Partial<Record<string, string[]>>
    historicalDays?: Partial<Record<string, string[]>>
  }
  updatedAt?: string
}

export interface MarketingProductInput {
  brand: string
  model: string
  color: string
  memory: string
  price?: string
  stock?: string
  todaySales?: string
  recentSales?: string
  highlight?: string
  note?: string
}

export interface MarketingAutoContext {
  locationName: string
  weatherText: string
  weatherCode?: number | null
  temperature?: number | null
  apparentTemperature?: number | null
  timeSegment: string
  season: string
  holidayCue?: string
  holidayName?: string
  holidayType?: 'traditional' | 'historical'
  solarTermCue?: string
  dayName: string
}

export interface MarketingCopySuggestion {
  id: string
  title: string
  tone: string
  text: string
  tags: string[]
}

export const MARKETING_MODE_LABELS: Record<MarketingMode, string> = {
  opening: '营业',
  sales: '销售'
}

export const MARKETING_WEATHER_TYPE_LABELS: Record<MarketingWeatherType, string> = {
  clear: '晴天',
  cloudy: '多云/阴天',
  light_rain: '小雨/阵雨',
  heavy_rain: '大雨/暴雨',
  thunderstorm: '雷雨/强对流',
  snow: '下雪',
  fog: '雾天',
  normal: '未分类'
}

export const MARKETING_COPY_TYPE_LABELS: Record<MarketingCopyType, string> = {
  cute: '🥰可爱型',
  lyrical: '🍃抒情型',
  gratitude: '❤️感恩型',
  culture: '📜文化型',
  cool: '🧊高冷型',
  retro: '📻复古型',
  trendy: '🔥流行型',
  deep_night: '🌙深夜型',
  playful: '😂调皮型',
  sales_record: '✨成交晒单',
  opening: '😂幽默型',
  friend_circle: '📱朋友圈型'
}

// 类型全部保留在管理端，只有实际配置了词句的类型才会参与生成。
export const MARKETING_COPY_TYPES: MarketingCopyType[] = [
  'cute',
  'lyrical',
  'gratitude',
  'culture',
  'cool',
  'retro',
  'trendy',
  'deep_night',
  'playful',
  'sales_record',
  'opening',
  'friend_circle'
]

export const normalizeMarketingMode = (value: unknown): MarketingMode => {
  if (value === 'sales' || value === 'deep_night' || value === 'chicken_soup') return 'sales'
  return 'opening'
}

export const DEFAULT_MARKETING_LEXICON: MarketingLexicon = {
  // 默认不提供任何文案。所有可生成内容必须来自后台数据库词库，
  // 避免数据库清空后又被内置句子补回。
  modeLexicon: {
    opening: { lines: [], nightLines: [] },
    sales: { lines: [], nightLines: [] }
  },
  typeLexicon: Object.fromEntries(
    MARKETING_COPY_TYPES.map((type) => [type, { lines: [] }])
  ) as Record<MarketingCopyType, { lines: string[] }>,
  contextLexicon: { holiday: [], solarTerm: [], weather: [], timeSegment: {}, color: {}, subsidy: {} },
  eventLexicon: { solarTerms: {}, traditionalHolidays: {}, historicalDays: {} },
  subsidyEnabled: false,
  updatedAt: new Date().toISOString()
}

const TIME_SEGMENTS = [
  { start: 5, end: 10, label: '开门' },
  { start: 10, end: 17, label: '销售' },
  { start: 17, end: 20, label: '下班前' },
  { start: 20, end: 24, label: '深夜' },
  { start: 0, end: 5, label: '深夜' }
]

const SEASON_BY_MONTH = [
  { months: [12, 1, 2], label: '冬日' },
  { months: [3, 4, 5], label: '春日' },
  { months: [6, 7, 8], label: '夏日' },
  { months: [9, 10, 11], label: '秋日' }
]

const FIXED_HOLIDAYS: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: '元旦' },
  { month: 2, day: 14, name: '情人节' },
  { month: 3, day: 8, name: '妇女节' },
  { month: 3, day: 12, name: '植树节' },
  { month: 4, day: 1, name: '愚人节' },
  { month: 4, day: 5, name: '清明节' },
  { month: 5, day: 4, name: '青年节' },
  { month: 5, day: 1, name: '劳动节' },
  { month: 6, day: 1, name: '儿童节' },
  { month: 7, day: 1, name: '建党节' },
  { month: 8, day: 1, name: '建军节' },
  { month: 9, day: 10, name: '教师节' },
  { month: 9, day: 18, name: '九一八' },
  { month: 9, day: 3, name: '抗战胜利日' },
  { month: 10, day: 1, name: '国庆节' },
  { month: 12, day: 13, name: '国家公祭日' },
  { month: 12, day: 24, name: '平安夜' },
  { month: 12, day: 25, name: '圣诞节' }
]

const TRADITIONAL_HOLIDAY_NAMES = new Set([
  '春节', '元宵节', '端午节', '七夕', '中秋节', '重阳节', '除夕', '清明节'
])

const _HISTORICAL_DAY_NAMES = new Set([
  '建党节', '建军节', '九一八', '抗战胜利日', '国家公祭日', '青年节', '教师节', '植树节',
  '妇女节', '劳动节', '儿童节', '国庆节'
])

const LUNAR_HOLIDAYS: Record<string, string> = {
  '正月初一': '春节',
  '正月十五': '元宵节',
  '五月初五': '端午节',
  '七月初七': '七夕',
  '八月十五': '中秋节',
  '九月初九': '重阳节',
  '腊月三十': '除夕',
  '腊月廿九': '除夕'
}

const SOLAR_TERMS = [
  { month: 1, day: 5, label: '小寒' },
  { month: 1, day: 20, label: '大寒' },
  { month: 2, day: 4, label: '立春' },
  { month: 2, day: 19, label: '雨水' },
  { month: 3, day: 5, label: '惊蛰' },
  { month: 3, day: 20, label: '春分' },
  { month: 4, day: 4, label: '清明' },
  { month: 4, day: 20, label: '谷雨' },
  { month: 5, day: 5, label: '立夏' },
  { month: 5, day: 21, label: '小满' },
  { month: 6, day: 5, label: '芒种' },
  { month: 6, day: 21, label: '夏至' },
  { month: 7, day: 7, label: '小暑' },
  { month: 7, day: 23, label: '大暑' },
  { month: 8, day: 7, label: '立秋' },
  { month: 8, day: 23, label: '处暑' },
  { month: 9, day: 7, label: '白露' },
  { month: 9, day: 23, label: '秋分' },
  { month: 10, day: 8, label: '寒露' },
  { month: 10, day: 23, label: '霜降' },
  { month: 11, day: 7, label: '立冬' },
  { month: 11, day: 22, label: '小雪' },
  { month: 12, day: 7, label: '大雪' },
  { month: 12, day: 21, label: '冬至' }
]

/** 后台应景词库使用的标准规则键，生成器会按这些键自动匹配当前上下文。 */
export const MARKETING_CONTEXT_CATEGORY_OPTIONS: Record<string, string[]> = {
  holiday: ['traditional', 'historical', 'all'],
  weather: ['clear', 'cloudy', 'light_rain', 'heavy_rain', 'thunderstorm', 'snow', 'fog', 'normal'],
  timeSegment: ['开门', '销售', '下班前', '深夜'],
  solarTerms: SOLAR_TERMS.map(item => item.label),
  traditionalHolidays: ['春节', '元宵节', '端午节', '七夕', '中秋节', '重阳节', '除夕', '清明节'],
  historicalDays: ['元旦', '情人节', '妇女节', '植树节', '愚人节', '青年节', '劳动节', '儿童节', '建党节', '建军节', '教师节', '九一八', '抗战胜利日', '国庆节', '国家公祭日', '平安夜', '圣诞节'],
  subsidy: ['all'],
  color: ['原色', '橙色', '深青色', '白色', '粉色', '紫色', '红色', '绿色', '群青色', '蓝色', '金色', '黄色', '黑色', '银色', '灰色']
}

const WEATHER_CODE_MAP: Record<number, string> = {
  0: '晴朗',
  1: '大致晴朗',
  2: '多云',
  3: '阴天',
  45: '有雾',
  48: '有雾',
  51: '毛毛雨',
  53: '小雨',
  55: '中雨',
  56: '冻雨',
  57: '冻雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '霰',
  80: '阵雨',
  81: '强阵雨',
  82: '暴雨',
  85: '阵雪',
  86: '强阵雪',
  95: '雷暴',
  96: '雷暴伴冰雹',
  99: '强雷暴'
}


const normalizeText = (value?: string) => String(value || '').trim().replace(/\s+/g, ' ')

// 表情仅作为展示装饰；文案正文、语气和收束句全部来自数据库词库。
const MARKETING_COPY_EMOJIS = [
  '✨', '📦', '✅', '🔥', '😂', '😆', '🤭', '👉', '🍃', '🌿', '☁️', '🌙',
  '📜', '🪄', '🧭', '✍️', '💥', '⚡', '📱', '❤️', '🙏', '🤝', '💐', '🚀',
  '📲', '🛒', '🍂', '☀️', '🌦️', '📸', '💬', '🌓', '💤', '🔔', '🌞', '🙌',
  '🎉', '💼'
] as const

// 约 240 个场景表情。表情只负责氛围，不替代后台词库中的正文内容。
const MARKETING_SCENE_EMOJIS = {
  opening: ['🌅', '🌄', '🌞', '🌤️', '☀️', '🔔', '🚪', '🪟', '🧹', '🧼', '🫖', '☕', '🥐', '🧡', '🌈', '🙋', '👋', '🫡', '📣', '🎈'],
  sales: ['📱', '📲', '💻', '⌚', '🎧', '📷', '🛍️', '🛒', '💳', '💰', '💵', '🧾', '🏷️', '📊', '📈', '🎯', '⚡', '🔥', '🚀', '✅'],
  night: ['🌙', '🌌', '🌃', '🌆', '🌠', '⭐', '🌟', '✨', '💫', '🌓', '🌒', '🌑', '🌙', '🕯️', '🛋️', '🫧', '🎧', '📖', '🍵', '😴'],
  weather: ['☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '🌨️', '⛈️', '🌩️', '🌪️', '🌫️', '☔', '❄️', '⛄', '💧', '💦', '🌈', '🌬️', '🧥'],
  season: ['🌱', '🌿', '🍀', '🌸', '🌺', '🌷', '🌻', '🌴', '🍃', '🍂', '🍁', '🌾', '🌵', '🎋', '🎍', '🪴', '🌳', '🌲', '❄️', '🧣'],
  holiday: ['🎉', '🎊', '🎈', '🧨', '🧧', '🏮', '🥳', '🎁', '🎀', '🍰', '🎂', '🍾', '🥂', '🪅', '🪩', '🎆', '🎇', '🕯️', '❤️', '🤍'],
  celebration: ['👏', '🙌', '🤝', '🤩', '🥰', '😍', '😊', '😄', '😁', '😆', '😂', '🤣', '🥳', '🎉', '🎊', '🏆', '🥇', '🏅', '💐', '🌹'],
  service: ['🤝', '🙏', '🙇', '💁', '🫶', '❤️', '💙', '💚', '💛', '💜', '🤍', '🩷', '🩵', '🧡', '📞', '💬', '📝', '📦', '🛠️', '🔧'],
  mood: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '🥰', '😍', '🤗', '🤭', '😎', '🤔'],
  style: ['💎', '👑', '✨', '🌟', '💫', '🪄', '🎨', '🖼️', '📸', '🎬', '🎵', '🎶', '🎼', '🕶️', '👒', '🧢', '🧥', '👟', '💅', '🪞'],
  delivery: ['📦', '📮', '🚚', '🚛', '✈️', '🛫', '🛬', '🛵', '🚲', '🏃', '🏃‍♂️', '🏃‍♀️', '📍', '🗺️', '🧭', '🔑', '🎁', '🛍️', '✅', '📬'],
  interaction: ['👉', '👇', '👆', '☝️', '✌️', '🤞', '🤟', '🤘', '👌', '👍', '👎', '👏', '🙌', '🫰', '💬', '📩', '📨', '🔔', '📣', '❓']
} as const

const capitalizeFirst = (text: string) => text ? text.charAt(0).toUpperCase() + text.slice(1) : text

const getDayName = (date: Date) => TimeUtil.getDayName(date)

const detectTimeSegment = (date: Date): string => {
  const hour = date.getHours()
  return TIME_SEGMENTS.find(segment => hour >= segment.start && hour < segment.end)?.label || '日常'
}

const detectSeason = (date: Date): string => {
  const month = date.getMonth() + 1
  return SEASON_BY_MONTH.find(item => item.months.includes(month))?.label || '四季'
}

const getChineseLunarLabel = (date: Date): string => {
  try {
    return new Intl.DateTimeFormat('zh-u-ca-chinese', {
      month: 'long',
      day: 'numeric'
    }).format(date)
  } catch {
    return ''
  }
}

const detectHoliday = (date: Date): {
  name?: string
  leadLabel?: string
  category?: 'traditional' | 'historical'
} => {
  const month = date.getMonth() + 1
  const day = date.getDate()

  const fixedHoliday = FIXED_HOLIDAYS.find(item => item.month === month && item.day === day)
  if (fixedHoliday) {
    return {
      name: fixedHoliday.name,
      leadLabel: fixedHoliday.name,
      category: TRADITIONAL_HOLIDAY_NAMES.has(fixedHoliday.name) ? 'traditional' : 'historical'
    }
  }

  const lunarLabel = getChineseLunarLabel(date)
  if (lunarLabel && LUNAR_HOLIDAYS[lunarLabel]) {
    return {
      name: LUNAR_HOLIDAYS[lunarLabel],
      leadLabel: LUNAR_HOLIDAYS[lunarLabel],
      category: 'traditional'
    }
  }

  const daysAhead = [1, 2, 3, 4, 5, 6, 7]
  for (const offset of daysAhead) {
    const future = new Date(date.getTime())
    future.setDate(future.getDate() + offset)
    const futureMonth = future.getMonth() + 1
    const futureDay = future.getDate()
    const match = FIXED_HOLIDAYS.find(item => item.month === futureMonth && item.day === futureDay)
    if (match) {
      return {
        name: match.name,
        leadLabel: `${match.name}前${offset}天`,
        category: TRADITIONAL_HOLIDAY_NAMES.has(match.name) ? 'traditional' : 'historical'
      }
    }
  }

  return {}
}

const detectSolarTerm = (date: Date): string => {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const matched = SOLAR_TERMS.find(item => item.month === month && Math.abs(item.day - day) <= 1)
  if (!matched) return ''

  if (day === matched.day) return matched.label
  return `${matched.label}将近`
}

const _detectWeatherCue = (weatherText?: string, temperature?: number | null, apparentTemperature?: number | null) => {
  const normalized = normalizeText(weatherText)
  const temp = Number.isFinite(Number(apparentTemperature)) ? Number(apparentTemperature) : Number(temperature)

  if (normalized.includes('雨') || normalized.includes('雷')) {
    return '雨天'
  }
  if (normalized.includes('雪')) {
    return '雪天'
  }
  if (normalized.includes('雾')) {
    return '雾天'
  }
  if (temp >= 33) {
    return '晴热'
  }
  if (temp >= 28) {
    return '闷热'
  }
  if (temp <= 8) {
    return '偏冷'
  }
  if (temp <= 16) {
    return '微凉'
  }
  if (normalized.includes('晴')) {
    return '晴好'
  }
  if (normalized.includes('云')) {
    return '多云'
  }
  return normalized
}

const detectWeatherType = (
  weatherText?: string,
  weatherCode?: number | null,
  temperature?: number | null,
  apparentTemperature?: number | null
): MarketingWeatherType => {
  const code = Number(weatherCode)
  if ([95, 96, 99].includes(code)) return 'thunderstorm'
  if ([82].includes(code)) return 'heavy_rain'
  if ([65, 67, 75, 86].includes(code)) return code >= 75 ? 'snow' : 'heavy_rain'
  if ([61, 63, 80, 81].includes(code)) return 'light_rain'
  if ([71, 73, 77, 85].includes(code)) return 'snow'
  if ([45, 48].includes(code)) return 'fog'
  if ([0, 1].includes(code)) return 'clear'
  if ([2, 3].includes(code)) return 'cloudy'

  const normalized = normalizeText(weatherText)
  if (normalized.includes('雷')) return 'thunderstorm'
  if (normalized.includes('暴雨') || normalized.includes('大雨') || normalized.includes('强阵雨')) return 'heavy_rain'
  if (normalized.includes('雨')) return 'light_rain'
  if (normalized.includes('雪')) return 'snow'
  if (normalized.includes('雾')) return 'fog'
  if (normalized.includes('云') || normalized.includes('阴')) return 'cloudy'
  if (normalized.includes('晴')) return 'clear'

  const temperatureValue = Number.isFinite(Number(apparentTemperature)) ? Number(apparentTemperature) : Number(temperature)
  return temperatureValue ? 'normal' : 'normal'
}

const safeParseNumber = (value?: string) => {
  const parsed = Number(String(value || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const _formatMoney = (value?: string) => {
  const parsed = safeParseNumber(value)
  if (!parsed) return ''
  return parsed % 1 === 0 ? `¥${parsed.toFixed(0)}` : `¥${parsed.toFixed(2)}`
}

const getProductName = (product: MarketingProductInput) => {
  const parts = [
    normalizeText(product.brand),
    normalizeText(product.model),
    normalizeText(product.color),
    normalizeText(product.memory)
  ].filter(Boolean)

  return parts.join(' ')
}

const getProductShortName = (product: MarketingProductInput) => {
  const parts = [
    normalizeText(product.brand),
    normalizeText(product.model)
  ].filter(Boolean)

  return parts.join(' ')
}

const hasProductIdentity = (product: MarketingProductInput) => [
  product.brand,
  product.model,
  product.color,
  product.memory
].some(value => normalizeText(value))

const createSeed = (input: string) => {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

const mulberry32 = (seed: number) => {
  let a = seed || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(items: T[], rng: () => number) => {
  if (!items.length) return undefined
  const index = Math.floor(rng() * items.length)
  return items[Math.max(0, Math.min(items.length - 1, index))]
}

const pickTypeLexiconValue = <T>(
  items: T[] | undefined,
  type: MarketingCopyType,
  seed: string,
  rng: () => number
) => {
  if (!items?.length) return undefined
  // 以“生成批次 + 类型”作为轮换种子，手动刷新时 nonce 变化，
  // 同一类型会稳定换到词库中的其他句子，而不是长期只碰到几条。
  const index = createSeed(`${seed}|${type}`) % items.length
  return items[index] ?? pick(items, rng)
}

const buildContextTags = (context: MarketingAutoContext) => {
  const tags = [
    context.locationName,
    context.timeSegment,
    context.season,
    context.holidayCue,
    context.solarTermCue,
    context.weatherText
  ]
  return Array.from(new Set(tags.map(tag => normalizeText(tag)).filter(Boolean)))
}

const getContextEmojis = (context: MarketingAutoContext) => {
  const emojis: string[] = []

  if (context.holidayCue) emojis.push(...MARKETING_SCENE_EMOJIS.holiday)
  if (context.solarTermCue) emojis.push(...MARKETING_SCENE_EMOJIS.season)
  if (context.timeSegment === '开门') emojis.push(...MARKETING_SCENE_EMOJIS.opening)
  if (context.timeSegment === '销售') emojis.push(...MARKETING_SCENE_EMOJIS.sales)
  if (context.timeSegment === '下班前') emojis.push(...MARKETING_SCENE_EMOJIS.delivery)
  if (context.timeSegment === '深夜') emojis.push(...MARKETING_SCENE_EMOJIS.night)

  const weather = normalizeText(context.weatherText)
  if (weather.includes('雨') || weather.includes('雷') || weather.includes('雪') || weather.includes('雾') || weather.includes('云') || weather.includes('晴')) {
    emojis.push(...MARKETING_SCENE_EMOJIS.weather)
  }

  if (context.season) emojis.push(...MARKETING_SCENE_EMOJIS.season)
  emojis.push(...MARKETING_SCENE_EMOJIS.style, ...MARKETING_SCENE_EMOJIS.interaction, ...MARKETING_COPY_EMOJIS)

  // 保持顺序稳定并去重，让同一场景下的表情池足够丰富但不重复。
  return Array.from(new Set(emojis))
}

const getEventPhrases = (
  context: MarketingAutoContext,
  eventLexicon: MarketingLexicon['eventLexicon'],
  includeSolarTerm = true
) => {
  if (!eventLexicon) return []
  const findByCue = (pool: Partial<Record<string, string[]>> | undefined, cue?: string) => {
    if (!pool || !cue) return []
    const key = Object.keys(pool).find(item => cue === item || cue.startsWith(item))
    return key ? (pool[key] || []) : []
  }

  const solarTermPhrases = includeSolarTerm
    ? findByCue(eventLexicon.solarTerms, context.solarTermCue)
    : []
  const holidayPool = context.holidayType === 'traditional'
    ? eventLexicon.traditionalHolidays
    : eventLexicon.historicalDays
  const holidayPhrases = findByCue(holidayPool, context.holidayName || context.holidayCue)

  return [...solarTermPhrases, ...holidayPhrases]
}

const getWeatherPhrases = (
  context: MarketingAutoContext,
  weatherLexicon: string[] | Partial<Record<MarketingWeatherType | 'all', string[]>> | undefined
) => {
  if (Array.isArray(weatherLexicon)) return weatherLexicon
  if (!weatherLexicon || typeof weatherLexicon !== 'object') return []
  const weatherType = detectWeatherType(
    context.weatherText,
    context.weatherCode,
    context.temperature,
    context.apparentTemperature
  )
  const aliases: Record<MarketingWeatherType, string[]> = {
    clear: ['clear', '晴天', '晴朗'],
    cloudy: ['cloudy', '多云', '阴天'],
    light_rain: ['light_rain', '小雨', '阵雨'],
    heavy_rain: ['heavy_rain', '大雨', '暴雨'],
    thunderstorm: ['thunderstorm', '雷雨', '雷暴', '强对流'],
    snow: ['snow', '下雪', '小雪', '大雪'],
    fog: ['fog', '雾天', '有雾'],
    normal: ['normal']
  }
  const matchedKey = Object.keys(weatherLexicon).find(key => aliases[weatherType].includes(key))
  return (matchedKey ? weatherLexicon[matchedKey] : undefined) || weatherLexicon[weatherType] || weatherLexicon.all || []
}

const getCategorizedContextPhrases = (
  values: string[] | Partial<Record<string, string[]>> | undefined,
  keys: string[]
) => {
  if (Array.isArray(values)) return values
  if (!values || typeof values !== 'object') return []
  for (const key of keys.filter(Boolean)) {
    const matchedKey = Object.keys(values).find(item => key === item || key.startsWith(item))
    if (matchedKey && values[matchedKey]?.length) return values[matchedKey] || []
  }
  return values.all || []
}

const getColorPhrases = (color: string, values: string[] | Partial<Record<string, string[]>> | undefined) => {
  if (!color || !values) return []
  if (Array.isArray(values)) return values
  const normalizedColor = normalizeText(color)
  const key = Object.keys(values).find(item => normalizedColor.includes(item) || item.includes(normalizedColor))
  return (key ? values[key] : values.all) || []
}

const sanitizeCopyByCondition = (text: string, condition: MarketingCondition) => {
  if (condition !== 'new') {
    return text
  }

  return text
    .replace(/二手/g, '全新')
    .replace(/二手机?/g, '全新机')
    .replace(/翻新/g, '全新')
    .replace(/旧机/g, '新机')
    .replace(/成色/g, '状态')
    .replace(/划算/g, '合适')
    .replace(/耐用/g, '稳定')
}

const replaceGenericProductPhrase = (text: string, subject: string) => {
  if (!subject) return text
  return text
    .replace(/这台手机/g, subject)
    .replace(/一台手机/g, subject)
}

export const MARKETING_MODE_DEFAULT_COPY_TYPE: Record<MarketingMode, MarketingCopyType> = {
  opening: 'cute',
  sales: 'cute'
}

export const getConfiguredMarketingCopyTypes = (
  lexicon?: Pick<MarketingLexicon, 'typeLexicon'>
) => MARKETING_COPY_TYPES.filter((type) => {
  const value = lexicon?.typeLexicon?.[type]
  return Boolean(Array.isArray(value?.lines) && value.lines.some(item => normalizeText(item)))
})

export const getAllowedMarketingCopyTypes = (mode: MarketingMode) => {
  void mode
  return MARKETING_COPY_TYPES
}

export const buildMarketingAutoContext = (options?: {
  date?: Date
  locationName?: string
  weatherText?: string
  weatherCode?: number | null
  temperature?: number | null
  apparentTemperature?: number | null
}) => {
  const now = options?.date || TimeUtil.now().toDate()
  const timeSegment = detectTimeSegment(now)
  const season = detectSeason(now)
  const holiday = detectHoliday(now)
  const solarTermCue = detectSolarTerm(now)
  const weatherText = normalizeText(options?.weatherText)

  return {
    locationName: normalizeText(options?.locationName),
    weatherText,
    weatherCode: options?.weatherCode ?? null,
    temperature: options?.temperature ?? null,
    apparentTemperature: options?.apparentTemperature ?? null,
    timeSegment,
    season,
    holidayCue: holiday.leadLabel || holiday.name || '',
    holidayName: holiday.name || '',
    holidayType: holiday.category,
    solarTermCue,
    dayName: getDayName(now)
  } satisfies MarketingAutoContext
}

export const generateMarketingCopySuggestions = (params: {
  mode: MarketingMode
  copyType?: MarketingCopyType
  condition: MarketingCondition
  product: MarketingProductInput
  context: MarketingAutoContext
  lexicon?: MarketingLexicon
  count?: number
  nonce?: number
}): MarketingCopySuggestion[] => {
  const count = Math.max(6, Math.min(16, params.count || 12))
  const runtimeSalt = Date.now()
  const productName = getProductName(params.product)
  const shortName = getProductShortName(params.product)
  const hasProduct = hasProductIdentity(params.product)
  const highlight = normalizeText(params.product.highlight)
  const { mode, condition, context } = params
  const requestedCopyType = params.copyType && MARKETING_COPY_TYPES.includes(params.copyType)
    ? params.copyType
    : undefined
  const lexicon = params.lexicon || DEFAULT_MARKETING_LEXICON
  const contextLexicon = lexicon.contextLexicon || {}
  const modeLabel = MARKETING_MODE_LABELS[mode]
  const contextEmojis = getContextEmojis(context)
  const isSalesNight = mode === 'sales' && ['下班前', '深夜'].includes(context.timeSegment)
  const modeConfig = lexicon.modeLexicon?.[mode]
  if (!modeConfig) return []
  const modeLines = isSalesNight && modeConfig.nightLines?.length
    ? modeConfig.nightLines
    : modeConfig.lines || []
  // 销售和深夜均只读取开始语句；每个类型只读取自己的类型句式。
  if (!modeLines.length) return []
  const configuredCopyTypes = getConfiguredMarketingCopyTypes(lexicon)
  const copyTypeSequence = requestedCopyType
    ? (configuredCopyTypes.includes(requestedCopyType) ? [requestedCopyType] : [])
    : configuredCopyTypes
  const used = new Set<string>()
  const copies: MarketingCopySuggestion[] = []
  const baseSeed = createSeed([
    runtimeSalt,
    params.nonce || 0,
    mode,
    condition,
    productName,
    context.locationName,
    context.weatherText,
    context.holidayCue || '',
    context.solarTermCue || ''
  ].join('|'))

  if (!copyTypeSequence.length) return []

  // 每个已配置类型只生成一张卡片；空类型不占位、不补默认文案。
  const outputCount = Math.min(count, copyTypeSequence.length)
  for (let index = 0; index < outputCount; index += 1) {
    const rng = mulberry32(baseSeed + index * 9973)
    const effectiveCopyType = copyTypeSequence[index % copyTypeSequence.length]
    const typeWords = lexicon.typeLexicon?.[effectiveCopyType]
    const typeLine = pickTypeLexiconValue(
      typeWords?.lines || [],
      effectiveCopyType,
      `${runtimeSalt}|${params.nonce || 0}|${productName}|${mode}`,
      rng
    ) || ''
    const emojiPool = Array.from(new Set([...contextEmojis, ...MARKETING_COPY_EMOJIS]))
    const leadEmoji = pick(emojiPool, rng) || ''
    const bodyEmoji = pick(emojiPool, mulberry32(baseSeed + index * 4513 + 31)) || ''
    const tailEmoji = pick(emojiPool, mulberry32(baseSeed + index * 2333)) || ''
    const subject = normalizeText(
      hasProduct
        ? (shortName || productName)
        : ''
    )
    const eventPhrases = getEventPhrases(context, lexicon.eventLexicon, lexicon.solarTermEnabled === true)
    const subsidyPhrases = lexicon.subsidyEnabled === true
      ? getCategorizedContextPhrases(contextLexicon.subsidy, ['all'])
      : []
    const customContextPhrases = [
      ...eventPhrases,
      ...(context.holidayCue
        ? getCategorizedContextPhrases(contextLexicon.holiday, [
          context.holidayName || '',
          context.holidayCue || '',
          context.holidayType || ''
        ])
        : []),
      ...(lexicon.solarTermEnabled && context.solarTermCue
        ? getCategorizedContextPhrases(contextLexicon.solarTerm, [context.solarTermCue])
        : []),
      ...(lexicon.weatherEnabled && context.weatherText
        ? getWeatherPhrases(context, contextLexicon.weather)
        : []),
      ...(lexicon.colorEnabled
        ? getColorPhrases(params.product.color, contextLexicon.color)
        : []),
      // 营业模式保持营业语气，不受夜间/下班时段销售语句影响；
      // 只有销售模式才读取按时段配置的应景句。
      ...(mode === 'sales' ? (contextLexicon.timeSegment?.[context.timeSegment] || []) : [])
    ]
    const contextPhrase = [
      pick(customContextPhrases, rng) || '',
      pick(subsidyPhrases, mulberry32(baseSeed + index * 1129 + 7)) || ''
    ].filter(Boolean).join('，')
    const modeLead = pick(modeLines, rng) || modeLines[0]
    const salesTalk = mode === 'sales'
      ? pick(modeConfig.salesTalks || [], mulberry32(baseSeed + index * 3347 + 11)) || ''
      : ''
    const lead = `${leadEmoji ? `${leadEmoji}` : ''}${[modeLead, typeLine].filter(Boolean).join(' ')}`
    const productParts = [
      bodyEmoji,
      subject,
      salesTalk,
      highlight,
      contextPhrase
    ].map(normalizeText).filter(Boolean)
    const body = productParts.join('，')
    const tail = tailEmoji ? `${tailEmoji}` : ''
    const text = [lead, body, tail].filter(Boolean).join('。')
    let safeText = replaceGenericProductPhrase(sanitizeCopyByCondition(text, condition), subject)

    if (used.has(safeText)) {
      const retryRng = mulberry32(baseSeed + index * 7919 + 17)
      const retryModeLead = pick(modeLines, retryRng) || modeLead
      const retryTypeLine = pickTypeLexiconValue(
        typeWords?.lines || [],
        effectiveCopyType,
        `${runtimeSalt}|${params.nonce || 0}|${productName}|${mode}|retry`,
        retryRng
      ) || typeLine
      const retryLead = `${retryModeLead} ${retryTypeLine}`
      const retryTail = tail
      safeText = replaceGenericProductPhrase(
        sanitizeCopyByCondition([retryLead, body, retryTail].filter(Boolean).join('。'), condition),
        subject
      )
      if (used.has(safeText)) continue
    }
    used.add(safeText)

    const title = MARKETING_COPY_TYPE_LABELS[effectiveCopyType]

    const tags = Array.from(new Set([
      title,
      MARKETING_MODE_LABELS[mode],
      condition === 'new' ? '全新' : condition === 'used' ? '二手' : '混合',
      ...buildContextTags(context).slice(0, 4)
    ]))

    copies.push({
      id: `${baseSeed}-${index}`,
      title,
      tone: `${title} · ${modeLabel}`,
      text: capitalizeFirst(safeText),
      tags: Array.from(new Set([
        ...tags,
        MARKETING_COPY_TYPE_LABELS[effectiveCopyType]
      ]))
    })
  }

  return copies
}

export const getWeatherTextByCode = (code?: number | null) => {
  if (code === undefined || code === null || Number.isNaN(Number(code))) {
    return ''
  }

  return WEATHER_CODE_MAP[Number(code)] || ''
}

export const formatMarketingPrice = (value?: string) => {
  const parsed = safeParseNumber(value)
  if (!parsed) return ''
  return parsed % 1 === 0 ? `¥${parsed.toFixed(0)}` : `¥${parsed.toFixed(2)}`
}
