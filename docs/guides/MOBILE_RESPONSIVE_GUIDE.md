# TF2025 移动端响应式设计指南

## 概述

本文档定义了 TF2025 项目的移动端响应式设计规范，确保应用在所有移动设备上都能提供良好的用户体验。

## 核心原则

### 最低适配尺寸
- **最小宽度**: 375px (iPhone SE, iPhone 12 Mini)
- **目标设备**: 所有 iPhone 及 Android 设备（覆盖全部移动终端）

### 设计理念
1. **移动优先**: 所有组件首先考虑移动端体验
2. **渐进增强**: 在移动端基础上增加平板和桌面端特性
3. **一致性**: 保持整个应用的设计语言统一
4. **灵活适配**: 不针对特定像素值，而是使用百分比和相对单位
5. **通用适配**: 适配所有移动终端，而非单个像素尺寸的页面

## 响应式断点

```css
/* 断点定义 - 范围式适配所有移动设备 */
:root {
  /* 最小断点 - 小屏手机 (375px及以上所有手机) */
  --breakpoint-min: 375px;

  /* 小屏手机范围 */
  --breakpoint-xs: 414px;   /* 375px - 479px 小屏手机 */

  /* 中屏手机范围 */
  --breakpoint-sm: 480px;   /* 480px - 767px 中大屏手机 */

  /* 大屏设备范围 */
  --breakpoint-md: 768px;   /* 768px+ 平板/桌面 */

  /* 桌面设备 */
  --breakpoint-lg: 1024px;  /* 1024px+ 平板横屏/小桌面 */
  --breakpoint-xl: 1200px;  /* 1200px+ 标准桌面 */
  --breakpoint-2xl: 1440px; /* 1440px+ 大桌面 */
}

/* 媒体查询 - 统一移动端布局 */
@media (max-width: 767px) {
  /* 适配所有手机（不含iPad） 375-767px - 统一布局 */

  /* 统一单列布局 */
  .grid-2, .grid-3, .grid-4 {
    grid-template-columns: 1fr !important;
  }

  /* 统一触摸优化 */
  .btn, .el-button {
    min-height: 44px !important;
    min-width: 44px !important;
  }

  /* 统一字体大小 - 防止iOS缩放 */
  input, select, textarea {
    font-size: 16px !important;
  }
}

/* iPad 单独适配 */
@media (min-width: 768px) and (max-width: 1023px) {
  /* iPad 特殊布局 */
  .grid-2, .grid-3 {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### 支持的设备尺寸
- **iPhone SE (375×667)**: 375px 宽度
- **iPhone SE 2022 (390×844)**: 390px 宽度
- **iPhone 12/13 (390×844)**: 390px 宽度
- **iPhone 14 (393×852)**: 393px 宽度
- **iPhone 14 Plus (428×926)**: 428px 宽度
- **iPhone 15/16 (393×852)**: 393px 宽度
- **iPhone Plus (414×736)**: 414px 宽度
- **Android 小屏 (360px+)**: 各种 Android 设备
- **Android 中屏 (375-480px)**: 主流 Android 设备
- **Android 大屏 (480px+)**: 大屏 Android 设备

**重要说明**: 系统采用范围式适配策略，确保从最小宽度 375px 开始的所有移动终端都能获得良好体验。

## 布局规范

### 1. 网格系统

#### 移动端 (375px - 767px)
```scss
.grid-container {
  display: grid;
  gap: 12px;

  /* 默认单列 - 适配所有小屏手机 */
  grid-template-columns: 1fr;

  /* 特殊两列布局（仅在内容允许时使用） */
  &.two-cols-mobile {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
}

/* 使用范围式媒体查询 */
@media (max-width: 767px) {
  /* 所有移动设备的通用样式 */
  .grid-container {
    padding: 0 16px;
  }
}

@media (max-width: 479px) {
  /* 小屏手机的特殊调整 */
  .grid-container {
    padding: 0 12px;
    gap: 8px;
  }
}
```

#### 平板及以上 (≥ 480px)
```scss
.grid-container {
  &.two-cols {
    grid-template-columns: repeat(2, 1fr);
  }

  &.three-cols {
    grid-template-columns: repeat(3, 1fr);
  }

  &.four-cols {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### 2. 模态框规范

#### 移动端 (375px - 767px)
```scss
.modal,
.el-dialog,
.modern-modal {
  /* 移动端通用适配 */
  @media (max-width: 767px) {
    width: 95vw;
    max-height: 90vh;
    margin: 0 auto;
    border-radius: 12px;

    .modal-header,
    .el-dialog__header,
    .modern-modal-header {
      padding: 16px 20px;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .modal-body,
    .el-dialog__body,
    .modern-modal-body {
      padding: 16px 20px;
      max-height: calc(90vh - 140px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .modal-footer,
    .el-dialog__footer,
    .modern-modal-footer {
      padding: 16px 20px;
      position: sticky;
      bottom: 0;
    }
  }

  /* 统一移动端优化 - 所有手机 */
  @media (max-width: 767px) {
    width: 95vw;
    max-height: 90vh;
    border-radius: 12px;

    .modal-header,
    .el-dialog__header,
    .modern-modal-header {
      padding: 16px 20px;
    }

    .modal-body,
    .el-dialog__body,
    .modern-modal-body {
      padding: 16px 20px;
      max-height: calc(90vh - 140px);
    }

    .modal-footer,
    .el-dialog__footer,
    .modern-modal-footer {
      padding: 16px 20px;
    }
  }

  /* 小屏手机特殊优化 */
  @media (max-width: 479px) {
    width: 98vw;
    max-height: 92vh;
    border-radius: 8px;

    .modal-header,
    .el-dialog__header,
    .modern-modal-header {
      padding: 12px 16px;
    }

    .modal-body,
    .el-dialog__body,
    .modern-modal-body {
      padding: 12px 16px;
      max-height: calc(92vh - 120px);
    }

    .modal-footer,
    .el-dialog__footer,
    .modern-modal-footer {
      padding: 12px 16px;
    }
  }
}
```

### 3. 表单规范

#### 字段布局
```scss
.form-row {
  /* 统一移动端单列布局 - 所有手机相同 */
  @media (max-width: 767px) {
    grid-template-columns: 1fr !important;
    gap: 12px;
  }

  /* iPad 特殊布局 */
  @media (min-width: 768px) and (max-width: 1023px) {
    &.two-cols-tablet {
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    &.three-cols-tablet {
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
  }

  /* 桌面端多列布局 */
  @media (min-width: 1024px) {
    &.two-cols-desktop {
      grid-template-columns: 1fr 1fr;
    }

    &.three-cols-desktop {
      grid-template-columns: repeat(3, 1fr);
    }
  }
}
```

#### 输入框尺寸
```scss
:deep(.el-input__wrapper) {
  min-height: 44px; /* iOS 触摸最小尺寸 */
  padding: 0 12px;
}

:deep(.el-form-item__label) {
  font-size: 14px;
  margin-bottom: 4px;
}
```

## 组件规范

### 1. 按钮

#### 最小触摸尺寸
- **高度**: 44px (iOS 推荐)
- **宽度**: 44px (正方形按钮) 或最小 88px (文字按钮)
- **间距**: 12px (按钮之间)

```scss
.btn {
  min-height: 44px;
  min-width: 44px;
  padding: 0 16px;
  font-size: 14px;

  /* 小按钮例外 */
  &.btn-small {
    min-height: 36px;
    font-size: 12px;
  }
}
```

### 2. 导航栏

#### 移动端导航
```scss
.navbar {
  height: 56px; /* Material Design 标准 */
  padding: 0 16px;

  /* 品牌标题 */
  .brand {
    font-size: 18px;
  }

  /* 汉堡菜单 */
  .menu-toggle {
    display: block;
    width: 44px;
    height: 44px;
  }
}
```

### 3. 表格

#### 移动端表格处理
```scss
.table-mobile {
  /* 卡片式布局 */
  @media (max-width: 479px) {
    thead { display: none; }

    tbody, tr, td {
      display: block;
      width: 100%;
    }

    tr {
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }

    td {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border: none;

      &::before {
        content: attr(data-label);
        font-weight: 600;
      }
    }
  }
}
```

## 交互规范

### 1. 触摸优化
- 所有可点击元素最小 44×44px
- 避免误触的间距设计
- 提供触摸反馈（状态变化）

### 2. 滚动优化
```css
.scroll-container {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

### 3. 手势支持
- 支持左右滑动切换
- 支持下拉刷新
- 支持上拉加载

## 字体规范

### 移动端字体大小
```css
/* 基础字体 */
body {
  font-size: 14px;
  line-height: 1.5;
}

/* 标题字体 */
h1 { font-size: 24px; } /* 大标题 */
h2 { font-size: 20px; } /* 页面标题 */
h3 { font-size: 18px; } /* 区块标题 */
h4 { font-size: 16px; } /* 小标题 */

/* 表单字体 */
.el-form-item__label { font-size: 14px; }
.el-input__inner { font-size: 14px; }
```

## 安全区域适配

### iPhone X 及以上
```css
.safe-area-padding {
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}
```

## 特殊考虑

### 1. 横屏适配
```css
@media (max-width: 844px) and (orientation: landscape) {
  .modal {
    .modal-body {
      max-height: calc(100vh - 100px);
    }
  }
}
```

### 2. 高DPI屏幕
```css
@media (-webkit-min-device-pixel-ratio: 2) {
  /* Retina 屏幕优化 */
  .icon {
    background-image: url(icon@2x.png);
    background-size: 50%;
  }
}
```

### 3. 暗黑模式
```css
@media (prefers-color-scheme: dark) {
  /* 暗黑模式样式 */
  .card {
    background: #1f2937;
    color: #f9fafb;
  }
}
```

## 测试要求

### 设备测试清单
- [ ] iPhone SE (390×844) ✓
- [ ] iPhone 12/13 (390×844)
- [ ] iPhone 14/15 Plus (428×926)
- [ ] iPad Mini (768×1024)
- [ ] iPad Air/Pro (1024×1366)

### 浏览器测试
- [ ] Safari (iOS)
- [ ] Chrome (Android)
- [ ] 微信内置浏览器
- [ ] 支付宝小程序

## 常见问题

### 1. 横向滚动
**原因**: 元素宽度超出视口
**解决**: 检查所有固定宽度元素

### 2. 触摸延迟
**原因**: 未使用 `touch-action` CSS 属性
**解决**: 添加 `touch-action: manipulation`

### 3. 输入框缩放
**原因**: 字体大小小于 16px
**解决**: 输入框字体大小至少 16px

## 最佳实践

### 1. 使用相对单位
```css
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}
```

### 2. 灵活的图片
```css
img {
  max-width: 100%;
  height: auto;
}
```

### 3. 优雅降级
```javascript
// 检测功能支持
if ('IntersectionObserver' in window) {
  // 使用 Intersection Observer
} else {
  // 使用传统 scroll 事件
}
```

## 实现指南

### 1. 使用统一响应式文件
所有项目应引入 `/frontend/src/styles/responsive.scss` 文件，包含完整的移动端适配规则。

### 2. 断点使用原则
```scss
/* ✅ 正确：使用范围式适配 */
@media (max-width: 767px) { /* 所有移动设备 */ }
@media (max-width: 479px) { /* 小屏手机 */ }

/* ❌ 错误：针对特定像素值 */
@media (max-width: 390px) { /* 只适配390px */ }
@media (width: 375px) { /* 只适配375px */ }
```

### 3. 适配检查清单
- [ ] 使用相对单位（%, rem, em, vw, vh）
- [ ] 最小触摸尺寸 44px
- [ ] 安全区域适配（iPhone X+）
- [ ] 横屏兼容性
- [ ] 防止横向滚动
- [ ] 优化滚动体验

## 更新记录

## 统一移动端布局策略

### 设计原则
从 2025-12-20 开始，项目采用统一的移动端布局策略：

1. **统一移动端体验**：所有手机设备（375px-767px）使用相同布局
2. **iPad独立适配**：768px-1023px 可有特殊布局
3. **桌面端渐进增强**：1024px+ 提供更丰富的功能

### 断点分配
```scss
// 统一移动端 - 所有手机相同
@media (max-width: 767px) { /* iPhone SE 到 iPhone 15 Plus */ }

// iPad 单独适配
@media (min-width: 768px) and (max-width: 1023px) { /* iPad Mini 到 iPad Pro */ }

// 桌面端
@media (min-width: 1024px) { /* MacBook 及以上 */ }
```

### 实现要点
1. **避免分级断点**：不再使用 479px、480px 等细分断点
2. **统一组件尺寸**：所有手机使用相同的触摸目标、字体大小
3. **简化开发**：减少针对特定屏幕的样式调整

## 更新记录

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2025-12-20 | 1.0.0 | 初始版本，定义 390×844 最低适配标准 |
| 2025-12-20 | 1.1.0 | 更新为通用适配策略，支持所有移动终端而非特定像素尺寸 |
| 2025-12-20 | 1.2.0 | **统一移动端布局**：所有手机（不含iPad）使用统一布局，iPad 独立适配 |