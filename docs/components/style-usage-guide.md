# TF2025 样式系统使用指南

> **文档说明**：详细介绍 TF2025 统一样式系统的使用方法、最佳实践和示例
>
> **最后更新**：2025-12-20
> **版本**：v1.0.0
> **维护者**：TF2025 开发团队

## 概述

TF2025 项目已经建立了完整的统一样式系统，包括响应式断点、尺寸规范、颜色系统和组件样式。本指南将帮助你正确使用这些样式，确保项目的视觉一致性和可维护性。

## 快速开始

### 1. 引入样式

在 Vue 组件中，你可以通过以下方式使用样式：

```vue
<template>
  <div class="responsive-container">
    <h1 class="page-title">标题</h1>
    <p class="body-text">正文内容</p>
  </div>
</template>

<style lang="scss" scoped>
// 引入变量和混入
@import '@/styles/variables.scss';
@import '@/styles/mixins/responsive.scss';

.responsive-container {
  @include responsive-container;
}

.page-title {
  @include responsive-text(24px, 32px);
  color: var(--color-text-primary);
}

.body-text {
  font-size: var(--font-base);
  color: var(--color-text-regular);
  line-height: var(--line-height-normal);
}
</style>
```

### 2. 使用响应式系统

```vue
<script setup>
import { useResponsive } from '@/composables/useResponsive'

const {
  isMobile,
  isTablet,
  isDesktop,
  mediaQuery,
  responsiveSizes
} = useResponsive()
</script>

<template>
  <div class="container">
    <!-- 根据设备类型显示不同内容 -->
    <div v-if="isMobile" class="mobile-layout">
      移动端布局
    </div>
    <div v-else-if="isTablet" class="tablet-layout">
      平板布局
    </div>
    <div v-else class="desktop-layout">
      桌面端布局
    </div>

    <!-- 使用动态样式 -->
    <div
      class="card"
      :style="{
        padding: responsiveSizes.containerPadding + 'px',
        fontSize: responsiveSizes.fontScale + 'rem'
      }"
    >
      响应式卡片
    </div>
  </div>
</template>

<style lang="scss" scoped>
.container {
  width: 100%;
  max-width: v-bind('responsiveSizes.containerMaxWidth');
  margin: 0 auto;
}
</style>
```

## 核心概念

### 1. CSS 变量系统

项目使用 CSS 自定义属性（变量）来定义所有设计令牌：

```scss
// ✅ 推荐：使用 CSS 变量
.element {
  color: var(--color-text-primary);
  background: var(--color-bg-white);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
}

// ❌ 避免：硬编码数值
.element-bad {
  color: #303133;      // 硬编码颜色
  background: #ffffff; // 硬编码背景
  padding: 16px;       // 硬编码间距
  border-radius: 6px;  // 硬编码圆角
}
```

### 2. 响应式断点

使用统一的断点系统进行响应式设计：

```scss
// 移动端专用样式
.mobile-feature {
  display: block;

  @include desktop-up {
    display: none;
  }
}

// 桌面端专用样式
.desktop-feature {
  display: none;

  @include desktop-up {
    display: block;
  }
}

// 响应式容器
.responsive-grid {
  display: grid;
  gap: var(--spacing-md);

  @include mobile-only {
    grid-template-columns: 1fr;
  }

  @include tablet-up {
    grid-template-columns: repeat(2, 1fr);
  }

  @include desktop-up {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 3. BEM 命名规范

遵循 BEM（Block, Element, Modifier）命名规范：

```scss
// Block（块）
.card {
  background: var(--color-bg-white);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-lg);

  // Element（元素）
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__title {
    font-size: var(--font-lg);
    font-weight: var(--font-weight-semibold);
  }

  &__content {
    color: var(--color-text-regular);
    margin: var(--spacing-md) 0;
  }

  // Modifier（修饰符）
  &--elevated {
    box-shadow: var(--shadow-md);
  }

  &--clickable {
    cursor: pointer;
    transition: var(--transition-all-normal);

    &:hover {
      transform: translateY(-2px);
    }
  }
}
```

## 最佳实践

### 1. 避免硬编码

**错误的示例：**
```scss
.hero-section {
  width: 1200px;  // 硬编码
  padding: 24px;  // 硬编码
  margin: 16px 0; // 硬编码
}
```

**正确的示例：**
```scss
.hero-section {
  width: var(--container-wide);
  padding: var(--spacing-xl);
  margin: var(--spacing-md) 0;
}
```

### 2. 使用语义化的变量

```scss
// ✅ 语义化
.card {
  padding: var(--spacing-card-padding, var(--spacing-lg));
}

// ✅ 带回退值
.button {
  min-height: var(--button-height, var(--touch-min));
}
```

### 3. 响应式优先设计

```scss
// ✅ 移动优先
.sidebar {
  width: 100%;

  @include tablet-up {
    width: var(--sidebar-width-default);
  }

  @include desktop-up {
    width: var(--sidebar-width-wide);
  }
}
```

### 4. 使用混入避免重复

```scss
// 定义混入
@mixin card-base {
  background: var(--color-bg-white);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

// 使用混入
.product-card {
  @include card-base;

  &__image {
    width: 100%;
    height: 200px;
    object-fit: cover;
  }
}

.user-card {
  @include card-base;

  &__avatar {
    width: var(--avatar-default);
    height: var(--avatar-default);
  }
}
```

## 组件样式指南

### 1. 按钮组件

```vue
<template>
  <button
    :class="[
      'btn',
      `btn--${type}`,
      `btn--${size}`,
      { 'btn--disabled': disabled }
    ]"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style lang="scss" scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: 0 var(--spacing-md);
  font-size: var(--font-base);
  font-weight: var(--font-weight-medium);
  border-radius: var(--border-radius);
  transition: var(--transition-all-normal);
  cursor: pointer;
  border: none;
  outline: none;

  // 尺寸变体
  &--small {
    min-height: var(--button-height-small);
    padding: 0 var(--spacing-sm);
    font-size: var(--font-sm);
  }

  &--large {
    min-height: var(--button-height-large);
    padding: 0 var(--spacing-xl);
    font-size: var(--font-lg);
  }

  // 类型变体
  &--primary {
    background: var(--color-primary);
    color: var(--color-bg-white);
  }

  &--secondary {
    background: transparent;
    color: var(--color-primary);
    border: 1px solid var(--color-primary);
  }

  // 状态
  &--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
```

### 2. 表单组件

```vue
<template>
  <div class="form-group">
    <label :class="['form-label', { 'form-label--required': required }]">
      {{ label }}
    </label>
    <input
      :class="['form-input', { 'form-input--error': error }]"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <span v-if="error" class="form-error">
      {{ error }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-label {
  display: block;
  font-size: var(--font-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);

  &--required::after {
    content: ' *';
    color: var(--color-danger);
  }
}

.form-input {
  width: 100%;
  height: var(--input-height-default);
  padding: 0 var(--spacing-md);
  font-size: var(--font-base);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  transition: var(--transition-all-normal);

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  }

  &--error {
    border-color: var(--color-danger);
  }
}

.form-error {
  display: block;
  font-size: var(--font-xs);
  color: var(--color-danger);
  margin-top: var(--spacing-xs);
}
</style>
```

## 主题和变体

### 1. 暗色主题支持

```scss
.theme-toggle {
  background: var(--color-bg-white);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);

  // 暗色主题自动适配
  [data-theme="dark"] & {
    background: var(--color-bg-overlay);
    color: var(--color-text-primary);
    border-color: var(--color-border);
  }
}
```

### 2. 高对比度模式

```scss
.accessible-button {
  background: var(--color-primary);
  color: var(--color-bg-white);
  border: 2px solid transparent;

  @include high-contrast {
    border-color: currentColor;
    font-weight: var(--font-weight-bold);
  }
}
```

## 性能优化

### 1. 避免过度嵌套

```scss
// ❌ 过度嵌套
.page {
  .header {
    .nav {
      .item {
        .link {
          .icon {
            // 太深的嵌套
          }
        }
      }
    }
  }
}

// ✅ 扁平结构
.page-nav-item-link-icon {
  // 直接的类名
}
```

### 2. 使用高效的 CSS 选择器

```scss
// ✅ 类选择器
.component {
  // 样式
}

// ✅ 属性选择器
input[type="text"] {
  // 样式
}

// ❌ 避免通配符
* {
  box-sizing: border-box;
}

// ✅ 更精确
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

## 调试技巧

### 1. 开发环境样式

```scss
@if ($env == 'development') {
  .debug-grid {
    background-image:
      linear-gradient(rgba(255, 0, 0, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 0, 0, 0.1) 1px, transparent 1px);
    background-size: 20px 20px;
  }
}
```

### 2. 检查响应式布局

```scss
.breakpoint-indicator {
  position: fixed;
  bottom: 10px;
  right: 10px;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 12px;
  border-radius: 3px;
  z-index: 9999;

  @include mobile-only {
    content: 'Mobile';
    background: rgba(255, 0, 0, 0.8);
  }

  @include tablet-only {
    content: 'Tablet';
    background: rgba(255, 165, 0, 0.8);
  }

  @include desktop-up {
    content: 'Desktop';
    background: rgba(0, 128, 0, 0.8);
  }
}
```

## 常见问题

### Q: 如何在不同组件间共享样式？

A: 使用混入（mixins）或 CSS 变量：

```scss
// 共享混入
@mixin card-base {
  background: var(--color-bg-white);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-lg);
}

// 在组件中使用
.feature-card {
  @include card-base;
}
```

### Q: 如何处理特殊的响应式需求？

A: 使用 JavaScript 配合响应式系统：

```vue
<script setup>
import { useResponsive } from '@/composables/useResponsive'

const { isMobile, screenWidth } = useResponsive()

const dynamicStyle = computed(() => ({
  fontSize: isMobile ? '14px' : '16px',
  width: Math.min(screenWidth.value, 800) + 'px'
}))
</script>
```

### Q: 如何确保无障碍性？

A: 遵循无障碍最佳实践：

```scss
.focus-element {
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
```

## 参考资料

- [CSS 变量使用指南](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [BEM 命名规范](http://getbem.com/)
- [响应式设计最佳实践](https://web.dev/responsive-web-design-basics/)
- [无障碍设计指南](https://web.dev/accessibility/)

---

通过遵循本指南，你可以创建出一致、可维护、高性能的样式代码。如有疑问，请参考项目中的示例代码或联系开发团队。