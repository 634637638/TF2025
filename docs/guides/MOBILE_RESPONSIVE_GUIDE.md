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
移动端布局断点由 `frontend/src/config/breakpoints.ts` 定义：小屏手机最大宽度 `479px`、手机最大宽度 `767px`、平板从 `768px` 起。后台桌面壳的导航切换由同一配置中的 `DESKTOP_MIN` 和导航判断函数维护，详见[移动端开发规范](mobile-development-standards.md)。不要在专题页面复制断点变量或通用按钮规则。
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

**重要说明**: 系统采用范围式适配策略，确保从最小宽度 375px 开始的所有移动终端都能获得良好体验。桌面固定侧栏与基础后台布局统一按视口宽度从 1025px 开始；1200px 仅作为更宽屏幕的增强阈值，不参与左侧菜单的显隐判断。左侧菜单的桌面/移动切换不得再依赖 UA、触摸能力或设备类型。

## 布局规范

### 统一展示要求

- 手机端必须优先保证完整展示，宁可字体再小一点，也不要遮挡、裁切或错位。
- 两列信息卡在手机端可以继续保持两列，但左右留白、卡片内边距和字号必须由公共规则统一控制。
- 保存图片的导出态必须和正常展示态使用同一套布局来源，不能单独写一套不同的手机样式。
- 375px 及以下仍然要保持可读和可操作，避免按单机型单独补丁式修复。

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

#### 平板及以上 (≥ 768px)
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
弹窗统一由 `frontend/src/components/MobileDialog.vue` 和
`frontend/src/styles/components/_dialog.scss` 维护。该入口统一处理 PC、iPad、手机的宽度边界、
标题栏、正文滚动、footer、安全区和按钮布局。底部操作使用
`frontend/src/styles/components/_dialog-actions.scss`，页面只负责业务内容布局。

不要在 `responsive.scss`、页面 `<style>` 或新组件中复制 `.el-dialog`、`.modal` 的通用外壳规则。
新建弹窗请优先使用 `MobileDialog`；必须使用 `el-dialog` 时直接复用全局样式，并在移动端验证
正文可滚动、footer 可操作和按钮不被安全区遮挡。

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
  @media (min-width: 768px) and (max-width: 1024px) {
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
  @media (min-width: 1025px) {
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

按钮语义、颜色、尺寸、触摸目标和移动端适配统一遵循[全局按钮规范](../frontend/button-standards.md)。专题页面不得重新定义 `.btn`、`.btn-small` 或覆盖 Element Plus 按钮的公共尺寸。

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

字体由 `frontend/src/styles.scss` 和 `frontend/src/styles/responsive.scss` 的公共令牌统一控制。禁止使用 `p, span` 等宽泛选择器覆盖业务字段字号；Android Chrome 的文字自动调整由全局 `text-size-adjust: 100%` 统一关闭。`375px` 及以下仅收紧正文、标签和表格字号，输入框继续使用 `16px`，以兼容 iOS Safari 聚焦行为。

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
当前项目采用统一的移动端布局策略：

1. **统一移动端体验**：所有手机设备（375px-767px）使用相同布局
2. **iPad独立适配**：768px-1023px 可有特殊布局
3. **桌面端渐进增强**：1025px+ 提供更丰富的功能

### 断点分配
```scss
// 统一移动端 - 所有手机相同
@media (max-width: 767px) { /* iPhone SE 到 iPhone 15 Plus */ }

// iPad 单独适配
@media (min-width: 768px) and (max-width: 1024px) { /* iPad Mini 到 iPad Pro */ }

// 桌面端
@media (min-width: 1025px) { /* MacBook 及以上 */ }
```

### 实现要点
1. **减少分级断点**：公共布局只使用 375、479、767、768、1024、1025、1200、1440；组件确需内容尺寸阈值时必须登记并由响应式审计守护
2. **统一组件尺寸**：所有手机使用相同的触摸目标、字体大小
3. **简化开发**：减少针对特定屏幕的样式调整

## 更新记录

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2025-12-20 | 1.0.0 | 初始版本，定义 390×844 最低适配标准 |
| 2025-12-20 | 1.1.0 | 更新为通用适配策略，支持所有移动终端而非特定像素尺寸 |
| 2025-12-20 | 1.2.0 | **统一移动端布局**：所有手机（不含iPad）使用统一布局，iPad 独立适配 |
