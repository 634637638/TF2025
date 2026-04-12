# TF2025 样式定义规范

> **文档说明**：定义 TF2025 项目的样式编写规范，包括 SCSS 组织结构、BEM 命名规范、设计令牌系统和响应式设计标准
>
> **最后更新**：2025-12-20
> **版本**：v1.0.0
> **维护者**：TF2025 开发团队

## 概述

TF2025 项目采用 SCSS 和 CSS Variables 构建的统一样式系统，结合 Element Plus 主题定制，实现了统一的视觉风格、响应式设计和深色模式支持。本规范定义了项目的样式组织结构、命名约定、设计令牌使用和最佳实践。

## 🎯 设计原则

1. **一致性**：所有页面和组件采用统一的设计语言
2. **可维护性**：模块化的样式结构，易于维护和扩展
3. **可扩展性**：灵活的设计系统，支持主题定制
4. **响应式**：适配不同设备和屏幕尺寸
5. **可访问性**：良好的颜色对比度和交互反馈

## 🏗️ 样式架构设计

### 目录结构

```
src/styles/
├── abstracts/              # 抽象层
│   ├── _variables.scss     # 变量定义
│   ├── _mixins.scss        # 混入函数
│   ├── _functions.scss     # 函数
│   └── _placeholders.scss  # 占位符
├── base/                   # 基础层
│   ├── _reset.scss         # 重置样式
│   ├── _typography.scss    # 字体样式
│   └── _layout.scss        # 布局样式
├── components/             # 组件层
│   ├── _button.scss        # 按钮组件
│   ├── _form.scss          # 表单组件
│   ├── _table.scss         # 表格组件
│   └── _card.scss          # 卡片组件
├── layout/                 # 布局层
│   ├── _header.scss        # 头部布局
│   ├── _sidebar.scss       # 侧边栏布局
│   ├── _main.scss          # 主内容区
│   └── _footer.scss        # 底部布局
├── pages/                  # 页面层
│   ├── _dashboard.scss     # 仪表盘页面
│   ├── _users.scss         # 用户页面
│   └── _orders.scss        # 订单页面
├── themes/                 # 主题层
│   ├── _light.scss         # 浅色主题
│   ├── _dark.scss          # 深色主题
│   └── _variables.scss     # 主题变量
├── utils/                  # 工具类
│   ├── _spacing.scss       # 间距工具类
│   ├── _colors.scss        # 颜色工具类
│   └── _layout.scss        # 布局工具类
└── main.scss               # 主样式文件
```

## 🎨 设计令牌系统

### 1. 颜色系统

```scss
// abstracts/_variables.scss

// 主色调
$primary-color: #409EFF;      // 主色
$success-color: #67C23A;      // 成功色
$warning-color: #E6A23C;      // 警告色
$danger-color: #F56C6C;       // 危险色
$info-color: #909399;         // 信息色

// 中性色
$white: #FFFFFF;
$gray-50: #FAFAFA;
$gray-100: #F5F5F5;
$gray-200: #EEEEEE;
$gray-300: #E0E0E0;
$gray-400: #BDBDBD;
$gray-500: #9E9E9E;
$gray-600: #757575;
$gray-700: #616161;
$gray-800: #424242;
$gray-900: #212121;
$black: #000000;

// 功能色
$background-color: $gray-50;
$text-color-primary: $gray-900;
$text-color-regular: $gray-600;
$text-color-secondary: $gray-500;
$text-color-placeholder: $gray-400;

// 边框色
$border-color-base: $gray-300;
$border-color-light: $gray-200;
$border-color-lighter: $gray-100;
$border-color-extra-light: $gray-50;

// 阴影
$box-shadow-base: 0 2px 4px rgba(0, 0, 0, 0.12), 0 0 6px rgba(0, 0, 0, 0.04);
$box-shadow-dark: 0 2px 4px rgba(0, 0, 0, 0.12), 0 0 6px rgba(0, 0, 0, 0.12);
$box-shadow-light: 0 2px 12px 0 rgba(0, 0, 0, 0.1);

// CSS 自定义属性
:root {
  // 主色
  --el-color-primary: #{$primary-color};
  --el-color-success: #{$success-color};
  --el-color-warning: #{$warning-color};
  --el-color-danger: #{$danger-color};
  --el-color-info: #{$info-color};

  // 中性色
  --el-bg-color: #{$background-color};
  --el-text-color-primary: #{$text-color-primary};
  --el-text-color-regular: #{$text-color-regular};
  --el-text-color-secondary: #{$text-color-secondary};

  // 边框
  --el-border-color: #{$border-color-base};
  --el-border-color-light: #{$border-color-light};
  --el-border-color-lighter: #{$border-color-lighter};

  // 自定义颜色
  --tf-primary: #{$primary-color};
  --tf-success: #{$success-color};
  --tf-warning: #{$warning-color};
  --tf-danger: #{$danger-color};
  --tf-info: #{$info-color};
}

// 深色主题
[data-theme="dark"] {
  --el-bg-color: #{$gray-900};
  --el-text-color-primary: #{$gray-100};
  --el-text-color-regular: #{$gray-300};
  --el-text-color-secondary: #{$gray-400};

  --el-border-color: #{$gray-700};
  --el-border-color-light: #{$gray-600};
  --el-border-color-lighter: #{$gray-500};

  --tf-bg-color: #{$gray-900};
  --tf-bg-color-page: #{$gray-800};
}
```

### 2. 间距系统

```scss
// 间距比例
$spacing-ratio: 1.5;
$spacing-base: 16px;

// 间距值
$spacing-xs: 4px;    // 0.25rem
$spacing-sm: 8px;    // 0.5rem
$spacing-md: 16px;   // 1rem
$spacing-lg: 24px;   // 1.5rem
$spacing-xl: 32px;   // 2rem
$spacing-2xl: 48px;  // 3rem
$spacing-3xl: 64px;  // 4rem

// 间距工具类
$spacing-utilities: (
  'm': 'margin',
  'p': 'padding',
  'mx': 'margin-left',
  'my': 'margin-top',
  'px': 'padding-left',
  'py': 'padding-top'
);

$spacing-sizes: (
  '0': 0,
  'xs': $spacing-xs,
  'sm': $spacing-sm,
  'md': $spacing-md,
  'lg': $spacing-lg,
  'xl': $spacing-xl,
  '2xl': $spacing-2xl,
  '3xl': $spacing-3xl,
  'auto': auto
);
```

### 3. 字体系统

```scss
// 字体族
$font-family-sans: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
  'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
$font-family-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier,
  monospace;

// 字体大小
$font-size-xs: 12px;
$font-size-sm: 14px;
$font-size-base: 16px;
$font-size-lg: 18px;
$font-size-xl: 20px;
$font-size-2xl: 24px;
$font-size-3xl: 30px;
$font-size-4xl: 36px;

// 行高
$line-height-tight: 1.25;
$line-height-normal: 1.5;
$line-height-relaxed: 1.75;

// 字重
$font-weight-light: 300;
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;

// CSS 变量
:root {
  --tf-font-family-sans: #{$font-family-sans};
  --tf-font-family-mono: #{$font-family-mono};

  --tf-font-size-xs: #{$font-size-xs};
  --tf-font-size-sm: #{$font-size-sm};
  --tf-font-size-base: #{$font-size-base};
  --tf-font-size-lg: #{$font-size-lg};
  --tf-font-size-xl: #{$font-size-xl};
  --tf-font-size-2xl: #{$font-size-2xl};
  --tf-font-size-3xl: #{$font-size-3xl};
  --tf-font-size-4xl: #{$font-size-4xl};
}
```

## 🎯 BEM 命名规范

### 1. BEM 基础

```scss
// Block（块）：独立的实体
.card {
  // 块样式
  background: white;
  border-radius: 8px;
  box-shadow: $box-shadow-base;

  // Element（元素）：块的一部分
  &__header {
    padding: $spacing-lg;
    border-bottom: 1px solid $border-color-light;
  }

  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $text-color-primary;
  }

  &__content {
    padding: $spacing-lg;
  }

  &__footer {
    padding: $spacing-md $spacing-lg;
    border-top: 1px solid $border-color-light;
  }

  // Modifier（修饰符）：块或元素的不同状态
  &--primary {
    border-color: $primary-color;
  }

  &--bordered {
    border: 1px solid $border-color-base;
  }

  &--shadow {
    box-shadow: $box-shadow-dark;
  }

  // 元素修饰符
  &__title--large {
    font-size: $font-size-xl;
  }

  &__title--center {
    text-align: center;
  }
}
```

### 2. 组件示例

```scss
// 用户列表组件
.user-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: $spacing-lg;
  }

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
  }

  &__actions {
    display: flex;
    gap: $spacing-sm;
  }

  &__content {
    flex: 1;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
  }

  &__row {
    &:hover {
      background: $gray-50;
    }

    &--selected {
      background: rgba($primary-color, 0.1);
    }
  }

  &__cell {
    padding: $spacing-md;
    text-align: left;
    border-bottom: 1px solid $border-color-light;

    &--center {
      text-align: center;
    }

    &--right {
      text-align: right;
    }
  }

  &__pagination {
    padding: $spacing-lg;
    display: flex;
    justify-content: center;
  }

  &--loading {
    opacity: 0.6;
    pointer-events: none;
  }
}
```

## 🎨 混入函数

### 1. 响应式混入

```scss
// abstracts/_mixins.scss

// 断点定义
$breakpoints: (
  'xs': 0,
  'sm': 576px,
  'md': 768px,
  'lg': 992px,
  'xl': 1200px,
  '2xl': 1600px
);

// 响应式混入
@mixin respond-to($breakpoint) {
  @if map-has-key($breakpoints, $breakpoint) {
    @media (min-width: map-get($breakpoints, $breakpoint)) {
      @content;
    }
  } @else {
    @warn "无效的断点：#{$breakpoint}";
  }
}

// 使用示例
.container {
  width: 100%;
  padding: 0 $spacing-md;

  @include respond-to('md') {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 $spacing-lg;
  }

  @include respond-to('lg') {
    max-width: 960px;
  }

  @include respond-to('xl') {
    max-width: 1140px;
  }
}

// 移动优先混入
@mixin mobile-first($breakpoint) {
  @if map-has-key($breakpoints, $breakpoint) {
    @media (max-width: map-get($breakpoints, $breakpoint) - 1px) {
      @content;
    }
  }
}

// 隐藏元素混入
@mixin hide-up-to($breakpoint) {
  @include mobile-first($breakpoint) {
    display: none !important;
  }
}

@mixin show-up-to($breakpoint) {
  @include respond-to($breakpoint) {
    display: none !important;
  }
}
```

### 2. 工具混入

```scss
// 清除浮动
@mixin clearfix {
  &::after {
    content: '';
    display: table;
    clear: both;
  }
}

// 文本截断
@mixin text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// 多行文本截断
@mixin text-truncate-lines($lines: 2) {
  display: -webkit-box;
  -webkit-line-clamp: $lines;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

// 居中对齐
@mixin center-absolute {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

@mixin center-flex {
  display: flex;
  align-items: center;
  justify-content: center;
}

// 隐藏滚动条
@mixin hide-scrollbar {
  -ms-overflow-style: none;  // IE and Edge
  scrollbar-width: none;     // Firefox

  &::-webkit-scrollbar {
    display: none;          // Chrome, Safari and Opera
  }
}

// 按钮样式
@mixin button-variant($bg-color, $color: white, $hover-color: null) {
  background-color: $bg-color;
  color: $color;
  border: 1px solid $bg-color;

  &:hover {
    background-color: darken($bg-color, 10%);
    border-color: darken($bg-color, 10%);
  }

  &:active {
    background-color: darken($bg-color, 15%);
    border-color: darken($bg-color, 15%);
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba($bg-color, 0.2);
  }
}
```

## 🎨 组件样式

### 1. 卡片组件

```scss
// components/_card.scss
.tf-card {
  background: white;
  border-radius: 8px;
  box-shadow: $box-shadow-base;
  overflow: hidden;
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow: $box-shadow-dark;
  }

  &__header {
    padding: $spacing-lg;
    border-bottom: 1px solid $border-color-light;
  }

  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $text-color-primary;
    margin: 0 0 $spacing-sm 0;
  }

  &__subtitle {
    font-size: $font-size-sm;
    color: $text-color-secondary;
    margin: 0;
  }

  &__body {
    padding: $spacing-lg;
  }

  &__footer {
    padding: $spacing-md $spacing-lg;
    background: $gray-50;
    border-top: 1px solid $border-color-light;
  }

  // 变体
  &--bordered {
    border: 1px solid $border-color-base;
    box-shadow: none;

    &:hover {
      box-shadow: $box-shadow-light;
    }
  }

  &--shadow {
    box-shadow: $box-shadow-dark;
  }

  &--elevated {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  // 尺寸
  &--small {
    .tf-card__header {
      padding: $spacing-md;
    }

    .tf-card__body {
      padding: $spacing-md;
    }
  }

  &--large {
    .tf-card__header {
      padding: $spacing-xl;
    }

    .tf-card__body {
      padding: $spacing-xl;
    }
  }
}
```

### 2. 表单组件

```scss
// components/_form.scss
.tf-form {
  &__group {
    margin-bottom: $spacing-lg;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__label {
    display: block;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $text-color-primary;
    margin-bottom: $spacing-xs;

    &--required::after {
      content: ' *';
      color: $danger-color;
    }
  }

  &__control {
    width: 100%;

    &--inline {
      display: inline-block;
      width: auto;
    }
  }

  &__help {
    font-size: $font-size-xs;
    color: $text-color-secondary;
    margin-top: $spacing-xs;
  }

  &__error {
    font-size: $font-size-xs;
    color: $danger-color;
    margin-top: $spacing-xs;
  }

  // 布局
  &--inline {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-lg;
    align-items: flex-end;

    .tf-form__group {
      margin-bottom: 0;
      flex: 1;
      min-width: 200px;
    }
  }

  &--horizontal {
    .tf-form__group {
      display: flex;
      align-items: center;
      gap: $spacing-md;
    }

    .tf-form__label {
      margin-bottom: 0;
      min-width: 120px;
    }

    .tf-form__control {
      flex: 1;
    }
  }
}

// 自定义输入框
.tf-input {
  width: 100%;
  padding: $spacing-sm $spacing-md;
  font-size: $font-size-base;
  line-height: 1.5;
  color: $text-color-primary;
  background: white;
  border: 1px solid $border-color-base;
  border-radius: 4px;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;

  &:focus {
    outline: none;
    border-color: $primary-color;
    box-shadow: 0 0 0 2px rgba($primary-color, 0.2);
  }

  &::placeholder {
    color: $text-color-placeholder;
  }

  &:disabled {
    background: $gray-100;
    border-color: $border-color-light;
    color: $text-color-secondary;
    cursor: not-allowed;
  }

  // 尺寸
  &--small {
    padding: $spacing-xs $spacing-sm;
    font-size: $font-size-sm;
  }

  &--large {
    padding: $spacing-md $spacing-lg;
    font-size: $font-size-lg;
  }

  // 状态
  &--error {
    border-color: $danger-color;

    &:focus {
      box-shadow: 0 0 0 2px rgba($danger-color, 0.2);
    }
  }

  &--success {
    border-color: $success-color;

    &:focus {
      box-shadow: 0 0 0 2px rgba($success-color, 0.2);
    }
  }
}
```

## 🎨 布局系统

### 1. 网格系统

```scss
// layout/_grid.scss
.tf-grid {
  display: grid;
  gap: $spacing-md;

  // 列数
  &--cols-1 { grid-template-columns: repeat(1, 1fr); }
  &--cols-2 { grid-template-columns: repeat(2, 1fr); }
  &--cols-3 { grid-template-columns: repeat(3, 1fr); }
  &--cols-4 { grid-template-columns: repeat(4, 1fr); }
  &--cols-5 { grid-template-columns: repeat(5, 1fr); }
  &--cols-6 { grid-template-columns: repeat(6, 1fr); }
  &--cols-12 { grid-template-columns: repeat(12, 1fr); }

  // 响应式
  @include respond-to('md') {
    &--md-cols-1 { grid-template-columns: repeat(1, 1fr); }
    &--md-cols-2 { grid-template-columns: repeat(2, 1fr); }
    &--md-cols-3 { grid-template-columns: repeat(3, 1fr); }
    &--md-cols-4 { grid-template-columns: repeat(4, 1fr); }
    &--md-cols-6 { grid-template-columns: repeat(6, 1fr); }
  }

  @include respond-to('lg') {
    &--lg-cols-2 { grid-template-columns: repeat(2, 1fr); }
    &--lg-cols-3 { grid-template-columns: repeat(3, 1fr); }
    &--lg-cols-4 { grid-template-columns: repeat(4, 1fr); }
    &--lg-cols-6 { grid-template-columns: repeat(6, 1fr); }
    &--lg-cols-12 { grid-template-columns: repeat(12, 1fr); }
  }
}

// Flexbox 布局
.tf-flex {
  display: flex;

  &--inline {
    display: inline-flex;
  }

  // 方向
  &--row {
    flex-direction: row;
  }

  &--column {
    flex-direction: column;
  }

  &--row-reverse {
    flex-direction: row-reverse;
  }

  &--column-reverse {
    flex-direction: column-reverse;
  }

  // 换行
  &--wrap {
    flex-wrap: wrap;
  }

  &--nowrap {
    flex-wrap: nowrap;
  }

  // 主轴对齐
  &--justify-start {
    justify-content: flex-start;
  }

  &--justify-center {
    justify-content: center;
  }

  &--justify-end {
    justify-content: flex-end;
  }

  &--justify-between {
    justify-content: space-between;
  }

  &--justify-around {
    justify-content: space-around;
  }

  // 交叉轴对齐
  &--align-start {
    align-items: flex-start;
  }

  &--align-center {
    align-items: center;
  }

  &--align-end {
    align-items: flex-end;
  }

  &--align-stretch {
    align-items: stretch;
  }

  // 间隙
  &--gap-xs { gap: $spacing-xs; }
  &--gap-sm { gap: $spacing-sm; }
  &--gap-md { gap: $spacing-md; }
  &--gap-lg { gap: $spacing-lg; }
  &--gap-xl { gap: $spacing-xl; }
}
```

### 2. 容器系统

```scss
// layout/_container.scss
.tf-container {
  width: 100%;
  margin: 0 auto;
  padding: 0 $spacing-md;

  &--fluid {
    max-width: none;
    padding: 0;
  }

  &--sm {
    max-width: 540px;
  }

  &--md {
    max-width: 720px;
  }

  &--lg {
    max-width: 960px;
  }

  &--xl {
    max-width: 1140px;
  }

  &--2xl {
    max-width: 1320px;
  }

  // 响应式
  @include respond-to('sm') {
    padding: 0 $spacing-lg;
  }

  @include respond-to('lg') {
    padding: 0 $spacing-xl;
  }
}

// 区块系统
.tf-section {
  padding: $spacing-3xl 0;

  &--small {
    padding: $spacing-xl 0;
  }

  &--large {
    padding: $spacing-4xl 0;
  }

  &--full {
    min-height: 100vh;
    padding: $spacing-3xl 0;
  }

  // 背景色
  &--light {
    background: $gray-50;
  }

  &--dark {
    background: $gray-900;
    color: white;
  }

  &--primary {
    background: linear-gradient(135deg, $primary-color, darken($primary-color, 10%));
    color: white;
  }
}
```

## 🎨 工具类

### 1. 间距工具类

```scss
// utils/_spacing.scss
@each $property, $class in $spacing-utilities {
  @each $size, $value in $spacing-sizes {
    .#{$class}-#{$size} {
      #{$property}: $value;
    }
  }
}

// 特殊间距
.m-auto { margin: auto; }
.mx-auto { margin-left: auto; margin-right: auto; }
.my-auto { margin-top: auto; margin-bottom: auto; }
```

### 2. 文本工具类

```scss
// utils/_text.scss
// 文本对齐
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-justify { text-align: justify; }

// 文本变换
.text-uppercase { text-transform: uppercase; }
.text-lowercase { text-transform: lowercase; }
.text-capitalize { text-transform: capitalize; }

// 文本颜色
.text-primary { color: $primary-color; }
.text-success { color: $success-color; }
.text-warning { color: $warning-color; }
.text-danger { color: $danger-color; }
.text-info { color: $info-color; }

// 字体大小
.text-xs { font-size: $font-size-xs; }
.text-sm { font-size: $font-size-sm; }
.text-base { font-size: $font-size-base; }
.text-lg { font-size: $font-size-lg; }
.text-xl { font-size: $font-size-xl; }
.text-2xl { font-size: $font-size-2xl; }
.text-3xl { font-size: $font-size-3xl; }
.text-4xl { font-size: $font-size-4xl; }

// 字重
.font-light { font-weight: $font-weight-light; }
.font-normal { font-weight: $font-weight-normal; }
.font-medium { font-weight: $font-weight-medium; }
.font-semibold { font-weight: $font-weight-semibold; }
.font-bold { font-weight: $font-weight-bold; }

// 文本截断
.text-truncate {
  @include text-truncate;
}

.text-truncate-2 {
  @include text-truncate-lines(2);
}

.text-truncate-3 {
  @include text-truncate-lines(3);
}
```

### 3. 显示工具类

```scss
// utils/_display.scss
// 显示
.block { display: block; }
.inline { display: inline; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.grid { display: grid; }
.hidden { display: none; }

// 位置
.relative { position: relative; }
.absolute { position: absolute; }
.fixed { position: fixed; }
.sticky { position: sticky; }

// 浮动
.float-left { float: left; }
.float-right { float: right; }
.clearfix {
  @include clearfix;
}

// 溢出
.overflow-hidden { overflow: hidden; }
.overflow-auto { overflow: auto; }
.overflow-scroll { overflow: scroll; }
.overflow-x-hidden { overflow-x: hidden; }
.overflow-y-hidden { overflow-y: hidden; }

// 圆角
.rounded-none { border-radius: 0; }
.rounded-sm { border-radius: 2px; }
.rounded { border-radius: 4px; }
.rounded-lg { border-radius: 8px; }
.rounded-xl { border-radius: 12px; }
.rounded-full { border-radius: 50%; }
```

## 📱 响应式设计

### 1. 移动优先策略

```scss
// base/_responsive.scss
// 移动优先的响应式设计
.mobile-menu {
  display: block;

  @include respond-to('md') {
    display: none;
  }
}

.desktop-menu {
  display: none;

  @include respond-to('md') {
    display: block;
  }
}

// 断点工具类
.visible-xs {
  @include mobile-first('sm') {
    display: none !important;
  }
}

.visible-sm {
  display: none !important;

  @include respond-to('sm') {
    display: block !important;

    @include mobile-first('md') {
      display: none !important;
    }
  }
}

.visible-md {
  display: none !important;

  @include respond-to('md') {
    display: block !important;

    @include mobile-first('lg') {
      display: none !important;
    }
  }
}

.visible-lg {
  display: none !important;

  @include respond-to('lg') {
    display: block !important;
  }
}
```

### 2. 响应式表格

```scss
// components/_responsive-table.scss
.tf-responsive-table {
  width: 100%;
  overflow-x: auto;

  @include mobile-first('md') {
    overflow-x: visible;
  }

  table {
    width: 100%;
    min-width: 600px;

    @include mobile-first('md') {
      min-width: auto;
    }
  }

  // 移动端卡片式布局
  @include mobile-first('md') {
    display: block;

    table {
      display: block;
    }

    thead {
      display: none;
    }

    tbody {
      display: block;
    }

    tr {
      display: block;
      margin-bottom: $spacing-lg;
      border: 1px solid $border-color-base;
      border-radius: 4px;
      padding: $spacing-md;
    }

    td {
      display: block;
      text-align: right;
      padding: $spacing-xs 0;

      &::before {
        content: attr(data-label);
        float: left;
        font-weight: $font-weight-medium;
        color: $text-color-secondary;
      }
    }
  }
}
```

## 🌙 主题系统

### 1. 主题切换

```scss
// themes/_theme-switch.scss
.tf-theme-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: $gray-300;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &--active {
    background: $primary-color;
  }

  &__slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

    .tf-theme-switch--active & {
      transform: translateX(20px);
    }
  }

  &__icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-size: 12px;
    color: $gray-600;

    &--sun {
      left: 6px;
    }

    &--moon {
      right: 6px;
    }
  }
}
```

### 2. 深色主题

```scss
// themes/_dark.scss
[data-theme="dark"] {
  // 基础颜色
  --tf-bg-color: #{$gray-900};
  --tf-bg-color-page: #{$gray-800};
  --tf-bg-color-overlay: #{$gray-700};

  // 文本颜色
  --tf-text-color-primary: #{$gray-100};
  --tf-text-color-regular: #{$gray-300};
  --tf-text-color-secondary: #{$gray-400};
  --tf-text-color-placeholder: #{$gray-500};

  // 边框颜色
  --tf-border-color: #{$gray-700};
  --tf-border-color-light: #{$gray-600};
  --tf-border-color-lighter: #{$gray-500};

  // 卡片背景
  .tf-card {
    background: var(--tf-bg-color-overlay);
    border-color: var(--tf-border-color);

    &__header,
    &__footer {
      border-color: var(--tf-border-color);
    }
  }

  // 表单样式
  .tf-input {
    background: var(--tf-bg-color-overlay);
    border-color: var(--tf-border-color);
    color: var(--tf-text-color-primary);

    &:focus {
      border-color: var(--el-color-primary);
    }
  }

  // 表格样式
  .el-table {
    background: var(--tf-bg-color-overlay);

    th,
    td {
      border-color: var(--tf-border-color);
    }

    th {
      background: var(--tf-bg-color);
    }

    tr:hover > td {
      background: var(--tf-bg-color);
    }
  }
}
```

## 📋 最佳实践

### 1. 样式组织原则

- **组件化**：按组件组织样式，避免全局污染
- **可复用**：提取公共样式，使用混入和变量
- **可维护**：清晰的命名和组织结构
- **性能优化**：避免过度嵌套，减少选择器复杂度

### 2. 书写规范

```scss
// ✅ 推荐
.component-name {
  // 布局属性
  display: flex;
  position: relative;
  top: 0;
  left: 0;

  // 盒模型属性
  width: 100%;
  height: auto;
  margin: 0;
  padding: $spacing-md;
  border: 1px solid $border-color-base;
  border-radius: 4px;

  // 排版属性
  font-size: $font-size-base;
  font-weight: $font-weight-normal;
  line-height: 1.5;
  color: $text-color-primary;
  text-align: left;

  // 视觉属性
  background: white;
  box-shadow: $box-shadow-base;
  opacity: 1;

  // 动画属性
  transition: all 0.3s ease;
  transform: none;

  // 伪类和伪元素
  &:hover {
    background: $gray-50;
  }

  &::before {
    content: '';
    display: block;
  }

  // 嵌套元素
  &__child {
    margin-top: $spacing-sm;
  }

  // 修饰符
  &--active {
    color: $primary-color;
  }
}

// ❌ 避免
.component {
  // 属性顺序混乱
  color: red;
  margin: 10px;
  padding: 5px;
  background: white;
  font-size: 14px;
  display: block;

  // 过度嵌套
  .container {
    .wrapper {
      .content {
        .title {
          .text {
            // 太深的嵌套
          }
        }
      }
    }
  }

  // 使用 !important
  width: 100% !important;
}
```

### 3. 性能优化

```scss
// 避免通配符选择器
// ❌
* {
  box-sizing: border-box;
}

// ✅
*,
*::before,
*::after {
  box-sizing: border-box;
}

// 避免标签选择器
// ❌
div {
  margin: 0;
}

// ✅
.tf-container {
  margin: 0;
}

// 避免复杂选择器
// ❌
.page .content .section .item .title .text {
  font-size: 16px;
}

// ✅
.tf-item__title {
  font-size: 16px;
}
```

## 🔍 故障排除

### 常见问题

1. **样式不生效**
   - 检查选择器优先级
   - 确认样式文件导入顺序
   - 验证 CSS 语法

2. **响应式失效**
   - 检查媒体查询断点
   - 确认 viewport meta 标签
   - 验证盒模型设置

3. **深色主题问题**
   - 检查 CSS 变量定义
   - 确认主题切换逻辑
   - 验证颜色对比度

### 调试技巧

```scss
// 开发环境样式调试
@if (import.meta.env.DEV) {
  .debug {
    outline: 1px solid red;
  }

  .debug-grid {
    background-image: linear-gradient(rgba(255, 0, 0, 0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255, 0, 0, 0.1) 1px, transparent 1px);
    background-size: 20px 20px;
  }
}
```

## 📚 参考资料

- [SCSS 官方文档](https://sass-lang.com/)
- [Element Plus 主题定制](https://element-plus.org/zh-CN/guide/design.html)
- [BEM 命名规范](https://bem.info/)
- [CSS 变量使用指南](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

---

**更新日期**：2025-01-15
**版本**：v1.0.0
**维护者**：TF2025 开发团队