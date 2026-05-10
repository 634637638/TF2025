/**
 * 全局站点设置 Store
 * 管理网站名称、Logo、主题等全局设置
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { buildLogoUrl } from '@/utils/logoUtils'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'

interface SiteSettings {
  logoUrl: string
  siteName: string
  siteSubtitle: string
  siteDomain: string
  icpNumber: string
  companyName: string
  contactPhone: string
  contactEmail: string
  companyAddress: string
}

interface UpdateSiteSettingsResult {
  savedFields: string[]
  unsupportedFields: string[]
}

const DEFAULT_FAVICON = '/favicon.ico'

const ensureHeadLink = (selector: string, attributes: Record<string, string>) => {
  if (typeof document === 'undefined') return null

  const matchedLinks = Array.from(document.head.querySelectorAll<HTMLLinkElement>(selector))
  const [primaryLink, ...duplicateLinks] = matchedLinks

  duplicateLinks.forEach(link => link.remove())

  let link = primaryLink || null
  if (!link) {
    link = document.createElement('link')
    Object.entries(attributes).forEach(([key, value]) => {
      link!.setAttribute(key, value)
    })
    document.head.appendChild(link)
  }
  return link
}

const getFaviconMimeType = (iconUrl: string): string => {
  const cleanUrl = iconUrl.split('?')[0].toLowerCase()

  if (cleanUrl.endsWith('.svg')) return 'image/svg+xml'
  if (cleanUrl.endsWith('.png')) return 'image/png'
  if (cleanUrl.endsWith('.gif')) return 'image/gif'
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg'
  if (cleanUrl.endsWith('.webp')) return 'image/webp'

  return 'image/x-icon'
}

const syncDocumentBranding = (siteName?: string, logoUrl?: string) => {
  if (typeof document === 'undefined') return

  const normalizedTitle = siteName?.trim() || '腾飞数码管理系统'
  document.title = normalizedTitle

  const normalizedLogo = logoUrl ? buildLogoUrl(logoUrl) : ''
  const faviconHref = normalizedLogo || DEFAULT_FAVICON
  const faviconType = getFaviconMimeType(faviconHref)
  const cacheSafeHref = faviconHref.includes('?')
    ? `${faviconHref}&t=${Date.now()}`
    : `${faviconHref}?t=${Date.now()}`

  const iconLink = ensureHeadLink('link[rel="icon"]', {
    rel: 'icon',
    type: faviconType
  })
  const shortcutIconLink = ensureHeadLink('link[rel="shortcut icon"]', {
    rel: 'shortcut icon',
    type: faviconType
  })
  const appleTouchIconLink = ensureHeadLink('link[rel="apple-touch-icon"]', {
    rel: 'apple-touch-icon'
  })

  iconLink?.setAttribute('href', cacheSafeHref)
  iconLink?.setAttribute('type', faviconType)
  shortcutIconLink?.setAttribute('href', cacheSafeHref)
  shortcutIconLink?.setAttribute('type', faviconType)
  appleTouchIconLink?.setAttribute('href', cacheSafeHref)
}

export const useSiteSettingsStore = defineStore('siteSettings', () => {
  // 状态
  const settings = ref<SiteSettings>({
    logoUrl: '',
    siteName: '腾飞数码管理系统',
    siteSubtitle: '专业的手机销售管理解决方案',
    siteDomain: 'www.tf2025.com',
    icpNumber: '京ICP备12345678号',
    companyName: '腾飞数码科技有限公司',
    contactPhone: '400-123-4567',
    contactEmail: 'service@tf2025.com',
    companyAddress: '北京市朝阳区建国路88号SOHO现代城A座2808室'
  })

  const isLoading = ref(false)
  const lastUpdated = ref<Date | null>(null)
  let loadPromise: Promise<void> | null = null

  // 计算属性
  const displayName = computed(() => {
    return settings.value.siteName || '腾飞数码管理系统'
  })

  const hasLogo = computed(() => {
    return !!settings.value.logoUrl
  })

  // 方法
  const loadSiteSettings = async (forceReload = false) => {
    if (loadPromise) {
      return loadPromise
    }

    // 避免重复调用
    if (isLoading.value) {
      return
    }

    // 如果已经加载过且不强制重新加载，跳过（但允许短时间内强制刷新）
    if (!forceReload && lastUpdated.value && (Date.now() - lastUpdated.value.getTime() < 2000)) {
      return
    }

    loadPromise = (async () => {
    try {
      isLoading.value = true

      const response = await unifiedApi.get('/system/site-settings')

      if (response.success && response.data) {
        // 更新设置
        Object.assign(settings.value, response.data)
        lastUpdated.value = new Date()

        // 触发设置更新事件
        window.dispatchEvent(new CustomEvent('tf2025:site-settings-updated', {
          detail: { settings: settings.value }
        }))
      }
    } catch (error) {
      // 加载站点设置失败，使用默认设置
    } finally {
      isLoading.value = false
    }
    })().finally(() => {
      loadPromise = null
    })

    return loadPromise
  }

  const updateSiteSettings = async (newSettings: Partial<SiteSettings>): Promise<UpdateSiteSettingsResult | null> => {
    const previousSettings = { ...settings.value }

    try {
      isLoading.value = true

      // 更新本地设置
      Object.assign(settings.value, newSettings)

      // 发送到服务器
      const response = await unifiedApi.post('/system/site-settings', settings.value)

      if (response.success) {
        lastUpdated.value = new Date()

        syncDocumentBranding(settings.value.siteName, settings.value.logoUrl)

        // 触发设置更新事件
        window.dispatchEvent(new CustomEvent('tf2025:site-settings-updated', {
          detail: { settings: settings.value }
        }))

        // 设置更新成功，标题将由watch监听器自动更新

        return response.data || {
          savedFields: Object.keys(newSettings),
          unsupportedFields: []
        }
      } else {
        throw new Error(response.message || '更新失败')
      }
    } catch (error) {
      logger.error('❌ 更新站点设置失败:', error)

      // 如果API调用失败，回滚本地更改
      Object.assign(settings.value, previousSettings)
      await loadSiteSettings(true)
      return null
    } finally {
      isLoading.value = false
    }
  }

  const resetSettings = () => {
    const defaultSettings: SiteSettings = {
      logoUrl: '',
      siteName: '腾飞数码管理系统',
      siteSubtitle: '专业的手机销售管理解决方案',
      siteDomain: 'www.tf2025.com',
      icpNumber: '京ICP备12345678号',
      companyName: '腾飞数码科技有限公司',
      contactPhone: '400-123-4567',
      contactEmail: 'service@tf2025.com',
      companyAddress: '北京市朝阳区建国路88号SOHO现代城A座2808室'
    }

    Object.assign(settings.value, defaultSettings)
    // 标题将由watch监听器自动更新

    // 触发设置重置事件
    window.dispatchEvent(new CustomEvent('tf2025:site-settings-reset', {
      detail: { settings: settings.value }
    }))
  }

  // 监听设置变化，自动更新浏览器标题
  watch(() => settings.value.siteName, (newName) => {
    syncDocumentBranding(newName, settings.value.logoUrl)
  }, { immediate: true })

  // 监听Logo变化，触发更新事件
  watch(() => settings.value.logoUrl, (newLogo) => {
    syncDocumentBranding(settings.value.siteName, newLogo)
    window.dispatchEvent(new CustomEvent('tf2025:site-logo-updated', {
      detail: { logoUrl: newLogo }
    }))
  }, { immediate: true })

  return {
    // 状态
    settings,
    isLoading,
    lastUpdated,

    // 计算属性
    displayName,
    hasLogo,

    // 方法
    loadSiteSettings,
    updateSiteSettings,
    resetSettings
  }
})

// 在应用启动时自动加载设置（移除认证依赖，让Logo可以在登录页面显示）
export const initializeSiteSettings = async () => {
  const siteSettingsStore = useSiteSettingsStore()

  // 直接加载站点设置，不依赖认证状态
  await siteSettingsStore.loadSiteSettings()

  return siteSettingsStore
}
