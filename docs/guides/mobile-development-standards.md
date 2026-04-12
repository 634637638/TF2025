# TF2025 移动端开发规范

## 📱 概述

本文档定义了 TF2025 项目的移动端开发规范，确保所有移动端功能的一致性、可用性和性能。

## 🎯 设计原则

### 1. 响应式优先
- 所有页面必须支持响应式设计
- 优先使用移动端布局（Mobile First）
- 支持横竖屏切换

### 2. 触摸友好
- 按钮点击区域不小于 44px × 44px
- 间距适中，避免误触
- 支持手势操作

### 3. 性能优化
- 减少不必要的动画
- 优化图片加载
- 使用虚拟滚动处理长列表

### 4. 一致性体验
- 统一的导航模式
- 一致的交互反馈
- 标准的页面过渡

## 🔧 技术实现

### 1. 响应式断点

```typescript
// src/composables/responsive.ts
export const BREAKPOINTS = {
  xs: 0,      // 超小屏手机 (< 576px)
  sm: 576,    // 小屏手机 (≥ 576px)
  md: 768,    // 平板竖屏 (≥ 768px)
  lg: 992,    // 平板横屏/小屏笔记本 (≥ 992px)
  xl: 1200,   // 桌面 (≥ 1200px)
  xxl: 1400   // 大屏桌面 (≥ 1400px)
}
```

### 2. 使用响应式布局组件

```vue
<template>
  <ResponsiveLayout
    title="页面标题"
    :show-mobile-header="true"
    :show-back-button="true"
    :fab-actions="fabActions"
  >
    <!-- 页面内容 -->
  </ResponsiveLayout>
</template>

<script setup>
import { ResponsiveLayout } from '@/components/ResponsiveLayout'

const fabActions = [
  {
    id: 'add',
    icon: Plus,
    label: '添加',
    handler: handleAdd,
    type: 'primary'
  }
]
</script>
```

### 3. 移动端检测

```typescript
import { useResponsive } from '@/composables/responsive'

const {
  isMobile,
  isTablet,
  deviceInfo
} = useResponsive()

// 根据设备类型执行不同逻辑
if (isMobile.value) {
  // 移动端逻辑
}
```

## 📐 布局规范

### 1. 页面结构

```vue
<template>
  <ResponsiveLayout>
    <!-- 移动端使用卡片布局 -->
    <div v-if="isMobile" class="mobile-card-list">
      <div v-for="item in list" :key="item.id" class="mobile-card">
        <!-- 卡片内容 -->
      </div>
    </div>

    <!-- 桌面端使用表格布局 -->
    <div v-else class="desktop-table">
      <el-table :data="list">
        <!-- 表格列 -->
      </el-table>
    </div>
  </ResponsiveLayout>
</template>
```

### 2. 卡片式布局

```scss
.mobile-card {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  &:active {
    transform: scale(0.98);
    transition: transform 0.1s;
  }
}
```

### 3. 表格响应式处理

```vue
<template>
  <div class="responsive-table-container">
    <el-table
      :data="tableData"
      :style="{ width: isMobile ? 'max-content' : '100%' }"
    >
      <!-- 表格列 -->
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.responsive-table-container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  // 移动端优化
  @media (max-width: 768px) {
    margin: 0 -16px;
    padding: 0 16px;
  }
}
</style>
```

## 🎨 样式规范

### 1. 安全区域适配

```scss
// iPhone 刘海屏适配
.mobile-header {
  padding-top: env(safe-area-inset-top);
}

.mobile-footer {
  padding-bottom: env(safe-area-inset-bottom);
}

// CSS 变量定义
:root {
  --safe-area-inset-top: 0;
  --safe-area-inset-right: 0;
  --safe-area-inset-bottom: 0;
  --safe-area-inset-left: 0;
}
```

### 2. 触摸优化

```scss
// 按钮最小点击区域
.touch-button {
  min-width: 44px;
  min-height: 44px;
  padding: 8px 16px;

  &:active {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

// 列表项优化
.touch-list-item {
  padding: 12px 16px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 16px;
    right: 0;
    height: 1px;
    background: var(--el-border-color-lighter);
  }
}
```

### 3. 字体大小适配

```scss
// 响应式字体
.responsive-text {
  font-size: 16px; // 默认大小，防止iOS自动缩放

  @media (min-width: 768px) {
    font-size: 14px;
  }
}

// 标题字体
.mobile-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
}
```

## 🎯 交互规范

### 1. 手势支持

```typescript
import { useMobileGestures } from '@/composables/useMobile'

const {
  enableSwipe,
  enablePullToRefresh,
  enableInfiniteScroll
} = useMobileGestures()

// 启用滑动操作
onMounted(() => {
  enableSwipe(element, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight
  })
})
```

### 2. 虚拟键盘处理

```typescript
import { useVirtualKeyboard } from '@/composables/responsive'

const {
  isKeyboardVisible,
  keyboardHeight
} = useVirtualKeyboard()

// 监听键盘状态
watch(keyboardHeight, (height) => {
  if (height > 0) {
    // 键盘显示时的处理
    document.body.classList.add('keyboard-open')
  } else {
    // 键盘隐藏时的处理
    document.body.classList.remove('keyboard-open')
  }
})
```

### 3. 下拉刷新

```vue
<template>
  <div
    ref="refreshContainer"
    class="refresh-container"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <div class="refresh-indicator" :class="{ 'active': isRefreshing }">
      <el-icon v-if="isRefreshing" class="is-loading">
        <Loading />
      </el-icon>
      <span>{{ isRefreshing ? '刷新中...' : '下拉刷新' }}</span>
    </div>

    <!-- 内容区域 -->
  </div>
</template>
```

## 📋 组件使用规范

### 1. 侧滑菜单 (MobileSlideMenu)

```vue
<template>
  <MobileSlideMenu
    :is-open="isMenuOpen"
    :menu-list="menuList"
    @close="isMenuOpen = false"
    @menu-click="handleMenuClick"
  />
</template>
```

### 2. 浮动操作按钮 (FAB)

```vue
<template>
  <ResponsiveLayout
    :fab-actions="[
      {
        id: 'add',
        icon: Plus,
        label: '新建',
        handler: handleCreate,
        type: 'primary'
      },
      {
        id: 'filter',
        icon: Filter,
        label: '筛选',
        handler: handleFilter,
        type: 'info'
      }
    ]"
  >
    <!-- 页面内容 -->
  </ResponsiveLayout>
</template>
```

### 3. 移动端表单

```vue
<template>
  <el-form :model="formData" label-position="top">
    <el-form-item label="姓名">
      <el-input
        v-model="formData.name"
        placeholder="请输入姓名"
        clearable
      />
    </el-form-item>

    <!-- 日期选择器优化 -->
    <el-form-item label="日期">
      <el-date-picker
        v-model="formData.date"
        type="date"
        placeholder="选择日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
      />
    </el-form-item>
  </el-form>
</template>
```

## 🚀 性能优化

### 1. 图片优化

```vue
<template>
  <!-- 使用懒加载 -->
  <img
    v-lazy="imageUrl"
    alt="描述"
    class="responsive-image"
  />

  <!-- 或使用 Element Plus 的图片组件 -->
  <el-image
    :src="imageUrl"
    :lazy="true"
    fit="cover"
  />
</template>
```

### 2. 列表虚拟滚动

```vue
<template>
  <!-- 大数据量列表使用虚拟滚动 -->
  <el-table-v2
    v-if="useVirtualScroll"
    :columns="columns"
    :data="tableData"
    :width="800"
    :height="600"
    :row-height="50"
  />
</template>
```

### 3. 组件懒加载

```javascript
// 路由懒加载
const MobileView = () => import('@/views/mobile/MobileView.vue')

// 组件懒加载
const HeavyComponent = defineAsyncComponent(() =>
  import('@/components/HeavyComponent.vue')
)
```

## 📊 测试规范

### 1. 设备测试清单

- [ ] iPhone (SE, 12, 14 Pro)
- [ ] Android (三星、小米、华为)
- [ ] iPad (不同尺寸)
- [ ] 不同屏幕分辨率测试

### 2. 功能测试点

- [ ] 触摸交互是否正常
- [ ] 横竖屏切换是否正确
- [ ] 虚拟键盘是否遮挡输入框
- [ ] 返回按钮是否正常工作
- [ ] 手势操作是否流畅

### 3. 性能测试

- [ ] 首屏加载时间 < 3秒
- [ ] 页面切换流畅度 > 60fps
- [ ] 内存使用合理
- [ ] 网络请求优化

## 🔧 调试工具

### 1. Chrome DevTools

```bash
# 开启调试模式
# 在移动设备上访问
chrome://inspect
```

### 2. VConsole（生产环境调试）

```typescript
// 仅在开发环境和测试环境引入
if (import.meta.env.DEV || import.meta.env.VITE_APP_ENV === 'test') {
  import('vconsole').then(VConsole => {
    new VConsole.default()
  })
}
```

## 📚 相关文档

- [响应式布局组件文档](../components/ResponsiveLayout.vue)
- [移动端工具函数](../composables/responsive.ts)
- [Element Plus 移动端适配](https://element-plus.org/zh-CN/guide/mobile.html)
- [Vue 3 响应式设计](https://vuejs.org/guide/scaling-up/responsive.html)

## ⚠️ 注意事项

### 1. iOS 特殊处理

- input 框聚焦时页面缩放问题
- 滚动卡顿问题
- Safari 兼容性问题

### 2. Android 兼容

- 不同厂商系统差异
- 返回键处理
- 权限申请流程

### 3. 常见陷阱

- 避免使用 fixed 定位（iOS 问题）
- 谨慎使用 transform 动画
- 注意 300ms 点击延迟

---

**最后更新**：2025-12-18
**维护团队**：TF2025前端开发团队