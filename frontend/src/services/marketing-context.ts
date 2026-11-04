import {
  buildMarketingAutoContext,
  getWeatherTextByCode,
  type MarketingAutoContext
} from '@/utils/marketing'
import { TimeUtil } from '@/utils/time'
import { logger } from '@/utils/logger'

interface BrowserCoordinates {
  latitude: number
  longitude: number
}

interface OpenMeteoLocationResult {
  country?: string
  admin1?: string
  admin2?: string
  name?: string
}

interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoLocationResult[]
}

interface OpenMeteoWeatherResponse {
  current?: {
    weather_code?: number | null
    temperature_2m?: number | null
    apparent_temperature?: number | null
  }
}

interface MarketingWeatherResult {
  weatherText: string
  weatherCode: number | null
  temperature: number | null
  apparentTemperature: number | null
}

export interface MarketingContextResult {
  context: MarketingAutoContext
  statusText: string
  locationAvailable: boolean
}

const EXTERNAL_REQUEST_TIMEOUT = 8000

const getBrowserCoordinates = (): Promise<BrowserCoordinates> => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('浏览器不支持定位'))
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    }),
    reject,
    {
      enableHighAccuracy: true,
      timeout: EXTERNAL_REQUEST_TIMEOUT,
      maximumAge: 5 * 60 * 1000
    }
  )
})

const fetchExternalJson = async <T>(url: string): Promise<T> => {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), EXTERNAL_REQUEST_TIMEOUT)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    })
    if (!response.ok) {
      throw new Error(`外部服务请求失败（HTTP ${response.status}）`)
    }
    return await response.json() as T
  } finally {
    window.clearTimeout(timeoutId)
  }
}

const resolveLocationText = async ({ latitude, longitude }: BrowserCoordinates): Promise<string> => {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse')
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    language: 'zh',
    count: '1'
  }).toString()

  const data = await fetchExternalJson<OpenMeteoGeocodingResponse>(url.toString())
  const result = data.results?.[0]
  if (!result) return ''

  return [result.country, result.admin1, result.admin2, result.name]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join('')
}

const resolveWeather = async ({ latitude, longitude }: BrowserCoordinates): Promise<MarketingWeatherResult> => {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,weather_code',
    timezone: 'Asia/Shanghai'
  }).toString()

  const data = await fetchExternalJson<OpenMeteoWeatherResponse>(url.toString())
  const current = data.current || {}
  const temperature = Number(current.temperature_2m)
  const apparentTemperature = Number(current.apparent_temperature)

  return {
    weatherText: getWeatherTextByCode(current.weather_code),
    weatherCode: current.weather_code ?? null,
    temperature: Number.isFinite(temperature) ? temperature : null,
    apparentTemperature: Number.isFinite(apparentTemperature) ? apparentTemperature : null
  }
}

export const loadMarketingAutoContext = async (): Promise<MarketingContextResult> => {
  const date = TimeUtil.now().toDate()
  let coordinates: BrowserCoordinates

  try {
    coordinates = await getBrowserCoordinates()
  } catch (error) {
    logger.warn('营销上下文定位不可用', error)
    return {
      context: buildMarketingAutoContext({ date }),
      statusText: '定位不可用，未使用默认位置',
      locationAvailable: false
    }
  }

  const [locationResult, weatherResult] = await Promise.allSettled([
    resolveLocationText(coordinates),
    resolveWeather(coordinates)
  ])

  if (locationResult.status === 'rejected') {
    logger.warn('营销地址解析失败', locationResult.reason)
  }
  if (weatherResult.status === 'rejected') {
    logger.warn('营销天气查询失败', weatherResult.reason)
  }

  const locationName = locationResult.status === 'fulfilled' ? locationResult.value : ''
  const weather = weatherResult.status === 'fulfilled'
    ? weatherResult.value
    : {
      weatherText: '',
      weatherCode: null,
      temperature: null,
      apparentTemperature: null
    }
  const context = buildMarketingAutoContext({
    date,
    locationName,
    weatherText: weather.weatherText,
    weatherCode: weather.weatherCode,
    temperature: weather.temperature,
    apparentTemperature: weather.apparentTemperature
  })

  let statusText = '已获取坐标，位置和天气服务暂不可用'
  if (context.locationName) {
    statusText = `已自动识别：${context.locationName}`
  } else if (context.weatherText) {
    statusText = '已获取天气，定位名称未获取'
  }

  return {
    context,
    statusText,
    locationAvailable: true
  }
}
