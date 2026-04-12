# TF2025 搜索组件规范

## 📝 概述

本文档定义了 TF2025 项目中统一搜索组件 `GlobalSearch` 的使用规范和标准。该组件支持灵活的搜索配置，可以适应不同页面的搜索需求，同时保持UI的一致性。

## 🎯 设计特点

### 1. **高度可配置**
- 支持多种筛选器类型（输入框、选择框、日期、日期范围、远程搜索）
- 灵活的快捷标签配置
- 可自定义按钮文本和提示信息

### 2. **UI 一致性**
- 统一的视觉风格和交互模式
- 响应式设计，适配移动端
- 平滑的动画效果

### 3. **用户体验**
- 防抖搜索，避免频繁请求
- 已选筛选条件展示
- 一键清空功能

## 📋 组件参数

### 基础配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| modelValue | string | '' | 搜索关键词（支持 v-model） |
| placeholder | string | '请输入搜索关键词' | 搜索框占位符 |
| disabled | boolean | false | 是否禁用 |
| loading | boolean | false | 是否加载中 |
| autoFocus | boolean | false | 是否自动聚焦 |

### UI 配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | '筛选条件' | 搜索区域标题 |
| showTitle | boolean | true | 是否显示标题 |
| compact | boolean | false | 是否紧凑模式 |
| showClearButton | boolean | true | 是否显示清空按钮 |
| showResetButton | boolean | true | 是否显示重置按钮 |
| showSelectedFilters | boolean | true | 是否显示已选筛选条件 |

### 按钮文本

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| searchButtonText | string | '搜索' | 搜索按钮文本 |
| resetButtonText | string | '重置' | 重置按钮文本 |

### 筛选配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| filters | FilterConfig[] | [] | 筛选器配置数组 |
| filterValues | Record<string, any> | {} | 筛选值对象（支持 v-model） |

### 快捷标签

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| quickTags | QuickTag[] | [] | 快捷标签配置 |

### 高级配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| debounceDelay | number | 500 | 防抖延迟（毫秒） |
| autoSearch | boolean | false | 是否自动搜索（输入时触发） |

## 🔧 筛选器配置 (FilterConfig)

```typescript
interface FilterConfig {
  key: string                    // 筛选器唯一标识
  label: string                  // 显示标签
  type: 'input' | 'select' | 'date' | 'daterange' | 'remote'  // 类型
  options?: FilterOption[]       // 选项（select类型）
  placeholder?: string          // 占位符
  allText?: string             // "全部"选项文本
  remoteOptions?: FilterOption[] // 远程搜索选项
  showOptions?: boolean        // 是否显示远程选项
  remoteMethod?: (query: string) => Promise<FilterOption[]> // 远程搜索方法
}

interface FilterOption {
  label: string
  value: any
}
```

### 筛选器类型说明

1. **input** - 文本输入框
   - 用于自由文本搜索
   - 支持回车触发搜索

2. **select** - 下拉选择框
   - 用于预定义选项选择
   - 需要提供 options 数组

3. **date** - 日期选择
   - 单个日期选择
   - 返回标准日期格式字符串

4. **daterange** - 日期范围
   - 开始和结束日期选择
   - 内部使用两个字段存储：`key_start` 和 `key_end`

5. **remote** - 远程搜索
   - 动态加载选项
   - 支持远程搜索 API

## 📌 快捷标签配置 (QuickTag)

```typescript
interface QuickTag {
  key: string                    // 唯一标识
  label: string                  // 显示标签
  query?: string                 // 搜索关键词
  filters?: Record<string, any>  // 筛选条件
}
```

## 🎨 使用示例

### 1. 基础搜索

```vue
<template>
  <GlobalSearch
    v-model="searchQuery"
    placeholder="搜索客户姓名、手机号..."
    :loading="loading"
    @search="handleSearch"
    @reset="handleReset"
  />
</template>

<script setup>
import { ref } from 'vue'
import GlobalSearch from '@/components/GlobalSearch.vue'

const searchQuery = ref('')
const loading = ref(false)

const handleSearch = (query, filters) => {
  console.log('搜索:', query, filters)
  // 执行搜索逻辑
}

const handleReset = () => {
  console.log('重置搜索')
  // 重置逻辑
}
</script>
```

### 2. 带筛选器的搜索（客户管理示例）

```vue
<template>
  <GlobalSearch
    v-model="searchQuery"
    v-model:filterValues="filterValues"
    title="客户筛选"
    placeholder="搜索客户姓名、手机号..."
    :loading="loading"
    :filters="filters"
    :quick-tags="quickTags"
    auto-search
    @search="handleSearch"
  />
</template>

<script setup>
import { ref } from 'vue'
import GlobalSearch from '@/components/GlobalSearch.vue'

const searchQuery = ref('')
const loading = ref(false)

// 筛选值
const filterValues = ref({
  customerType: '',
  status: '',
  level: '',
  registerDateStart: '',
  registerDateEnd: ''
})

// 筛选器配置
const filters = [
  {
    key: 'customerType',
    label: '客户类型',
    type: 'select',
    options: [
      { label: '个人客户', value: 'individual' },
      { label: '企业客户', value: 'business' },
      { label: 'VIP客户', value: 'vip' }
    ],
    allText: '全部类型'
  },
  {
    key: 'status',
    label: '客户状态',
    type: 'select',
    options: [
      { label: '活跃', value: 'active' },
      { label: '非活跃', value: 'inactive' },
      { label: '黑名单', value: 'blacklist' }
    ],
    allText: '全部状态'
  },
  {
    key: 'level',
    label: '客户等级',
    type: 'select',
    options: [
      { label: '普通', value: 'normal' },
      { label: '银卡', value: 'silver' },
      { label: '金卡', value: 'gold' },
      { label: '钻石', value: 'diamond' }
    ],
    allText: '全部等级'
  },
  {
    key: 'registerDate',
    label: '注册日期',
    type: 'daterange'
  }
]

// 快捷标签
const quickTags = [
  {
    key: 'vip-customers',
    label: 'VIP客户',
    filters: { level: 'vip' }
  },
  {
    key: 'new-customers',
    label: '本月新增',
    query: '',
    filters: {
      registerDateStart: getMonthStart(),
      registerDateEnd: getMonthEnd()
    }
  },
  {
    key: 'active-customers',
    label: '活跃客户',
    filters: { status: 'active' }
  }
]

const handleSearch = (query, filters) => {
  loading.value = true

  // 构建搜索参数
  const params = {
    keyword: query,
    customer_type: filters.customerType,
    status: filters.status,
    level: filters.level,
    register_date_start: filters.registerDate?.start,
    register_date_end: filters.registerDate?.end,
    page: 1,
    limit: 20
  }

  // 调用API
  try {
    const response = await api.getCustomers(params)
    // 处理响应
  } catch (error) {
    console.error('搜索失败:', error)
  } finally {
    loading.value = false
  }
}
</script>
```

### 3. 带远程搜索的示例（商品搜索）

```vue
<template>
  <GlobalSearch
    v-model="searchQuery"
    v-model:filterValues="filterValues"
    :filters="filters"
    @search="handleSearch"
  />
</template>

<script setup>
import { ref } from 'vue'
import GlobalSearch from '@/components/GlobalSearch.vue'

const filterValues = ref({
  category: '',
  brand: '',
  model: ''
})

const filters = [
  {
    key: 'category',
    label: '商品分类',
    type: 'remote',
    placeholder: '搜索商品分类',
    remoteMethod: async (query) => {
      const response = await api.searchCategories(query)
      return response.data.map(item => ({
        label: item.name,
        value: item.id
      }))
    }
  },
  {
    key: 'brand',
    label: '品牌',
    type: 'select',
    options: [
      { label: '苹果', value: 'apple' },
      { label: '三星', value: 'samsung' },
      { label: '华为', value: 'huawei' },
      { label: '小米', value: 'xiaomi' }
    ]
  },
  {
    key: 'model',
    label: '型号',
    type: 'remote',
    placeholder: '输入型号搜索',
    remoteMethod: async (query) => {
      const response = await api.searchModels(query)
      return response.data.map(item => ({
        label: `${item.brand} ${item.name}`,
        value: item.id
      }))
    }
  }
]

const handleSearch = (query, filters) => {
  console.log('搜索商品:', query, filters)
  // 执行搜索逻辑
}
</script>
```

### 4. 紧凑模式（用于空间受限的场景）

```vue
<template>
  <GlobalSearch
    v-model="searchQuery"
    compact
    :show-title="false"
    :show-reset-button="false"
    placeholder="快速搜索..."
    auto-search
    @search="handleSearch"
  />
</template>
```

## 🔄 事件处理

| 事件名 | 参数 | 说明 |
|--------|------|------|
| search | (query: string, filters: Record<string, any>) | 搜索触发 |
| reset | - | 重置触发 |
| clear | - | 清空搜索框 |
| filter-change | (key: string, value: any) | 筛选值变化 |
| update:modelValue | (value: string) | 搜索关键词更新 |
| update:filterValues | (value: Record<string, any>) | 筛选值更新 |

## 📱 响应式适配

组件已内置响应式设计：

- **桌面端**：水平布局，筛选条件并排显示
- **平板端**：适当调整间距和字体大小
- **手机端**：垂直布局，按钮宽度自适应

## 🎯 最佳实践

### 1. 筛选器命名规范
```javascript
// ✅ 推荐：使用语义化的命名
const filters = [
  { key: 'customerType', label: '客户类型' },
  { key: 'orderStatus', label: '订单状态' },
  { key: 'dateRange', label: '日期范围' }
]

// ❌ 不推荐：使用无意义的命名
const filters = [
  { key: 'type1', label: '类型1' },
  { key: 'status2', label: '状态2' }
]
```

### 2. 远程搜索优化
```javascript
// ✅ 推荐：添加防抖和缓存
const remoteMethod = useDebounce(async (query) => {
  if (remoteCache.has(query)) {
    return remoteCache.get(query)
  }

  const result = await api.search(query)
  remoteCache.set(query, result)
  return result
}, 300)
```

### 3. 快捷标签设计
```javascript
// ✅ 推荐：提供常用的高频搜索
const quickTags = [
  { key: 'today', label: '今日订单', filters: { dateRange: 'today' } },
  { key: 'pending', label: '待处理', filters: { status: 'pending' } }
]

// ❌ 不推荐：提供过于具体的标签
const quickTags = [
  { key: 'specific', label: 'iPhone 15 Pro Max 256G 深空黑色' }
]
```

## ⚠️ 注意事项

### 1. 性能考虑
- 使用 `autoSearch` 时注意调整 `debounceDelay`
- 远程搜索要实现缓存机制
- 大数据量筛选建议使用后端分页

### 2. 数据格式
- 日期范围返回格式：`{ start: '2024-01-01', end: '2024-01-31' }`
- 筛选值使用驼峰命名
- 远程搜索选项必须包含 `label` 和 `value`

### 3. 用户体验
- 提供清晰的筛选条件标签
- 合理使用快捷标签（3-5个为宜）
- 加载状态及时反馈

## 📚 相关文档

- [组件开发规范](./component-standards.md)
- [API调用规范](./api-standards.md)
- [TypeScript规范](./typescript-standards.md)

---

**最后更新**：2025-12-18
**维护团队**：TF2025前端开发团队