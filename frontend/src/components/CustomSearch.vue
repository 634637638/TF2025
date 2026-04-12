<template>
  <div class="custom-search" :class="{ 'mobile-mode': isMobile }">
    <!-- 主搜索输入框 -->
    <div class="search-input-container">
      <i class="fas fa-search search-icon"></i>
      <input
        ref="mainSearchInput"
        v-model="searchQuery"
        type="text"
        class="search-input"
        :placeholder="placeholder"
        :title="placeholder === '搜索 IMEI/序列号/入库价格' ? '支持搜索：IMEI号、序列号、入库价格' : ''"
        @input="handleSearchInput"
        @keyup.enter="handleSearch"
      />
      <button
        v-if="searchQuery"
        class="clear-btn"
        @click="clearSearch"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- PC端筛选条件 -->
    <div v-if="!isMobile" class="filters-row">
      <div
        v-for="filter in filters"
        :key="filter.key"
        class="filter-item"
      >
        <label class="filter-label">{{ filter.label }}</label>
        <!-- 普通选择器 -->
        <select
          v-if="filter.type === 'select'"
          v-model="filterValues[filter.key]"
          class="filter-select"
          @change="handleFilterChange"
        >
          <option value="">全部</option>
          <option
            v-for="option in filter.options"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <!-- 可编辑选择器 - 使用原生select配合datalist -->
        <div v-else-if="filter.type === 'editable-select'" class="editable-select">
          <input
            :ref="`filter-${filter.key}`"
            v-model="filterInputValues[filter.key]"
            type="text"
            class="filter-input"
            :list="`list-${filter.key}`"
            :placeholder="filter.placeholder"
            @input="handleEditableInput(filter)"
            @change="handleEditableChange(filter)"
            @focus="handleEditableFocus(filter)"
          />
          <datalist :id="`list-${filter.key}`" :key="`datalist-${filter.key}-${updateTrigger}`">
            <option
              v-for="option in getFilterOptions(filter)"
              :key="`${option}-${updateTrigger}`"
              :value="option"
            />
          </datalist>
          <button
            v-if="filterInputValues[filter.key]"
            class="filter-clear"
            @click="clearFilter(filter)"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
        <!-- 日期范围选择器 -->
        <div v-else-if="filter.type === 'daterange'" class="daterange-filter">
          <input
            v-model="dateRangeStart[filter.key]"
            type="date"
            class="date-input"
            @change="handleDateRangeChange(filter)"
          />
          <span class="date-separator">至</span>
          <input
            v-model="dateRangeEnd[filter.key]"
            type="date"
            class="date-input"
            @change="handleDateRangeChange(filter)"
          />
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button class="btn btn-primary" @click="handleSearch">
          <i class="fas fa-search"></i>
          搜索
        </button>
        <button class="btn btn-secondary" @click="handleReset">
          <i class="fas fa-redo"></i>
          重置
        </button>
      </div>
    </div>

    <!-- 移动端筛选按钮 -->
    <div v-else class="mobile-filter-trigger">
      <button class="filter-btn" @click="showFilterDrawer = true">
        <i class="fas fa-filter"></i>
        <span>筛选条件</span>
        <span v-if="hasActiveFilters" class="filter-count">{{ activeFilterCount }}</span>
      </button>
    </div>

    <!-- 移动端筛选抽屉 -->
    <el-drawer
      v-if="isMobile"
      v-model="showFilterDrawer"
      title="筛选条件"
      direction="rtl"
      :size="isMobile ? '85%' : '80%'"
      :with-header="true"
    >
      <template #header>
        <div class="drawer-header">
          <h3>筛选条件</h3>
          <el-button link @click="showFilterDrawer = false">
            <i class="fas fa-times"></i>
          </el-button>
        </div>
      </template>

      <div class="filter-drawer-content">
        <!-- 产品属性：品牌、型号 - 一行展示 -->
        <div class="mobile-filter-row">
          <div
            v-for="filter in filters.filter(f => ['brand', 'model'].includes(f.key))"
            :key="filter.key"
            class="mobile-filter-item row-item"
          >
            <select
              v-if="filter.type === 'select'"
              v-model="filterValues[filter.key]"
              class="mobile-filter-select compact"
              @change="handleFilterChange"
            >
              <option value="">{{ filter.label }}</option>
              <option
                v-for="option in filter.options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>

            <!-- 可编辑选择器 - 移动端使用原生select -->
            <select
              v-else-if="filter.type === 'editable-select'"
              v-model="filterValues[filter.key]"
              class="mobile-filter-select compact"
              @change="handleFilterChange"
            >
              <option value="">{{ filter.label }}</option>
              <option
                v-for="option in getFilterOptions(filter)"
                :key="option"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
          </div>
        </div>

        <!-- 产品属性：颜色、内存 - 一行展示 -->
        <div class="mobile-filter-row">
          <div
            v-for="filter in filters.filter(f => ['color', 'memory'].includes(f.key))"
            :key="filter.key"
            class="mobile-filter-item row-item"
          >
            <select
              v-if="filter.type === 'select'"
              v-model="filterValues[filter.key]"
              class="mobile-filter-select compact"
              @change="handleFilterChange"
            >
              <option value="">{{ filter.label }}</option>
              <option
                v-for="option in filter.options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>

            <!-- 可编辑选择器 - 移动端使用原生select -->
            <select
              v-else-if="filter.type === 'editable-select'"
              v-model="filterValues[filter.key]"
              class="mobile-filter-select compact"
              @change="handleFilterChange"
            >
              <option value="">{{ filter.label }}</option>
              <option
                v-for="option in getFilterOptions(filter)"
                :key="option"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
          </div>
        </div>

        <!-- 其他筛选条件 -->
        <div
          v-for="filter in filters.filter(f => !['brand', 'model', 'color', 'memory'].includes(f.key))"
          :key="filter.key"
          class="mobile-filter-item"
        >
          <label class="mobile-filter-label">{{ filter.label }}</label>

          <!-- 普通选择器 -->
          <select
            v-if="filter.type === 'select'"
            v-model="filterValues[filter.key]"
            class="mobile-filter-select"
            @change="handleFilterChange"
          >
            <option value="">全部</option>
            <option
              v-for="option in filter.options"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>

          <!-- 可编辑选择器 -->
          <select
            v-else-if="filter.type === 'editable-select'"
            v-model="filterValues[filter.key]"
            class="mobile-filter-select"
            @change="handleFilterChange"
          >
            <option value="">请选择{{ filter.label }}</option>
            <option
              v-for="option in getFilterOptions(filter)"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>

          <!-- 日期范围选择器 -->
          <div v-else-if="filter.type === 'daterange'" class="mobile-daterange">
            <input
              v-model="dateRangeStart[filter.key]"
              type="date"
              class="mobile-date-input"
              @change="handleDateRangeChange(filter)"
            />
            <span class="mobile-date-separator">至</span>
            <input
              v-model="dateRangeEnd[filter.key]"
              type="date"
              class="mobile-date-input"
              @change="handleDateRangeChange(filter)"
            />
          </div>
        </div>

        <!-- 移动端操作按钮 -->
        <div class="mobile-actions">
          <button class="mobile-btn mobile-btn-primary" @click="applyAndClose">
            应用筛选
          </button>
          <button class="mobile-btn mobile-btn-secondary" @click="resetAndClose">
            重置
          </button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, nextTick } from 'vue'
import type {
  FilterChangeEmits,
  ResetEmits,
  SearchSubmitEmits,
  StringModelValueProps,
  UpdateFilterValuesEmits,
  UpdateStringModelValueEmits
} from '@/types/component'
import { logger } from '@/utils/logger'

interface FilterOption {
  label: string
  value: unknown
}

interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'editable-select' | 'daterange'
  placeholder?: string
  options?: FilterOption[]
  editableOptions?: () => string[]
  onOptionsChange?: (filter: FilterConfig, value: unknown) => void
}

interface Props extends StringModelValueProps {
  placeholder?: string
  filters?: FilterConfig[]
  filterValues?: Record<string, unknown>
  isMobile?: boolean
  autoSearch?: boolean
  debounceDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '搜索...',
  filters: () => [],
  filterValues: () => ({}),
  isMobile: false,
  autoSearch: false,
  debounceDelay: 500
})

type Emits = UpdateStringModelValueEmits &
  UpdateFilterValuesEmits &
  SearchSubmitEmits &
  ResetEmits &
  FilterChangeEmits

const emit = defineEmits<Emits>()

// 响应式数据
const searchQuery = ref(props.modelValue)
const mainSearchInput = ref<HTMLInputElement>()
const showFilterDrawer = ref(false)
const filterInputValues = reactive<Record<string, string>>({})
const dateRangeStart = reactive<Record<string, string>>({})
const dateRangeEnd = reactive<Record<string, string>>({})
const localFilterValues = reactive<Record<string, unknown>>({ ...props.filterValues })

// 用于强制更新datalist的触发器
const updateTrigger = ref(0)

// 防抖定时器
let searchTimer: ReturnType<typeof setTimeout> | null = null
let filterTimer: ReturnType<typeof setTimeout> | null = null

// 计算属性
const hasActiveFilters = computed(() => {
  return Object.values(localFilterValues).some(value => value !== '' && value !== null && value !== undefined)
})

const activeFilterCount = computed(() => {
  return Object.values(localFilterValues).filter(value => value !== '' && value !== null && value !== undefined).length
})

// 方法
const handleSearchInput = () => {
  if (props.autoSearch) {
    debouncedSearch()
  }
}

const debouncedSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    handleSearch()
  }, props.debounceDelay)
}

const handleSearch = () => {
  const filters = { ...localFilterValues }

  // 处理日期范围
  props.filters.forEach(filter => {
    if (filter.type === 'daterange') {
      const start = dateRangeStart[filter.key]
      const end = dateRangeEnd[filter.key]
      if (start || end) {
        // 格式化为后端期望的格式：YYYY-MM-DD - YYYY-MM-DD
        filters[filter.key] = `${start || ''} - ${end || ''}`
      }
    }
  })

  // 发送搜索事件
  emit('search', searchQuery.value, filters)
}

const handleReset = () => {
  searchQuery.value = ''
  Object.keys(localFilterValues).forEach(key => {
    localFilterValues[key] = ''
  })
  Object.keys(filterInputValues).forEach(key => {
    filterInputValues[key] = ''
  })
  Object.keys(dateRangeStart).forEach(key => {
    dateRangeStart[key] = ''
  })
  Object.keys(dateRangeEnd).forEach(key => {
    dateRangeEnd[key] = ''
  })
  emit('update:modelValue', '')
  emit('update:filterValues', {})
  emit('reset')
}

const clearSearch = () => {
  searchQuery.value = ''
  emit('update:modelValue', '')
  if (props.autoSearch) {
    handleSearch()
  }
}

const handleFilterChange = () => {
  debouncedFilterChange()
}

const debouncedFilterChange = () => {
  if (filterTimer) {
    clearTimeout(filterTimer)
  }
  filterTimer = setTimeout(() => {
    emit('update:filterValues', { ...localFilterValues })
    emit('filter-change', 'batch', localFilterValues)
    if (props.autoSearch) {
      handleSearch()
    }
  }, 300)
}

const handleEditableInput = (filter: FilterConfig) => {
  // 同步输入值到filterValues
  localFilterValues[filter.key] = filterInputValues[filter.key]
}

const handleEditableChange = (filter: FilterConfig) => {
  const oldValue = localFilterValues[filter.key]
  const newValue = filterInputValues[filter.key]

  localFilterValues[filter.key] = newValue

  // 品牌型号联动：当品牌改变时，清空型号
  if (filter.key === 'brand') {
    localFilterValues.model = ''
    filterInputValues.model = ''
    // 通知父组件更新型号列表
    emit('filter-change', 'brand-changed', newValue)

    // 立即触发品牌搜索，不管型号是否为空
    nextTick(() => {
      handleSearch()
    })
    return // 品牌变化已经处理了搜索，直接返回
  }

  // 实时搜索：当用户选择其他筛选条件时立即触发搜索

  // 如果新值不为空，立即触发搜索
  if (newValue && newValue.trim()) {
    // 延迟一点时间确保数据已更新
    nextTick(() => {
      handleSearch()
    })
  } else if (oldValue && !newValue) {
    // 如果清空了筛选条件，也触发搜索显示所有数据
    nextTick(() => {
      handleSearch()
    })
  }

  handleFilterChange()
}

const handleEditableFocus = (filter: FilterConfig) => {
  // 聚焦时立即加载相关数据

  if (filter.key === 'brand') {
    // 点击品牌输入框时，确保品牌数据已加载

    // 触发选项重新加载，确保有最新的数据
    updateTrigger.value++

    // 获取当前品牌选项
    getFilterOptions(filter)
  } else if (filter.key === 'model') {
    // 点击型号输入框时，根据选择的品牌加载对应型号

    if (localFilterValues.brand) {
      // 如果已选择品牌，触发品牌型号联动
      if (filter.onOptionsChange) {
        filter.onOptionsChange(filter, localFilterValues.brand)
      }
    } else {
      // 如果没有选择品牌，显示所有型号
    }

    // 强制更新型号选项
    updateTrigger.value++
  } else if (filter.key === 'color') {
    // 点击颜色输入框时，确保颜色数据已加载
    updateTrigger.value++
  } else if (filter.key === 'memory') {
    // 点击内存输入框时，确保内存数据已加载
    updateTrigger.value++
  }

  // 强制触发Vue重新渲染对应的datalist
  nextTick(() => {
    updateTrigger.value++
  })
}

const clearFilter = (filter: FilterConfig) => {
  filterInputValues[filter.key] = ''
  localFilterValues[filter.key] = ''

  // 强制触发Vue重新渲染datalist
  updateTrigger.value++

  // 强制触发datalist更新
  const listId = `list-${filter.key}`
  const inputElement = document.querySelector<HTMLInputElement>(`input[list="${listId}"]`)
  if (inputElement) {
    // 移除并重新添加list属性来强制刷新
    inputElement.removeAttribute('list')
    nextTick(() => {
      inputElement.setAttribute('list', listId)
    })
  }

  // 清除筛选条件后立即触发搜索，显示更新的结果
  nextTick(() => {
    handleSearch()
  })

  handleFilterChange()
}

const handleDateRangeChange = (filter: FilterConfig) => {
  const start = dateRangeStart[filter.key]
  const end = dateRangeEnd[filter.key]
  if (start || end) {
    // 格式化为后端期望的格式：YYYY-MM-DD - YYYY-MM-DD
    localFilterValues[filter.key] = `${start || ''} - ${end || ''}`
  } else {
    localFilterValues[filter.key] = ''
  }
  handleFilterChange()
}

const getFilterOptions = (filter: FilterConfig): string[] => {
  if (filter.type === 'editable-select' && filter.editableOptions) {
    try {
      const options = filter.editableOptions()
      const result = Array.isArray(options) ? options : []

      return result
    } catch (error) {
      logger.error(`❌ Error getting options for ${filter.key}:`, error)
      return []
    }
  }
  return []
}

const applyAndClose = () => {
  handleSearch()
  showFilterDrawer.value = false
}

const resetAndClose = () => {
  handleReset()
  showFilterDrawer.value = false
}

// 监听器
watch(() => props.modelValue, (newValue) => {
  searchQuery.value = newValue
})

watch(() => props.filterValues, (newValues) => {
  Object.assign(localFilterValues, newValues)
  // 同步到filterInputValues
  props.filters.forEach(filter => {
    if (filter.type === 'editable-select' && newValues[filter.key]) {
      filterInputValues[filter.key] = newValues[filter.key]
    }
  })
}, { deep: true })
</script>

<style lang="scss" scoped>
.custom-search {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  &.mobile-mode {
    padding: 12px;
  }
}

.search-input-container {
  position: relative;
  margin-bottom: 16px;

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #909399;
    z-index: 1;
  }

  .search-input {
    width: 100%;
    height: 40px;
    padding: 0 40px 0 36px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 14px;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: #409eff;
    }
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #909399;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: #606266;
      background: #f5f7fa;
    }
  }
}

// PC端样式
.filters-row {
  display: flex;
  gap: 16px;
  align-items: end;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;

  .filter-label {
    font-size: 14px;
    color: #606266;
    font-weight: 500;
  }

  .filter-select,
  .filter-input {
    height: 32px;
    padding: 0 8px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 14px;
    background: white;
    min-width: 120px;

    &:focus {
      outline: none;
      border-color: #409eff;
    }
  }

  .editable-select {
    position: relative;

    .filter-clear {
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #909399;
      cursor: pointer;
      padding: 2px;
      font-size: 12px;

      &:hover {
        color: #606266;
      }
    }
  }

  .daterange-filter {
    display: flex;
    align-items: center;
    gap: 4px;

    .date-input {
      height: 32px;
      padding: 0 8px;
      border: 1px solid #dcdfe6;
      border-radius: 4px;
      font-size: 14px;
      min-width: 100px;

      &:focus {
        outline: none;
        border-color: #409eff;
      }
    }

    .date-separator {
      font-size: 14px;
      color: #909399;
    }
  }
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-left: auto;

  .btn {
    height: 32px;
    padding: 0 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;

    &.btn-primary {
      background: #409eff;
      color: white;

      &:hover {
        background: #66b1ff;
      }
    }

    &.btn-secondary {
      background: #f5f7fa;
      color: #606266;
      border: 1px solid #dcdfe6;

      &:hover {
        background: #ecf5ff;
        color: #409eff;
      }
    }
  }
}

// 移动端样式
.mobile-filter-trigger {
  .filter-btn {
    width: 100%;
    height: 40px;
    background: #f5f7fa;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
    color: #606266;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;

    &:hover {
      background: #ecf5ff;
      border-color: #409eff;
      color: #409eff;
    }

    .filter-count {
      background: #f56c6c;
      color: white;
      font-size: 12px;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 60px;

  h3 {
    margin: 0;
    font-size: 18px;
    color: #303133;
  }
}

.filter-drawer-content {
  padding: 0 20px 20px;
  height: 100%;
  overflow-y: auto;
}

.mobile-filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding: 0 20px;

  .mobile-filter-item.row-item {
    margin-bottom: 0;
    flex: 1;
    min-width: 0;

    .mobile-filter-select.compact {
      width: 100%;
      height: 36px;
      padding: 0 12px;
      border: 1px solid #dcdfe6;
      border-radius: 18px;
      font-size: 13px;
      background: white;

      &:focus {
        outline: none;
        border-color: #409eff;
      }

      option {
        padding: 4px 8px;
      }
    }
  }
}

/* iPhone SE/12 mini 等小屏幕优化 - 390*844分辨率 */
@media (max-width: 420px) {
  .mobile-filter-row {
    gap: 6px;
    padding: 0 16px;

    .mobile-filter-item.row-item {
      min-width: 0;
      flex: 1;

      .mobile-filter-select.compact {
        height: 34px;
        font-size: 12px;
        padding: 0 8px;
      }
    }
  }
}

/* 超小屏幕优化 */
@media (max-width: 360px) {
  .mobile-filter-row {
    gap: 4px;

    .mobile-filter-item.row-item {
      .mobile-filter-select.compact {
        font-size: 11px;
        padding: 0 6px;
      }
    }
  }
}

/* 390*844分辨率特殊优化 */
@media (max-width: 390px) and (min-height: 800px) {
  .filter-drawer-content {
    padding: 0 16px 20px;
  }

  .mobile-filter-row {
    padding: 0 12px;
    margin-bottom: 12px;

    .mobile-filter-item.row-item {
      .mobile-filter-select.compact {
        height: 32px;
        font-size: 12px;
        padding: 0 6px;
        border-radius: 16px;
      }
    }
  }

  .mobile-filter-item {
    margin-bottom: 16px;

    .mobile-filter-label {
      font-size: 14px;
      margin-bottom: 6px;
    }
  }

  .mobile-actions {
    margin-top: 20px;
    gap: 8px;

    .mobile-btn {
      height: 44px;
      font-size: 15px;
    }
  }
}

.mobile-filter-item {
  margin-bottom: 20px;

  .mobile-filter-label {
    display: block;
    font-size: 16px;
    color: #303133;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .mobile-filter-select,
  .mobile-date-input {
    width: 100%;
    height: 44px;
    padding: 0 12px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 16px; /* 防止iOS缩放 */

    &:focus {
      outline: none;
      border-color: #409eff;
    }
  }

  .mobile-daterange {
    display: flex;
    align-items: center;
    gap: 8px;

    .mobile-date-input {
      flex: 1;
    }

    .mobile-date-separator {
      font-size: 14px;
      color: #909399;
    }
  }
}

.mobile-actions {
  display: flex;
  gap: 12px;
  margin-top: 30px;

  .mobile-btn {
    flex: 1;
    height: 48px;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;

    &.mobile-btn-primary {
      background: #409eff;
      color: white;

      &:hover {
        background: #66b1ff;
      }
    }

    &.mobile-btn-secondary {
      background: #f5f7fa;
      color: #606266;
      border: 1px solid #dcdfe6;

      &:hover {
        background: #ecf5ff;
        color: #409eff;
      }
    }
  }
}
</style>
