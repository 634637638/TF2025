# TF2025 页面结构规范

## 📋 概述

TF2025 项目采用统一的页面结构和组织模式，确保所有页面的一致性、可维护性和用户体验。本规范定义了页面的基本结构、组件组织、路由设计原则和页面生命周期管理的最佳实践。

## 🎯 设计原则

1. **一致性**：所有页面采用相同的布局和交互模式
2. **可维护性**：清晰的目录结构和组件职责分离
3. **可扩展性**：灵活的组件设计，支持功能扩展
4. **用户体验**：流畅的导航和操作流程
5. **响应式设计**：适配不同设备和屏幕尺寸

## 🏗️ 页面架构设计

### 目录结构

```
src/views/
├── dashboard/              # 仪表盘模块
│   ├── DashboardView.vue   # 主页面
│   ├── components/         # 页面专用组件
│   │   ├── StatCard.vue
│   │   └── RecentActivity.vue
│   └── hooks/             # 页面专用 hooks
│       └── useDashboardData.ts
├── users/                 # 用户管理模块
│   ├── UserListView.vue   # 列表页
│   ├── UserDetailView.vue # 详情页
│   ├── UserForm.vue       # 表单页
│   ├── components/        # 用户模块组件
│   │   ├── UserTable.vue
│   │   └── UserForm.vue
│   └── hooks/            # 用户模块 hooks
│       ├── useUserList.ts
│       └── useUserForm.ts
├── orders/               # 订单管理模块
├── inventory/            # 库存管理模块
├── shared/               # 共享页面组件
│   ├── Layout/
│   │   ├── AppLayout.vue
│   │   ├── AuthLayout.vue
│   │   └── ErrorLayout.vue
│   ├── Error/
│   │   ├── NotFound.vue
│   │   └── ServerError.vue
│   └── Loading/
│       └── PageLoading.vue
└── test/                 # 测试页面
    ├── NotificationTest.vue
    └── ComponentTest.vue
```

## 📄 页面基础结构

### 1. 标准页面模板

```vue
<template>
  <div class="page-container">
    <!-- 页面头部 -->
    <div v-if="showHeader" class="page-header">
      <div class="page-header__content">
        <div class="page-header__left">
          <!-- 面包屑导航 -->
          <el-breadcrumb v-if="breadcrumbs?.length" class="page-breadcrumb">
            <el-breadcrumb-item
              v-for="item in breadcrumbs"
              :key="item.path"
              :to="item.path"
            >
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>

          <!-- 页面标题 -->
          <h1 class="page-title">
            {{ title }}
            <span v-if="subtitle" class="page-subtitle">{{ subtitle }}</span>
          </h1>

          <!-- 页面描述 -->
          <p v-if="description" class="page-description">
            {{ description }}
          </p>
        </div>

        <div class="page-header__right">
          <!-- 页面级操作按钮 -->
          <slot name="header-actions">
            <el-space>
              <el-button v-if="showBack" @click="handleBack">
                返回
              </el-button>
              <el-button
                v-if="showRefresh"
                :icon="Refresh"
                :loading="loading"
                @click="handleRefresh"
              >
                刷新
              </el-button>
            </el-space>
          </slot>
        </div>
      </div>
    </div>

    <!-- 页面主体 -->
    <div class="page-body" :class="{ 'page-body--full': fullBody }">
      <!-- 工具栏 -->
      <div v-if="showToolbar" class="page-toolbar">
        <div class="page-toolbar__left">
          <slot name="toolbar-left" />
        </div>
        <div class="page-toolbar__right">
          <slot name="toolbar-right" />
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="page-content">
        <!-- 加载状态 -->
        <div v-if="loading" class="page-loading">
          <el-skeleton :rows="5" animated />
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="page-error">
          <el-result
            icon="error"
            title="加载失败"
            :sub-title="error.message"
          >
            <template #extra>
              <el-button type="primary" @click="handleRefresh">
                重试
              </el-button>
            </template>
          </el-result>
        </div>

        <!-- 正常内容 -->
        <div v-else class="page-main">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'

interface BreadcrumbItem {
  title: string
  path?: string
}

interface Props {
  // 页面信息
  title?: string
  subtitle?: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]

  // 显示控制
  showHeader?: boolean
  showToolbar?: boolean
  showBack?: boolean
  showRefresh?: boolean
  fullBody?: boolean

  // 状态
  loading?: boolean
  error?: Error | null
}

const props = withDefaults(defineProps<Props>(), {
  showHeader: true,
  showToolbar: false,
  showBack: false,
  showRefresh: true,
  fullBody: false,
  loading: false,
  error: null
})

interface Emits {
  refresh: []
  back: []
}

const emit = defineEmits<Emits>()

const router = useRouter()

// 页面标题自动更新
const pageTitle = computed(() => {
  const parts = []
  if (props.title) parts.push(props.title)
  parts.push('TF2025')
  return parts.join(' - ')
})

// 事件处理
const handleRefresh = () => {
  emit('refresh')
}

const handleBack = () => {
  emit('back')
  if (router.options.history.state.back) {
    router.back()
  } else {
    router.push('/')
  }
}

// 页面标题更新
onMounted(() => {
  if (props.title) {
    document.title = pageTitle.value
  }
})

onUnmounted(() => {
  // 恢复默认标题
  if (props.title) {
    document.title = 'TF2025'
  }
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

.page-breadcrumb {
  margin-bottom: 8px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 4px 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.page-subtitle {
  font-size: 14px;
  font-weight: normal;
  color: var(--el-text-color-regular);
}

.page-description {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin: 0;
  line-height: 1.5;
}

.page-body {
  flex: 1;
  padding: 24px;
  overflow: auto;

  &--full {
    padding: 0;
  }
}

.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--el-bg-color);
  border-radius: 4px;
}

.page-content {
  background: var(--el-bg-color);
  border-radius: 8px;
  min-height: 400px;
}

.page-loading {
  padding: 24px;
}

.page-error {
  padding: 40px 24px;
}

.page-main {
  padding: 24px;
}
</style>
```

### 2. 列表页面结构

```vue
<!-- views/users/UserListView.vue -->
<template>
  <PageContainer
    title="用户管理"
    description="管理系统中的所有用户账户信息"
    :loading="loading"
    :error="error"
    @refresh="loadData"
  >
    <!-- 工具栏 -->
    <template #toolbar-left>
      <el-button type="primary" :icon="Plus" @click="handleCreate">
        新建用户
      </el-button>
      <el-button
        :disabled="!selectedUsers.length"
        @click="handleBatchDelete"
      >
        批量删除 ({{ selectedUsers.length }})
      </el-button>
    </template>

    <template #toolbar-right>
      <el-space>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索用户..."
          clearable
          @keyup.enter="handleSearch"
          @clear="handleSearchClear"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-dropdown @command="handleExport">
          <el-button :icon="Download">
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
              <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-space>
    </template>

    <!-- 表格内容 -->
    <PaginatedTable
      :data="data"
      :columns="columns"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      @selection-change="handleSelectionChange"
      @sort-change="handleSort"
      @pagination-change="handlePaginationChange"
    >
      <!-- 用户信息列 -->
      <template #column-user="{ row }">
        <div class="user-info">
          <el-avatar :src="row.avatar" :size="32">
            {{ row.name.charAt(0) }}
          </el-avatar>
          <div class="user-info__text">
            <div class="user-info__name">{{ row.name }}</div>
            <div class="user-info__email">{{ row.email }}</div>
          </div>
        </div>
      </template>

      <!-- 角色列 -->
      <template #column-role="{ row }">
        <el-tag :type="getRoleTagType(row.role)">
          {{ getRoleLabel(row.role) }}
        </el-tag>
      </template>

      <!-- 状态列 -->
      <template #column-status="{ row }">
        <el-switch
          v-model="row.status"
          :active-value="'active'"
          :inactive-value="'inactive'"
          @change="handleStatusChange(row)"
        />
      </template>

      <!-- 操作列 -->
      <template #column-actions="{ row }">
        <el-space>
          <el-button size="small" @click="handleView(row)">
            查看
          </el-button>
          <el-button size="small" @click="handleEdit(row)">
            编辑
          </el-button>
          <el-button
            size="small"
            type="danger"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </el-space>
      </template>
    </PaginatedTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Plus,
  Search,
  Download,
  ArrowDown
} from '@element-plus/icons-vue'
import { PageContainer } from '@/components/Page'
import { PaginatedTable } from '@/components/PaginatedTable'
import { useUserList } from '@/views/users/hooks/useUserList'
import { useNotification } from '@/composables/useNotification'
import type { User } from '@/types/entities/user'

const router = useRouter()
const { success, error, confirm } = useNotification()

// 使用用户列表 hook
const {
  loading,
  error,
  data,
  pagination,
  searchKeyword,
  selectedUsers,
  columns,
  loadData,
  handleSearch,
  handleSearchClear,
  handleSelectionChange,
  handleSort,
  handlePaginationChange
} = useUserList()

// 事件处理
const handleCreate = () => {
  router.push('/users/create')
}

const handleView = (user: User) => {
  router.push(`/users/${user.id}`)
}

const handleEdit = (user: User) => {
  router.push(`/users/${user.id}/edit`)
}

const handleDelete = async (user: User) => {
  const confirmed = await confirm(`确定删除用户 "${user.name}" 吗？`)
  if (!confirmed) return

  try {
    // 调用删除 API
    await deleteUser(user.id)
    success('删除成功')
    loadData()
  } catch (err) {
    error('删除失败')
  }
}

const handleBatchDelete = async () => {
  const confirmed = await confirm(
    `确定删除选中的 ${selectedUsers.value.length} 个用户吗？`
  )
  if (!confirmed) return

  try {
    const ids = selectedUsers.value.map(user => user.id)
    await batchDeleteUsers(ids)
    success('批量删除成功')
    loadData()
  } catch (err) {
    error('批量删除失败')
  }
}

const handleStatusChange = async (user: User) => {
  try {
    await updateUserStatus(user.id, user.status)
    success('状态更新成功')
  } catch (err) {
    error('状态更新失败')
    // 恢复原状态
    user.status = user.status === 'active' ? 'inactive' : 'active'
  }
}

const handleExport = async (format: string) => {
  try {
    const response = await exportUsers({
      format,
      filters: { keyword: searchKeyword.value }
    })

    // 下载文件
    downloadFile(response.data, `users.${format}`)
    success('导出成功')
  } catch (err) {
    error('导出失败')
  }
}

// 生命周期
onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;

  &__text {
    flex: 1;
  }

  &__name {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  &__email {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }
}
</style>
```

### 3. 表单页面结构

```vue
<!-- views/users/UserForm.vue -->
<template>
  <PageContainer
    :title="pageTitle"
    :show-back="true"
    :loading="loading"
    @back="handleBack"
  >
    <el-card class="form-card">
      <!-- 表单步骤 -->
      <el-steps :active="currentStep" align-center class="form-steps">
        <el-step title="基本信息" />
        <el-step title="角色权限" />
        <el-step title="完成" />
      </el-steps>

      <!-- 表单内容 -->
      <div class="form-content">
        <!-- 基本信息步骤 -->
        <div v-show="currentStep === 0" class="form-step">
          <h3>基本信息</h3>
          <el-form
            ref="basicFormRef"
            :model="formData.basic"
            :rules="basicRules"
            label-width="120px"
          >
            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="用户名" prop="username">
                  <el-input
                    v-model="formData.basic.username"
                    placeholder="请输入用户名"
                    :disabled="isEdit"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="姓名" prop="name">
                  <el-input
                    v-model="formData.basic.name"
                    placeholder="请输入姓名"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="24">
              <el-col :span="12">
                <el-form-item label="邮箱" prop="email">
                  <el-input
                    v-model="formData.basic.email"
                    type="email"
                    placeholder="请输入邮箱"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="手机号" prop="phone">
                  <el-input
                    v-model="formData.basic.phone"
                    placeholder="请输入手机号"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item v-if="!isEdit" label="密码" prop="password">
              <el-input
                v-model="formData.basic.password"
                type="password"
                placeholder="请输入密码"
                show-password
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- 角色权限步骤 -->
        <div v-show="currentStep === 1" class="form-step">
          <h3>角色权限</h3>
          <el-form
            ref="roleFormRef"
            :model="formData.role"
            :rules="roleRules"
            label-width="120px"
          >
            <el-form-item label="用户角色" prop="roleId">
              <el-select
                v-model="formData.role.roleId"
                placeholder="请选择角色"
                style="width: 100%"
              >
                <el-option
                  v-for="role in roleList"
                  :key="role.id"
                  :label="role.name"
                  :value="role.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="所属部门" prop="department">
              <el-cascader
                v-model="formData.role.department"
                :options="departmentOptions"
                placeholder="请选择部门"
                style="width: 100%"
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- 完成步骤 -->
        <div v-show="currentStep === 2" class="form-step">
          <el-result
            icon="success"
            title="信息已保存"
            :sub-title="successMessage"
          >
            <template #extra>
              <el-space>
                <el-button @click="handleBack">返回列表</el-button>
                <el-button type="primary" @click="handleCreateAnother">
                  继续创建
                </el-button>
              </el-space>
            </template>
          </el-result>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div v-if="currentStep < 2" class="form-actions">
        <el-space>
          <el-button @click="handlePrev" :disabled="currentStep === 0">
            上一步
          </el-button>
          <el-button
            v-if="currentStep < 1"
            type="primary"
            @click="handleNext"
          >
            下一步
          </el-button>
          <el-button
            v-else
            type="primary"
            :loading="submitting"
            @click="handleSubmit"
          >
            {{ isEdit ? '保存' : '创建' }}
          </el-button>
          <el-button @click="handleBack">取消</el-button>
        </el-space>
      </div>
    </el-card>
  </PageContainer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PageContainer } from '@/components/Page'
import { useUserForm } from '@/views/users/hooks/useUserForm'
import { useNotification } from '@/composables/useNotification'

const route = useRoute()
const router = useRouter()
const { success } = useNotification()

// 判断编辑模式
const isEdit = computed(() => !!route.params.id)

// 使用表单 hook
const {
  loading,
  submitting,
  formData,
  currentStep,
  basicFormRef,
  roleFormRef,
  basicRules,
  roleRules,
  roleList,
  departmentOptions,
  pageTitle,
  successMessage,
  loadData,
  handleNext,
  handlePrev,
  handleSubmit,
  reset
} = useUserForm(isEdit.value)

// 事件处理
const handleBack = () => {
  router.push('/users')
}

const handleCreateAnother = () => {
  // 重置表单并回到第一步
  reset()
  currentStep.value = 0
}

// 生命周期
onMounted(() => {
  if (isEdit.value) {
    loadData(route.params.id as string)
  }
})
</script>

<style lang="scss" scoped>
.form-card {
  max-width: 800px;
  margin: 0 auto;
}

.form-steps {
  margin-bottom: 40px;
}

.form-content {
  min-height: 400px;
}

.form-step {
  h3 {
    margin-bottom: 24px;
    font-size: 18px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
}

.form-actions {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--el-border-color-light);
  text-align: center;
}
</style>
```

## 🛣️ 路由设计原则

### 1. 路由结构

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  // 根路径重定向
  {
    path: '/',
    redirect: '/dashboard'
  },

  // 应用主体
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      // 仪表盘
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: {
          title: '仪表盘',
          icon: 'Dashboard',
          requiresAuth: true
        }
      },

      // 用户管理
      {
        path: 'users',
        name: 'Users',
        meta: {
          title: '用户管理',
          icon: 'User',
          requiresAuth: true,
          permissions: ['users_usersview:view']
        }
      },
      {
        path: 'users/create',
        name: 'UserCreate',
        component: () => import('@/views/users/UserForm.vue'),
        meta: {
          title: '新建用户',
          requiresAuth: true,
          permissions: ['users_usersview:create']
        }
      },
      {
        path: 'users/:id',
        name: 'UserDetail',
        component: () => import('@/views/users/UserDetailView.vue'),
        meta: {
          title: '用户详情',
          requiresAuth: true,
          permissions: ['users_usersview:view']
        }
      },
      {
        path: 'users/:id/edit',
        name: 'UserEdit',
        component: () => import('@/views/users/UserForm.vue'),
        meta: {
          title: '编辑用户',
          requiresAuth: true,
          permissions: ['users_usersview:edit']
        }
      },

      // 其他模块...
    ]
  },

  // 认证相关
  {
    path: '/auth',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: 'login',
        name: 'Login',
        component: () => import('@/views/auth/LoginView.vue'),
        meta: {
          title: '登录',
          requiresGuest: true
        }
      },
      {
        path: 'register',
        name: 'Register',
        component: () => import('@/views/auth/RegisterView.vue'),
        meta: {
          title: '注册',
          requiresGuest: true
        }
      }
    ]
  },

  // 错误页面
  {
    path: '/error',
    component: () => import('@/layouts/ErrorLayout.vue'),
    children: [
      {
        path: '404',
        name: 'NotFound',
        component: () => import('@/views/shared/Error/NotFound.vue'),
        meta: {
          title: '页面未找到'
        }
      },
      {
        path: '500',
        name: 'ServerError',
        component: () => import('@/views/shared/Error/ServerError.vue'),
        meta: {
          title: '服务器错误'
        }
      }
    ]
  },

  // 404 页面
  {
    path: '/:pathMatch(.*)*',
    redirect: '/error/404'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})
```

### 2. 路由守卫

```typescript
// router/guards.ts
import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'

export function setupRouterGuards(router: Router) {
  // 全局前置守卫
  router.beforeEach(async (to, from, next) => {
    // 设置页面标题
    if (to.meta.title) {
      document.title = `${to.meta.title} - TF2025`
    }

    const authStore = useAuthStore()
    const permissionStore = usePermissionStore()

    // 检查认证状态
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      next({
        name: 'Login',
        query: { redirect: to.fullPath }
      })
      return
    }

    // 检查访客页面
    if (to.meta.requiresGuest && authStore.isAuthenticated) {
      next({ name: 'Dashboard' })
      return
    }

    // 检查权限
    if (to.meta.permissions) {
      const hasPermission = permissionStore.hasAnyPermission(
        to.meta.permissions as string[]
      )

      if (!hasPermission) {
        next({ name: 'Forbidden' })
        return
      }
    }

    // 加载用户信息（如果需要）
    if (authStore.isAuthenticated && !authStore.user) {
      try {
        await authStore.loadUserInfo()
      } catch (error) {
        console.error('加载用户信息失败:', error)
        next({ name: 'Login' })
        return
      }
    }

    next()
  })

  // 全局后置守卫
  router.afterEach((to, from) => {
    // 页面访问统计
    if (import.meta.env.PROD) {
      // analytics.trackPageView(to.path, to.meta.title as string)
    }

    // 清理某些状态
    // store.clearTemporaryState()
  })

  // 全局错误处理
  router.onError((error) => {
    console.error('路由错误:', error)

    if (error.name === 'ChunkLoadError') {
      // 代码块加载失败，提示刷新
      ElMessage.warning('资源加载失败，正在刷新页面...')
      window.location.reload()
    }
  })
}
```

## 🎨 布局组件

### 1. 应用主布局

```vue
<!-- layouts/AppLayout.vue -->
<template>
  <div class="app-layout">
    <!-- 侧边栏 -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      @toggle="handleSidebarToggle"
    />

    <!-- 主内容区 -->
    <div class="app-main" :class="{ 'app-main--collapsed': sidebarCollapsed }">
      <!-- 顶部导航 -->
      <AppHeader
        :sidebar-collapsed="sidebarCollapsed"
        @sidebar-toggle="handleSidebarToggle"
      />

      <!-- 面包屑导航 -->
      <AppBreadcrumb class="app-breadcrumb" />

      <!-- 页面内容 -->
      <div class="app-content">
        <router-view v-slot="{ Component, route }">
          <transition name="fade-transform" mode="out-in">
            <keep-alive :include="cachedViews">
              <component :is="Component" :key="route.path" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </div>

    <!-- 移动端遮罩 -->
    <div
      v-if="isMobile && !sidebarCollapsed"
      class="app-overlay"
      @click="handleSidebarToggle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import AppHeader from './components/AppHeader.vue'
import AppBreadcrumb from './components/AppBreadcrumb.vue'

const appStore = useAppStore()
const route = useRoute()

// 响应式数据
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const isMobile = computed(() => appStore.isMobile)
const cachedViews = computed(() => appStore.cachedViews)

// 事件处理
const handleSidebarToggle = () => {
  appStore.toggleSidebar()
}

// 响应式处理
const handleResize = () => {
  appStore.setWindowWidth(window.innerWidth)
}

// 生命周期
onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 240px;
  transition: margin-left 0.3s ease;

  &--collapsed {
    margin-left: 64px;
  }
}

.app-breadcrumb {
  padding: 16px 24px 0;
}

.app-content {
  flex: 1;
  padding: 0 24px 24px;
  overflow: auto;
}

.app-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 999;
}

// 路由过渡动画
.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s ease;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

// 响应式
@media (max-width: 768px) {
  .app-main {
    margin-left: 0;
  }

  .app-content {
    padding: 0 16px 16px;
  }
}
</style>
```

## 📝 页面生命周期管理

### 1. 页面数据管理 Hook

```typescript
// hooks/usePageData.ts
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface UsePageDataOptions<T> {
  // 数据加载函数
  fetcher: () => Promise<T>
  // 是否立即加载
  immediate?: boolean
  // 页面离开时是否重置数据
  resetOnLeave?: boolean
  // 轮询间隔（毫秒）
  pollInterval?: number
}

export function usePageData<T = any>(
  options: UsePageDataOptions<T>
) {
  const {
    fetcher,
    immediate = true,
    resetOnLeave = false,
    pollInterval
  } = options

  const route = useRoute()
  const router = useRouter()

  // 状态
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // 轮询定时器
  let pollTimer: NodeJS.Timeout | null = null

  // 加载数据
  const loadData = async () => {
    if (loading.value) return

    try {
      loading.value = true
      error.value = null

      const result = await fetcher()
      data.value = result
    } catch (err) {
      error.value = err as Error
      console.error('页面数据加载失败:', err)
    } finally {
      loading.value = false
    }
  }

  // 重新加载数据
  const reload = () => {
    return loadData()
  }

  // 重置数据
  const reset = () => {
    data.value = null
    error.value = null
    loading.value = false
  }

  // 开始轮询
  const startPolling = () => {
    if (!pollInterval) return

    pollTimer = setInterval(() => {
      if (!loading.value) {
        loadData()
      }
    }, pollInterval)
  }

  // 停止轮询
  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  // 生命周期
  onMounted(() => {
    if (immediate) {
      loadData()
    }
    startPolling()
  })

  onUnmounted(() => {
    stopPolling()
    if (resetOnLeave) {
      reset()
    }
  })

  // 监听路由参数变化
  watch(
    () => route.params,
    () => {
      loadData()
    },
    { deep: true }
  )

  return {
    data,
    loading,
    error,
    reload,
    reset,
    loadData,
    startPolling,
    stopPolling
  }
}
```

### 2. 页面状态管理

```typescript
// stores/page.ts
import { defineStore } from 'pinia'

interface PageState {
  // 当前页面信息
  currentPage: {
    name: string
    title: string
    path: string
  }
  // 缓存页面
  cachedViews: string[]
  // 页面加载状态
  loading: boolean
  // 页面错误信息
  error: Error | null
}

export const usePageStore = defineStore('page', {
  state: (): PageState => ({
    currentPage: {
      name: '',
      title: '',
      path: ''
    },
    cachedViews: [],
    loading: false,
    error: null
  }),

  actions: {
    // 设置当前页面
    setCurrentPage(page: Partial<PageState['currentPage']>) {
      this.currentPage = { ...this.currentPage, ...page }
    },

    // 添加缓存页面
    addCachedView(viewName: string) {
      if (!this.cachedViews.includes(viewName)) {
        this.cachedViews.push(viewName)
      }
    },

    // 移除缓存页面
    removeCachedView(viewName: string) {
      const index = this.cachedViews.indexOf(viewName)
      if (index > -1) {
        this.cachedViews.splice(index, 1)
      }
    },

    // 清空缓存页面
    clearCachedViews() {
      this.cachedViews = []
    },

    // 设置加载状态
    setLoading(loading: boolean) {
      this.loading = loading
    },

    // 设置错误信息
    setError(error: Error | null) {
      this.error = error
    }
  }
})
```

## 📋 最佳实践

### 1. 页面设计原则

- **单一职责**：每个页面只负责一个主要功能
- **渐进式 disclosure**：复杂操作分步骤引导
- **一致性**：相同的操作使用相同的交互模式
- **反馈及时**：操作后立即给予反馈
- **容错性**：提供错误恢复机制

### 2. 性能优化

- **懒加载**：路由和组件按需加载
- **缓存策略**：合理使用页面缓存
- **资源优化**：图片、字体等资源优化
- **代码分割**：按模块分割代码

### 3. 可访问性

- **键盘导航**：支持 Tab 键导航
- **屏幕阅读器**：提供 ARIA 标签
- **颜色对比**：确保足够的颜色对比度
- **焦点管理**：明确的焦点指示

## 🔍 故障排除

### 常见问题

1. **页面白屏**
   - 检查路由配置
   - 确认组件导入路径
   - 查看控制台错误

2. **页面切换卡顿**
   - 检查数据加载逻辑
   - 优化组件渲染性能
   - 使用 keep-alive 缓存

3. **布局错乱**
   - 检查 CSS 样式冲突
   - 确认响应式断点
   - 验证 HTML 结构

### 调试技巧

```typescript
// 开发环境开启页面调试
if (import.meta.env.DEV) {
  window.__TF2025_PAGE_DEBUG__ = {
    showRouteInfo: true,
    showPerformance: true,
    logPageChanges: true
  }
}
```

## 📚 参考资料

- [Vue Router 官方文档](https://router.vuejs.org/)
- [Vue 3 组合式 API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [前端页面性能优化](https://web.dev/performance/)

---

**更新日期**：2025-01-15
**版本**：v1.0.0
**维护者**：TF2025 开发团队