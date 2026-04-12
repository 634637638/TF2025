# TF2025 组件开发规范

> **文档说明**：定义 TF2025 项目中 Vue 组件的开发、命名、使用和维护规范，确保组件的一致性、可维护性和复用性
>
> **最后更新**：2025-12-20
> **版本**：v2.0.0
> **维护者**：TF2025 开发团队

## 概述

本文档定义了TF2025项目中Vue组件的开发规范，确保组件的一致性、可维护性和复用性。所有组件开发必须遵循本规范。

## 🎯 设计原则

1. **单一职责**：每个组件只负责一个功能
2. **可复用性**：组件应该高度可配置和可复用
3. **可测试性**：组件应该易于单元测试
4. **类型安全**：使用TypeScript确保类型安全
5. **性能优化**：避免不必要的渲染和内存泄漏

## 🏗️ 组件结构

### 1. 目录结构

```
src/components/
├── common/              # 通用组件
│   ├── BaseButton.vue  # 基础按钮
│   ├── BaseInput.vue   # 基础输入框
│   └── BaseModal.vue   # 基础模态框
├── business/           # 业务组件
│   ├── UserSelector.vue
│   ├── OrderForm.vue
│   └── ProductCard.vue
└── layout/            # 布局组件
    ├── PageHeader.vue
    ├── Sidebar.vue
    └── Footer.vue
```

### 2. 文件命名规范

```bash
# 组件文件命名（PascalCase）
UserProfile.vue
OrderForm.vue
DataModal.vue

# 测试文件命名
UserProfile.spec.ts
OrderForm.test.ts

# 样式文件命名
UserProfile.module.scss
order-form.scss
```

## 📝 组件定义规范

### 1. 基础模板

```vue
<template>
  <!-- 使用语义化标签 -->
  <div class="component-name" :class="componentClasses">
    <!-- 插槽内容 -->
    <slot v-if="$slots.default" />

    <!-- 条件渲染 -->
    <div v-if="showContent" class="content">
      {{ content }}
    </div>

    <!-- 列表渲染 -->
    <ul v-if="items.length" class="item-list">
      <li v-for="item in items" :key="item.id" class="item">
        {{ item.name }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// 1. 导入依赖
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { ComponentProps, ComponentEmits } from './types'

// 2. Props定义（使用interface）
interface Props {
  title?: string
  content?: string
  items?: Array<{ id: number; name: string }>
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
}

// 3. 使用withDefaults设置默认值
const props = withDefaults(defineProps<Props>(), {
  title: '',
  content: '',
  items: () => [],
  disabled: false,
  variant: 'primary'
})

// 4. Emits定义（使用interface）
interface Emits {
  update: [value: string]
  change: [event: Event]
  submit: [formData: FormData]
}

const emit = defineEmits<Emits>()

// 5. 响应式数据
const isLoading = ref(false)
const internalValue = ref(props.content)

// 6. 计算属性
const componentClasses = computed(() => ({
  'component-name': true,
  'component-name--disabled': props.disabled,
  'component-name--loading': isLoading.value,
  [`component-name--${props.variant}`]: props.variant
}))

const showContent = computed(() => !!props.content)

// 7. 方法定义
const handleClick = (event: Event) => {
  if (props.disabled) return

  emit('change', event)
  emit('update', internalValue.value)
}

// 8. 监听器
watch(
  () => props.content,
  (newValue) => {
    internalValue.value = newValue
  }
)

// 9. 生命周期
onMounted(() => {
  // 初始化逻辑
})

onUnmounted(() => {
  // 清理逻辑
})

// 10. 暴露给父组件的方法或属性
defineExpose({
  internalValue,
  reset: () => { internalValue.value = '' }
})
</script>

<style lang="scss" scoped>
// 使用BEM命名规范
.component-name {
  // 基础样式

  // 修饰符
  &--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--loading {
    pointer-events: none;
  }

  &--primary {
    background-color: var(--color-primary);
  }

  // 元素
  &__content {
    padding: var(--spacing-md);
  }

  &__item {
    margin-bottom: var(--spacing-sm);

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
```

### 2. Props定义规范

```typescript
// 使用interface定义Props
interface ButtonProps {
  // 必填属性
  label: string

  // 可选属性
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
  icon?: string
  fullWidth?: boolean

  // 事件处理器
  onClick?: (event: MouseEvent) => void

  // 复杂对象
  style?: CSSProperties
  class?: ClassValue
}

// 使用withDefaults设置默认值
const props = withDefaults(defineProps<ButtonProps>(), {
  type: 'button',
  variant: 'primary',
  size: 'medium',
  disabled: false,
  loading: false,
  fullWidth: false
})

// 复杂默认值
const props = withDefaults(defineProps<FormProps>(), {
  rules: () => ({
    required: true,
    message: '此字段为必填项',
    trigger: 'blur'
  })
})
```

### 3. Emits定义规范

```typescript
// 使用interface定义Emits
interface ModalEmits {
  // 更新事件
  'update:modelValue': [value: boolean]

  // 业务事件
  confirm: [data: any]
  cancel: []

  // 自定义事件
  'custom-event': [payload: { id: number; name: string }]
}

const emit = defineEmits<ModalEmits>()

// 使用emit
const handleConfirm = () => {
  emit('confirm', { id: 1, name: 'test' })
  emit('update:modelValue', false)
}
```

## 🎨 样式规范

### 1. CSS组织

```scss
<style lang="scss" scoped>
// 1. 变量定义
@use '@/styles/variables' as *;

// 2. 基础样式
.component-name {
  // 定位
  position: relative;

  // 盒模型
  display: flex;
  padding: var(--spacing-md);

  // 字体
  font-size: var(--font-size-base);
  color: var(--color-text);

  // 背景
  background-color: var(--color-bg);

  // 边框
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);

  // 阴影
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  // 过渡
  transition: all 0.3s ease;

  // 修饰符
  &--disabled {
    opacity: 0.6;
    pointer-events: none;
    cursor: not-allowed;
  }

  &--loading {
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.8);
      z-index: 1;
    }
  }

  // 状态
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  &:active {
    transform: translateY(0);
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-primary);
  }

  // 元素
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  &__title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  &__content {
    flex: 1;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
  }

  // 子组件样式
  .child-component {
    margin: var(--spacing-sm);
  }
}
</style>
```

### 2. BEM命名规范

```scss
// Block: .button
.button {
  // Element: .button__icon
  &__icon {
    margin-right: 8px;
  }

  // Element: .button__text
  &__text {
    font-weight: 500;
  }

  // Modifier: .button--primary
  &--primary {
    background-color: var(--color-primary);
    color: white;

    &:hover {
      background-color: var(--color-primary-dark);
    }
  }

  // Modifier: .button--large
  &--large {
    padding: 12px 24px;
    font-size: 16px;
  }
}
```

## 🔄 组件通信

### 1. Props向下传递

```vue
<!-- 父组件 -->
<template>
  <ChildComponent
    :data="parentData"
    :config="parentConfig"
    @update="handleChildUpdate"
  />
</template>

<!-- 子组件 -->
<script setup lang="ts">
interface Props {
  data: any[]
  config: ComponentConfig
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [value: any]
}>()
</script>
```

### 2. 事件向上传递

```typescript
// 子组件
const handleClick = () => {
  emit('update', newValue)
  emit('custom-event', payload)
}

// 父组件
const handleChildUpdate = (value: any) => {
  // 处理更新
}
```

### 3. 插槽（Slots）

```vue
<!-- 子组件 -->
<template>
  <div class="card">
    <header class="card__header">
      <slot name="header" :title="title">
        <h2>{{ title }}</h2>
      </slot>
    </header>

    <main class="card__content">
      <slot />
    </main>

    <footer class="card__footer">
      <slot name="footer" :actions="footerActions">
        <button v-for="action in footerActions" :key="action.id">
          {{ action.label }}
        </button>
      </slot>
    </footer>
  </div>
</template>

<!-- 父组件 -->
<template>
  <ChildComponent title="Card Title">
    <!-- 默认插槽 -->
    <p>This is the card content</p>

    <!-- 具名插槽 -->
    <template #header="{ title }">
      <h1>Custom Header: {{ title }}</h1>
    </template>

    <template #footer="{ actions }">
      <button @click="handleCustomAction">Custom Action</button>
    </template>
  </ChildComponent>
</template>
```

### 4. Provide / Inject

```typescript
// 父组件提供数据
import { provide, ref } from 'vue'

const theme = ref('light')
const userSettings = ref({})

provide('theme', theme)
provide('userSettings', userSettings)

// 子组件注入数据
import { inject } from 'vue'

const theme = inject<Ref<string>>('theme')
const userSettings = inject<Ref<any>>('userSettings')
```

## 🧪 组件测试

### 1. 单元测试

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import Component from './Component.vue'

describe('Component', () => {
  it('应该正确渲染Props', () => {
    const wrapper = mount(Component, {
      props: {
        title: 'Test Title',
        disabled: false
      }
    })

    expect(wrapper.text()).toContain('Test Title')
    expect(wrapper.classes()).not.toContain('component--disabled')
  })

  it('应该正确响应事件', async () => {
    const wrapper = mount(Component)

    await wrapper.trigger('click')

    expect(wrapper.emitted()).toHaveProperty('change')
    expect(wrapper.emitted('change')).toHaveLength(1)
  })

  it('应该正确处理插槽', () => {
    const wrapper = mount(Component, {
      slots: {
        default: 'Custom content'
      }
    })

    expect(wrapper.text()).toContain('Custom content')
  })
})
```

### 2. 组件快照

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import Component from './Component.vue'

describe('Component Snapshot', () => {
  it('应该匹配快照', () => {
    const wrapper = mount(Component, {
      props: {
        title: 'Test Title'
      }
    })

    expect(wrapper.html()).toMatchSnapshot()
  })
})
```

## 🚀 性能优化

### 1. 避免不必要的渲染

```typescript
import { computed, shallowRef } from 'vue'

// 使用shallowRef减少深度响应式
const items = shallowRef([])

// 使用计算属性缓存
const filteredItems = computed(() => {
  return items.value.filter(item => item.active)
})
```

### 2. 懒加载组件

```typescript
import { defineAsyncComponent } from 'vue'

const HeavyComponent = defineAsyncComponent(() =>
  import('./HeavyComponent.vue')
)

// 带加载状态的异步组件
const AsyncComponent = defineAsyncComponent({
  loader: () => import('./Component.vue'),
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 3000
})
```

### 3. 事件处理优化

```vue
<template>
  <!-- 使用事件委托 -->
  <ul @click="handleListClick">
    <li v-for="item in items" :key="item.id" :data-id="item.id">
      {{ item.name }}
    </li>
  </ul>
</template>

<script setup lang="ts">
const handleListClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const itemId = target.dataset.id

  if (itemId) {
    handleItemClick(parseInt(itemId))
  }
}
</script>
```

## 📝 最佳实践

### 1. 组件设计原则

```typescript
// ✅ 好的设计
interface ButtonProps {
  // 明确的API
  variant: 'primary' | 'secondary'
  size: 'small' | 'medium' | 'large'
  disabled: boolean
  loading: boolean
}

// ❌ 避免的设计
interface BadButtonProps {
  // 不明确的布尔值
  primary?: boolean
  secondary?: boolean
  large?: boolean
  isLoading?: boolean
}
```

### 2. 使用Composition API

```typescript
// ✅ 使用组合式函数
import { useCounter } from '@/composables/useCounter'
import { useApi } from '@/composables/useApi'

const { count, increment, decrement } = useCounter()
const { data, loading, error } = useApi('/api/data')
```

### 3. 类型安全

```typescript
// ✅ 完整的类型定义
interface User {
  id: number
  name: string
  email: string
  createdAt: Date
}

interface UserListProps {
  users: User[]
  onSelect: (user: User) => void
}

// ❌ 缺少类型
const props = defineProps({
  users: Array,
  onSelect: Function
})
```

### 4. 可访问性

```vue
<template>
  <!-- 语义化标签 -->
  <button
    :disabled="disabled"
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <span v-if="loading" aria-hidden="true">
      <LoadingIcon />
    </span>
    <span v-else>
      <slot />
    </span>
  </button>
</template>
```

## 📋 组件使用标准

### 1. 图片组件标准

**必须使用 Image 组件的场景：**
- ✅ 所有业务图片展示
- ✅ 需要懒加载的图片
- ✅ 需要URL降级的图片（HTTP/HTTPS兼容）
- ✅ 需要默认图片和错误处理的场景

```vue
<!-- ✅ 标准：使用统一的 Image 组件 -->
<Image src="/uploads/product.jpg" alt="产品图片" />
<Image src="product.image" mode="lazy" width="200" height="200" />
<Image src="xxx.jpg" mode="smart" />  <!-- 智能降级 -->

<!-- 组件模式说明：
  - eager: 默认模式，立即加载
  - lazy: 懒加载模式，进入视口才加载
  - smart: 智能模式，支持HTTP/HTTPS降级
-->

<!-- ⚠️ 兼容别名（保留但不推荐新代码使用） -->
<AppImage :src="product.image" alt="产品图片" />
```

**禁止使用：**
- ❌ `SmartImage`（已删除）
- ❌ `LazyImage`（已删除）
- ❌ 直接使用 `<img>` 标签处理业务图片

### 2. 弹窗组件标准

**必须使用 MobileDialog 的场景：**
- ✅ 所有业务相关弹窗（表单、详情、编辑等）
- ✅ 需要响应式设计的弹窗
- ✅ 需要统一确认/取消按钮的弹窗

**可以使用其他场景：**
- ⚠️ 简单提示框（使用 ElMessageBox）
- ⚠️ 特殊自定义弹窗（使用 BaseModal）

```vue
<!-- ✅ 标准：业务弹窗 -->
<MobileDialog
  v-model="visible"
  title="编辑用户"
  :width="800"
  @confirm="handleSave"
>

<!-- ✅ 例外：简单确认 -->
<ElMessageBox.confirm />

<!-- ✅ 例外：特殊需求 -->
<BaseModal
  v-model="visible"
  :show-default-footer="false"
>
  <!-- 完全自定义内容 -->
</BaseModal>
```

### 2. 表格组件标准

**必须使用 MobileTable 的场景：**
- ✅ 标准数据展示
- ✅ 需要移动端响应式
- ✅ 包含操作列的表格

**可以使用 el-table 的场景：**
- ⚠️ 大数据量（使用 el-table-v2）
- ⚠️ 复杂表头合并
- ⚠️ 多级表头
- ⚠️ 树形数据

```vue
<!-- ✅ 标准：响应式表格 -->
<MobileTable
  :data="data"
  :columns="columns"
  :actions="actions"
/>

<!-- ✅ 例外：大数据量 -->
<el-table-v2
  :columns="columns"
  :data="data"
  :height="600"
/>

<!-- ✅ 例外：树形数据 -->
<el-table
  :data="data"
  row-key="id"
  :tree-props="{ children: 'children' }"
/>
```

### 3. 表单组件标准

**必须使用 MobileForm 的场景：**
- ✅ 标准业务表单
- ✅ 移动端优化需求
- ✅ 需要响应式布局

**可以使用 el-form 的场景：**
- ⚠️ 复杂表单结构
- ⚠️ 内联表单
- ⚠️ 步骤表单
- ⚠️ 动态表单项

### 4. 导航组件标准

**必须使用 ResponsiveLayout 的场景：**
- ✅ 页面主布局
- ✅ 包含导航的页面

**其他导航组件：**
- 📋 顶部导航：El-Menu (horizontal)
- 📋 侧边导航：El-Menu (vertical)
- 📋 移动端导航：MobileSlideMenu
- 📋 面包屑：El-Breadcrumb

## 🔧 组件封装规范

### 1. 组件组合模式

```vue
<!-- ✅ 推荐：组合使用标准组件 -->
<template>
  <ResponsiveLayout :title="pageTitle">
    <template #content>
      <MobileDialog v-model="dialogVisible">
        <MobileForm
          v-model="formData"
          :fields="fields"
          @submit="handleSubmit"
        />
      </MobileDialog>

      <MobileTable
        :data="tableData"
        :columns="columns"
      />
    </template>
  </ResponsiveLayout>
</template>
```

### 2. 业务组件封装

```vue
<!-- ✅ 推荐：封装业务组件 -->
<UserProfileDialog
  v-model="visible"
  :user-id="userId"
  @update="handleUpdate"
/>

<script setup>
// 业务组件内部使用标准组件
import { MobileDialog } from '@/components'
import { MobileForm } from '@/components'
</script>
```

### 3. 组件属性规范

```typescript
// ✅ 推荐：明确的属性接口
interface DialogProps {
  modelValue: boolean
  title?: string
  width?: string | number
  fullscreen?: boolean
  showFooter?: boolean
  confirmText?: string
  cancelText?: string
}

// ❌ 避免：模糊的属性
interface BadDialogProps {
  options?: any
  config?: object
}
```

## 🚀 组件迁移策略

### 阶段一：新增组件（优先）

1. 所有新开发的功能使用标准组件
2. 建立组件使用审查机制
3. 更新开发文档和示例

### 阶段二：逐步迁移

1. **低风险组件先行**
   - 简单的列表页面
   - 非核心功能页面

2. **中风险组件跟进**
   - 表单页面
   - 详情页面

3. **高风险组件最后**
   - 核心业务流程
   - 复杂交互页面

### 阶段三：统一维护

1. 删除废弃的组件代码
2. 统一组件API文档
3. 建立组件使用检查清单

## 📝 组件使用检查清单

在开发过程中，请确保：

### 使用前检查
- [ ] 已阅读[组件决策指南](./component-decision-guide.md)
- [ ] 确认组件类型符合使用场景
- [ ] 检查组件API文档
- [ ] 确认响应式需求

### 开发中检查
- [ ] 使用了正确的组件属性
- [ ] 实现了必要的事件处理
- [ ] 遵循了无访问性要求
- [ ] 移动端测试通过

### 使用后检查
- [ ] 组件行为符合预期
- [ ] 无控制台错误
- [ ] 跨浏览器兼容
- [ ] 性能表现良好

## 📚 参考资料

- [Vue 3 官方文档](https://vuejs.org/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [BEM 命名规范](http://getbem.com/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Vitest 测试框架](https://vitest.dev/)
- [组件决策指南](./component-decision-guide.md)

---

**更新日期**：2026-04-10
**版本**：v2.1.0（新增统一 Image 组件）
**维护者**：TF2025 前端开发团队