<template>
  <div class="icon-picker">
    <!-- 可折叠的头部 -->
    <div
      class="icon-picker-header"
      role="button"
      tabindex="0"
      @click.stop="toggleCollapse"
      @keydown.enter.prevent.stop="toggleCollapse"
      @keydown.space.prevent.stop="toggleCollapse"
    >
      <div class="header-left">
        <i class="collapse-icon" :class="isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"></i>
        <span class="header-title">
          <IconRenderer
            :icon="currentIconClass || 'fas fa-icons'"
            :svg="currentIconSvg"
            class-name="current-icon"
            fallback="fas fa-icons"
          />
        </span>
      </div>
      <span class="collapse-hint">{{ isCollapsed ? '点击展开' : '点击折叠' }}</span>
    </div>

    <!-- 可折叠的内容区域 -->
    <div v-show="!isCollapsed" class="icon-picker-content">
      <div class="icon-picker-search">
        <el-input
          v-model="searchQuery"
          placeholder="搜索图标（支持中文/英文）..."
          clearable
          class="icon-search-input"
          @input="filterIcons"
          @keydown.enter.prevent
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
          <template v-if="searching" #suffix>
            <InlineLoading size="small" />
          </template>
        </el-input>

        <el-select
          v-model="selectedCategory"
          placeholder="所有分类"
          clearable
          filterable
          class="category-filter"
          popper-class="tf2025-form-popper icon-picker-category-dropdown"
          @change="filterIcons"
          @keydown.enter.prevent
        >
          <el-option label="所有分类" value="" />
          <el-option
            v-for="category in categories"
            :key="category"
            :label="getCategoryLabel(category)"
            :value="category"
          />
        </el-select>

        <el-segmented
          v-model="searchMode"
          :options="searchModeOptions"
          class="search-mode-toggle"
          @change="handleSearchModeChange"
        />
      </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-content">
        <InlineLoading text="正在加载图标..." />
      </div>
    </div>

    <!-- 图标网格 -->
    <div v-else-if="filteredIcons.length > 0" class="icon-grid">
      <div
        v-for="icon in paginatedIcons"
        :key="icon.id"
        class="icon-item"
        :class="{ active: selectedIcon === icon.class }"
        role="button"
        tabindex="0"
        @pointerdown.prevent.stop="selectIcon(icon)"
        @click.prevent.stop
        @keydown.enter.prevent.stop="selectIcon(icon)"
        @keydown.space.prevent.stop="selectIcon(icon)"
        :title="`${icon.name} (${icon.class})`"
      >
        <IconRenderer :icon="icon.class" :svg="icon.svg" />
        <button
          v-if="canDeleteIcon(icon)"
          type="button"
          class="icon-delete-btn"
          title="删除本地图标"
          @click.stop="deleteLocalIcon(icon)"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- 无结果状态 -->
    <div v-else class="no-results">
      <i class="fas fa-search"></i>
      <p>{{ emptyStateText }}</p>
      <p class="hint" v-if="emptyStateHint">
        {{ emptyStateHint }}
      </p>
    </div>

    <div class="icon-picker-footer" v-if="totalPages > 1" @click.stop>
      <div class="pagination">
        <button
          type="button"
          @click.stop="prevPage"
          :disabled="currentPage === 1"
          class="btn btn-sm btn-outline-secondary"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button
          type="button"
          @click.stop="nextPage"
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
import { ref, computed, onMounted, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { ElMessage, ElMessageBox } from 'element-plus'
import InlineLoading from '@/components/InlineLoading.vue'
import IconRenderer from '@/components/IconRenderer.vue'
import { extractIconifyName, isIconifyIcon } from '@/utils/iconify'
import { storage } from '@/services/storage'
import { CACHE_STORAGE_KEYS } from '@/constants/storage'

const ICON_PICKER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const ICON_PICKER_FALLBACK_DELAY = 1500

const DEFAULT_ICONS = [
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
const DEFAULT_ICON_CATEGORIES = ['navigation', 'user', 'interface', 'data', 'commerce', 'tools', 'charts', 'files', 'communication', 'notification']

let memoryCachedIcons = null
let memoryCachedCategories = null
let iconsLoadingPromise = null

const iconKeywordMap = {
  '首页': 'home',
  '主页': 'home',
  '用户': 'user',
  '客户': 'user',
  '员工': 'employee',
  '供应商': 'supplier',
  '设置': 'settings',
  '系统': 'system',
  '权限': 'permission',
  '角色': 'role',
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
  '产品': 'product',
  '销售': 'sales',
  '收银': 'cashier',
  '付款': 'payment',
  '支付': 'payment',
  '账单': 'bill',
  '利润': 'profit',
  '价格': 'price',
  '价目表': 'price',
  '库存': 'inventory',
  '入库': 'stock-in',
  '出库': 'stock-out',
  '调拨': 'transfer',
  '仓库': 'warehouse',
  '维修': 'repair',
  '补贴': 'subsidy',
  '工资': 'salary',
  '考勤': 'attendance',
  '商城': 'store',
  '横幅': 'banner',
  '轮播': 'banner',
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

const isChineseText = (value) => /[\u4e00-\u9fa5]/.test(String(value || ''))

const iconCategoryRules = [
  { category: '导航', keywords: ['首页', '主页', '菜单', '返回', '箭头', '搜索', '导航', 'home', 'menu', 'back', 'arrow', 'search', 'navigation'] },
  { category: '用户客户', keywords: ['用户', '客户', '员工', '供应商', '会员', 'user', 'customer', 'employee', 'supplier', 'people', 'person'] },
  { category: '系统管理', keywords: ['系统', '设置', '配置', '管理', '后台', '仪表盘', 'system', 'settings', 'config', 'admin', 'dashboard', 'gear', 'cog'] },
  { category: '权限安全', keywords: ['权限', '角色', '安全', '锁', '钥匙', '密码', 'permission', 'role', 'security', 'lock', 'key', 'shield', 'password'] },
  { category: '销售收款', keywords: ['销售', '收银', '付款', '支付', '账单', '利润', '价格', '价目表', 'sales', 'sell', 'cash', 'cashier', 'payment', 'pay', 'receipt', 'invoice', 'wallet', 'price', 'money'] },
  { category: '库存仓储', keywords: ['库存', '入库', '出库', '调拨', '仓库', '运输', '送货', 'inventory', 'stock', 'warehouse', 'box', 'package', 'truck', 'shipping', 'delivery'] },
  { category: '商品订单', keywords: ['商品', '产品', '订单', '商城', '购物车', '商店', 'product', 'order', 'cart', 'store', 'shop'] },
  { category: '数据报表', keywords: ['数据', '统计', '分析', '报表', '图表', '数据库', 'data', 'chart', 'analytics', 'report', 'database', 'table'] },
  { category: '文件媒体', keywords: ['文件', '文档', '图片', '照片', '视频', '音乐', 'file', 'document', 'image', 'photo', 'video', 'music'] },
  { category: '通知消息', keywords: ['通知', '消息', '邮件', '电话', '铃铛', 'notification', 'message', 'email', 'phone', 'bell', 'envelope'] },
  { category: '工具操作', keywords: ['工具', '维修', '编辑', '删除', '保存', '导入', '导出', '打印', 'tool', 'wrench', 'repair', 'edit', 'delete', 'trash', 'save', 'import', 'export', 'print'] },
  { category: '时间日历', keywords: ['考勤', '工资', '时间', '日历', '时钟', 'attendance', 'salary', 'time', 'calendar', 'clock'] },
  { category: '地图位置', keywords: ['地图', '位置', '全球', 'map', 'location', 'globe'] }
]

const resolveIconCategory = (icon, query = '') => {
  const currentCategory = String(icon?.category || '').trim()
  if (isChineseText(currentCategory)) {
    return currentCategory
  }

  const text = [
    query,
    icon?.name,
    icon?.class,
    icon?.iconifyName,
    currentCategory,
    icon?.description,
    icon?.tags
  ].filter(Boolean).join(' ').toLowerCase()

  const matchedRule = iconCategoryRules.find(rule =>
    rule.keywords.some(keyword => text.includes(String(keyword).toLowerCase()))
  )

  return matchedRule?.category || '在线图标'
}

const buildOnlineIconTags = (icon, category) => {
  return Array.from(new Set([
    category,
    icon?.category,
    icon?.tags,
    icon?.iconifyName || getIconifyName(icon?.class),
    icon?.name
  ].filter(Boolean).map(item => String(item).trim()).filter(Boolean))).join(',')
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

const applyFallbackIcons = () => {
  allIcons.value = DEFAULT_ICONS
  icons.value = DEFAULT_ICONS
  categories.value = DEFAULT_ICON_CATEGORIES
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

// 默认使用本地图标，在线检索由用户手动切换。
const useOnlineSearch = ref(false)
const searchMode = ref('local')
const searchModeOptions = [
  { label: '本地', value: 'local' },
  { label: '在线', value: 'online' }
]

// 切换在线/离线搜索
const handleSearchModeChange = (mode) => {
  useOnlineSearch.value = mode === 'online'
  selectedCategory.value = ''
  currentPage.value = 1

  if (useOnlineSearch.value) {
    if (searchQuery.value.trim()) {
      searchIcons()
    } else {
      icons.value = []
      searching.value = false
    }
  } else {
    icons.value = allIcons.value
    if (searchQuery.value.trim()) {
      searchIcons()
    }
  }
}

// 当前显示的图标类名
const currentIconClass = computed(() => {
  return props.modelValue || null
})

const currentIconSvg = computed(() => {
  const currentClass = String(props.modelValue || '').trim()
  if (!currentClass) {
    return ''
  }

  return allIcons.value.find(icon => icon.class === currentClass)?.svg ||
    icons.value.find(icon => icon.class === currentClass)?.svg ||
    ''
})

const isIconifyIconClass = (iconClass) => isIconifyIcon(String(iconClass || '').trim())
const getIconifyName = (iconClass) => extractIconifyName(String(iconClass || '').trim()) || ''

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

const emptyStateText = computed(() => {
  if (useOnlineSearch.value && !searchQuery.value.trim()) {
    return '输入关键词后搜索在线图标'
  }

  if (searchQuery.value.trim() || selectedCategory.value) {
    return '未找到匹配的图标'
  }

  return '暂无图标数据'
})

const emptyStateHint = computed(() => {
  if (useOnlineSearch.value && !searchQuery.value.trim()) {
    return '例如：首页、销售、库存、设置'
  }

  if (!searchQuery.value.trim() && !selectedCategory.value) {
    return '本地图标库正在后台刷新，稍后会自动补全'
  }

  return ''
})

const selectedIcon = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
  }
})

const updateLocalIconCache = (icon) => {
  if (!icon || !icon.class) {
    return
  }

  const normalizedIcon = {
    ...icon,
    source: icon.source === 'online' ? 'local' : (icon.source || 'local')
  }
  const exists = allIcons.value.some(item => item.class === icon.class)
  const shouldSyncVisibleIcons = !useOnlineSearch.value

  if (!exists) {
    allIcons.value = [normalizedIcon, ...allIcons.value]

    if (shouldSyncVisibleIcons && !searchQuery.value.trim()) {
      icons.value = [normalizedIcon, ...icons.value.filter(item => item.class !== icon.class)]
    }
  } else {
    allIcons.value = allIcons.value.map(item => item.class === icon.class ? { ...item, ...normalizedIcon } : item)
    if (shouldSyncVisibleIcons) {
      icons.value = icons.value.map(item => item.class === icon.class ? { ...item, ...normalizedIcon } : item)
    }
  }

  if (normalizedIcon.category && !categories.value.includes(normalizedIcon.category)) {
    categories.value = [...categories.value, normalizedIcon.category].sort()
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
    const localCategory = resolveIconCategory(icon, searchQuery.value)
    const iconifyName = icon.iconifyName || getIconifyName(icon.class)
    const tags = buildOnlineIconTags(icon, localCategory)

    const response = await unifiedApi.post('/icons/cache', {
      class: icon.class,
      name: icon.name || iconifyName,
      category: localCategory,
      description: icon.description || `${localCategory}图标`,
      tags,
      iconifyName,
      svg: icon.svg || null
    })

    if (response?.success && response.data) {
      updateLocalIconCache(response.data)
      return
    }
  } catch (error) {
    // 静默处理
  }

  const localCategory = resolveIconCategory(icon, searchQuery.value)
  const iconifyName = icon.iconifyName || getIconifyName(icon.class)
  updateLocalIconCache({
    class: icon.class,
    name: icon.name || iconifyName,
    category: localCategory,
    description: icon.description || `${localCategory}图标`,
    tags: buildOnlineIconTags(icon, localCategory),
    iconifyName
  })
}

const canDeleteIcon = (icon) => {
  return Boolean(icon?.id && icon.source !== 'online')
}

const removeIconFromCache = (iconId) => {
  allIcons.value = allIcons.value.filter(icon => icon.id !== iconId)
  icons.value = icons.value.filter(icon => icon.id !== iconId)
  saveIconCache(allIcons.value, categories.value)
}

const deleteLocalIcon = async (icon) => {
  if (!canDeleteIcon(icon)) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定删除图标「${icon.name || icon.class}」吗？如果菜单正在使用，系统会阻止删除。`,
      '删除图标',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await unifiedApi.delete(`/icons/${icon.id}`)
    if (response?.success) {
      removeIconFromCache(icon.id)
      ElMessage.success(response.message || '图标已删除')
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      const message = error?.response?.data?.message || error?.message || '删除图标失败'
      ElMessage.warning(message)
    }
  }
}

// 方法
const filterIcons = () => {
  currentPage.value = 1
  // 触发实时搜索
  searchIcons()
}

const selectIcon = (icon) => {
  const iconClass = icon?.class || ''
  if (!iconClass) {
    return
  }

  selectedIcon.value = iconClass
  emit('select', iconClass, icon)

  if (icon?.source === 'online' || isIconifyIconClass(iconClass)) {
    persistOnlineIcon(icon)
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
  if (isChineseText(category)) {
    return category
  }

  const labels = {
    'solid': '实心图标',
    'regular': '常规图标',
    'light': '轻量图标',
    'duotone': '双色调图标',
    'brands': '品牌图标',
    'navigation': '导航',
    'user': '用户客户',
    'interface': '系统界面',
    'data': '数据报表',
    'commerce': '商品订单',
    'tools': '工具操作',
    'charts': '数据图表',
    'files': '文件媒体',
    'communication': '通知消息',
    'notification': '通知消息',
    'iconify': '在线图标',
    'mdi': 'Material 图标',
    'lucide': 'Lucide 图标',
    'tabler': 'Tabler 图标',
    'solar': 'Solar 图标',
    'fa6-solid': 'Font Awesome',
    'fa-solid': 'Font Awesome'
  }
  return labels[category] || category
}

const loadIcons = async () => {
  const cached = readIconCache()
  let fallbackTimer = null

  if (cached?.icons?.length) {
    allIcons.value = cached.icons
    icons.value = cached.icons
    categories.value = cached.categories
    loading.value = false
  } else {
    loading.value = true
    fallbackTimer = window.setTimeout(() => {
      if (loading.value && allIcons.value.length === 0) {
        applyFallbackIcons()
        loading.value = false
      }
    }, ICON_PICKER_FALLBACK_DELAY)
  }

  if (!iconsLoadingPromise) {
    iconsLoadingPromise = unifiedApi.get('/icons?limit=1000', {
      showError: false
    })
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
  } catch (apiError) {
    if (!cached?.icons?.length) {
      applyFallbackIcons()
    }
  } finally {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer)
    }
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
    icons.value = useOnlineSearch.value ? [] : allIcons.value
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
    const response = await unifiedApi.get(`/icons/search/online?query=${encodeURIComponent(query)}&limit=100`)

    if (response && response.success && response.data && response.data.length > 0) {
      icons.value = response.data
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
})

// 监听搜索和分类变化，重置分页
watch([searchQuery, selectedCategory], () => {
  currentPage.value = 1
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

.icon-item .icon-renderer {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

.icon-picker-header {
  width: 100%;
  border: 0;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  text-align: left;
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
  flex-wrap: wrap;
}

.icon-search-input {
  flex: 1 1 220px;
  min-width: 0;
}

.category-filter {
  flex: 0 1 150px;
  min-width: 130px;
}

.search-mode-toggle {
  flex: 0 0 auto;
  min-width: 118px;
}

.icon-picker-search :deep(.el-input__wrapper),
.icon-picker-search :deep(.el-select__wrapper) {
  border-radius: 10px;
}

.icon-picker-search :deep(.el-segmented) {
  --el-segmented-item-selected-bg-color: #0f766e;
  --el-segmented-item-selected-color: #fff;
  border-radius: 10px;
}

.icon-picker-search :deep(.el-segmented__item) {
  min-width: 52px;
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
  position: relative;
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

.icon-delete-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 999px;
  background: var(--tf-button-danger-bg);
  color: var(--tf-button-on-color);
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  box-shadow: var(--tf-button-danger-shadow);
}

.icon-item:hover .icon-delete-btn {
  display: inline-flex;
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

  .icon-picker-search {
    gap: 10px;
  }

  .icon-search-input,
  .category-filter,
  .search-mode-toggle {
    flex-basis: 100%;
    width: 100%;
  }

  .search-mode-toggle :deep(.el-segmented) {
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
