# TF2025 模态框使用指南

> **文档说明**：本指南介绍 TF2025 项目中模态框组件的使用方法，包括 MobileDialog、BaseModal 和 el-dialog 的使用规范
>
> **最后更新**：2025-12-20
> **版本**：v1.1.0
> **维护者**：TF2025 开发团队

## 概述

TF2025项目提供了完整的模态框解决方案，支持从移动端到桌面端的全设备适配。系统包含三种模态框类型：

1. **MobileDialog** - 基于Element Plus的增强版对话框组件（推荐）
2. **BaseModal** - 自定义模态框组件
3. **Element Plus Dialog** - 原生组件配合响应式样式

## 组件对比

| 特性 | MobileDialog | BaseModal | El-Dialog |
|------|--------------|-----------|------------|
| 响应式适配 | ✅ 自动适配 | ✅ 基础适配 | ⚠️ 需手动配置 |
| 移动端优化 | ✅ 完整支持 | ✅ 基础支持 | ⚠️ 依赖样式 |
| PC端功能 | ✅ 拖拽、大小调整 | ✅ 基础功能 | ✅ 完整功能 |
| 全屏模式 | ✅ 自动全屏 | ✅ 支持全屏 | ✅ 支持全屏 |
| 自定义性 | ✅ 高度可定制 | ✅ 完全自定义 | ✅ 标准插槽 |
| 推荐场景 | 通用场景 | 特殊样式需求 | 简单场景 |

## MobileDialog 组件（推荐）

### 基础用法

```vue
<template>
  <MobileDialog
    v-model="dialogVisible"
    title="添加商品"
    :width="800"
    :loading="loading"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <!-- 默认内容插槽 -->
    <el-form :model="formData" label-width="100px">
      <el-form-item label="名称">
        <el-input v-model="formData.name" />
      </el-form-item>
      <el-form-item label="价格">
        <el-input-number v-model="formData.price" />
      </el-form-item>
    </el-form>
  </MobileDialog>
</template>

<script setup>
import { ref } from 'vue'
import { MobileDialog } from '@/components'

const dialogVisible = ref(false)
const loading = ref(false)
const formData = ref({
  name: '',
  price: 0
})

const handleConfirm = async () => {
  loading.value = true
  try {
    // 提交逻辑
    await submitData()
    dialogVisible.value = false
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  dialogVisible.value = false
}
</script>
```

### 高级用法

```vue
<template>
  <MobileDialog
    v-model="dialogVisible"
    title="商品详情"
    :width="1200"
    :force-fullscreen="isMobile"
    :draggable="!isMobile"
    dialog-class="product-dialog"
  >
    <!-- 自定义头部 -->
    <template #header>
      <div class="custom-header">
        <h3>{{ product.name }}</h3>
        <el-tag :type="product.status === 'active' ? 'success' : 'danger'">
          {{ product.status }}
        </el-tag>
      </div>
    </template>

    <!-- 自定义内容 -->
    <div class="product-detail">
      <el-tabs>
        <el-tab-pane label="基本信息">
          <ProductInfo :product="product" />
        </el-tab-pane>
        <el-tab-pane label="库存信息">
          <StockInfo :product-id="product.id" />
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 自定义底部 -->
    <template #footer>
      <div class="footer-actions">
        <el-button @click="handleEdit">编辑</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
        <el-button type="danger" @click="handleDelete">删除</el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup>
import { computed } from 'vue'
import { useResponsive } from '@/composables/responsive'

const { isMobile } = useResponsive()
</script>

<style lang="scss" scoped>
.product-dialog {
  .custom-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-actions {
    display: flex;
    gap: 12px;
  }
}

// 移动端样式
@media (max-width: 767px) {
  .product-dialog {
    .footer-actions {
      flex-direction: column;

      .el-button {
        width: 100%;
      }
    }
  }
}
</style>
```

### Props 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | boolean | - | 对话框显示状态 |
| title | string | '' | 对话框标题 |
| width | string/number | '50%' | 对话框宽度 |
| fullscreen | boolean | false | 是否全屏 |
| forceFullscreen | boolean | false | 强制移动端全屏 |
| closeOnClickModal | boolean | true | 点击遮罩关闭 |
| closeOnPressEscape | boolean | true | ESC键关闭 |
| showClose | boolean | true | 显示关闭按钮 |
| draggable | boolean | true | 可拖拽 |
| loading | boolean | false | 确认按钮加载状态 |
| showDefaultFooter | boolean | true | 显示默认底部按钮 |
| showCancelButton | boolean | true | 显示取消按钮 |
| confirmText | string | '确定' | 确认按钮文字 |
| cancelText | string | '取消' | 取消按钮文字 |

## 响应式设计规范

### 断点定义

- **移动端**：< 768px
- **平板端**：768px - 1024px
- **桌面端**：≥ 1024px

### 移动端适配

1. **尺寸调整**
   - 自动宽度：95vw
   - 超小屏（<480px）：98vw
   - 内边距：16px

2. **交互优化**
   - 按钮最小高度：44px（iOS标准）
   - 表单字体大小：16px（防止缩放）
   - 触摸优化间距

3. **布局调整**
   - 底部按钮垂直排列
   - 表格转换为卡片式
   - 滚动优化：-webkit-overflow-scrolling: touch

### PC端特性

1. **功能增强**
   - 拖拽移动
   - 宽度调整
   - 大小限制（最大1200px）

2. **布局优化**
   - 内容区域最大高度：70vh
   - 表单网格布局
   - 按钮水平排列

## 样式覆盖指南

### Element Plus Dialog 样式

在 `responsive.scss` 中已定义了全局样式：

```scss
/* 移动端通用适配 - 375px及以上所有手机 */
@media (max-width: 767px) {
  .el-dialog {
    width: 95vw !important;
    max-width: 95vw !important;
    margin: 0 auto !important;
    border-radius: 12px;
  }
}
```

### 自定义模态框样式

使用 BaseModal 时，样式在 `modal-styles.scss` 中：

```scss
@media (max-width: 767px) {
  .modal-content {
    width: 95vw;
    max-width: 95vw;
  }
}
```

## 最佳实践

### 1. 统一使用 MobileDialog

```javascript
// 组件导入
import { MobileDialog } from '@/components'

// 全局注册（可选）
app.component('MobileDialog', MobileDialog)
```

### 2. 响应式内容布局

```vue
<template>
  <MobileDialog v-model="visible">
    <!-- PC端网格布局 -->
    <div class="form-grid">
      <div class="form-group">
        <label>名称</label>
        <el-input />
      </div>
      <div class="form-group">
        <label>价格</label>
        <el-input-number />
      </div>
    </div>
  </MobileDialog>
</template>

<style lang="scss" scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;

  // 移动端响应式
  @media (max-width: 767px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
```

### 3. 处理长表单

```vue
<template>
  <MobileDialog v-model="visible" title="长表单" :fullscreen="isSmallScreen">
    <el-form>
      <!-- 表单内容 -->
    </el-form>
  </MobileDialog>
</template>

<script setup>
import { computed } from 'vue'
import { useResponsive } from '@/composables/responsive'

const { screenWidth } = useResponsive()
const isSmallScreen = computed(() => screenWidth.value < 600)
</script>
```

### 4. 表格模态框

```vue
<template>
  <MobileDialog
    v-model="visible"
    title="数据列表"
    :width="1000"
    :fullscreen="isMobile"
  >
    <!-- PC端表格 -->
    <el-table v-if="!isMobile" :data="tableData">
      <!-- 表格列 -->
    </el-table>

    <!-- 移动端卡片 -->
    <div v-else class="mobile-card-list">
      <div v-for="item in tableData" :key="item.id" class="card-item">
        <!-- 卡片内容 -->
      </div>
    </div>
  </MobileDialog>
</template>
```

## 迁移指南

### 从 el-dialog 迁移

```vue
<!-- 原代码 -->
<el-dialog v-model="visible" title="标题" width="600px">
  <div>内容</div>
  <template #footer>
    <el-button @click="visible = false">取消</el-button>
    <el-button type="primary" @click="handleConfirm">确定</el-button>
  </template>
</el-dialog>

<!-- 迁移后 -->
<MobileDialog v-model="visible" title="标题" width="600" @confirm="handleConfirm">
  <div>内容</div>
</MobileDialog>
```

### 从 BaseModal 迁移

```vue
<!-- 原代码 -->
<BaseModal
  v-model:visible="visible"
  title="标题"
  :show-default-footer="true"
  @confirm="handleConfirm"
>
  <div>内容</div>
</BaseModal>

<!-- 迁移后 -->
<MobileDialog
  v-model="visible"
  title="标题"
  @confirm="handleConfirm"
>
  <div>内容</div>
</MobileDialog>
```

## 常见问题

### Q: 如何在移动端强制全屏？
A: 使用 `forceFullscreen` 属性：

```vue
<MobileDialog v-model="visible" :force-fullscreen="true">
  <!-- 内容 -->
</MobileDialog>
```

### Q: 如何自定义底部按钮？
A: 使用 `#footer` 插槽：

```vue
<MobileDialog v-model="visible">
  <!-- 内容 -->
  <template #footer>
    <el-button>自定义按钮1</el-button>
    <el-button type="primary">自定义按钮2</el-button>
  </template>
</MobileDialog>
```

### Q: 如何处理大尺寸模态框？
A: 使用响应式宽度：

```vue
<MobileDialog
  v-model="visible"
  :width="isMobile ? '95vw' : '1200px'"
  :fullscreen="isMobile"
>
  <!-- 内容 -->
</MobileDialog>
```

### Q: 如何禁用拖拽？
A: 设置 `draggable` 为 `false`：

```vue
<MobileDialog v-model="visible" :draggable="false">
  <!-- 内容 -->
</MobileDialog>
```

## 总结

1. **新项目**：直接使用 MobileDialog 组件
2. **现有项目**：逐步从 el-dialog/BaseModal 迁移到 MobileDialog
3. **统一标准**：保持组件使用的一致性
4. **响应式优先**：始终考虑移动端体验

通过统一的模态框解决方案，确保应用在所有设备上都有良好的用户体验。

## 更新日志

- 2025-12-20: 完善模态框适配系统
  - 修正最小适配宽度为375px（iPhone SE）
  - 优化移动端断点：767px和479px双断点适配
  - 增强PC端功能：支持拖拽、动态宽度调整
  - 完善响应式设计：自动全屏、按钮布局优化
  - 添加无障碍支持：高对比度、减少动画模式