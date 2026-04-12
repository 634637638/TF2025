# TF2025 移动端适配指南

> **文档说明**：本指南详细说明 TF2025 项目的移动端适配方案，帮助开发者快速实现响应式设计
>
> **最后更新**：2025-12-20
> **版本**：v1.2.0
> **维护者**：TF2025 开发团队

## 概述

TF2025项目已内置完善的移动端适配系统，支持从375px（iPhone SE）到所有桌面尺寸的响应式设计。

## 核心组件

### 1. 响应式布局系统

#### ResponsiveLayout 组件
完整的响应式布局容器，已集成：
- 安全区域适配（支持iPhone X系列）
- 移动端顶部导航
- 侧边栏移动端适配
- 浮动操作按钮（FAB）
- 虚拟键盘适配

```vue
<template>
  <ResponsiveLayout
    title="页面标题"
    :show-mobile-header="true"
    :show-back-button="true"
    :fab-actions="fabActions"
  >
    <template #default>
      <!-- 页面内容 -->
    </template>

    <template #sidebar>
      <!-- 侧边栏内容 -->
    </template>
  </ResponsiveLayout>
</template>

<script setup>
import { ResponsiveLayout } from '@/components'

const fabActions = [
  {
    id: 'add',
    icon: Plus,
    label: '添加',
    type: 'primary',
    handler: () => handleAdd()
  }
]
</script>
```

### 2. 移动端表格组件

#### MobileTable 组件
自动适配移动端的表格组件，在小屏幕上切换为卡片式布局。

```vue
<template>
  <MobileTable
    :data="tableData"
    :columns="columns"
    :actions="actions"
    :loading="loading"
    @action="handleAction"
    @row-click="handleRowClick"
  >
    <template #status="{ row }">
      <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
        {{ row.status }}
      </el-tag>
    </template>
  </MobileTable>
</template>

<script setup>
const columns = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '名称' },
  { prop: 'status', label: '状态', slot: 'status' },
  { prop: 'created_at', label: '创建时间' }
]

const actions = [
  { key: 'edit', label: '编辑', type: 'primary' },
  { key: 'delete', label: '删除', type: 'danger' }
]
</script>
```

### 3. 移动端表单组件

#### MobileForm 组件
专为移动端优化的表单组件，自动调整布局和交互。

### 4. 移动端模态框组件

#### MobileDialog 组件
基于Element Plus Dialog的增强版模态框，提供完整的响应式适配。

```vue
<template>
  <MobileDialog
    v-model="dialogVisible"
    title="添加商品"
    :width="800"
    :force-fullscreen="isMobile"
    @confirm="handleConfirm"
  >
    <!-- 内容 -->
  </MobileDialog>
</template>

<script setup>
import { MobileDialog } from '@/components'
import { useResponsive } from '@/composables/responsive'

const { isMobile } = useResponsive()
</script>
```

```vue
<template>
  <MobileForm
    v-model="formData"
    :fields="fields"
    :rules="rules"
    :loading="loading"
    @submit="handleSubmit"
    @cancel="handleCancel"
  >
    <template #custom-field="{ field, value }">
      <!-- 自定义字段 -->
    </template>
  </MobileForm>
</template>

<script setup>
const formData = ref({
  name: '',
  type: '',
  date: '',
  status: false
})

const fields = [
  {
    prop: 'name',
    label: '名称',
    type: 'input',
    required: true,
    placeholder: '请输入名称'
  },
  {
    prop: 'type',
    label: '类型',
    type: 'select',
    options: [
      { label: '类型1', value: 'type1' },
      { label: '类型2', value: 'type2' }
    ]
  },
  {
    prop: 'date',
    label: '日期',
    type: 'date',
    valueFormat: 'YYYY-MM-DD'
  },
  {
    prop: 'status',
    label: '状态',
    type: 'switch'
  }
]

const rules = {
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' }
  ]
}
</script>
```

## 响应式工具

### 1. useMobile Composable

```javascript
import { useMobile } from '@/composables/useMobile'

const {
  isMobile,      // 是否为移动端
  isTablet,      // 是否为平板
  isDesktop,     // 是否为桌面端
  screenSize,    // 屏幕尺寸
  orientation,   // 屏幕方向
  detectDeviceType,
  getDeviceInfo,
  isTouchDevice,
  getSafeAreaInsets
} = useMobile()
```

### 2. useResponsive Composable

```javascript
import { useResponsive } from '@/composables/responsive'

const {
  windowWidth,
  windowHeight,
  currentBreakpoint,  // 当前断点 xs/sm/md/lg/xl/xxl
  deviceInfo,
  isMobile,
  isTablet,
  isDesktop,
  isXs,               // 断点判断
  isSm,
  isMd,
  isLg,
  isXl,
  isXxl,
  isSmAndDown,        // 范围判断
  isSmAndUp,
  isMdAndDown,
  isMdAndUp
} = useResponsive()
```

## 样式规范

### 1. 断点系统

```scss
// 断点定义（与 responsive.scss 保持一致）
:root {
  --breakpoint-min: 375px;  // iPhone SE, iPhone 12 Mini
  --breakpoint-xs: 414px;   // iPhone SE 2022, iPhone 12, 13
  --breakpoint-sm: 480px;   // 大屏手机竖屏
  --breakpoint-md: 768px;   // 平板竖屏/大屏手机横屏
  --breakpoint-lg: 1024px;  // 平板横屏/小桌面
  --breakpoint-xl: 1200px;  // 标准桌面
  --breakpoint-2xl: 1440px; // 大桌面
}

// 媒体查询断点
$breakpoints: (
  min: 375px,   // 最小适配宽度
  xs: 414px,    // 小屏手机
  sm: 480px,    // 中屏手机
  md: 768px,    // 大屏手机/平板
  lg: 1024px,   // 平板
  xl: 1200px,   // 桌面
  xxl: 1440px   // 大桌面
);

// 使用示例
@media (max-width: 768px) {
  .mobile-only {
    display: block;
  }
}

@media (min-width: 769px) {
  .desktop-only {
    display: block;
  }
}
```

### 2. 工具类

```html
<!-- 显示/隐藏 -->
<div class="mobile-only">移动端显示</div>
<div class="desktop-only">桌面端显示</div>
<div class="hide-on-mobile">移动端隐藏</div>

<!-- 间距调整 -->
<div class="p-sm-mobile">移动端小内边距</div>
<div class="m-lg-mobile">移动端大外边距</div>

<!-- 文字大小 -->
<div class="text-xs-mobile">移动端超小文字</div>
<div class="text-base-mobile">移动端基础文字</div>

<!-- 安全区域 -->
<div class="safe-area-top">顶部安全区域</div>
<div class="safe-area-bottom">底部安全区域</div>
```

## 最佳实践

### 1. 触摸优化

- 所有可点击元素最小44px × 44px
- 按钮间距至少8px
- 避免误触设计

```vue
<!-- 好的实践 -->
<el-button class="mobile-btn">操作</el-button>

<style>
.mobile-btn {
  min-height: 44px;
  min-width: 44px;
  margin: 4px;
}
</style>
```

### 2. 表单优化

- 输入框字体大小至少16px（防止iOS自动缩放）
- 使用合适的键盘类型
- 提供清晰的错误提示

```vue
<el-input
  v-model="input"
  type="tel"        <!-- 电话键盘 -->
  maxlength="11"    <!-- 限制长度 -->
  class="mobile-input"
/>
```

### 3. 导航优化

- 移动端使用底部导航
- 提供返回按钮
- 简化层级结构

```vue
<!-- 移动端底部导航 -->
<div class="bottom-nav">
  <a href="#" class="nav-item active">
    <i class="nav-icon">🏠</i>
    <span class="nav-label">首页</span>
  </a>
  <a href="#" class="nav-item">
    <i class="nav-icon">📊</i>
    <span class="nav-label">统计</span>
  </a>
</div>
```

### 4. 性能优化

- 使用虚拟滚动处理长列表
- 图片懒加载
- 减少动画使用

```vue
<!-- 虚拟滚动 -->
<el-table-v2
  :columns="columns"
  :data="data"
  :width="800"
  :height="600"
  :row-height="50"
/>

<!-- 图片懒加载 -->
<img v-lazy="imageUrl" alt="描述" />
```

## 常见问题

### 1. 虚拟键盘遮挡输入框

使用ResponsiveLayout组件，会自动处理虚拟键盘适配。

### 2. 横屏适配

项目已自动处理横屏情况，会调整模态框高度等。

### 3. 安全区域适配

自动检测并适配iPhone X系列的安全区域。

## 测试建议

1. **真机测试**：在真实移动设备上测试
2. **模拟器测试**：使用Chrome DevTools设备模拟
3. **多设备测试**：测试不同尺寸的设备
4. **交互测试**：测试触摸手势和交互

## 更新日志

- 2025-12-20: 完善移动端适配系统
  - 修正断点定义：最小适配宽度改为375px（iPhone SE）
  - 新增MobileDialog组件，提供完整的响应式模态框
  - 优化响应式样式系统，统一断点规范
  - 完善安全区域适配，支持iPhone X系列
  - 提供完整的移动端组件库（表格、表单、模态框）
- 详细文档请参考：《模态框使用指南》(docs/modal-guide.md)