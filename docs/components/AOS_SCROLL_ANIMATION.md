# AOS 滚动动画使用指南

## 📦 安装

已安装 `aos@next`

## 🚀 快速开始

### 1. 基础用法

在任何元素上添加 `data-aos` 属性：

```vue
<template>
  <div data-aos="fade-up">向上淡入</div>
  <div data-aos="fade-down">向下淡入</div>
  <div data-aos="zoom-in">缩放淡入</div>
  <div data-aos="flip-left">左翻转</div>
</template>
```

### 2. 延迟动画

```vue
<template>
  <!-- 固定延迟 -->
  <div data-aos="fade-up" data-aos-delay="100">延迟100ms</div>

  <!-- 动态延迟（列表） -->
  <div
    v-for="(item, index) in items"
    :key="index"
    data-aos="fade-up"
    :data-aos-delay="index * 100"
  >
    {{ item.name }}
  </div>
</template>
```

### 3. 自定义持续时间

```vue
<template>
  <div data-aos="fade-up" data-aos-duration="500">快速 (500ms)</div>
  <div data-aos="fade-up" data-aos-duration="1000">正常 (1000ms)</div>
  <div data-aos="fade-up" data-aos-duration="2000">缓慢 (2000ms)</div>
</template>
```

### 4. 缓动函数

```vue
<template>
  <div data-aos="fade-up" data-aos-easing="linear">Linear</div>
  <div data-aos="fade-up" data-aos-easing="ease">Ease</div>
  <div data-aos="fade-up" data-aos-easing="ease-in-out">Ease In Out</div>
  <div data-aos="fade-up" data-aos-easing="ease-out-cubic">Ease Out Cubic</div>
</template>
```

## 🎨 可用动画效果

### 淡入效果 (Fade)

| 动画 | 属性值 | 效果 |
|------|--------|------|
| 向上淡入 | `fade-up` | 从下向上淡入 |
| 向下淡入 | `fade-down` | 从上向下淡入 |
| 向右淡入 | `fade-right` | 从左向右淡入 |
| 向左淡入 | `fade-left` | 从右向左淡入 |
| 右上淡入 | `fade-up-right` | 从左下向右上淡入 |
| 左上淡入 | `fade-up-left` | 从右下向左上淡入 |
| 右下淡入 | `fade-down-right` | 从左上向右下淡入 |
| 左下淡入 | `fade-down-left` | 从右上向左下淡入 |

### 翻转效果 (Flip)

| 动画 | 属性值 | 效果 |
|------|--------|------|
| 左翻转 | `flip-left` | 沿Y轴向左翻转 |
| 右翻转 | `flip-right` | 沿Y轴向右翻转 |
| 上翻转 | `flip-up` | 沿X轴向上翻转 |
| 下翻转 | `flip-down` | 沿X轴向下翻转 |

### 缩放效果 (Zoom)

| 动画 | 属性值 | 效果 |
|------|--------|------|
| 放大 | `zoom-in` | 从小到大放大 |
| 放大向上 | `zoom-in-up` | 放大并向上移动 |
| 放大向下 | `zoom-in-down` | 放大并向下移动 |
| 放大向右 | `zoom-in-right` | 放大并向右移动 |
| 放大向左 | `zoom-in-left` | 放大并向左移动 |
| 缩小 | `zoom-out` | 从大到小缩小 |

### 滑动效果 (Slide)

| 动画 | 属性值 | 效果 |
|------|--------|------|
| 向上滑动 | `slide-up` | 从下向上滑入 |
| 向下滑动 | `slide-down` | 从上向下滑入 |
| 向右滑动 | `slide-right` | 从左向右滑入 |
| 向左滑动 | `slide-left` | 从右向左滑入 |

## 📋 所有属性

| 属性 | 值类型 | 默认值 | 说明 |
|------|--------|--------|------|
| `data-aos` | string | - | 动画效果名称 |
| `data-aos-duration` | number | 600 | 动画持续时间（毫秒） |
| `data-aos-delay` | number | 0 | 动画延迟时间（毫秒） |
| `data-aos-offset` | number | 120 | 触发动画的偏移量（像素） |
| `data-aos-easing` | string | ease | 缓动函数 |
| `data-aos-once` | boolean | true | 是否只执行一次 |
| `data-aos-mirror` | boolean | false | 向上滚动时是否重复动画 |
| `data-aos-anchor` | string | null | 锚点元素选择器 |
| `data-aos-anchor-placement` | string | top-bottom | 锚点位置 |

## 🎯 缓动函数

- `linear` - 线性
- `ease` - 平滑
- `ease-in` - 加速
- `ease-out` - 减速
- `ease-in-out` - 加速然后减速
- `ease-in-back` - 回弹加速
- `ease-out-back` - 回弹减速
- `ease-in-out-back` - 回弹加速减速
- `ease-in-sine` - 正弦加速
- `ease-out-sine` - 正弦减速
- `ease-in-out-sine` - 正弦加速减速
- `ease-in-quad` - 二次方加速
- `ease-out-quad` - 二次方减速
- `ease-in-out-quad` - 二次方加速减速
- `ease-in-cubic` - 三次方加速
- `ease-out-cubic` - 三次方减速
- `ease-in-out-cubic` - 三次方加速减速
- `ease-in-quart` - 四次方加速
- `ease-out-quart` - 四次方减速
- `ease-in-out-quart` - 四次方加速减速

## 🌐 锚点位置

- `top-bottom` - 元素顶部到达视口底部
- `top-center` - 元素顶部到达视口中心
- `top-top` - 元素顶部到达视口顶部
- `center-bottom` - 元素中心到达视口底部
- `center-center` - 元素中心到达视口中心
- `center-top` - 元素中心到达视口顶部
- `bottom-bottom` - 元素底部到达视口底部
- `bottom-center` - 元素底部到达视口中心
- `bottom-top` - 元素底部到达视口顶部

## 💡 实用示例

### 示例 1: 统计卡片依次出现

```vue
<template>
  <div class="stats-grid">
    <div
      v-for="(stat, index) in stats"
      :key="index"
      data-aos="fade-up"
      :data-aos-delay="index * 100"
      class="stat-card"
    >
      <div class="stat-value">{{ stat.value }}</div>
      <div class="stat-label">{{ stat.label }}</div>
    </div>
  </div>
</template>
```

### 示例 2: 内容区块左右交替

```vue
<template>
  <div>
    <div data-aos="fade-right" class="content-row">
      <img src="image1.jpg" alt="">
      <div class="content">左侧内容</div>
    </div>
    <div data-aos="fade-left" class="content-row">
      <div class="content">右侧内容</div>
      <img src="image2.jpg" alt="">
    </div>
  </div>
</template>
```

### 示例 3: 列表项逐个进入

```vue
<template>
  <div class="list">
    <div
      v-for="(item, index) in items"
      :key="item.id"
      data-aos="slide-right"
      :data-aos-delay="index * 150"
      data-aos-duration="600"
      class="list-item"
    >
      {{ item.text }}
    </div>
  </div>
</template>
```

### 示例 4: 卡片网格

```vue
<template>
  <div class="card-grid">
    <div
      v-for="i in 6"
      :key="i"
      data-aos="zoom-in"
      :data-aos-delay="(i - 1) * 100"
      class="card"
    >
      卡片 {{ i }}
    </div>
  </div>
</template>
```

## 🔧 高级配置

### 禁用移动端动画

```typescript
import AOS from 'aos'

AOS.init({
  disable: window.innerWidth < 768 ? 'mobile' : false
})
```

### 动态刷新

```typescript
import { refreshScrollAnimations } from '@/utils/scrollAnimation'

// 在 DOM 更新后调用
refreshScrollAnimations()
```

### 编程方式触发

```typescript
import AOS from 'aos'

// 刷新
AOS.refresh()

// 硬刷新
AOS.refreshHard()

### 全局配置

已在 `main.ts` 中配置：

```typescript
import { initScrollAnimations } from '@/utils/scrollAnimation'

initScrollAnimations()
```

默认配置：
- duration: 800ms
- easing: ease-out-cubic
- once: true (只执行一次)
- offset: 50px
- 禁用移动端（< 768px）

## 📱 最佳实践

1. **性能考虑**
   - 使用 `once: true` 避免重复动画
   - 在移动端禁用动画
   - 避免过多元素同时动画

2. **用户体验**
   - 重要内容使用明显动画
   - 次要内容使用微动画
   - 列表使用渐进式延迟

3. **组合使用**
   - 页面标题：fade-down
   - 统计卡片：fade-up + delay
   - 内容区块：fade-left/fade-right
   - 数据表格：fade-up

## 🎨 综合查询页面已集成

已为以下部分添加滚动动画：

1. **页面头部** - fade-down (600ms)
2. **统计卡片** - fade-up (依次延迟 100ms)
3. **搜索区域** - fade-up (延迟 400ms)
4. **数据表格** - fade-up (延迟 600ms)

查看效果：访问综合查询页面并向下滚动。
