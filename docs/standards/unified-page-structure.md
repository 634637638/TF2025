# TF2025 统一页面结构规范

## 📋 概述

基于对现有核心页面的分析，制定TF2025项目的统一页面结构规范，确保所有页面具有一致的用户体验和代码结构。

## 🎯 核心问题总结

通过分析核心页面发现的主要问题：

1. **权限检查方式不统一** - 不同页面使用不同的权限检查方法
2. **页面头部结构不一致** - 标题、描述、操作按钮布局不统一
3. **组件导入路径不规范** - 相对路径不统一
4. **状态管理命名不一致** - loading、error等状态命名不统一
5. **样式类名不规范** - 按钮和表格类名不统一

## 🏗️ 统一页面结构模板

### 1. 标准页面结构

```vue
<template>
  <div class="page-container">
    <!-- 权限加载状态 -->
    <div v-if="permissionLoading" class="permission-loading">
      <BaseLoading />
    </div>

    <!-- 权限不足提示 -->
    <div v-else-if="!hasViewPermission" class="permission-denied">
      <div class="permission-denied-content">
        <i class="fas fa-lock"></i>
        <h2>权限不足</h2>
        <p>您没有权限访问此页面</p>
        <p><strong>需要的权限：</strong>{{ modulePermission }}:view</p>
        <button class="btn btn-primary" @click="router.back()">
          返回上一页
        </button>
      </div>
    </div>

    <!-- 主要内容 -->
    <div v-else class="page-content" v-permission="'${modulePermission}:view'">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-left">
            <h1 class="page-title">
              <i :class="pageTitleIcon"></i>
              {{ pageTitle }}
            </h1>
            <p class="page-description">{{ pageDescription }}</p>
          </div>
          <div class="header-actions">
            <div class="action-buttons">
              <slot name="header-actions">
                <button class="btn btn-primary" @click="handleCreate" v-permission="'${modulePermission}:create'">
                  <i class="fas fa-plus"></i>
                  <span>新增</span>
                </button>
                <button class="btn btn-outline-secondary" @click="handleRefresh" :disabled="loading">
                  <i :class="loading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
                  <span>刷新</span>
                </button>
              </slot>
            </div>
          </div>
        </div>
      </div>

      <!-- 页面主体 -->
      <div class="page-body">
        <!-- 统计卡片 -->
        <div v-if="showStats" class="stats-cards">
          <slot name="stats-cards" />
        </div>

        <!-- 搜索筛选区域 -->
        <div v-if="showSearch" class="search-section">
          <div class="section-title">
            <i class="fas fa-filter"></i>
            筛选条件
          </div>
          <div class="search-form">
            <div class="search-row">
              <div class="search-main">
                <div class="input-group">
                  <i class="fas fa-search input-icon"></i>
                  <input
                    v-model="searchKeyword"
                    @input="debounceSearch"
                    type="text"
                    class="form-control"
                    placeholder="搜索关键词..."
                  />
                </div>
              </div>
              <div class="search-filters">
                <slot name="search-filters" />
              </div>
              <div class="search-actions">
                <button class="btn btn-primary" @click="handleSearch" :disabled="loading">
                  <i class="fas fa-search"></i>
                  搜索
                </button>
                <button class="btn btn-outline-secondary" @click="handleReset">
                  <i class="fas fa-redo"></i>
                  重置
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 数据表格区域 -->
        <div v-if="showTable" class="table-section">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-list"></i>
              {{ tableTitle }}
              <span class="record-count">共 {{ pagination.total }} 条记录</span>
            </div>
            <div class="table-actions">
              <slot name="table-actions" />
            </div>
          </div>

          <div class="table-responsive">
            <!-- 表格内容 -->
            <slot name="table-content">
              <div v-if="loading" class="table-loading">
                <el-skeleton :rows="5" animated />
              </div>
              <div v-else-if="errorMessage" class="table-error">
                <el-empty description="加载失败" :image-size="200">
                  <el-button type="primary" @click="handleRefresh">
                    重试
                  </el-button>
                </el-empty>
              </div>
              <div v-else>
                <!-- 实际表格内容 -->
                <table class="unified-table">
                  <thead>
                    <tr>
                      <th v-for="column in columns" :key="column.key">
                        {{ column.label }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in tableData" :key="item.id">
                      <td v-for="column in columns" :key="column.key">
                        {{ item[column.key] }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </slot>
          </div>

          <!-- 统一分页组件 -->
          <div class="table-pagination">
            <Pagination
              v-if="pagination.total > 0"
              v-model:current="pagination.page"
              v-model:page-size="pagination.pageSize"
              :total="pagination.total"
              :page-sizes="[20, 50, 100, 200]"
              :show-total="true"
              :show-range="true"
              :show-page-sizes="true"
              :show-quick-jumper="true"
              :disabled="loading"
              @change="handlePaginationChange"
            />
          </div>
        </div>

        <!-- 其他内容区域 -->
        <slot name="extra-content" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { useDebounce } from '@/composables/useDebounce'
import Pagination from '@/components/Pagination.vue'
import BaseLoading from '@/components/BaseLoading.vue'

// 接口定义
interface Props {
  // 页面信息
  pageTitle: string
  pageDescription?: string
  pageTitleIcon?: string
  modulePermission: string
  tableTitle?: string

  // 显示控制
  showStats?: boolean
  showSearch?: boolean
  showTable?: boolean

  // 表格配置
  columns?: Array<{
    key: string
    label: string
    width?: string
  }>
  tableData?: any[]
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  pageDescription: '',
  pageTitleIcon: 'fas fa-circle',
  tableTitle: '数据列表',
  showStats: true,
  showSearch: true,
  showTable: true,
  columns: () => [],
  tableData: () => [],
  pagination: () => ({ page: 1, pageSize: 20, total: 0 })
})

const emit = defineEmits<{
  refresh: []
  create: []
  search: [keyword: string]
  reset: []
  'pagination-change': [page: number, pageSize: number]
}>()

// 路由和权限
const router = useRouter()
const authStore = useAuthStore()
const { success, error, handleApiError } = useNotification()

// 状态管理
const permissionLoading = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const searchKeyword = ref('')

// 权限检查
const hasViewPermission = computed(() => {
  return authStore.hasPermission(`${props.modulePermission}:view`)
})

// 防抖搜索
const debounceSearch = useDebounce(() => {
  emit('search', searchKeyword.value)
}, 300)

// 事件处理
const handleCreate = () => {
  emit('create')
}

const handleRefresh = () => {
  emit('refresh')
}

const handleSearch = () => {
  emit('search', searchKeyword.value)
}

const handleReset = () => {
  searchKeyword.value = ''
  emit('reset')
}

const handlePaginationChange = (page: number, pageSize: number) => {
  emit('pagination-change', page, pageSize)
}

// 暴露方法
defineExpose({
  setLoading: (value: boolean) => { loading.value = value },
  setError: (message: string) => { errorMessage.value = message },
  setPermissionLoading: (value: boolean) => { permissionLoading.value = value }
})
</script>

<style lang="scss" scoped>
.page-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

.permission-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50vh;
}

.permission-denied {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50vh;

  &-content {
    text-align: center;
    max-width: 400px;

    i {
      font-size: 48px;
      color: var(--el-color-warning);
      margin-bottom: 16px;
    }

    h2 {
      margin-bottom: 8px;
      color: var(--el-text-color-primary);
    }

    p {
      color: var(--el-text-color-regular);
      margin-bottom: 24px;
    }
  }
}

.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-header {
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;

  &__content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    min-height: 80px;
    padding: 16px 0;
  }

  &__left {
    flex: 1;
  }

  &__right {
    margin-left: 24px;
  }
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 8px;

  i {
    font-size: 20px;
    color: var(--el-color-primary);
  }
}

.page-description {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin: 0;
  line-height: 1.5;
}

.header-actions {
  .action-buttons {
    display: flex;
    gap: 12px;
    align-items: center;
  }
}

.page-body {
  flex: 1;
  padding: 24px;
  overflow: auto;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.search-section {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid var(--el-border-color-light);

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 16px;
  }
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

  .search-main {
    flex: 1;
    min-width: 200px;
  }

  .search-filters {
    flex: 2;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .search-actions {
    display: flex;
    gap: 12px;
  }

  .input-group {
    position: relative;

    .input-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--el-text-color-placeholder);
      z-index: 1;
    }

    .form-control {
      width: 100%;
      padding-left: 36px;
    }
  }
}

.table-section {
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  overflow: hidden;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid var(--el-border-color-light);

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 500;
      color: var(--el-text-color-primary);

      .record-count {
        font-size: 12px;
        color: var(--el-text-color-regular);
        background: var(--el-color-primary-light-9);
        padding: 2px 8px;
        border-radius: 12px;
      }
    }
  }

  .table-responsive {
    min-height: 400px;
  }

  .table-loading,
  .table-error {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
  }

  .table-pagination {
    padding: 16px 24px;
    border-top: 1px solid var(--el-border-color-light);
  }
}

.unified-table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  th {
    background: var(--el-bg-color-page);
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  tbody tr:hover {
    background: var(--el-bg-color-page);
  }
}

// 统一按钮样式
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;

  &:focus {
    outline: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: white;

  &:hover:not(:disabled) {
    background: var(--el-color-primary-dark-2);
    border-color: var(--el-color-primary-dark-2);
  }
}

.btn-outline-secondary {
  background: transparent;
  border-color: var(--el-border-color);
  color: var(--el-text-color-primary);

  &:hover:not(:disabled) {
    background: var(--el-bg-color-page);
    border-color: var(--el-border-color-hover);
  }
}

.btn-success {
  background: var(--el-color-success);
  border-color: var(--el-color-success);
  color: white;

  &:hover:not(:disabled) {
    background: var(--el-color-success-dark-2);
    border-color: var(--el-color-success-dark-2);
  }
}

.btn-warning {
  background: var(--el-color-warning);
  border-color: var(--el-color-warning);
  color: white;

  &:hover:not(:disabled) {
    background: var(--el-color-warning-dark-2);
    border-color: var(--el-color-warning-dark-2);
  }
}

.btn-danger {
  background: var(--el-color-danger);
  border-color: var(--el-color-danger);
  color: white;

  &:hover:not(:disabled) {
    background: var(--el-color-danger-dark-2);
    border-color: var(--el-color-danger-dark-2);
  }
}

// 统一表单控件样式
.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  background: var(--el-bg-color);
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--el-color-primary);
  }

  &::placeholder {
    color: var(--el-text-color-placeholder);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .page-header {
    padding: 0 16px;

    &__content {
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
    }
  }

  .page-body {
    padding: 16px;
  }

  .search-section {
    padding: 16px;
  }

  .table-section {
    .section-header {
      padding: 12px 16px;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }

    .table-pagination {
      padding: 12px 16px;
    }
  }
}
</style>
```

## 📝 页面改造实施步骤

### 第一阶段：创建基础组件

1. **创建 BasePageLayout 组件** - 封装通用页面结构
2. **创建 PageHeader 组件** - 统一页面头部
3. **创建 SearchSection 组件** - 统一搜索区域
4. **创建 TableSection 组件** - 统一表格区域

### 第二阶段：统一权限检查

```javascript
// composables/usePagePermissions.ts
export const usePagePermissions = (module: string) => {
  const authStore = useAuthStore()

  const hasPermission = (action: string) => {
    return authStore.hasPermission(`${module}:${action}`)
  }

  const canView = () => hasPermission('view')
  const canCreate = () => hasPermission('create')
  const canEdit = () => hasPermission('edit')
  const canDelete = () => hasPermission('delete')
  const canExport = () => hasPermission('export')

  return {
    hasPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport
  }
}
```

### 第三阶段：统一状态管理

```javascript
// composables/usePageState.ts
export const usePageState = () => {
  const permissionLoading = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  const searchKeyword = ref('')

  const pagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0
  })

  const setLoading = (value: boolean) => {
    loading.value = value
  }

  const setError = (message: string) => {
    errorMessage.value = message
  }

  const clearError = () => {
    errorMessage.value = ''
  }

  const resetPagination = () => {
    pagination.page = 1
    pagination.total = 0
  }

  return {
    permissionLoading,
    loading,
    errorMessage,
    searchKeyword,
    pagination,
    setLoading,
    setError,
    clearError,
    resetPagination
  }
}
```

### 第四阶段：页面改造优先级

1. **高优先级页面**（用户使用频繁）：
   - 客户管理 (CustomersView.vue)
   - 库存管理 (InventoryView.vue)
   - 销售管理 (SalesView.vue)

2. **中优先级页面**（管理功能）：
   - 权限管理 (PermissionsView.vue)
   - 菜单管理 (MenuManagementView.vue)
   - 员工管理 (EmployeesView.vue)

3. **低优先级页面**（配置功能）：
   - 供应商管理 (SuppliersView.vue)
   - 品牌管理 (BrandsView.vue)
   - 型号管理 (ModelsView.vue)

## 🔍 验收标准

1. **视觉一致性** - 所有页面具有相同的外观和布局
2. **交互一致性** - 相同操作具有相同的交互方式
3. **代码一致性** - 使用相同的组件和命名规范
4. **权限一致性** - 统一的权限检查方式
5. **响应式设计** - 所有页面在移动端正常显示

## 📚 参考文件

- [Element Plus 组件文档](https://element-plus.org/)
- [Vue 3 组合式 API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [TF2025 分页组件规范](./pagination-standards.md)
- [TF2025 权限系统指南](./permission-system-guide.md)

---

**更新日期**：2025-12-18
**版本**：v1.0.0
**维护者**：TF2025 开发团队