# 综合查询模态框组件使用指南

## 概述

本文档介绍了综合查询页面使用的三个模态框组件，这些组件基于 `MobileDialog` 封装，提供了统一的UI风格和响应式体验。

## 组件列表

### 1. QueryEditModal - 编辑模态框

用于编辑设备的基本信息、供应商、店铺、价格等。

**文件位置：** `frontend/src/components/query/QueryEditModal.vue`

#### 使用示例

```vue
<template>
  <div>
    <el-button @click="openEditModal">编辑设备</el-button>

    <QueryEditModal
      v-model="showEditModal"
      :edit-item="currentEditItem"
      @success="handleEditSuccess"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import QueryEditModal from '@/components/query/QueryEditModal.vue'

const showEditModal = ref(false)
const currentEditItem = ref(null)

const openEditModal = (item) => {
  currentEditItem.value = item
  showEditModal.value = true
}

const handleEditSuccess = () => {
  // 重新加载数据
  loadData()
}
</script>
```

#### Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | Boolean | false | 控制模态框显示/隐藏 |
| editItem | Object | null | 要编辑的设备信息对象 |

#### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| update:modelValue | v-model更新 | value: boolean |
| success | 编辑成功时触发 | - |

---

### 2. QuickSaleModal - 快速出库模态框

用于快速创建销售出库记录，跳过入库流程。

**文件位置：** `frontend/src/components/query/QuickSaleModal.vue`

#### 使用示例

```vue
<template>
  <div>
    <el-button
      type="warning"
      @click="showQuickSaleModal = true"
    >
      <i class="fas fa-bolt"></i>
      快速出库
    </el-button>

    <QuickSaleModal
      v-model="showQuickSaleModal"
      @success="handleQuickSaleSuccess"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import QuickSaleModal from '@/components/query/QuickSaleModal.vue'

const showQuickSaleModal = ref(false)

const handleQuickSaleSuccess = () => {
  // 重新加载数据
  loadData()
  ElMessage.success('快速出库成功')
}
</script>
```

#### Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | Boolean | false | 控制模态框显示/隐藏 |

#### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| update:modelValue | v-model更新 | value: boolean |
| success | 快速出库成功时触发 | - |

#### 功能特点

- ✅ 自动计算利润和利润率
- ✅ 支持扫码识别IMEI和序列号（预留接口）
- ✅ 完整的表单验证
- ✅ 自动设置当前用户为销售员
- ✅ 响应式设计，移动端友好

---

### 3. ReturnStockModal - 退库模态框

用于将已售设备退回库存。

**文件位置：** `frontend/src/components/query/ReturnStockModal.vue`

#### 使用示例

```vue
<template>
  <div>
    <el-button
      type="secondary"
      @click="openReturnModal(item)"
    >
      <i class="fas fa-undo-alt"></i>
      退库
    </el-button>

    <ReturnStockModal
      v-model="showReturnModal"
      :device-info="currentReturnDevice"
      @success="handleReturnSuccess"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ReturnStockModal from '@/components/query/ReturnStockModal.vue'

const showReturnModal = ref(false)
const currentReturnDevice = ref(null)

const openReturnModal = (item) => {
  currentReturnDevice.value = item.基本信息
  showReturnModal.value = true
}

const handleReturnSuccess = () => {
  // 重新加载数据
  loadData()
  ElMessage.success('退库成功')
}
</script>
```

#### Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | Boolean | false | 控制模态框显示/隐藏 |
| deviceInfo | Object | null | 要退库的设备信息对象 |

#### Events

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| update:modelValue | v-model更新 | value: boolean |
| success | 退库成功时触发 | - |

---

## 集成到 QueryView.vue

在综合查询页面中使用这些组件：

```vue
<template>
  <div class="query-view">
    <!-- 页面头部按钮 -->
    <button
      @click="showQuickSaleModal = true"
      class="btn btn-warning"
      v-permission="'inventory_inventoryview:create'"
    >
      <i class="fas fa-bolt"></i>
      快速出库
    </button>

    <!-- 表格操作列 -->
    <td class="actions-cell">
      <button
        @click="openEditModal(item)"
        v-permission="'query_queryview:edit'"
      >
        <i class="fas fa-edit"></i>
        编辑
      </button>
      <button
        @click="openReturnModal(item)"
        v-permission="'query_queryview:create'"
      >
        <i class="fas fa-undo-alt"></i>
        退库
      </button>
    </td>

    <!-- 模态框组件 -->
    <QueryEditModal
      v-model="showEditModal"
      :edit-item="currentEditItem"
      @success="loadData"
    />

    <QuickSaleModal
      v-model="showQuickSaleModal"
      @success="loadData"
    />

    <ReturnStockModal
      v-model="showReturnModal"
      :device-info="currentReturnDevice"
      @success="loadData"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import QueryEditModal from '@/components/query/QueryEditModal.vue'
import QuickSaleModal from '@/components/query/QuickSaleModal.vue'
import ReturnStockModal from '@/components/query/ReturnStockModal.vue'

// 模态框状态
const showEditModal = ref(false)
const showQuickSaleModal = ref(false)
const showReturnModal = ref(false)

// 当前操作的数据
const currentEditItem = ref(null)
const currentReturnDevice = ref(null)

// 打开编辑模态框
const openEditModal = (item) => {
  currentEditItem.value = item
  showEditModal.value = true
}

// 打开退库模态框
const openReturnModal = (item) => {
  currentReturnDevice.value = item.基本信息
  showReturnModal.value = true
}

// 加载数据
const loadData = () => {
  // 重新加载查询数据
}
</script>
```

---

## 样式定制

所有组件都支持通过 CSS 变量进行样式定制：

```scss
:root {
  // 主题色
  --el-color-primary: #1890ff;

  // 边框颜色
  --el-border-color: #dcdfe6;
  --el-border-color-light: #e4e7ed;

  // 文字颜色
  --el-text-color-primary: #303133;
  --el-text-color-regular: #606266;

  // 圆角
  --el-border-radius-base: 4px;
}
```

---

## API 接口说明

### QueryEditModal 使用的接口

- `PUT /inventory/:id` - 更新设备信息

### QuickSaleModal 使用的接口

- `POST /quick-sale` - 快速出库

### ReturnStockModal 使用的接口

- `POST /inventory/return-to-stock` - 退库操作

---

## 权限控制

| 组件 | 所需权限 |
|------|----------|
| QueryEditModal | query_queryview:edit |
| QuickSaleModal | inventory_inventoryview:create |
| ReturnStockModal | query_queryview:create |

---

## 移动端适配

所有组件都内置了移动端适配：

- 自动检测屏幕尺寸
- 移动端单列布局
- 触摸友好的按钮大小
- 优化的字体和间距

---

## 注意事项

1. **数据格式**：确保传入的 `editItem` 和 `deviceInfo` 对象格式正确
2. **权限检查**：在使用前确保用户具有相应的权限
3. **错误处理**：组件已内置错误处理，无需额外处理
4. **数据刷新**：监听 `@success` 事件后刷新列表数据

---

## 常见问题

### Q: 如何自定义模态框宽度？

A: 可以通过修改组件中的 `width` 和 `max-width` props：

```vue
<QueryEditModal
  v-model="showEditModal"
  :edit-item="currentEditItem"
  width="95%"
  max-width="1000px"
  @success="handleSuccess"
/>
```

### Q: 如何禁用移动端全屏？

A: 设置 `:force-fullscreen="false"`：

```vue
<QueryEditModal
  v-model="showEditModal"
  :edit-item="currentEditItem"
  :force-fullscreen="false"
  @success="handleSuccess"
/>
```

### Q: 如何添加自定义字段？

A: 在对应组件的模板和表单数据中添加字段即可。
