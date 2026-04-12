<template>
  <div class="icon-picker" @submit.prevent>
    <!-- 可折叠的头部 -->
    <div class="icon-picker-header" @click.stop="toggleCollapse" @submit.prevent>
      <div class="header-left">
        <i class="collapse-icon" :class="isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"></i>
        <span class="header-title">
          <!-- Iconify 图标 -->
          <span
            v-if="currentIconClass && isIconifyIconClass(currentIconClass)"
            class="iconify current-icon"
            :data-icon="getIconifyName(currentIconClass)"
          ></span>
          <!-- Font Awesome 图标 -->
          <i v-else :class="currentIconClass || 'fas fa-icons'" class="current-icon"></i>
          {{ currentIconClass || '选择图标' }}
        </span>
      </div>
      <span class="collapse-hint">{{ isCollapsed ? '点击展开' : '点击折叠' }}</span>
    </div>

    <!-- 可折叠的内容区域 -->
    <div v-show="!isCollapsed" class="icon-picker-content" @submit.prevent>
      <div class="icon-picker-search" @submit.prevent>
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input
            v-model="searchQuery"
            @input="filterIcons"
            @keydown.enter.prevent
            type="text"
            placeholder="搜索图标（支持中文/英文）..."
            class="search-input"
          />
          <i v-if="searching" class="fas fa-spinner fa-spin searching-indicator"></i>
        </div>
        <select v-model="selectedCategory" @change="filterIcons" @keydown.enter.prevent class="category-filter">
          <option value="">所有分类</option>
          <option v-for="category in categories" :key="category" :value="category">
            {{ getCategoryLabel(category) }}
          </option>
        </select>
        <button
          type="button"
          @click.stop="toggleOnlineSearch"
          @submit.prevent
          class="online-search-toggle"
          :class="{ active: useOnlineSearch }"
          title="切换在线/离线搜索"
        >
          <i :class="useOnlineSearch ? 'fas fa-globe' : 'fas fa-database'"></i>
          {{ useOnlineSearch ? '在线' : '离线' }}
        </button>
      </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-content">
        <i class="fas fa-spinner fa-spin"></i>
        <p>正在加载图标...</p>
      </div>
    </div>

    <!-- 图标网格 -->
    <div v-else-if="filteredIcons.length > 0" class="icon-grid" @submit.prevent>
      <div
        v-for="icon in paginatedIcons"
        :key="icon.id"
        class="icon-item"
        :class="{ active: selectedIcon === icon.class }"
        @click.stop="selectIcon(icon)"
        :title="`${icon.name} (${icon.class})`"
      >
        <!-- Iconify 图标使用 span + iconify 类 -->
        <span
          v-if="isIconifyIconClass(icon.class)"
          class="iconify"
          :data-icon="getIconifyName(icon.class)"
        ></span>
        <!-- Font Awesome 图标 -->
        <i v-else :class="icon.class"></i>
      </div>
    </div>

    <!-- 无结果状态 -->
    <div v-else class="no-results">
      <i class="fas fa-search"></i>
      <p>{{ searchQuery.trim() || selectedCategory ? '未找到匹配的图标' : '暂无图标数据' }}</p>
      <p class="hint" v-if="!searchQuery.trim() && !selectedCategory">
        尝试刷新页面或检查网络连接
      </p>
      <p class="hint online-hint" v-if="searchQuery.trim() && useOnlineSearch">
        <i class="fas fa-lightbulb"></i>
        提示：支持中文搜索（如"首页"、"用户"、"设置"）
      </p>
    </div>

    <div class="icon-picker-footer" v-if="totalPages > 1" @click.stop @submit.prevent>
      <div class="pagination">
        <button
          type="button"
          @click.stop="prevPage"
          @submit.prevent
          :disabled="currentPage === 1"
          class="btn btn-sm btn-outline-secondary"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button
          type="button"
          @click.stop="nextPage"
          @submit.prevent
          :disabled="currentPage === totalPages"
          class="btn btn-sm btn-outline-secondary"
        >
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { extractIconifyName, isIconifyReady, isIconifyIcon, refreshIconifyIcons, waitForIconify } from '@/utils/iconify'
import { storage } from '@/services/storage'
import { CACHE_STORAGE_KEYS } from '@/constants/storage'

const ICON_PICKER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

let memoryCachedIcons = null
let memoryCachedCategories = null
let iconsLoadingPromise = null

const iconKeywordMap = {
  '首页': 'home',
  '主页': 'home',
  '用户': 'user',
  '客户': 'user',
  '设置': 'settings',
  '系统': 'system',
  '菜单': 'menu',
  '列表': 'list',
  '表格': 'table',
  '图表': 'chart',
  '统计': 'chart',
  '分析': 'analytics',
  '报表': 'report',
  '数据': 'data',
  '数据库': 'database',
  '服务器': 'server',
  '购物车': 'cart',
  '商店': 'store',
  '订单': 'order',
  '商品': 'product',
  '库存': 'inventory',
  '仓库': 'warehouse',
  '盒子': 'box',
  '包裹': 'package',
  '卡车': 'truck',
  '工具': 'tool',
  '编辑': 'edit',
  '删除': 'delete',
  '垃圾桶': 'trash',
  '保存': 'save',
  '下载': 'download',
  '上传': 'upload',
  '打印': 'print',
  '导出': 'export',
  '导入': 'import',
  '文件': 'file',
  '文档': 'document',
  '图片': 'image',
  '铃铛': 'bell',
  '通知': 'notification',
  '消息': 'message',
  '邮件': 'email',
  '电话': 'phone',
  '手机': 'mobile',
  '搜索': 'search',
  '查找': 'search',
  '筛选': 'filter',
  '排序': 'sort',
  '新增': 'plus',
  '增加': 'plus',
  '减号': 'minus',
  '关闭': 'close',
  '返回': 'back',
  '箭头': 'arrow',
  '刷新': 'refresh'
}

const translateSearchKeyword = (query) => {
  if (!query) return ''

  if (iconKeywordMap[query]) {
    return iconKeywordMap[query]
  }

  let translated = query
  Object.entries(iconKeywordMap).forEach(([chinese, english]) => {
    if (translated.includes(chinese)) {
      translated = translated.replaceAll(chinese, english)
    }
  })

  return translated
}

const buildSearchKeywords = (query) => {
  const rawQuery = String(query || '').trim()
  const translatedQuery = translateSearchKeyword(rawQuery)
  return Array.from(new Set([rawQuery, translatedQuery].filter(Boolean).map(item => item.toLowerCase())))
}

const saveIconCache = (icons, categories) => {
  memoryCachedIcons = icons
  memoryCachedCategories = categories

  try {
    storage.set(CACHE_STORAGE_KEYS.ICON_PICKER_CACHE, {
      icons,
      categories,
      timestamp: Date.now()
    }, 'local')
  } catch (e) {
    // 静默处理
  }
}

const readIconCache = () => {
  if (memoryCachedIcons?.length) {
    return {
      icons: memoryCachedIcons,
      categories: memoryCachedCategories || []
    }
  }

  try {
    const cached = storage.get<any>(CACHE_STORAGE_KEYS.ICON_PICKER_CACHE, 'local')
    if (!cached) {
      return null
    }

    if (Date.now() - cached.timestamp >= ICON_PICKER_CACHE_TTL) {
      return null
    }

    memoryCachedIcons = cached.icons || []
    memoryCachedCategories = cached.categories || []

    return {
      icons: memoryCachedIcons,
      categories: memoryCachedCategories
    }
  } catch (error) {
    return null
  }
}

const props = defineProps({
  modelValue: {
    type: [String, null],
    default: null
  },
  defaultCollapsed: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'select'])

// 折叠状态
const isCollapsed = ref(props.defaultCollapsed)

// 切换折叠状态
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

// 在线搜索模式（默认开启）
const useOnlineSearch = ref(true)

// 切换在线/离线搜索
const toggleOnlineSearch = () => {
  useOnlineSearch.value = !useOnlineSearch.value

  // 清空搜索并重新加载
  searchQuery.value = ''
  currentPage.value = 1

  if (useOnlineSearch.value) {
    // 切换到在线模式，清空当前显示
    icons.value = []
  } else {
    // 切换到离线模式，加载本地数据
    icons.value = allIcons.value
  }
}

// 当前显示的图标类名
const currentIconClass = computed(() => {
  return props.modelValue || null
})

const isIconifyIconClass = (iconClass) => isIconifyIcon(String(iconClass || '').trim())
const getIconifyName = (iconClass) => extractIconifyName(String(iconClass || '').trim()) || ''

const refreshCurrentIconPreview = async () => {
  if (!isIconifyIcon(String(props.modelValue || '').trim())) {
    return
  }

  await nextTick()

  if (!isIconifyReady()) {
    await waitForIconify(3000)
  }

  if (isIconifyReady()) {
    const iconName = extractIconifyName(String(props.modelValue || '').trim())
    const iconifyRuntime = typeof window !== 'undefined' ? window.Iconify : null

    if (iconName && iconifyRuntime?.loadIcon) {
      try {
        await iconifyRuntime.loadIcon(iconName)
      } catch (error) {
        // 静默处理
      }
    }

    refreshIconifyIcons()
  }
}

// 状态管理
const searchQuery = ref('')
const selectedCategory = ref('')
const icons = ref([])
const allIcons = ref([]) // 保存所有加载的图标
const categories = ref([])
const currentPage = ref(1)
const iconsPerPage = 96 // 8x12 grid
const loading = ref(true)
const searching = ref(false)
let searchTimer = null

// 计算属性
const filteredIcons = computed(() => {
  let filtered = icons.value

  // 如果有搜索词，不过滤（因为已经从 API 获取了搜索结果）
  // 如果没有搜索词，按分类筛选
  if (!searchQuery.value.trim() && selectedCategory.value) {
    filtered = filtered.filter(icon => icon.category === selectedCategory.value)
  }

  return filtered
})

const totalPages = computed(() => {
  return Math.ceil(filteredIcons.value.length / iconsPerPage)
})

const paginatedIcons = computed(() => {
  const start = (currentPage.value - 1) * iconsPerPage
  const end = start + iconsPerPage
  return filteredIcons.value.slice(start, end)
})

const selectedIcon = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
    emit('select', value)
  }
})

const updateLocalIconCache = (icon) => {
  if (!icon || !icon.class) {
    return
  }

  const exists = allIcons.value.some(item => item.class === icon.class)
  if (!exists) {
    const normalizedIcon = {
      ...icon,
      source: 'local'
    }
    allIcons.value = [normalizedIcon, ...allIcons.value]

    if (!searchQuery.value.trim() || !useOnlineSearch.value) {
      icons.value = [normalizedIcon, ...icons.value.filter(item => item.class !== icon.class)]
    }
  }

  try {
    storage.set(CACHE_STORAGE_KEYS.ICON_PICKER_CACHE, {
      icons: allIcons.value,
      categories: categories.value,
      timestamp: Date.now()
    }, 'local')
  } catch (error) {
    // 静默处理
  }
}

const persistOnlineIcon = async (icon) => {
  if (!icon || !isIconifyIconClass(icon.class)) {
    return
  }

  try {
    const response = await unifiedApi.post('/icons/cache', {
      class: icon.class,
      name: icon.name || getIconifyName(icon.class),
      category: icon.category || 'iconify',
      description: icon.description || `${icon.category || 'iconify'} 图标`,
      tags: icon.tags || icon.category || 'iconify'
    })

    if (response?.success && response.data) {
      updateLocalIconCache(response.data)
      return
    }
  } catch (error) {
    // 静默处理
  }

  updateLocalIconCache({
    class: icon.class,
    name: icon.name || getIconifyName(icon.class),
    category: icon.category || 'iconify',
    description: icon.description || `${icon.category || 'iconify'} 图标`,
    tags: icon.tags || icon.category || 'iconify'
  })
}

// 方法
const filterIcons = () => {
  currentPage.value = 1
  // 触发实时搜索
  searchIcons()
}

const selectIcon = async (icon) => {
  const iconClass = icon?.class || ''
  selectedIcon.value = iconClass

  if (icon?.source === 'online' || isIconifyIconClass(iconClass)) {
    await persistOnlineIcon(icon)
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

const getCategoryLabel = (category) => {
  const labels = {
    'solid': '实心图标',
    'regular': '常规图标',
    'light': '轻量图标',
    'duotone': '双色调图标',
    'brands': '品牌图标'
  }
  return labels[category] || category
}

const loadIcons = async () => {
  try {
    const cached = readIconCache()
    if (cached?.icons?.length) {
      allIcons.value = cached.icons
      icons.value = cached.icons
      categories.value = cached.categories
      loading.value = false
    } else {
      loading.value = true
    }

    if (!iconsLoadingPromise) {
      iconsLoadingPromise = unifiedApi.get('/icons?limit=1000')
        .then(response => {
          if (response && response.success && response.data && response.data.length > 0) {
            const iconData = response.data
            const uniqueCategories = [...new Set(iconData.map(icon => icon.category))].sort()
            saveIconCache(iconData, uniqueCategories)
            return {
              icons: iconData,
              categories: uniqueCategories
            }
          }

          throw new Error('图标接口返回空数据')
        })
        .finally(() => {
          iconsLoadingPromise = null
        })
    }

    try {
      const remoteData = await iconsLoadingPromise
      allIcons.value = remoteData.icons
      icons.value = searchQuery.value.trim() ? icons.value : remoteData.icons
      categories.value = remoteData.categories
      return
    } catch (apiError) {
      if (cached?.icons?.length) {
        return
      }
    }

    // 如果所有方式都失败，使用默认图标
    throw new Error('所有加载方式都失败')

  } catch (error) {
    // 加载失败，使用默认图标
    const defaultIcons = [
      { id: 1, class: 'fas fa-home', name: '首页', category: 'navigation' },
      { id: 2, class: 'fas fa-user', name: '用户', category: 'user' },
      { id: 3, class: 'fas fa-cog', name: '设置', category: 'interface' },
      { id: 4, class: 'fas fa-dashboard', name: '仪表盘', category: 'interface' },
      { id: 5, class: 'fas fa-chart-bar', name: '图表', category: 'data' },
      { id: 6, class: 'fas fa-database', name: '数据库', category: 'data' },
      { id: 7, class: 'fas fa-shopping-cart', name: '购物车', category: 'commerce' },
      { id: 8, class: 'fas fa-box', name: '盒子', category: 'commerce' },
      { id: 9, class: 'fas fa-truck', name: '卡车', category: 'commerce' },
      { id: 10, class: 'fas fa-wrench', name: '扳手', category: 'tools' },
      { id: 11, class: 'fas fa-tools', name: '工具', category: 'tools' },
      { id: 12, class: 'fas fa-chart-line', name: '折线图', category: 'charts' },
      { id: 13, class: 'fas fa-chart-pie', name: '饼图', category: 'charts' },
      { id: 14, class: 'fas fa-file', name: '文件', category: 'files' },
      { id: 15, class: 'fas fa-file-alt', name: '文档', category: 'files' },
      { id: 16, class: 'fas fa-envelope', name: '信封', category: 'communication' },
      { id: 17, class: 'fas fa-bell', name: '铃铛', category: 'notification' },
      { id: 18, class: 'fas fa-search', name: '搜索', category: 'navigation' },
      { id: 19, class: 'fas fa-plus', name: '加号', category: 'interface' },
      { id: 20, class: 'fas fa-minus', name: '减号', category: 'interface' }
    ]
    allIcons.value = defaultIcons
    icons.value = defaultIcons
    categories.value = ['navigation', 'user', 'interface', 'data', 'commerce', 'tools', 'charts', 'files', 'communication', 'notification']
    saveIconCache(defaultIcons, categories.value)
  } finally {
    loading.value = false
  }
}

// 实时搜索图标
const searchIcons = async () => {
  const query = searchQuery.value.trim()

  // 清除之前的定时器
  if (searchTimer) {
    clearTimeout(searchTimer)
  }

  // 如果搜索为空，显示所有图标
  if (!query) {
    icons.value = allIcons.value
    searching.value = false
    return
  }

  // 设置搜索状态
  searching.value = true

  // 防抖：500ms 后执行搜索
  searchTimer = setTimeout(async () => {
    try {
      if (useOnlineSearch.value) {
        // ========== 在线搜索模式 ==========
        await searchOnlineIcons(query)
      } else {
        // ========== 离线搜索模式 ==========
        await searchOfflineIcons(query)
      }

    } catch (error) {
      // 搜索失败，使用前端过滤
      const searchKeywords = buildSearchKeywords(query)
      icons.value = allIcons.value.filter(icon =>
        searchKeywords.some(keyword =>
          (icon.name && icon.name.toLowerCase().includes(keyword)) ||
          (icon.class && icon.class.toLowerCase().includes(keyword)) ||
          (icon.category && icon.category.toLowerCase().includes(keyword)) ||
          (icon.tags && icon.tags.toLowerCase().includes(keyword)) ||
          (icon.description && icon.description.toLowerCase().includes(keyword))
        )
      )
    } finally {
      searching.value = false
    }
  }, 500)
}

// 在线搜索图标（使用 Iconify API）
const searchOnlineIcons = async (query) => {
  try {
    const translatedQuery = translateSearchKeyword(query)
    const response = await unifiedApi.get(`/icons/search/online?query=${encodeURIComponent(translatedQuery || query)}&limit=100`)

    if (response && response.success && response.data && response.data.length > 0) {
      icons.value = response.data

      // 等待 DOM 更新后刷新 Iconify 图标
      await nextTick()

      // 动态导入并使用 Iconify 工具
      try {
        const { refreshIconifyIcons, isIconifyReady } = await import('@/utils/iconify')

        if (isIconifyReady()) {
          refreshIconifyIcons()
        } else {
          // 如果 Iconify 未就绪，等待加载
          const { waitForIconify } = await import('@/utils/iconify')
          const ready = await waitForIconify(3000)

          if (ready) {
            refreshIconifyIcons()
          }
        }
      } catch (iconifyError) {
        // 无法刷新 Iconify 图标，静默处理
      }
    } else {
      icons.value = []
    }
  } catch (error) {
    throw error
  }
}

// 离线搜索图标（使用本地数据库）
const searchOfflineIcons = async (query) => {
  try {
    // 优先尝试本地数据库 API 搜索
    let searchResults = []
    const searchKeywords = buildSearchKeywords(query)

    for (const keyword of searchKeywords) {
      try {
        const response = await unifiedApi.get(`/icons?search=${encodeURIComponent(keyword)}&limit=1000`)
        if (response && response.success && response.data && response.data.length > 0) {
          searchResults = [...searchResults, ...response.data]
        }
      } catch (localApiError) {
        // 本地 API 搜索失败，继续下一个关键词
      }
    }

    searchResults = searchResults.filter((icon, index, array) =>
      array.findIndex(item => item.class === icon.class) === index
    )

    // 如果本地 API 没有结果，使用前端过滤
    if (searchResults.length === 0) {
      searchResults = allIcons.value.filter(icon =>
        searchKeywords.some(keyword =>
          (icon.name && icon.name.toLowerCase().includes(keyword)) ||
          (icon.class && icon.class.toLowerCase().includes(keyword)) ||
          (icon.category && icon.category.toLowerCase().includes(keyword)) ||
          (icon.tags && icon.tags.toLowerCase().includes(keyword)) ||
          (icon.description && icon.description.toLowerCase().includes(keyword))
        )
      )
    }

    icons.value = searchResults
  } catch (error) {
    throw error
  }
}

const loadCategories = async () => {
  // 分类已经在 loadIcons 中加载，这里只是为了兼容
  if (icons.value.length > 0) {
    const uniqueCategories = [...new Set(icons.value.map(icon => icon.category))]
    categories.value = uniqueCategories.sort()
  }
}

// 生命周期
onMounted(async () => {
  await loadIcons()
  await loadCategories()

  // 等待 Iconify 加载完成
  try {
    await waitForIconify(5000)
  } catch (error) {
    // Iconify 加载检查失败，静默处理
  }

  await refreshCurrentIconPreview()
})

// 监听图标数据变化，刷新 Iconify 图标显示
watch(icons, async (newIcons) => {
  // 检查是否有在线图标需要刷新
  const hasOnlineIcons = newIcons.some(icon => icon.source === 'online' || icon.iconifyName)

  if (hasOnlineIcons) {
    await nextTick()
    try {
      if (isIconifyReady()) {
        refreshIconifyIcons()
      }
    } catch (error) {
      // 静默处理
    }
  }
}, { deep: true })

// 监听搜索和分类变化，重置分页
watch([searchQuery, selectedCategory], () => {
  currentPage.value = 1
})

watch(() => props.modelValue, async () => {
  await refreshCurrentIconPreview()
})

watch(isCollapsed, async (collapsed) => {
  if (!collapsed) {
    await refreshCurrentIconPreview()
  }
})
</script>

<style scoped>
.icon-picker {
  border: 1px solid #e9ecef;
  border-radius: 12px;
  background: white;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Iconify 图标样式 */
.iconify {
  display: inline-block;
  vertical-align: middle;
  font-size: 18px;
  width: 1em;
  height: 1em;
}

/* 确保图标网格中的图标大小一致 */
.icon-item .iconify {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

.icon-picker-header {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.icon-picker-header:hover {
  background: #e9ecef;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-icon {
  font-size: 12px;
  color: #6c757d;
  transition: transform 0.3s;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #495057;
}

.current-icon {
  font-size: 16px;
  color: #667eea;
}

.collapse-hint {
  font-size: 12px;
  color: #adb5bd;
}

.icon-picker-content {
  background: white;
}

.icon-picker-search {
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-box i {
  position: absolute;
  left: 12px;
  color: #6c757d;
  font-size: 14px;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.searching-indicator {
  position: absolute;
  right: 12px;
  color: #667eea;
  font-size: 14px;
}

.category-filter {
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  min-width: 120px;
}

.category-filter:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.online-search-toggle {
  padding: 8px 16px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6c757d;
}

.online-search-toggle:hover {
  background: #f8f9fa;
  border-color: #667eea;
}

.online-search-toggle.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
}

.online-search-toggle i {
  font-size: 14px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 4px;
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.icon-item {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #f8f9fa;
  font-size: 18px;
  color: #495057;
}

.icon-item:hover {
  background: #e9ecef;
  border-color: #dee2e6;
  transform: translateY(-1px);
}

.icon-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.no-results {
  padding: 40px;
  text-align: center;
  color: #6c757d;
}

.no-results i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.icon-picker-footer {
  padding: 16px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: center;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-info {
  font-size: 14px;
  font-weight: 500;
  color: #495057;
  min-width: 60px;
  text-align: center;
}

/* 加载状态样式 */
.loading-state {
  padding: 40px;
  text-align: center;
  color: #6c757d;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-content i {
  font-size: 32px;
  color: #667eea;
}

.no-results .hint {
  font-size: 12px;
  color: #adb5bd;
  margin-top: 8px;
  margin-bottom: 0;
}

.no-results .online-hint {
  color: #667eea;
  font-size: 13px;
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.no-results .online-hint i {
  font-size: 14px;
}

/* 滚动条样式 */
.icon-grid::-webkit-scrollbar {
  width: 6px;
}

.icon-grid::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.icon-grid::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.icon-grid::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .icon-picker-header {
    flex-direction: column;
    gap: 8px;
  }

  .search-box {
    width: 100%;
  }

  .category-filter {
    width: 100%;
  }

  .icon-grid {
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 3px;
    padding: 12px;
  }

  .icon-item {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }
}
</style>
