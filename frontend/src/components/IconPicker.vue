<template>
  <div
    class="icon-picker"
    :aria-busy="saving"
  >
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
        <i
          class="collapse-icon"
          :class="isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down'"
        />
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
    <div
      v-show="!isCollapsed"
      class="icon-picker-content"
    >
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
            <i class="fas fa-search" />
          </template>
          <template
            v-if="searching"
            #suffix
          >
            <InlineLoading size="small" />
          </template>
        </el-input>

        <el-select
          v-if="!useOnlineSearch"
          v-model="selectedCategory"
          placeholder="所有分类"
          clearable
          filterable
          class="category-filter"
          popper-class="tf2025-form-popper icon-picker-category-dropdown"
          @change="filterIcons"
          @keydown.enter.prevent
        >
          <el-option
            label="所有分类"
            value=""
          />
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
      <SectionLoading
        v-if="saving"
        text="正在保存图标..."
      />
      <SectionLoading
        v-if="loading"
        text="正在加载图标..."
      />

      <el-alert
        v-if="searchError || previewError"
        :title="searchError || previewError"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-button
        v-if="previewError"
        native-type="button"
        :disabled="previewLoading"
        @click="loadOnlinePreviews"
      >
        重试图标预览
      </el-button>

      <!-- 图标网格 -->
      <div
        v-if="!loading && filteredIcons.length > 0"
        v-tf-loading="{ active: searching, text: '正在检索图标...' }"
        class="icon-grid"
      >
        <div
          v-for="icon in paginatedIcons"
          :key="icon.id"
          class="icon-item"
          :class="{ active: selectedIcon === icon.class }"
          role="button"
          :aria-disabled="saving"
          tabindex="0"
          :title="`${icon.name} (${icon.class})`"
          @pointerdown.prevent.stop="selectIcon(icon)"
          @click.prevent.stop
          @keydown.enter.prevent.stop="selectIcon(icon)"
          @keydown.space.prevent.stop="selectIcon(icon)"
        >
          <InlineLoading
            v-if="icon.source === 'online' && !icon.svg && previewLoading"
            size="small"
          />
          <span v-else-if="icon.source === 'online' && !icon.svg">预览失败</span>
          <IconRenderer
            v-else
            :icon="icon.class"
            :svg="icon.svg"
            :online-preview="icon.source === 'online'"
          />
          <el-button
            v-if="canDeleteIcon(icon)"
            native-type="button"
            type="danger"
            class="tf-button--icon-badge"
            title="删除本地图标"
            aria-label="删除本地图标"
            @click.stop="deleteLocalIcon(icon)"
          >
            <i class="fas fa-times" />
          </el-button>
        </div>
      </div>

      <!-- 无结果状态 -->
      <DataEmptyState
        v-else-if="!loading && !searching"
        state="filtered"
        size="compact"
        :title="emptyStateText"
        :description="emptyStateHint || emptyStateText"
      />
      <SectionLoading
        v-else-if="searching && !filteredIcons.length"
        text="正在检索图标..."
      />

      <div
        v-if="totalPages > 1"
        class="icon-picker-footer"
        @click.stop
      >
        <div class="pagination">
          <el-button
            native-type="button"
            :disabled="currentPage === 1"
            class="btn btn-sm btn-outline-secondary"
            @click.stop="prevPage"
          >
            <i class="fas fa-chevron-left" />
          </el-button>
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          <el-button
            native-type="button"
            :disabled="currentPage === totalPages"
            class="btn btn-sm btn-outline-secondary"
            @click.stop="nextPage"
          >
            <i class="fas fa-chevron-right" />
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { iconService } from '@/services/icons'
import { getRequestErrorMessage } from '@/utils/api-response'
import { useLatestRequest } from '@/composables/useLatestRequest'

import SectionLoading from '@/components/SectionLoading.vue'
import IconRenderer from '@/components/IconRenderer.vue'
import { extractIconifyName, isIconifyIcon } from '@/utils/iconify'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


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

const applyFallbackIcons = () => {
  icons.value = DEFAULT_ICONS
  categories.value = DEFAULT_ICON_CATEGORIES
  totalIconCount.value = DEFAULT_ICONS.length
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

const emit = defineEmits(['update:modelValue', 'select', 'saving-change'])
const { confirm } = useNotification()
const listRequest = useLatestRequest()
const previewRequest = useLatestRequest()

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

  searchIcons()
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
const allIcons = ref([]) // 仅保存当前页和当前选中的图标
const categories = ref([])
const currentPage = ref(1)
const iconsPerPage = computed(() => useOnlineSearch.value ? 24 : 96)
const totalIconCount = ref(0)
const loading = ref(true)
const searching = ref(false)
const searchError = ref('')
const previewError = ref('')
const previewLoading = ref(false)
const saving = ref(false)
let disposed = false
let searchTimer = null

// 计算属性
const filteredIcons = computed(() => {
  let filtered = icons.value
  if (useOnlineSearch.value) return filtered

  // 如果有搜索词，不过滤（因为已经从 API 获取了搜索结果）
  // 如果没有搜索词，按分类筛选
  if (!searchQuery.value.trim() && selectedCategory.value) {
    filtered = filtered.filter(icon => icon.category === selectedCategory.value)
  }

  return filtered
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(totalIconCount.value / iconsPerPage.value))
})

const paginatedIcons = computed(() => {
  if (!useOnlineSearch.value) return filteredIcons.value
  const offset = (currentPage.value - 1) * iconsPerPage.value
  return filteredIcons.value.slice(offset, offset + iconsPerPage.value)
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
  }

  // 在线候选一旦成功入库，也立即换成返回的本地 SVG，不继续请求在线预览。
  icons.value = icons.value.map(item => item.class === icon.class ? { ...item, ...normalizedIcon } : item)

  if (normalizedIcon.category && !categories.value.includes(normalizedIcon.category)) {
    categories.value = [...categories.value, normalizedIcon.category].sort()
  }

}

const persistOnlineIcon = async (icon) => {
  const localCategory = resolveIconCategory(icon, searchQuery.value)
  const iconifyName = icon.iconifyName || getIconifyName(icon.class)
  const tags = buildOnlineIconTags(icon, localCategory)

  return iconService.cache({
    class: icon.class,
    name: icon.name || iconifyName,
    category: localCategory,
    description: icon.description || `${localCategory}图标`,
    tags,
    iconifyName,
    svg: icon.svg || null
  })
}

const canDeleteIcon = (icon) => {
  return Boolean(icon?.id && icon.source !== 'online')
}

const removeIconFromCache = (iconId) => {
  allIcons.value = allIcons.value.filter(icon => icon.id !== iconId)
  icons.value = icons.value.filter(icon => icon.id !== iconId)
  totalIconCount.value = Math.max(0, totalIconCount.value - 1)
}

const deleteLocalIcon = async (icon) => {
  if (!canDeleteIcon(icon)) {
    return
  }

  try {
    if (!await confirm(
      `确定删除图标「${icon.name || icon.class}」吗？如果菜单正在使用，系统会阻止删除。`,
      '删除图标',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )) return

    const response = await iconService.remove(icon.id)
    if (response?.success) {
      removeIconFromCache(icon.id)
      globalNotifications.success(response.message || '图标已删除')
    }
  } catch (error) {
    const message = error?.response?.data?.message || error?.message || '删除图标失败'
    globalNotifications.warning(message)
  }
}

// 方法
const filterIcons = () => {
  currentPage.value = 1
  // 触发实时搜索
  searchIcons()
}

const selectIcon = async (icon) => {
  const iconClass = icon?.class || ''
  if (!iconClass || saving.value) {
    return
  }

  saving.value = true
  emit('saving-change', true)
  try {
    const selected = icon.source === 'online' || isIconifyIconClass(iconClass)
      ? await persistOnlineIcon(icon)
      : icon
    if (disposed) return
    updateLocalIconCache(selected)
    selectedIcon.value = selected.class
    emit('select', selected.class, selected)
  } catch (error) {
    if (!disposed) globalNotifications.warning(getRequestErrorMessage(error, '图标保存失败，请重试'))
  } finally {
    saving.value = false
    if (!disposed) emit('saving-change', false)
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    if (!useOnlineSearch.value) loadLocalIcons()
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    if (!useOnlineSearch.value) loadLocalIcons()
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

const loadLocalIcons = async (request = listRequest.nextRequest()) => {
  loading.value = true
  const fallbackTimer = window.setTimeout(() => {
    if (request.isLatest() && loading.value && icons.value.length === 0) {
      applyFallbackIcons()
      loading.value = false
    }
  }, ICON_PICKER_FALLBACK_DELAY)
  try {
    const response = await iconService.list({
      limit: iconsPerPage.value,
      page: currentPage.value,
      category: selectedCategory.value || undefined,
      search: searchQuery.value.trim() || undefined
    }, request.signal)
    if (!request.isLatest()) return
    if (!response?.success || !Array.isArray(response.data)) throw new Error('图标接口响应无效')
    allIcons.value = response.data
    icons.value = response.data
    totalIconCount.value = Number(response.total || response.data.length)
  } catch (error) {
    if (!request.isLatest() || listRequest.isCanceledError(error)) return
    applyFallbackIcons()
  } finally {
    clearTimeout(fallbackTimer)
    if (request.isLatest()) loading.value = false
  }
}

// 防抖开始时即取消旧请求，避免旧搜索/本地分页覆盖新的在线结果。
const searchIcons = async () => {
  const query = searchQuery.value.trim()
  const request = listRequest.nextRequest()
  previewRequest.cancelLatest()
  previewLoading.value = false
  previewError.value = ''
  searchError.value = ''
  if (searchTimer) clearTimeout(searchTimer)
  currentPage.value = 1
  loading.value = false
  if (!query) {
    searching.value = false
    if (useOnlineSearch.value) {
      icons.value = []
      totalIconCount.value = 0
    } else {
      await loadLocalIcons(request)
    }
    return
  }
  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      if (useOnlineSearch.value) {
        const response = await iconService.searchOnline(query, request.signal)
        if (!request.isLatest()) return
        if (!response?.success || !Array.isArray(response.data)) throw new Error('在线图标检索失败，请重试')
        // 结果来源由在线接口边界确定，未入库候选不能误查本地库。
        icons.value = response.data.map(icon => ({ ...icon, source: 'online' }))
        totalIconCount.value = icons.value.length
        loadOnlinePreviews()
      } else {
        await loadLocalIcons(request)
      }
    } catch (error) {
      if (!request.isLatest() || listRequest.isCanceledError(error)) return
      icons.value = []
      totalIconCount.value = 0
      searchError.value = getRequestErrorMessage(error, '在线图标检索失败，请重试')
    } finally {
      if (request.isLatest()) searching.value = false
    }
  }, 500)
}

const loadOnlinePreviews = async () => {
  const request = previewRequest.nextRequest()
  previewError.value = ''
  const candidates = paginatedIcons.value.filter(icon => icon.source === 'online' && !icon.svg)
  if (!useOnlineSearch.value || !candidates.length) {
    previewLoading.value = false
    return
  }
  previewLoading.value = true
  try {
    const names = candidates.map(icon => getIconifyName(icon.class))
    const response = await iconService.preview(names, request.signal)
    if (!request.isLatest()) return
    if (!response?.success || !Array.isArray(response.data)) throw new Error('图标预览读取失败')
    const previews = new Map(response.data.map(icon => [icon.class, icon.svg]))
    icons.value = icons.value.map(icon => previews.get(icon.class) ? { ...icon, svg: previews.get(icon.class) } : icon)
    if (candidates.some(icon => !previews.get(icon.class))) previewError.value = '部分图标预览暂不可用，请重试'
  } catch (error) {
    if (!request.isLatest() || previewRequest.isCanceledError(error)) return
    previewError.value = getRequestErrorMessage(error, '图标预览暂不可用，请重试')
  } finally {
    if (request.isLatest()) previewLoading.value = false
  }
}

// 搜索完成时主动预览；翻页只跟踪页码，回写 SVG 不触发重复请求。
watch([useOnlineSearch, currentPage], loadOnlinePreviews)

const loadCategories = async () => {
  try {
    const response = await iconService.categories()
    if (response?.success && Array.isArray(response.data)) {
      categories.value = response.data
      return
    }
  } catch (error) {
    // 使用内置分类兜底
  }
  categories.value = DEFAULT_ICON_CATEGORIES
}

// 生命周期
onMounted(async () => {
  await Promise.all([loadCategories(), loadLocalIcons()])
  if (disposed) return
  const currentClass = String(props.modelValue || '').trim()
  // Iconify 图标由 IconRenderer 直接从图标库渲染，不需要查询本地图标表。
  if (
    currentClass &&
    !isIconifyIcon(currentClass) &&
    !allIcons.value.some(icon => icon.class === currentClass)
  ) {
    try {
      const icon = await iconService.byClass(currentClass)
      if (icon) {
        updateLocalIconCache(icon)
      }
    } catch (error) {
      // 本地图标可能已被删除，当前值仍由 IconRenderer 保留展示。
    }
  }
})

onBeforeUnmount(() => {
  disposed = true
  if (searchTimer) clearTimeout(searchTimer)
  emit('saving-change', false)
})

// 监听搜索和分类变化，重置分页
watch([searchQuery, selectedCategory], () => {
  currentPage.value = 1
})
</script>

<style scoped>
.icon-picker {
  border: 1px solid var(--tf-color-border-muted);
  border-radius: 12px;
  background: white;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.icon-item .icon-renderer {
  font-size: var(--tf-type-scale-24);
  width: 24px;
  height: 24px;
}

.icon-picker-header {
  width: 100%;
  border: 0;
  padding: 12px 16px;
  background: var(--tf-color-surface-muted);
  border-bottom: 1px solid var(--tf-color-border-muted);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  text-align: left;
}

.icon-picker-header:hover {
  background: var(--tf-color-border-muted);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-icon {
  font-size: var(--tf-type-scale-12);
  color: var(--tf-color-muted);
  transition: transform 0.3s;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--tf-color-gray-bootstrap-700);
}

.current-icon {
  font-size: var(--tf-type-scale-16);
  color: var(--tf-color-indigo-brand);
}

.collapse-hint {
  font-size: var(--tf-type-scale-12);
  color: var(--tf-color-gray-bootstrap-500);
}

.icon-picker-content {
  background: white;
}

.icon-picker-search {
  padding: 16px;
  background: var(--tf-color-surface-muted);
  border-bottom: 1px solid var(--tf-color-border-muted);
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
  background: var(--tf-color-surface-muted);
  font-size: var(--tf-type-scale-18);
  color: var(--tf-color-gray-bootstrap-700);
}

.icon-item:hover {
  background: var(--tf-color-border-muted);
  border-color: var(--tf-color-border-subtle);
  transform: translateY(-1px);
}

.icon-item.active {
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  border-color: var(--tf-color-indigo-brand);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.tf-button--icon-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  display: none;
}

.icon-item:hover .tf-button--icon-badge {
  display: inline-flex;
}

.icon-picker-footer {
  padding: 16px;
  background: var(--tf-color-surface-muted);
  border-top: 1px solid var(--tf-color-border-muted);
  display: flex;
  justify-content: center;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-info {
  font-size: var(--tf-type-scale-14);
  font-weight: 500;
  color: var(--tf-color-gray-bootstrap-700);
  min-width: 60px;
  text-align: center;
}

/* 滚动条样式 */
.icon-grid::-webkit-scrollbar {
  width: 6px;
}

.icon-grid::-webkit-scrollbar-track {
  background: var(--tf-color-gray-100);
  border-radius: 3px;
}

.icon-grid::-webkit-scrollbar-thumb {
  background: var(--tf-color-gray-300);
  border-radius: 3px;
}

.icon-grid::-webkit-scrollbar-thumb:hover {
  background: var(--tf-color-gray-400);
}

/* 响应式设计 */
@media (max-width: 767px) {
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
    font-size: var(--tf-type-scale-16);
  }
}
</style>
