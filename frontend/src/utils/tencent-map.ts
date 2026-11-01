import { showElementError } from '@/utils/element-feedback'

const TENCENT_MAP_SCRIPT_BASE_URL = 'https://map.qq.com/api/gljs?v=1.exp'
const environmentTencentMapKey = (import.meta.env.VITE_TENCENT_MAP_KEY || '').trim()
let mapScriptPromise: Promise<void> | null = null

export function getTencentMapKey(runtimeKey?: unknown): string {
  const configuredKey = typeof runtimeKey === 'string' ? runtimeKey.trim() : ''
  return configuredKey || environmentTencentMapKey
}

export function buildTencentMapScriptUrl(runtimeKey?: unknown): string | null {
  const tencentMapKey = getTencentMapKey(runtimeKey)
  if (!tencentMapKey) {
    return null
  }

  return `${TENCENT_MAP_SCRIPT_BASE_URL}&key=${encodeURIComponent(tencentMapKey)}`
}

export function ensureTencentMapKey(runtimeKey?: unknown, message = '未配置腾讯地图 Key，请在商城配置中填写腾讯地图浏览器 Key'): string | null {
  const tencentMapKey = getTencentMapKey(runtimeKey)
  if (tencentMapKey) {
    return tencentMapKey
  }

  showElementError(message)
  return null
}

/** 后台选点与商城地图共用同一个 SDK 加载状态。 */
export function loadTencentMapScript(runtimeKey?: unknown): Promise<void> {
  if (window.TMap) {
    return Promise.resolve()
  }
  if (mapScriptPromise) {
    return mapScriptPromise
  }

  const scriptUrl = buildTencentMapScriptUrl(runtimeKey)
  if (!scriptUrl) {
    return Promise.reject(new Error('腾讯地图 Key 未配置'))
  }

  let script: HTMLScriptElement | null = null
  mapScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-tencent-map-sdk]')
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.TMap) resolve()
        else reject(new Error('腾讯地图 SDK 初始化失败，请检查 Key 和域名白名单'))
      }, { once: true })
      existingScript.addEventListener('error', () => reject(new Error('地图脚本加载失败')), { once: true })
      return
    }

    script = document.createElement('script')
    script.dataset.tencentMapSdk = 'true'
    script.src = scriptUrl
    script.onload = () => {
      if (window.TMap) resolve()
      else reject(new Error('腾讯地图 SDK 初始化失败，请检查 Key 和域名白名单'))
    }
    script.onerror = () => reject(new Error('地图脚本加载失败'))
    document.head.appendChild(script)
  }).catch((error) => {
    script?.remove()
    mapScriptPromise = null
    throw error
  })

  return mapScriptPromise
}
