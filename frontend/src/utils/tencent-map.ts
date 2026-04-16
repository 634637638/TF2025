import { ElMessage } from 'element-plus'

const TENCENT_MAP_SCRIPT_BASE_URL = 'https://map.qq.com/api/gljs?v=1.exp'
const tencentMapKey = (import.meta.env.VITE_TENCENT_MAP_KEY || '').trim()

export function buildTencentMapScriptUrl(): string | null {
  if (!tencentMapKey) {
    return null
  }

  return `${TENCENT_MAP_SCRIPT_BASE_URL}&key=${encodeURIComponent(tencentMapKey)}`
}

export function ensureTencentMapKey(message = '未配置腾讯地图 Key，请联系管理员配置环境变量 VITE_TENCENT_MAP_KEY'): string | null {
  if (tencentMapKey) {
    return tencentMapKey
  }

  ElMessage.error(message)
  return null
}
