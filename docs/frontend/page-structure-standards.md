# TF2025 页面结构规范

本文是后台页面结构的唯一正文，适用于新增页面及既有页面改造。原 [统一页面结构](unified-page-structure.md) 只保留迁移导航，不能作为第二套模板。

## 修改前与目录职责

先按 [前端索引](INDEX.md) 和 [规范清单](standards-manifest.json) 阅读本次涉及的专项正文，再查看邻近业务页面和公共实现。

- 页面放在 `frontend/src/views/<业务>/`，保留布局与流程编排；私有列表、表单和弹窗放在现有业务子目录，复用逻辑进入公共或领域 Composable。
- 共享业务类型和契约从既有类型入口引用，组件独有 Props/Emits 可就近定义，详见 [TypeScript 规范](../guides/typescript-standards.md)。
- 不为一次页面改造建立第二套请求、权限、通知、Loading、时间、表单或缓存。
- 权限、路由、菜单、字段、后端接口和页面台账一起核对，更新 [页面台账](page-audit-inventory.md)。

## 页面壳与控件

后台页面采用 `admin-page`、`admin-page-content` 等公共布局，复用 `PageHeader`。按 [组件采用规范](component-adoption-standard.md) 选择搜索、表格和弹窗；不得复制私有页头或通用控件。

- 标题与操作使用 `PageHeader` 的 `actions` 插槽；由公共组件维护垂直居中、触摸区域和操作区横向滑动。
- 手机端操作保持单行，空间不足时仅操作容器横向滑动。不得压缩按钮文字、截断末尾按钮或造成整个页面横向滚动。
- 不覆盖公共 `.header-actions` 的溢出、触摸滑动或按钮收缩规则；验收初始和最右侧位置。
- 颜色、间距、字号、圆角和断点按 [视觉令牌](design-token-standard.md)、[排版](typography-standards.md) 和 [响应式断点](responsive-breakpoint-standard.md) 使用，不复制硬编码几何值。
- 表单、对话框、按钮、空状态分别遵循 [表单控件](form-control-standards.md)、[对话框](dialog-standards.md)、[按钮](button-standards.md) 和 [空状态](empty-state-standard.md)。

## 权限与路由

页面使用 `usePagePermissions` 和 `PermissionGate`；动作使用全局 `v-permission` 或公共能力结果，不根据角色名推测权限。指令接收真实权限标识或表达式，不把未插值的模板占位符当权限字符串。

字段权限使用已登记页面键和字段键，核对桌面、手机、导出、统计及编辑入口。操作列可见性与动作能力合并的规则见 [字段权限指南](field-permission-guide.md)，不能只看隐藏字段而误删已授权操作。

路由复用 `frontend/src/router/` 中的懒加载、元信息和统一守卫，不在页面复制登录校验。前端显示控制不能替代后端认证、动作权限和数据范围校验。

## 数据、生命周期与反馈

- API 和响应处理遵循 [API 规范](../guides/api-standards.md)，基础下拉选项使用既有 `reference-options` 等服务。
- 首次页面请求由统一 API/路由的全局 Loading 负责，遵循统一延迟；首次表格不得叠加局部遮罩。已有数据刷新时保留内容，由 `v-tf-loading` 锁定表格区域。
- 顶部刷新使用独立 `refreshing` 和 `useRefreshData`，统一提示“数据刷新成功”或“刷新失败，请重试”；失败只由一层提示。完整分工见 [Loading 规范](global-loading-standard.md)。
- 搜索、筛选、分页使用 [最新请求处理](latest-request-standard.md)，卸载时取消请求；共享缓存请求是否支持取消应以服务签名为准，不能假传 `signal`。
- 被刷新函数必须在失败时抛出，不能捕获后当成功返回，导致公共刷新误报成功。
- 写入成功后按 [CRUD](crud-standards.md) 和 [数据实时性](data-freshness-standard.md) 失效相关缓存并更新列表、统计和选项；不得清空无关模块缓存。
- 清理定时器、事件监听、订阅和观察器；权限撤销后不继续展示旧敏感数据。业务日期沿用 [时间规范](time-standards.md)。

## 最小只读页面示例

以下示例参加类型编译，演示已有品牌选项服务、页面壳和字段权限。它不是完整 CRUD 页，不包含搜索或分页；新增这些交互时须接入最新请求及对应专项规范。组件沿用全局注册，不在页面重复导入全局组件。

```vue check
<template>
  <div class="admin-page">
    <PermissionGate :can-view="canView" module-name="品牌管理" module-key="brands" permission-code="brands:view">
      <PageHeader title="品牌管理" icon="fas fa-tags">
        <template #actions>
          <el-button type="info" :loading="refreshing" :disabled="refreshing || loading" @click="handleRefresh">
            {{ refreshing ? '刷新中...' : '刷新' }}
          </el-button>
        </template>
      </PageHeader>
      <div class="admin-page-content">
        <el-table v-tf-loading="loading" :data="rows">
          <el-table-column v-if="nameVisible" prop="name" label="品牌名称" />
          <template #empty>
            <DataEmptyState v-if="!loading" description="暂无品牌" />
          </template>
        </el-table>
      </div>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useLoadingState } from '@/composables'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { getCachedBrands } from '@/services/reference-options'
import type { ReferenceRecord } from '@/services/reference-options'
import { logger } from '@/utils/logger'

const { canView } = usePagePermissions('brands')
const { loading, wrap } = useLoadingState(true)
const { refreshing, refreshData } = useRefreshData()
const rows = ref<ReferenceRecord[]>([])
const nameVisible = computed(() => fieldPermissions.isFieldVisible('brands_brandsview', 'brand.name'))
let active = true

onBeforeUnmount(() => { active = false })

async function loadBrands(): Promise<void> {
  if (!canView.value) return
  await wrap(async () => {
    const response = await getCachedBrands()
    if (!active || !canView.value) return
    rows.value = response.data ?? []
  })
}

async function handleRefresh(): Promise<void> {
  if (refreshing.value || loading.value) return
  await refreshData(loadBrands, {
    cacheScope: '/brands',
    successMessage: '数据刷新成功',
    errorMessage: '刷新失败，请重试',
    // 此服务请求的失败由统一 API 提示，避免重复通知。
    showError: false
  })
}

watch(canView, allowed => {
  if (allowed) void loadBrands().catch(error => logger.warn('加载品牌失败', error))
  else {
    rows.value = []
    loading.value = false
  }
}, { immediate: true })
</script>
```

## 性能、可访问性与验收

按测量结果决定懒加载、虚拟滚动、请求合并和缓存，不要求每个页面机械增加性能封装。保留键盘操作、表单标签、焦点恢复、禁用态和必要的可访问名称；不能只依赖颜色表达错误。

执行类型检查、定向 ESLint，以及清单中适用的 UI、表格、按钮、权限、Loading、令牌和响应式审计。浏览器验收按 [视觉回归清单](visual-regression-checklist.md) 检查桌面和手机、权限不足、空数据、失败重试、刷新保留数据及弹窗溢出；静态通过不能代替这些验收。
