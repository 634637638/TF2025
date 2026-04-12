<template>
  <div
    class="tf-pagination"
    :class="{
      'is-mobile': isMobile,
      'is-tablet': isTablet,
      'is-compact': isCompact
    }"
    :data-size="size"
  >
    <!-- 分页信息 -->
    <div class="tf-pagination__info">
      <span v-if="effectiveShowTotal" class="tf-pagination__total">
        共 {{ total }} 条记录
      </span>
      <span v-if="effectiveShowRange && total > 0" class="tf-pagination__range">
        当前第 {{ startIndex }} - {{ endIndex }} 条
      </span>
    </div>

    <!-- 分页器 -->
    <div class="tf-pagination__controls">
      <!-- 页面大小选择 -->
      <div v-if="effectiveShowPageSizes" class="tf-pagination__sizes">
        <span class="tf-pagination__sizes-text">每页显示</span>
        <el-select
          v-model="currentPageSize"
          :size="size"
          @change="handleSizeChange"
        >
          <el-option
            v-for="size in pageSizes"
            :key="size"
            :label="size"
            :value="size"
          />
        </el-select>
        <span class="tf-pagination__sizes-text">条</span>
      </div>

      <!-- 分页按钮 -->
      <div class="tf-pagination__pager">
        <button
          class="tf-pagination__btn tf-pagination__btn--prev"
          :class="{ 'is-disabled': currentPage <= 1 }"
          :disabled="currentPage <= 1 || disabled"
          @click="handlePrevClick"
        >
          <i class="fas fa-chevron-left"></i>
          上一页
        </button>

        <!-- 页码 -->
        <div class="tf-pagination__numbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            class="tf-pagination__number"
            :class="{
              'is-current': page === currentPage,
              'is-ellipsis': page === '...'
            }"
            :disabled="page === '...' || disabled"
            @click="handlePageClick(page)"
          >
            {{ page }}
          </button>
        </div>

        <button
          class="tf-pagination__btn tf-pagination__btn--next"
          :class="{ 'is-disabled': currentPage >= totalPages }"
          :disabled="currentPage >= totalPages || disabled"
          @click="handleNextClick"
        >
          下一页
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <!-- 快速跳转 -->
      <div v-if="effectiveShowQuickJumper && totalPages > 1" class="tf-pagination__jumper">
        <span class="tf-pagination__jumper-text">跳至</span>
        <el-input-number
          v-model="jumpPage"
          :min="1"
          :max="totalPages"
          :controls="false"
          :size="size"
          :disabled="disabled"
          @change="handleJump"
          @keyup.enter="handleJump"
        />
        <span class="tf-pagination__jumper-text">页</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMobile } from '@/composables/useMobile'

interface Props {
  current?: number
  pageSize?: number
  total?: number
  pageSizes?: number[]
  showTotal?: boolean
  showRange?: boolean
  showPageSizes?: boolean
  showQuickJumper?: boolean
  size?: 'large' | 'default' | 'small'
  disabled?: boolean
  background?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  current: 1,
  pageSize: 100,
  total: 0,
  pageSizes: () => [100, 200, 500, 1000],
  showTotal: true,
  showRange: false,
  showPageSizes: true,
  showQuickJumper: true,
  size: 'default',
  disabled: false,
  background: true
})

interface Emits {
  'update:current': [page: number]
  'update:pageSize': [size: number]
  'change': [page: number, pageSize: number]
  'size-change': [size: number]
  'current-change': [page: number]
}

const emit = defineEmits<Emits>()
const { isMobile, isTablet, screenSize } = useMobile()

// 响应式数据
const currentPage = ref(props.current)
const currentPageSize = ref(props.pageSize || 100)
const jumpPage = ref(props.current)

// 计算属性
const totalPages = computed(() => {
  return Math.ceil(Math.max(props.total, 0) / currentPageSize.value)
})

const startIndex = computed(() => {
  if (props.total === 0) return 0
  return (currentPage.value - 1) * currentPageSize.value + 1
})

const endIndex = computed(() => {
  const end = currentPage.value * currentPageSize.value
  return end > props.total ? props.total : end
})

const isCompact = computed(() => screenSize.value.width > 0 && screenSize.value.width <= 480)

const effectiveShowTotal = computed(() => props.showTotal)
const effectiveShowRange = computed(() => props.showRange && !isCompact.value)
const effectiveShowPageSizes = computed(() => props.showPageSizes && !isCompact.value)
const effectiveShowQuickJumper = computed(() => props.showQuickJumper && !isMobile.value)

const visiblePages = computed(() => {
  const current = currentPage.value
  const total = totalPages.value
  const sideCount = isCompact.value ? 0 : isMobile.value ? 1 : isTablet.value ? 1 : 2
  const maxVisible = isCompact.value ? 3 : isMobile.value ? 5 : 7

  if (total <= maxVisible) {
    const pages = []
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
    return pages
  }

  const pages = []

  // 总是显示第1页
  pages.push(1)

  // 当前页距离第1页较远，显示省略号
  if (current > 2 + sideCount) {
    pages.push('...')
  }

  // 显示当前页附近的页码
  const start = Math.max(2, current - sideCount)
  const end = Math.min(total - 1, current + sideCount)

  for (let i = start; i <= end; i++) {
    if (i !== 1 && i !== total) {
      pages.push(i)
    }
  }

  // 当前页距离最后一页较远，显示省略号
  if (current < total - (1 + sideCount)) {
    pages.push('...')
  }

  // 总是显示最后一页
  if (total > 1) {
    pages.push(total)
  }

  return pages
})

// 事件处理
const handleSizeChange = (size: number) => {
  currentPageSize.value = size
  emit('update:pageSize', size)
  emit('size-change', size)
  emit('change', currentPage.value, size)
}

const handleCurrentChange = (page: number) => {
  currentPage.value = page
  emit('update:current', page)
  emit('current-change', page)
  emit('change', page, currentPageSize.value)
}

const handlePrevClick = () => {
  if (currentPage.value > 1) {
    handleCurrentChange(currentPage.value - 1)
  }
}

const handleNextClick = () => {
  if (currentPage.value < totalPages.value) {
    handleCurrentChange(currentPage.value + 1)
  }
}

const handlePageClick = (page: number | string) => {
  if (typeof page === 'number' && page >= 1 && page <= totalPages.value) {
    handleCurrentChange(page)
  }
}

const handleJump = (page?: number) => {
  const targetPage = page || jumpPage.value
  if (targetPage >= 1 && targetPage <= totalPages.value) {
    handleCurrentChange(targetPage)
  }
}

// 监听器
watch(() => props.current, (newPage) => {
  currentPage.value = newPage
  jumpPage.value = newPage
})

watch(() => props.pageSize, (newSize) => {
  currentPageSize.value = newSize
}, { immediate: true })

// 监听总数变化，调整当前页
watch(() => props.total, () => {
  if (currentPage.value > totalPages.value && totalPages.value > 0) {
    handleCurrentChange(totalPages.value)
  }
})
</script>

<style lang="scss" scoped>
.tf-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 14px;
  color: var(--el-text-color-regular);

  &__info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  &__total {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  &__range {
    color: var(--el-text-color-regular);
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  &__sizes {
    display: flex;
    align-items: center;
    gap: 8px;

    &-text {
      color: var(--el-text-color-regular);
      white-space: nowrap;
    }
  }

  &__pager {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__numbers {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    background: var(--el-bg-color);
    color: var(--el-text-color-regular);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
    white-space: nowrap;
    gap: 4px;

    &:hover:not(.is-disabled) {
      background: var(--el-bg-color-page);
      border-color: var(--el-border-color-hover);
      color: var(--el-text-color-primary);
    }

    &.is-disabled {
      cursor: not-allowed;
      opacity: 0.5;
      color: var(--el-text-color-disabled);
    }
  }

  &__number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    background: var(--el-bg-color);
    color: var(--el-text-color-regular);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;

    &:hover:not(.is-current):not(.is-ellipsis) {
      background: var(--el-bg-color-page);
      border-color: var(--el-border-color-hover);
      color: var(--el-text-color-primary);
    }

    &.is-current {
      background: var(--el-color-primary);
      border-color: var(--el-color-primary);
      color: #fff;
    }

    &.is-ellipsis {
      border: none;
      background: none;
      cursor: default;
      color: var(--el-text-color-disabled);
    }
  }

  &__jumper {
    display: flex;
    align-items: center;
    gap: 8px;

    &-text {
      color: var(--el-text-color-regular);
      white-space: nowrap;
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .tf-pagination {
    justify-content: center;
    gap: 8px;
    align-items: center;
    padding: 6px 0;

    &__info {
      justify-content: center;
      font-size: 13px;
      order: 1;
      width: auto;
    }

    &__controls {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      order: 2;
      justify-content: center;
      width: auto;
    }

    &__sizes {
      order: 1;
      width: auto;
      justify-content: center;

      &-text {
        font-size: 13px;
      }

      .el-select {
        width: 100px;
      }
    }

    &__pager {
      order: 2;

      .tf-pagination__btn {
        padding: 5px 10px;
        font-size: 13px;

        i {
          margin: 0 2px;
        }
      }
    }

    &__numbers {
      .tf-pagination__number {
        min-width: 28px;
        height: 28px;
        font-size: 13px;
      }
    }

    &__jumper {
      order: 3;

      &-text {
        font-size: 13px;
      }

      .el-input-number {
        width: 60px;
      }
    }
  }
}

// 超小屏幕优化
@media (max-width: 480px) {
  .tf-pagination {
    justify-content: center;
    gap: 6px;
    padding: 4px 0;

    &__info {
      flex-direction: row;
      justify-content: center;
      text-align: center;
      gap: 6px;
      font-size: 12px;
      width: 100%;
    }

    &__controls {
      gap: 6px;
      width: 100%;
      justify-content: center;
    }

    &__pager {
      gap: 4px;

      .tf-pagination__btn {
        padding: 4px 8px;
        font-size: 12px;

        i {
          display: none;
        }
      }
    }

    &__numbers {
      gap: 2px;

      .tf-pagination__number {
        min-width: 24px;
        height: 24px;
        font-size: 12px;
        padding: 0 4px;
      }
    }

    &__sizes {
      .el-select {
        width: 80px;
      }
    }

    &__jumper {
      .el-input-number {
        width: 50px;
      }
    }
  }
}

// 小尺寸
.tf-pagination[data-size="small"] {
  font-size: 12px;

  .tf-pagination__btn {
    padding: 4px 8px;
    font-size: 12px;
  }

  .tf-pagination__number {
    min-width: 28px;
    height: 28px;
    font-size: 12px;
    padding: 0 6px;
  }
}

// 大尺寸
.tf-pagination[data-size="large"] {
  font-size: 16px;

  .tf-pagination__btn {
    padding: 12px 16px;
    font-size: 16px;
  }

  .tf-pagination__number {
    min-width: 36px;
    height: 36px;
    font-size: 16px;
    padding: 0 12px;
  }
}
</style>
