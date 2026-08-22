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
  publicPriceContacts: string
  publicPriceWatermark: string
  publicPriceWatermarkEnabled: string
  publicPriceWatermarkTimeEnabled: string
  publicPriceWatermarkColor: string
}

interface UpdateSiteSettingsResult {
  savedFields: string[]
  unsupportedFields: string[]
}

const DEFAULT_FAVICON = '/favicon.ico'
let appliedFaviconHref = ''
let appliedFaviconType = ''

const removeDuplicateFaviconLinks = () => {
  if (typeof document === 'undefined') return

  const faviconLinks = Array.from(document.head.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  ))

  faviconLinks.forEach((link) => {
    const relation = link.getAttribute('rel')?.toLowerCase() || ''
    const isIconLink = ['icon', 'shortcut icon', 'apple-touch-icon'].includes(relation)

    if (isIconLink && link.id !== 'app-favicon') {
      link.remove()
    }
  })
}

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
  if (document.title !== normalizedTitle) {
    document.title = normalizedTitle
  }

  const normalizedLogo = logoUrl ? buildLogoUrl(logoUrl) : ''
  const faviconHref = normalizedLogo || DEFAULT_FAVICON
  const faviconType = getFaviconMimeType(faviconHref)

  if (appliedFaviconHref === faviconHref && appliedFaviconType === faviconType) {
    return
  }

  removeDuplicateFaviconLinks()

  const iconLink = ensureHeadLink('#app-favicon', {
    id: 'app-favicon',
    rel: 'icon',
    type: faviconType
  })

  iconLink?.setAttribute('href', faviconHref)
  iconLink?.setAttribute('type', faviconType)

  appliedFaviconHref = faviconHref
  appliedFaviconType = faviconType
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
    ,publicPriceContacts: '饶先生|132-0790-3333\n刘女士|132-0790-3335\n三小店|156-7907-9373\n广场店|156-0790-9320'
    ,publicPriceWatermark: '腾飞数码 132-0790-3333'
    ,publicPriceWatermarkEnabled: '1'
    ,publicPriceWatermarkTimeEnabled: '1'
    ,publicPriceWatermarkColor: '#6b7280'
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

      const response = await unifiedApi.get('/system/site-settings', {
        showLoading: false,
        showError: false,
        // 强制刷新用于公开报价页和设置页保存后的回读，不能命中旧的3秒GET缓存。
        useCache: !forceReload,
        ...(forceReload ? { params: { _t: Date.now() } } : {})
      })

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
      const response = await unifiedApi.post('/system/site-settings', settings.value, {
        showLoading: false
      })

      if (response.success) {
        lastUpdated.value = new Date()

        // 让同时打开的公开报价页也能感知后台设置已更新。
        try {
          window.localStorage.setItem('tf2025:site-settings-version', String(Date.now()))
        } catch {
          // 隐私模式或禁用存储时，当前窗口事件仍可正常更新。
        }

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
      ,publicPriceContacts: '饶先生|132-0790-3333\n刘女士|132-0790-3335\n三小店|156-7907-9373\n广场店|156-0790-9320'
      ,publicPriceWatermark: '腾飞数码 132-0790-3333'
      ,publicPriceWatermarkEnabled: '1'
      ,publicPriceWatermarkTimeEnabled: '1'
      ,publicPriceWatermarkColor: '#6b7280'
    }

    Object.assign(settings.value, defaultSettings)
    // 标题将由watch监听器自动更新

    // 触发设置重置事件
    window.dispatchEvent(new CustomEvent('tf2025:site-settings-reset', {
      detail: { settings: settings.value }
    }))
  }

  // 标题与 favicon 统一由同一个监听器同步，避免站点名称和 logo 分别触发两次资源请求
  watch(
    () => [settings.value.siteName, settings.value.logoUrl] as const,
    ([newName, newLogo], previousValue) => {
      const previousLogo = previousValue?.[1]
      syncDocumentBranding(newName, newLogo)

      if (newLogo !== previousLogo) {
        window.dispatchEvent(new CustomEvent('tf2025:site-logo-updated', {
          detail: { logoUrl: newLogo }
        }))
      }
    },
    { immediate: true }
  )

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
