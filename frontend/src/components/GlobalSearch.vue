<template>
  <div class="global-search">
    <!-- 搜索区域标题 -->
    <div v-if="showTitle" class="search-title">
      <i class="fas fa-filter"></i>
      <span>{{ title }}</span>
    </div>

    <!-- 搜索表单 -->
    <div class="search-form" :class="{ 'search-form-compact': compact }">
      <div class="search-row">
        <!-- 筛选条件区域 -->
        <div v-if="filters && filters.length > 0" class="search-filters">
          <div
            v-for="filter in filters"
            :key="filter.key"
            class="filter-item"
            :class="`filter-${filter.type}`"
          >
            <!-- 输入框类型筛选 -->
            <template v-if="filter.type === 'input'">
              <label class="filter-label">{{ filter.label }}</label>
              <input
                v-model="localFilterValues[filter.key]"
                type="text"
                class="form-control form-control-sm"
                :placeholder="filter.placeholder || `请输入${filter.label}`"
                @keyup.enter="handleSearch"
                @input="debouncedFilterChange(filter.key, localFilterValues[filter.key])"
              />
            </template>

            <!-- 选择框类型筛选 -->
            <template v-else-if="filter.type === 'select'">
              <label class="filter-label">{{ filter.label }}</label>
              <select
                v-model="localFilterValues[filter.key]"
                class="form-control form-control-sm"
                @change="debouncedFilterChange(filter.key, localFilterValues[filter.key], true)"
              >
                <option value="">{{ filter.allText || '全部' }}</option>
                <option
                  v-for="option in filter.options"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </template>

            <!-- 日期选择器类型筛选 -->
            <template v-else-if="filter.type === 'date'">
              <label class="filter-label">{{ filter.label }}</label>
              <input
                v-model="localFilterValues[filter.key]"
                type="date"
                class="form-control form-control-sm"
                @change="debouncedFilterChange(filter.key, localFilterValues[filter.key], true)"
              />
            </template>

            <!-- 日期范围类型筛选 -->
            <template v-else-if="filter.type === 'daterange'">
              <label class="filter-label">{{ filter.label }}</label>
              <div class="daterange-inputs">
                <input
                  :model-value="filterValues['__daterange_' + filter.key + '_start__']"
                  type="date"
                  class="form-control form-control-sm"
                  placeholder="开始日期"
                  @input="updateDaterangeStart(filter.key, $event)"
                  @change="handleSearch"
                />
                <span class="daterange-separator">至</span>
                <input
                  :model-value="filterValues['__daterange_' + filter.key + '_end__']"
                  type="date"
                  class="form-control form-control-sm"
                  placeholder="结束日期"
                  @input="updateDaterangeEnd(filter.key, $event)"
                  @change="handleSearch"
                />
              </div>
            </template>

            <!-- 远程搜索类型筛选 -->
            <template v-else-if="filter.type === 'remote'">
              <label class="filter-label">{{ filter.label }}</label>
              <div class="remote-select-wrapper">
                <input
                  v-model="localFilterValues[filter.key]"
                  type="text"
                  class="form-control form-control-sm"
                  :placeholder="filter.placeholder || `请输入${filter.label}`"
                  @input="handleRemoteSearch(filter, $event)"
                  @focus="showRemoteOptions(filter)"
                  @blur="hideRemoteOptions(filter)"
                />
                <div
                  v-if="filter.showOptions && filter.remoteOptions?.length > 0"
                  class="remote-options"
                >
                  <div
                    v-for="option in filter.remoteOptions"
                    :key="option.value"
                    class="remote-option"
                    @click="selectRemoteOption(filter, option)"
                  >
                    {{ option.label }}
                  </div>
                </div>
              </div>
            </template>

            <!-- 可编辑下拉框类型筛选 -->
            <template v-else-if="filter.type === 'editable-select'">
              <label class="filter-label">{{ filter.label }}</label>
              <div class="editable-select-wrapper">
                <input
                  :ref="(el) => inputRefs[`${filter.key}Input`] = el as HTMLInputElement"
                  v-model="filterInputValues[filter.key]"
                  type="text"
                  class="form-control form-control-sm"
                  :placeholder="filter.placeholder || `请输入或选择${filter.label}`"
                  @input="handleEditableSelectInput(filter, $event)"
                  @focus="showEditableSelectOptions(filter)"
                  @blur="hideEditableSelectOptions(filter)"
                  @keydown.down="navigateEditableOptions(filter, 'down')"
                  @keydown.up="navigateEditableOptions(filter, 'up')"
                  @keydown.enter.prevent="handleEditableEnterKey(filter)"
                />
                <i
                  v-if="filterInputValues[filter.key]"
                  class="editable-clear fas fa-times"
                  @click="clearEditableSelect(filter)"
                ></i>
                <i class="editable-dropdown fas fa-chevron-down" @mousedown.prevent="toggleEditableSelect(filter)"></i>
                <div
                  v-if="filterShowOptions[filter.key]"
                  class="editable-options"
                >
                  <div
                    v-for="(option, index) in getFilteredEditableOptions(filter)"
                    :key="option"
                    :class="['editable-option', { 'highlighted': index === filter.highlightedIndex }]"
                    @mousedown="selectEditableOption(filter, index)"
                  >
                    {{ option }}
                  </div>
                  <div
                    v-if="filterInputValues[filter.key] && filterInputValues[filter.key].trim() && !getFilteredEditableOptions(filter).includes(filterInputValues[filter.key])"
                    class="editable-option new-item"
                    @mousedown="selectNewEditableOption(filter)"
                  >
                    <i class="fas fa-plus"></i> 使用 "{{ filterInputValues[filter.key] }}"
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 主搜索框 -->
        <div class="search-main">
          <div class="input-group">
            <i class="fas fa-search input-icon"></i>
            <input
              ref="searchInput"
              v-model="searchQuery"
              @input="handleSearchInput"
              @keyup.enter="handleSearch"
              type="text"
              class="form-control"
              :placeholder="placeholder"
              :disabled="disabled"
            />
            <button
              v-if="searchQuery && showClearButton"
              class="input-clear"
              @click="handleClear"
              title="清空"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <!-- 操作按钮区域 -->
        <div class="search-actions">
          <button
            class="btn btn-primary"
            @click="handleSearch"
            :disabled="loading || disabled"
          >
            <i :class="loading ? 'fas fa-spinner fa-spin' : 'fas fa-search'"></i>
            <span v-if="!compact">{{ searchButtonText }}</span>
          </button>
          <button
            v-if="showResetButton"
            class="btn btn-outline-secondary"
            @click="handleReset"
            :disabled="loading"
          >
            <i class="fas fa-redo"></i>
            <span v-if="!compact">{{ resetButtonText }}</span>
          </button>
          <slot name="extra-actions"></slot>
        </div>
      </div>

      <!-- 快捷标签 -->
      <div v-if="quickTags && quickTags.length > 0" class="quick-tags">
        <span class="quick-tags-label">快捷：</span>
        <button
          v-for="tag in quickTags"
          :key="tag.key"
          class="quick-tag"
          :class="{ active: isQuickTagActive(tag) }"
          @click="handleQuickTag(tag)"
        >
          {{ tag.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type {
  ClearEmits,
  FilterChangeEmits,
  OptionalStringModelValueProps,
  ResetEmits,
  SearchSubmitEmits,
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
  type: 'input' | 'select' | 'date' | 'daterange' | 'remote' | 'editable-select'
  options?: FilterOption[]
  placeholder?: string
  allText?: string
  remoteOptions?: FilterOption[]
  showOptions?: boolean
  remoteMethod?: (query: string) => Promise<FilterOption[]>
  
  editableOptions?: string[] | (() => string[])
  onOptionsChange?: (filter: FilterConfig, value: string) => void
  
  highlightedIndex?: number
}

interface QuickTag {
  key: string
  label: string
  query?: string
  filters?: Record<string, unknown>
}

interface Props extends OptionalStringModelValueProps {
  placeholder?: string
  disabled?: boolean
  loading?: boolean

  
  title?: string
  showTitle?: boolean
  compact?: boolean
  showClearButton?: boolean
  showResetButton?: boolean
  autoFocus?: boolean

  
  searchButtonText?: string
  resetButtonText?: string

  
  filters?: FilterConfig[]
  filterValues?: Record<string, unknown>

  
  quickTags?: QuickTag[]

  
  debounceDelay?: number
  filterChangeDelay?: number

  
  autoSearch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '请输入搜索关键词',
  disabled: false,
  loading: false,

  title: '筛选条件',
  showTitle: true,
  compact: false,
  showClearButton: true,
  showResetButton: true,
  autoFocus: false,

  searchButtonText: '搜索',
  resetButtonText: '重置',

  filters: () => [],
  filterValues: () => ({}),
  quickTags: () => [],

  debounceDelay: 500,
  filterChangeDelay: 300,
  autoSearch: false
})

type Emits = UpdateStringModelValueEmits &
  UpdateFilterValuesEmits &
  SearchSubmitEmits &
  ResetEmits &
  ClearEmits &
  FilterChangeEmits

const emit = defineEmits<Emits>()


const searchInput = ref<HTMLInputElement>()
const searchQuery = ref(props.modelValue)
const localFilterValues = reactive<Record<string, unknown>>({ ...props.filterValues })
const filterInputValues = reactive<Record<string, string>>({})
const inputRefs = reactive<Record<string, HTMLElement | HTMLInputElement>>({})
const showAllEditableOptions = reactive<Record<string, boolean>>({})
const filterShowOptions = reactive<Record<string, boolean>>({})


let searchTimer: ReturnType<typeof setTimeout> | null = null
let filterChangeTimer: ReturnType<typeof setTimeout> | null = null
let pendingFilterChange: { key: string; value: unknown } | null = null


const debouncedFilterChange = (key: string, value: unknown, immediate = false) => {
  
  pendingFilterChange = { key, value }

  
  if (filterChangeTimer !== null) {
    clearTimeout(filterChangeTimer)
  }

  if (immediate) {
    
    emitFilterChange()
  } else {
    
    filterChangeTimer = setTimeout(() => {
      emitFilterChange()
    }, props.filterChangeDelay) 
  }
}


const emitFilterChange = () => {
  if (pendingFilterChange) {
    const { key, value } = pendingFilterChange
    emit('filter-change', key, value)
    pendingFilterChange = null
  }
  filterChangeTimer = null
}

const debouncedSearch = (query: string) => {
  if (searchTimer !== null) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    if (props.autoSearch) {
      handleSearch()
    }
    searchTimer = null
  }, props.debounceDelay)
}


const handleSearchInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  searchQuery.value = value
  emit('update:modelValue', value)

  if (props.autoSearch) {
    debouncedSearch(value)
  }
}

const handleSearch = () => {
  
  const filters = { ...localFilterValues }

  
  props.filters.forEach(filter => {
    if (filter.type === 'daterange') {
      const startKey = `__daterange_${filter.key}_start__`
      const endKey = `__daterange_${filter.key}_end__`
      const start = filters[startKey]
      const end = filters[endKey]
      if (start || end) {
        filters[filter.key] = { start, end }
        delete filters[startKey]
        delete filters[endKey]
      }
    }
  })

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

  
  Object.keys(filterShowOptions).forEach(key => {
    filterShowOptions[key] = false
  })

  
  props.filters.forEach(filter => {
    if (filter.type === 'daterange') {
      const startKey = `__daterange_${filter.key}_start__`
      const endKey = `__daterange_${filter.key}_end__`
      delete localFilterValues[startKey]
      delete localFilterValues[endKey]
    }
  })

  emit('update:modelValue', '')
  emit('update:filterValues', {})
  emit('reset')

  
  if (props.autoSearch) {
    handleSearch()
  }
}

const handleClear = () => {
  searchQuery.value = ''
  emit('update:modelValue', '')
  emit('clear')

  if (props.autoSearch) {
    handleSearch()
  }
}

const clearSearch = () => {
  handleClear()
}

const clearFilter = (key: string) => {
  localFilterValues[key] = ''

  
  const filterConfig = props.filters.find(f => f.key === key)
  if (filterConfig?.type === 'daterange') {
    localFilterValues[key + '_start'] = ''
    localFilterValues[key + '_end'] = ''
  }

  debouncedFilterChange(key, '', true)

  if (props.autoSearch) {
    handleSearch()
  }
}

const handleQuickTag = (tag: QuickTag) => {
  
  if (tag.query !== undefined) {
    searchQuery.value = tag.query
    emit('update:modelValue', tag.query)
  }

  
  if (tag.filters) {
    Object.entries(tag.filters).forEach(([key, value]) => {
      localFilterValues[key] = value
    })
  }

  
  handleSearch()
}

const isQuickTagActive = (tag: QuickTag): boolean => {
  
  if (tag.query !== undefined && searchQuery.value !== tag.query) {
    return false
  }

  
  if (tag.filters) {
    return Object.entries(tag.filters).every(([key, value]) => {
      return localFilterValues[key] === value
    })
  }

  return true
}


const handleRemoteSearch = async (filter: FilterConfig, event: Event) => {
  const query = (event.target as HTMLInputElement).value

  if (filter.remoteMethod && query) {
    try {
      filter.remoteOptions = await filter.remoteMethod(query)
    } catch (error) {
      logger.error('远程搜索失败:', error)
      filter.remoteOptions = []
    }
  }

  
  debouncedFilterChange(filter.key, localFilterValues[filter.key])
}

const showRemoteOptions = (filter: FilterConfig) => {
  filter.showOptions = true
}

const hideRemoteOptions = (filter: FilterConfig) => {
  
  setTimeout(() => {
    filter.showOptions = false
  }, 200)
}

const selectRemoteOption = (filter: FilterConfig, option: FilterOption) => {
  localFilterValues[filter.key] = option.value
  filter.showOptions = false
  debouncedFilterChange(filter.key, option.value, true)

  if (props.autoSearch) {
    handleSearch()
  }
}


const updateDaterangeStart = (key: string, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  localFilterValues['__daterange_' + key + '_start__'] = value
}

const updateDaterangeEnd = (key: string, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  localFilterValues['__daterange_' + key + '_end__'] = value
}


const handleEditableSelectInput = (filter: FilterConfig, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  filterInputValues[filter.key] = value
  localFilterValues[filter.key] = value
  filter.highlightedIndex = -1

  
  showAllEditableOptions[filter.key] = false

  
  debouncedFilterChange(filter.key, value)
}


const handleEditableEnterKey = (filter: FilterConfig) => {
  const options = getFilteredEditableOptions(filter)
  const inputValue = filterInputValues[filter.key]?.trim()

  
  if (filter.highlightedIndex >= 0 && filter.highlightedIndex < options.length) {
    selectEditableOption(filter, filter.highlightedIndex)
  }
  
  else if (inputValue && !options.includes(inputValue)) {
    selectNewEditableOption(filter)
  }
  
  else if (inputValue && options.includes(inputValue)) {
    const matchIndex = options.findIndex(option => option === inputValue)
    if (matchIndex >= 0) {
      selectEditableOption(filter, matchIndex)
    }
  }
}

const getFilteredEditableOptions = (filter: FilterConfig): string[] => {

  const rawOptions = filter.editableOptions
  let options: string[] = []

  if (Array.isArray(rawOptions)) {
    options = rawOptions
  } else if (typeof rawOptions === 'function') {
    options = rawOptions()
  }


  if (showAllEditableOptions[filter.key]) {
    return options
  }

  const inputValue = filterInputValues[filter.key]?.trim()

  
  if (!inputValue) return options

  const input = inputValue.toLowerCase()

  
  const filteredOptions = options.filter((option: string) => {
    const optionName = option.toLowerCase()
    return optionName.includes(input)
  }).sort((a: string, b: string) => {
    const aLower = a.toLowerCase()
    const bLower = b.toLowerCase()

    
    if (aLower === input && bLower !== input) return -1
    if (bLower === input && aLower !== input) return 1
    
    if (aLower.startsWith(input) && !bLower.startsWith(input)) return -1
    if (bLower.startsWith(input) && !aLower.startsWith(input)) return 1
    
    return aLower.localeCompare(bLower)
  })

  
  return filteredOptions
}

const showEditableSelectOptions = (filter: FilterConfig) => {
  
  filterShowOptions[filter.key] = true

  
  filter.highlightedIndex = -1

  
  showAllEditableOptions[filter.key] = true

  
  if (!filterInputValues[filter.key]) {
    filterInputValues[filter.key] = localFilterValues[filter.key] || ''
  }

  
  nextTick(() => {
    positionDropdownOptions(filter)
  })
}


const positionDropdownOptions = (filter: FilterConfig) => {
  const inputRefKey = `${filter.key}Input` as keyof typeof inputRefs
  const inputElement = inputRefs[inputRefKey]

  if (!inputElement) return

  const wrapper = inputElement.closest('.editable-select-wrapper')
  const optionsElement = wrapper?.querySelector('.editable-options') as HTMLElement

  if (!optionsElement) return

  
  optionsElement.style.removeProperty('position')
  optionsElement.style.removeProperty('top')
  optionsElement.style.removeProperty('left')
  optionsElement.style.removeProperty('width')
  optionsElement.style.removeProperty('z-index')
  optionsElement.style.removeProperty('max-height')

  const rect = inputElement.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

  
  optionsElement.style.visibility = 'hidden'
  optionsElement.style.display = 'block'
  const dropdownHeight = optionsElement.scrollHeight
  optionsElement.style.visibility = ''
  optionsElement.style.display = ''

  
  let top = rect.bottom + scrollTop
  let left = rect.left + scrollLeft
  const width = rect.width

  
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top

  
  if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
    top = rect.top + scrollTop - dropdownHeight
  }

  
  if (left + width > viewportWidth) {
    left = viewportWidth - width - 10 
  }

  
  if (left < 10) {
    left = 10
  }

  
  Object.assign(optionsElement.style, {
    position: 'absolute',
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    zIndex: '9999',
    maxWidth: `${viewportWidth - 20}px` 
  })

  
  const maxDropdownHeight = Math.min(300, spaceBelow - 10)
  if (maxDropdownHeight > 0) {
    optionsElement.style.maxHeight = `${maxDropdownHeight}px`
  }
}

const hideEditableSelectOptions = (filter: FilterConfig) => {
  setTimeout(() => {
    filterShowOptions[filter.key] = false
    showAllEditableOptions[filter.key] = false
  }, 200)
}

const navigateEditableOptions = (filter: FilterConfig, direction: 'up' | 'down') => {
  const options = getFilteredEditableOptions(filter)
  if (options.length === 0) return

  if (direction === 'down') {
    filter.highlightedIndex = filter.highlightedIndex >= options.length - 1 ? 0 : filter.highlightedIndex + 1
  } else {
    filter.highlightedIndex = filter.highlightedIndex <= 0 ? options.length - 1 : filter.highlightedIndex - 1
  }
}

const selectEditableOption = (filter: FilterConfig, index: number) => {
  const options = getFilteredEditableOptions(filter)
  if (index >= 0 && index < options.length) {
    const selectedValue = options[index]
    filterInputValues[filter.key] = selectedValue
    localFilterValues[filter.key] = selectedValue
    filterShowOptions[filter.key] = false
    filter.highlightedIndex = -1

    
    showAllEditableOptions[filter.key] = false

    debouncedFilterChange(filter.key, selectedValue, true)

    
    if (filter.onOptionsChange) {
      filter.onOptionsChange(filter, selectedValue)
    }

    if (props.autoSearch) {
      handleSearch()
    }
  }
}

const selectNewEditableOption = (filter: FilterConfig) => {
  if (filterInputValues[filter.key]?.trim()) {
    const newValue = filterInputValues[filter.key].trim()
    localFilterValues[filter.key] = newValue
    filter.showOptions = false
    filter.highlightedIndex = -1
    debouncedFilterChange(filter.key, newValue, true)

    if (props.autoSearch) {
      handleSearch()
    }
  }
}

const toggleEditableSelect = (filter: FilterConfig) => {
  filterShowOptions[filter.key] = !filterShowOptions[filter.key]

  if (filterShowOptions[filter.key]) {

    filter.highlightedIndex = -1


    if (!filterInputValues[filter.key]) {
      filterInputValues[filter.key] = localFilterValues[filter.key] || ''
    }

    showAllEditableOptions[filter.key] = true


    nextTick(() => {
      positionDropdownOptions(filter)
    })
  }
}

const clearEditableSelect = (filter: FilterConfig) => {
  filterInputValues[filter.key] = ''
  localFilterValues[filter.key] = ''
  filterShowOptions[filter.key] = false
  filter.highlightedIndex = -1

  
  showAllEditableOptions[filter.key] = false

  debouncedFilterChange(filter.key, '', true)

  if (props.autoSearch) {
    handleSearch()
  }
}


watch(() => props.modelValue, (newValue) => {
  searchQuery.value = newValue
})

watch(() => props.filterValues, (newValues) => {
  Object.assign(localFilterValues, newValues)
  
  props.filters.forEach(filter => {
    if (filter.type === 'editable-select' && newValues[filter.key]) {
      filterInputValues[filter.key] = newValues[filter.key]
    }
  })
}, { deep: true })

watch(localFilterValues, (newValues) => {
  emit('update:filterValues', { ...newValues })
}, { deep: true })


let handleGlobalClick: ((event: MouseEvent) => void) | null = null

onMounted(() => {

  if (props.autoFocus && searchInput.value) {
    searchInput.value.focus()
  }

  // 初始化 filterShowOptions
  props.filters.forEach(filter => {
    if (filter.type === 'editable-select') {
      filterShowOptions[filter.key] = filter.showOptions || false
    }
  })


  handleGlobalClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement

    
    props.filters.forEach(filter => {
      if (filter.type === 'editable-select' && filterShowOptions[filter.key]) {
        
        if (target.classList.contains('editable-dropdown') ||
            target.closest('.editable-dropdown')) {
          return
        }

        
        if (target.classList.contains('editable-clear') ||
            target.closest('.editable-clear')) {
          return
        }

        
        const inputRefKey = `${filter.key}Input` as keyof typeof inputRefs
        const inputElement = inputRefs[inputRefKey]

        if (inputElement) {
          const wrapper = inputElement.closest('.editable-select-wrapper')

          
          if (!wrapper || !wrapper.contains(target)) {
            filterShowOptions[filter.key] = false
            filter.highlightedIndex = -1 
          }
        } else {
          
          filterShowOptions[filter.key] = false
          filter.highlightedIndex = -1
        }
      }
    })
  }

  document.addEventListener('click', handleGlobalClick)

  
  document.addEventListener('touchstart', handleGlobalClick)
})

onBeforeUnmount(() => {
  
  if (searchTimer !== null) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  if (filterChangeTimer !== null) {
    clearTimeout(filterChangeTimer)
    filterChangeTimer = null
  }

  
  if (handleGlobalClick) {
    document.removeEventListener('click', handleGlobalClick)
    document.removeEventListener('touchstart', handleGlobalClick)
    handleGlobalClick = null
  }
})
</script>

<style lang="scss" scoped>
.global-search {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 24px;

  
  @media (max-width: 768px) {
    padding: 16px 0; 
  }

  
  @media (max-width: 375px) {
    padding: 12px 0; 
  }
  border: 1px solid var(--el-border-color-light);
}

.search-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 16px;
}

.search-form {
  .search-row {
    display: flex;
    gap: 16px;
    align-items: flex-end;

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: stretch;
    }
  }

  .search-filters {
    flex: 1;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .search-main {
    flex: 1; /* 占据剩余空间 */
    min-width: 100px; /* 最小宽度 */
    max-width: 500px; /* 最大宽度 */
  }

  @media (max-width: 768px) {
    .search-row {
      gap: 12px;
      align-items: center;
    }

    .search-filters {
      order: 1;
      width: 100%;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 8px; 

      .filter-item {
        flex: 0 0 calc(33.333% - 6px); 
        min-width: 110px; 
        max-width: calc(50% - 4px); 

        
        .form-control-sm {
          font-size: 13px; 
          height: 38px;  
          padding: 6px 40px 6px 6px;
        }

        .filter-label {
          font-size: 10px; 
          margin-bottom: 2px;
        }
      }
    }

  
    // 搜索框和按钮在同一行
    .search-main {
      order: 2;
      display: flex;
      gap: 8px;
      padding: 0 8px;
      align-items: stretch;
      flex: 1; /* 占据剩余空间 */

      .input-group {
        flex: 1;
        position: relative;

        .form-control {
          font-size: 16px; /* Prevent iOS zoom */
          height: 44px;   /* iOS recommended touch target size */
          padding: 12px 48px 12px 48px;
          border-radius: 8px;
          width: 100%;
        }

        .input-icon {
          position: absolute;
          width: 44px;
          height: 44px;
          font-size: 16px;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--el-text-color-placeholder);
          z-index: 1;
        }

        .input-clear {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--el-text-color-placeholder);
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          z-index: 1;
        }
      }

      .search-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0; /* 防止按钮被压缩 */

        .btn {
          min-height: 44px; /* iOS recommended touch target size */
          white-space: nowrap;
          padding: 0 16px;
        }
      }
    }

    .search-actions {
      order: 3;
      display: flex;
      gap: 8px;
      flex-shrink: 0; 

      .btn {
        min-height: 44px; /* iOS recommended touch target size */
        white-space: nowrap;
        padding: 0 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
    }

    
    .filter-item {
      width: 100%;

      .filter-label {
        font-size: 11px;
        margin-bottom: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      
      &.filter-select,
      &.filter-daterange {
        .form-control-sm,
        .daterange-inputs input {
          font-size: 14px; /* Prevent iOS zoom, slightly smaller for 3-column layout */
          height: 40px;
          padding: 8px;
          border-radius: 6px;
        }
      }

      
      &.filter-editable-select {
        .form-control-sm {
          font-size: 14px; /* Prevent iOS zoom, slightly smaller for 3-column layout */
          height: 40px;
          padding: 8px 48px 8px 8px;
        }

        .editable-select-wrapper {
          .editable-clear,
          .editable-dropdown {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          }

          .editable-clear {
            right: 40px;
          }

          .editable-options {
            max-height: 180px;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch; /* iOS scroll optimization */
            position: absolute !important;
            background: white;
            border: 1px solid #ddd;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

            .editable-option {
              padding: 10px 12px;
              font-size: 14px;
              line-height: 1.4;
              min-height: 40px; 
              border-bottom: 1px solid #f0f0f0;

              &:last-child {
                border-bottom: none;
              }

              &:active {
                background-color: #f5f5f5;
              }
            }
          }
        }
      }
    }

    
    .search-main {
      .input-group {
        position: relative; 
        width: 100%;

        .form-control {
          font-size: 16px; /* Prevent iOS zoom */
          height: 44px;   /* iOS recommended touch target size */
          padding: 12px 48px 12px 48px; 
          border-radius: 8px; 
          -webkit-appearance: none; /* Remove iOS default styles */
          -webkit-tap-highlight-color: transparent; 
          width: 100%; 

          &:focus {
            outline: none;
            border-color: var(--el-color-primary);
            box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
          }
        }

        .input-icon {
          position: absolute;
          width: 44px;
          height: 44px;
          font-size: 16px;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none; 
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .input-clear {
          position: absolute;
          width: 44px;
          height: 44px;
          font-size: 16px;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--el-text-color-placeholder);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          display: flex;
          align-items: center;
          justify-content: center;

          &:active {
            color: var(--el-text-color-primary);
          }
        }
      }
    }

    
    .quick-tags {
      flex-wrap: wrap;
      gap: 8px;

      .tag-item {
        padding: 8px 12px;
        font-size: 14px;
        min-height: 32px;
      }
    }
  }

  
  @media (max-width: 480px) {
    .search-filters {
      .filter-item {
        flex: 0 0 calc(50% - 4px); 
        max-width: calc(50% - 4px);
      }
    }
  }

  
  @media (max-width: 375px) {
    .search-row {
      gap: 12px;
    }

    .search-filters {
      gap: 6px;

      .filter-item {
        flex: 0 0 calc(50% - 3px); 
        max-width: calc(50% - 3px);

        &.filter-editable-select {
          .form-control-sm {
            font-size: 14px;
            padding: 10px 48px 10px 10px;
            height: 40px; 
          }
        }

        .filter-label {
          font-size: 11px;
          margin-bottom: 3px;
        }
      }
    }

    .search-main {
      .input-group {
        .form-control {
          font-size: 14px;
          padding: 10px 40px 10px 40px;
        }
      }
    }

    .search-actions {
      .btn {
        font-size: 14px;
        min-height: 40px;
      }
    }
  }

  
  @media (max-width: 320px) {
    .search-filters {
      .filter-item {
        flex: 0 0 100%; 
        max-width: 100%;
      }
    }
  }

  .search-actions {
    display: flex;
    gap: 12px;

    @media (max-width: 768px) {
      flex-direction: row;
      gap: 4px;

      .btn {
        flex: 1;
        justify-content: center;
        min-width: 80px;
      }
    }
  }
}


.search-form-compact {
  padding: 16px;

  .search-row {
    gap: 12px;
    align-items: center;
  }

  .search-filters {
    gap: 12px;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;

    
    &::-webkit-scrollbar {
      height: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--el-border-color);
      border-radius: 2px;
    }
  }

  .filter-item {
    min-width: 0;
    flex: 0 0 auto;

    
    .filter-label {
      margin-bottom: 4px;
      font-size: 12px;
    }
  }

  .search-main {
    flex: 1; /* 占据剩余空间 */
    min-width: 200px; /* 最小宽度 */
    max-width: 500px; /* 最大宽度 */
  }

  .search-actions {
    flex: 0 0 auto;
    gap: 8px;
  }
}


@media (max-width: 768px) {
  .global-search {
    padding: 12px;

    .search-header {
      padding: 0 0 12px 0;
      font-size: 16px;
    }

    .search-row {
      gap: 12px;
      align-items: center;
    }

    .search-main {
      display: flex;
      gap: 4px;
      align-items: stretch;
      flex: 1; /* 占据剩余空间 */
    }

    .search-main .input-group {
      flex: 1; /* 输入框占据剩余空间 */
    }

    .search-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0; /* 防止按钮被压缩 */
    }

    .search-input {
      .el-input__wrapper {
        padding: 8px 12px;
        font-size: 14px;
        width: 100%; /* 确保输入框占据容器宽度 */
      }
    }

    .search-filters {
      .filter-item {
        flex: 1 1 100%;
        min-width: 100%;

        .el-select,
        .el-date-editor {
          width: 100%;
        }

        .filter-label {
          font-size: 13px;
          margin-bottom: 4px;
        }
      }
    }

    .quick-tags {
      flex-wrap: wrap;
      gap: 8px;

      .quick-tag {
        font-size: 12px;
        padding: 4px 8px;
      }
    }

    .active-filters {
      flex-wrap: wrap;
      gap: 6px;

      .active-filter {
        font-size: 12px;
        padding: 2px 6px;
      }
    }
  }
}


@media (max-width: 480px) {
  .global-search {
    padding: 8px;

    .search-header {
      font-size: 15px;
      margin-bottom: 8px;
    }

    .search-row {
      gap: 10px;
    }

    .search-actions {
      .btn {
        height: 40px;
        font-size: 14px;
        padding: 0 16px;
      }
    }

    .filter-container {
      padding: 8px;
    }

    .filter-section {
      margin-bottom: 12px;

      .section-title {
        font-size: 14px;
        margin-bottom: 8px;
      }
    }

    .filter-item {
      margin-bottom: 8px;

      .filter-label {
        font-size: 12px;
      }
    }

    .quick-tags {
      .quick-tag {
        font-size: 11px;
        padding: 3px 6px;
      }
    }

    .selected-filters {
      padding: 8px;
      margin-top: 8px;

      .filter-title {
        font-size: 13px;
      }

      .active-filters {
        margin-top: 6px;

        .active-filter {
          font-size: 11px;
          padding: 2px 5px;
        }
      }
    }
  }
}


.input-group {
  position: relative;

  .input-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--el-text-color-placeholder);
    font-size: 14px;
    z-index: 1;
  }

  .form-control {
    padding-left: 40px;
    padding-right: 40px;
  }

  .input-clear {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    transition: all 0.2s;

    &:hover {
      background: var(--el-fill-color-light);
      color: var(--el-text-color-regular);
    }
  }
}


.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 140px;

  @media (max-width: 768px) {
    min-width: 100%;
  }

  .filter-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    font-weight: 500;
  }

  .form-control-sm {
    font-size: 13px;
  }
}


.daterange-inputs {
  display: flex;
  align-items: center;
  gap: 8px;

  .form-control-sm {
    flex: 1;
  }

  .daterange-separator {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
}


.remote-select-wrapper {
  position: relative;
  z-index: 9999; 

  .remote-options {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 999999; 
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  }

  .remote-option {
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--el-fill-color-light);
    }
  }
}


.editable-select-wrapper {
  position: relative;
  z-index: 9999; 

  .form-control-sm {
    padding-right: 60px;
  }

  .editable-clear {
    position: absolute;
    right: 32px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    font-size: 12px;
    z-index: 2;
    padding: 2px;

    &:hover {
      color: var(--el-text-color-regular);
    }
  }

  .editable-dropdown {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    font-size: 12px;
    z-index: 2;
    padding: 2px;

    &:hover {
      color: var(--el-text-color-regular);
    }
  }

  .editable-options {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--el-border-color);
    border-top: none;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    max-height: 200px;
    overflow-y: auto;
    z-index: 999999999; 
    margin: 0;
    padding: 0;
    list-style: none;
    
    transform: translateZ(0);
    will-change: transform;
    
    isolation: isolate;
    
    pointer-events: auto;
  }

  .editable-option {
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-bottom: 1px solid var(--el-fill-color-lighter);
    font-size: 13px;
    color: var(--el-text-color-regular);
    
    min-height: 40px;
    display: flex;
    align-items: center;
    -webkit-tap-highlight-color: transparent; 

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: var(--el-fill-color-light);
    }

    &.highlighted {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }

    
    &:active {
      background: var(--el-color-primary-light-8);
      color: var(--el-color-primary);
    }

    &.new-item {
      color: var(--el-color-primary);
      font-style: italic;

      i {
        margin-right: 4px;
        font-size: 11px;
      }
    }
  }
}


.quick-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;

  .quick-tags-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .quick-tag {
    padding: 4px 12px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 16px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-7);
      color: var(--el-color-primary);
    }

    &.active {
      background: var(--el-color-primary);
      border-color: var(--el-color-primary);
      color: white;
    }
  }
}


.active-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;

  .active-filters-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .active-filter-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    flex: 1;
  }

  .active-filter-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    border-radius: 16px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--el-color-primary-light-7);
    }

    i {
      font-size: 12px;
    }
  }

  .clear-all-filters {
    background: none;
    border: none;
    color: var(--el-color-danger);
    font-size: 13px;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.8;
    }
  }
}


.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.btn-primary {
    background: var(--el-color-primary);
    border-color: var(--el-color-primary);
    color: white;

    &:hover:not(:disabled) {
      background: var(--el-color-primary-light-3);
      border-color: var(--el-color-primary-light-3);
    }
  }

  &.btn-outline-secondary {
    background: transparent;
    border-color: var(--el-border-color);
    color: var(--el-text-color-regular);

    &:hover:not(:disabled) {
      background: var(--el-fill-color-light);
      color: var(--el-text-color-primary);
    }
  }
}


.form-control {
  display: block;
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
  background-color: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  transition: border-color 0.2s, box-shadow 0.2s;
  height: 32px; 
  box-sizing: border-box; 

  &:focus {
    outline: none;
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
  }

  &:disabled {
    background-color: var(--el-fill-color-light);
    cursor: not-allowed;
  }

  &::placeholder {
    color: var(--el-text-color-placeholder);
  }
}
</style>
