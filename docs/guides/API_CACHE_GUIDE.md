# API 缓存使用指南

> 本文档介绍项目中统一的 API 缓存机制和使用规范。

## 📦 缓存工具

### 核心文件

| 文件 | 位置 | 说明 |
|------|------|------|
| `api-cache.ts` | `src/composables/` | 全局缓存管理器核心 |
| `usePageCache.ts` | `src/composables/` | 页面级缓存工具（推荐使用） |

---

## 🚀 快速开始

### 1. 导入缓存工具

```typescript
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
```

### 2. 定义缓存键

```typescript
// 缓存键 - 使用有意义的命名
const CACHE_KEYS = {
  dashboard: '/dashboard',
  brands: '/brands:all',
  models: (brandId: number) => `/models:${brandId}`,
  salesReport: (params: any) => `/sales/report:${JSON.stringify(params)}`
}
```

### 3. 使用缓存请求

```typescript
// 基础用法
const loadBrands = async () => {
  const response = await useCachedRequest(
    CACHE_KEYS.brands,
    () => api.get('/brands'),
    DEFAULT_CACHE_TTL.STATIC  // 60秒
  )
  brands.value = response.data
}

// 带参数的缓存
const loadModels = async (brandId: number) => {
  const response = await useCachedRequest(
    CACHE_KEYS.models(brandId),
    () => api.get(`/brands/${brandId}/models`),
    DEFAULT_CACHE_TTL.STATIC
  )
  models.value = response.data
}
```

---

## ⏱️ 缓存策略

### TTL 配置

```typescript
export const DEFAULT_CACHE_TTL = {
  STATIC: 60000,      // 静态数据: 60秒（概览、统计）
  DYNAMIC: 30000,     // 动态数据: 30秒（趋势、图表）
  REALTIME: 5000,     // 实时数据: 5秒
  STALE: 5 * 60000    // 允许过期数据: 5分钟
}
```

### 数据类型选择

| 数据类型 | TTL | 示例 |
|----------|-----|------|
| 静态基础数据 | `STATIC` (60秒) | 品牌、型号、颜色、门店列表 |
| 统计概览数据 | `STATIC` (60秒) | 销售统计、库存概览 |
| 图表趋势数据 | `DYNAMIC` (30秒) | 月度趋势、同比环比 |
| 实时监控数据 | `REALTIME` (5秒) | 性能监控、在线用户 |

---

## 📋 使用规范

### ✅ 应该使用缓存的场景

```typescript
// 1. 基础数据列表（品牌、型号、门店等）
const CACHE_KEYS = {
  brands: '/brands:all',
  stores: '/stores:all',
  suppliers: '/suppliers:all'
}

// 2. 统计数据（概览、汇总）
const CACHE_KEYS = {
  salesStats: (params) => `/sales/stats:${JSON.stringify(params)}`,
  inventoryStats: '/inventory/stats'
}

// 3. 分析图表数据（趋势、分布）
const CACHE_KEYS = {
  salesTrend: (period) => `/analytics/sales/trend:${period}`,
  customerSegments: '/analytics/customers/segments'
}
```

### ❌ 不应该使用缓存的场景

```typescript
// 1. 列表搜索查询（带搜索条件）
// 搜索结果不应该全局缓存
const loadSearchResults = async (keyword: string) => {
  // 不建议缓存搜索结果
  const response = await api.get('/search', { params: { keyword } })
}

// 2. 单条详情查询（频繁更新）
const loadOrderDetail = async (orderId: number) => {
  // 订单详情应该实时获取
  const response = await api.get(`/orders/${orderId}`)
}

// 3. 敏感操作
// 删除、审批等操作后不应该使用缓存
const deleteItem = async (id: number) => {
  await api.delete(`/items/${id}`)
  // 删除后应该清除相关缓存
  clearCache('items')
}
```

---

## 🔧 高级用法

### 手动清除缓存

```typescript
import { clearCache } from '@/composables/usePageCache'

// 清除指定缓存
clearCache('/brands:all')

// 清除所有缓存
clearCache()
```

### 检查待处理请求

```typescript
import { hasPendingRequest } from '@/composables/usePageCache'

// 检查是否有正在进行的请求
if (hasPendingRequest('/dashboard')) {
  console.log('请求正在进行中...')
}
```

### 批量预加载

```typescript
import { preloadCache } from '@/composables/usePageCache'

// 页面初始化时预加载常用数据
await preloadCache([
  { key: '/brands', fetcher: () => api.get('/brands'), ttl: DEFAULT_CACHE_TTL.STATIC },
  { key: '/stores', fetcher: () => api.get('/stores'), ttl: DEFAULT_CACHE_TTL.STATIC },
  { key: '/operators', fetcher: () => api.get('/operators'), ttl: DEFAULT_CACHE_TTL.STATIC }
])
```

---

## 📁 已应用缓存的页面

| 页面 | 缓存内容 |
|------|----------|
| `DashboardView.vue` | 仪表盘数据 |
| `InventoryView.vue` | 门店、供应商、品牌、型号、颜色、内存、操作员 |
| `SalesView.vue` | 门店、供应商、品牌、型号、颜色、内存、操作员 |
| `SubsidyView.vue` | 门店列表 |
| `CustomersView.vue` | 客户统计 |
| `EmployeesView.vue` | 角色列表 |
| `PerformanceAnalytics.vue` | 性能概览、实时数据、详细指标 |
| `SalesAnalytics.vue` | 销售数据、月度趋势、店铺对比 |
| `CustomerAnalytics.vue` | 客户概览、列表、增长、细分、留存 |
| `InventoryAnalytics.vue` | 库存数据、低库存、周转率 |
| `EmployeeAnalytics.vue` | 员工统计、考勤、业绩、薪资趋势 |

---

## 🔍 工作原理

### 缓存流程

```
请求 → 检查缓存 → 缓存命中?
                          ↓
            是              否
            ↓                ↓
        返回缓存      检查重复请求
                          ↓
                  重复请求?
                    ↓
                是      否
                ↓        ↓
           返回已有    发起新请求
           请求的Promise
                          ↓
                      存入缓存
                          ↓
                      返回数据
```

### 特性

1. **自动去重**: 相同请求不会并发发起
2. **过期后备**: 请求失败时可使用过期缓存
3. **TTL 控制**: 不同数据类型设置不同缓存时间
4. **全局共享**: 多个页面可共享同一份缓存

---

## ⚠️ 注意事项

1. **POST/PUT/DELETE 请求不会自动清除缓存**，需要在操作后手动清除
2. **缓存键必须唯一**，相同数据使用相同键
3. **带参数的请求**，参数应包含在缓存键中
4. **实时性要求高的数据**，使用较短的 TTL

---

**最后更新**: 2026-04-10
