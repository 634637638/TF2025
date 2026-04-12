# TF2025 组件使用决策指南

> **文档说明**：指导在特定场景下选择合适的组件，确保项目组件使用的一致性
>
> **最后更新**：2025-12-20
> **版本**：v1.0.0
> **维护者**：TF2025 开发团队

## 概述

本文档为 TF2025 项目中的组件选择提供明确的指导原则，帮助开发者根据不同的使用场景选择最合适的组件，确保代码的一致性和可维护性。

## 组件选择矩阵

### 1. 弹窗组件选择

| 场景 | 推荐组件 | 理由 | 示例 |
|------|----------|------|------|
| 通用业务弹窗 | **MobileDialog** | 响应式设计、功能完整、自动适配移动端 | [示例](#mobiledialog-示例) |
| 简单确认框 | **ElMessageBox** | Element Plus 内置、快速实现 | [示例](#elmessagebox-示例) |
| 复杂自定义弹窗 | **BaseModal** | 完全自定义控制 | [示例](#basemodal-示例) |
| 表单弹窗 | **MobileDialog + MobileForm** | 移动端优化、响应式布局 | [示例](#表单弹窗-示例) |
| 详情查看弹窗 | **MobileDialog** | 支持拖拽、自动全屏 | [示例](#详情弹窗-示例) |
| 确认删除弹窗 | **ElMessageBox.confirm** | 标准确认流程 | [示例](#确认弹窗-示例) |
| 全屏展示 | **MobileDialog** + `force-fullscreen` | 移动端自动全屏 | [示例](#全屏弹窗-示例) |

### 2. 表格组件选择

| 场景 | 推荐组件 | 理由 | 示例 |
|------|----------|------|------|
| 标准数据表格 | **MobileTable** | 自动响应式、移动端卡片布局 | [示例](#mobiletable-示例) |
| 大数据量表格 | **El-Table-V2** | 虚拟滚动、性能优化 | [示例](#el-table-v2-示例) |
| 简单列表 | **El-Table** | 基础功能足够 | [示例](#el-table-示例) |
| 复杂表头表格 | **El-Table** + 自定义列 | 灵活性高 | [示例](#复杂表格-示例) |
| 树形数据 | **El-Table** + 树形列 | 内置树形功能 | [示例](#树形表格-示例) |

### 3. 表单组件选择

| 场景 | 推荐组件 | 理由 | 示例 |
|------|----------|------|------|
| 标准表单 | **MobileForm** | 响应式布局、移动端优化 | [示例](#mobileform-示例) |
| 复杂表单 | **El-Form** | 完整功能、丰富验证 | [示例](#el-form-示例) |
| 内联表单 | **El-Form** + inline | 紧凑布局 | [示例](#内联表单-示例) |
| 步骤表单 | **El-Steps** + **El-Form** | 清晰的流程 | [示例](#步骤表单-示例) |
| 搜索表单 | **MobileForm** + 折叠 | 移动端友好 | [示例](#搜索表单-示例) |

### 4. 导航组件选择

| 场景 | 推荐组件 | 理由 | 示例 |
|------|----------|------|------|
| 主导航 | **ResponsiveLayout** | 集成导航、响应式 | [示例](#主导航-示例) |
| 顶部导航 | **El-Menu** + horizontal | 标准布局 | [示例](#顶部导航-示例) |
| 侧边导航 | **El-Menu** + vertical | 经典布局 | [示例](#侧边导航-示例) |
| 移动端导航 | **MobileSlideMenu** | 移动端优化 | [示例](#移动端导航-示例) |
| 面包屑导航 | **El-Breadcrumb** | 清晰的层级 | [示例](#面包屑-示例) |
| 标签页导航 | **El-Tabs** | 内容组织 | [示例](#标签页导航-示例) |

## 组件使用原则

### 1. 优先级原则

1. **首选统一组件**：优先使用项目封装的组件（MobileDialog、MobileTable、MobileForm）
2. **其次 Element Plus**：当统一组件不满足需求时，使用 Element Plus 组件
3. **最后自定义**：在特殊场景下，创建自定义组件

### 2. 一致性原则

1. **同类功能统一**：相同功能使用相同组件
2. **样式统一**：使用统一样式变量和类名
3. **交互统一**：保持相同的交互模式

### 3. 可访问性原则

1. **键盘导航**：支持 Tab 键导航
2. **屏幕阅读器**：提供适当的 ARIA 标签
3. **对比度**：满足 WCAG 2.1 AA 标准

## 使用示例

### MobileDialog 示例

```vue
<template>
  <MobileDialog
    v-model="visible"
    title="编辑商品"
    :width="800"
    :force-fullscreen="isMobile"
    :draggable="!isMobile"
    @confirm="handleSave"
    @cancel="handleCancel"
  >
    <!-- 弹窗内容 -->
    <el-form :model="formData" label-width="100px">
      <el-form-item label="商品名称">
        <el-input v-model="formData.name" />
      </el-form-item>
      <el-form-item label="价格">
        <el-input-number v-model="formData.price" />
      </el-form-item>
    </el-form>
  </MobileDialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { MobileDialog } from '@/components'
import { useResponsive } from '@/composables/useResponsive'

const visible = ref(false)
const { isMobile } = useResponsive()

const formData = ref({
  name: '',
  price: 0
})

const handleSave = async () => {
  // 保存逻辑
}

const handleCancel = () => {
  visible.value = false
}
</script>
```

### ElMessageBox 示例

```typescript
// 确认删除
import { ElMessageBox } from 'element-plus'

const handleDelete = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条记录吗？',
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // 执行删除
    await deleteRecord(id)
    ElMessage.success('删除成功')
  } catch {
    // 用户取消
  }
}
```

### MobileTable 示例

```vue
<template>
  <MobileTable
    :data="tableData"
    :columns="columns"
    :loading="loading"
    @action="handleAction"
  >
    <!-- 自定义状态列 -->
    <template #status="{ row }">
      <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
        {{ row.status }}
      </el-tag>
    </template>
  </MobileTable>
</template>

<script setup>
import { ref } from 'vue'
import { MobileTable } from '@/components'

const tableData = ref([])
const loading = ref(false)

const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '名称' },
  { prop: 'status', label: '状态', slot: 'status' },
  { prop: 'created_at', label: '创建时间' }
]

const handleAction = ({ action, row }) => {
  switch (action) {
    case 'edit':
      handleEdit(row)
      break
    case 'delete':
      handleDelete(row)
      break
  }
}
</script>
```

## 迁移指南

### 从 el-dialog 迁移到 MobileDialog

```vue
<!-- 迁移前 -->
<el-dialog
  v-model="dialogVisible"
  title="标题"
  width="600px"
>
  <div>内容</div>
  <template #footer>
    <el-button @click="dialogVisible = false">取消</el-button>
    <el-button type="primary" @click="handleConfirm">确定</el-button>
  </template>
</el-dialog>

<!-- 迁移后 -->
<MobileDialog
  v-model="dialogVisible"
  title="标题"
  width="600"
  @confirm="handleConfirm"
>
  <div>内容</div>
</MobileDialog>
```

### 从 el-table 迁移到 MobileTable

```vue
<!-- 迁移前 -->
<el-table :data="data">
  <el-table-column prop="name" label="名称" />
  <el-table-column prop="status" label="状态">
    <template #default="{ row }">
      <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
        {{ row.status }}
      </el-tag>
    </template>
  </el-table-column>
</el-table>

<!-- 迁移后 -->
<MobileTable
  :data="data"
  :columns="[
    { prop: 'name', label: '名称' },
    { prop: 'status', label: '状态', slot: 'status' }
  ]"
>
  <template #status="{ row }">
    <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
      {{ row.status }}
    </el-tag>
  </template>
</MobileTable>
```

## 最佳实践

### 1. 组件封装

```vue
<!-- ✅ 推荐：封装业务组件 -->
<ProductDialog
  v-model="visible"
  :product-id="selectedId"
  @success="handleSuccess"
/>

<!-- ✅ 推荐：使用插槽保持灵活性 -->
<CustomDialog>
  <template #header>
    <h2>自定义标题</h2>
  </template>

  <template #default>
    <slot name="content" />
  </template>

  <template #footer>
    <slot name="actions" />
  </template>
</CustomDialog>
```

### 2. 属性传递

```vue
<!-- ✅ 推荐：明确的属性 -->
<MobileDialog
  :title="dialogTitle"
  :width="dialogWidth"
  :loading="isLoading"
  :show-footer="true"
>

<!-- ❌ 避免：模糊的属性 -->
<MobileDialog
  :options="dialogOptions"
>
```

### 3. 事件处理

```vue
<!-- ✅ 推荐：语义化的事件 -->
<MobileDialog
  @confirm="handleConfirm"
  @cancel="handleCancel"
  @open="handleOpen"
  @opened="handleOpened"
>

<!-- ✅ 推荐：事件参数明确 -->
<MobileTable
  @action="({ action, row, index }) => {
    // 处理表格行操作
  }"
>
```

## 检查清单

在开发过程中，请确保：

- [ ] 选择了正确的组件类型
- [ ] 使用了统一的 API
- [ ] 响应式设计已实现
- [ ] 可访问性要求已满足
- [ ] 组件文档已更新
- [ ] 代码已通过 lint 检查
- [ ] 跨浏览器兼容性测试
- [ ] 移动端测试完成

## 常见问题

### Q: 什么时候应该使用 MobileDialog 而不是 el-dialog？

A: 当你需要：
- 响应式设计（移动端自动适配）
- 统一的确认/取消按钮
- 内置的加载状态
- 移动端优化（触摸目标、安全区域）

### Q: MobileTable 可以完全替代 el-table 吗？

A: 大部分场景可以，但某些特殊功能可能需要使用 el-table：
- 复杂的表头合并
- 多级表头
- 自定义的拖拽排序

### Q: 如何在 MobileDialog 中使用复杂的表单？

A: 可以使用 MobileForm 组件，或者在 MobileDialog 内部使用 el-form：

```vue
<MobileDialog v-model="visible" title="复杂表单">
  <el-form :model="formData" :rules="rules">
    <!-- 复杂的表单结构 -->
  </el-form>
</MobileDialog>
```

---

**注意**：本指南会随着项目发展持续更新，如有疑问请联系技术负责人。