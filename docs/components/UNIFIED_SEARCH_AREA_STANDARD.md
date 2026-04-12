# 统一搜索区域设计规范

> **版本**: v2.0
> **最后更新**: 2026-01-23
> **适用范围**: 所有包含搜索/筛选功能的页面

## 📝 概述

本文档定义了 TF2025 项目中所有页面的搜索/筛选区域的统一设计规范，确保全项目在 PC 端和移动端都有一致的用户体验。

### 🎯 设计目标

1. **统一性**: 所有页面使用相同的搜索区域结构和样式
2. **响应式**: PC 端和移动端都有优化的布局
3. **易用性**: 简洁的交互设计，减少用户操作步骤
4. **可维护性**: 标准化的代码结构，便于后续维护

## 🏗️ 整体架构

### 组件层级结构

```
.search-section (搜索区域容器)
  └── .search-form (搜索表单)
        ├── .form-group-search (搜索关键词输入框)
        ├── .advanced-toggle-btn (筛选切换按钮)
        ├── .form-actions-group (操作按钮组)
        │     ├── 搜索按钮
        │     └── 重置按钮
        └── .filter-item (筛选项，多个)
              ├── 供应商选择器
              ├── 店铺选择器
              ├── 品牌选择器
              └── ...
```

### 交互逻辑

```
用户操作流程:
┌─────────────┐
│ 默认折叠状态 │
│ [搜索框] [筛选] [搜索] [重置]
└──────┬──────┘
       │ 点击"筛选"按钮
       ▼
┌─────────────┐
│ 展开状态     │
│ [搜索框] [筛选] [搜索] [重置]
│ [供应商] [店铺] [品牌] ...
└──────┬──────┘
       │ 点击"收起"按钮
       ▼
返回默认折叠状态
```

## 📐 模板结构规范

### 完整模板代码

```vue
<!-- 搜索筛选区域 - 统一响应式布局 -->
<div class="search-section" @click="toggleSearch">
  <div class="search-form" :class="{ 'expanded': shouldExpandSearch }" @click.stop>
    <!-- 搜索关键词 -->
    <div class="form-group form-group-search" @click="shouldExpandSearch || toggleSearch()">
      <el-input
        v-model="filters.search"
        placeholder="🔍 搜索关键词"
        clearable
        @input="debounceLoad"
        @keyup.enter="loadData"
        @click.stop
      >
        <template #prefix>
          <i class="fas fa-search"></i>
        </template>
      </el-input>
    </div>

    <!-- 高级搜索切换按钮 -->
    <button class="advanced-toggle-btn" @click.stop="toggleSearch()">
      <i class="fas" :class="shouldExpandSearch ? 'fa-chevron-up' : 'fa-sliders-h'"></i>
      <span class="btn-text">{{ shouldExpandSearch ? '收起' : '筛选' }}</span>
    </button>

    <!-- 搜索和重置按钮 -->
    <div class="form-actions-group" @click.stop>
      <el-button type="primary" size="small" @click="loadData">
        <i class="fas fa-search"></i>
        搜索
      </el-button>
      <el-button type="default" size="small" @click="resetFilters">
        <i class="fas fa-redo"></i>
        重置
      </el-button>
    </div>

    <!-- 筛选项 - 必须添加 data-field 属性 -->
    <div class="form-group filter-item" data-field="supplier">
      <el-select
        v-model="filters.supplier_id"
        placeholder="供应商"
        filterable
        clearable
        @change="loadData"
      >
        <el-option
          v-for="item in suppliers"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
    </div>

    <!-- 更多筛选项... -->
  </div>
</div>
```

### 关键要素说明

| 元素 | 类名 | 说明 | 必需 |
|-----|------|-----|------|
| 搜索区域容器 | `.search-section` | 整个搜索区域的外层容器 | ✅ |
| 搜索表单 | `.search-form` | 表单内容的容器 | ✅ |
| 搜索框 | `.form-group-search` | 搜索关键词输入框 | ✅ |
| 切换按钮 | `.advanced-toggle-btn` | 展开/收起筛选的按钮 | ✅ |
| 按钮组 | `.form-actions-group` | 搜索和重置按钮组 | ✅ |
| 筛选项 | `.filter-item` | 各个筛选字段 | ❌ |
| data-field | `data-field="xxx"` | 筛选字段标识属性 | ✅ |

## 🎨 Script 部分规范

### 状态管理

```javascript
import { ref, computed } from 'vue'

// 搜索相关状态
const searchExpanded = ref(false) // 默认折叠状态

// 计算是否应该展开搜索区域
const shouldExpandSearch = computed(() => {
  return searchExpanded.value
})

// 切换搜索区域展开/收起
const toggleSearch = () => {
  searchExpanded.value = !searchExpanded.value
}
```

### 筛选数据结构

```javascript
// 筛选条件对象
const filters = reactive({
  search: '',           // 搜索关键词
  supplier_id: '',      // 供应商ID
  store_id: '',         // 店铺ID
  brand: '',            // 品牌
  model: '',            // 型号
  // ... 其他筛选字段
})

// 重置筛选条件
const resetFilters = () => {
  filters.search = ''
  filters.supplier_id = ''
  filters.store_id = ''
  filters.brand = ''
  filters.model = ''
  // ... 重置其他字段
  loadData() // 重新加载数据
}
```

## 🎨 CSS 样式规范

### 完整样式代码

```css
/* ===== 搜索区域样式 - 统一规范 ===== */

/* 搜索区域容器 */
.search-section {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid #d1d9e6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  position: relative;
}

.search-section:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 搜索表单 */
.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* 表单组基础样式 */
.search-form .form-group {
  margin: 0;
  flex-direction: row;
  align-items: center;
}

/* 搜索输入框 */
.search-form .form-group-search {
  flex: 1 1 200px;
  min-width: 180px;
}

/* 高级搜索切换按钮 */
.advanced-toggle-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: white;
  border: 1px solid #d1d9e6;
  border-radius: 6px;
  color: #5a67d8;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex: 0 0 auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  height: 32px;
}

.advanced-toggle-btn:hover {
  background: #f0f4ff;
  border-color: #a3bffa;
  box-shadow: 0 2px 6px rgba(90, 103, 216, 0.15);
}

.advanced-toggle-btn:active {
  transform: scale(0.98);
}

/* 移动端默认隐藏按钮文字 */
.advanced-toggle-btn .btn-text {
  display: none;
}

/* 按钮组 */
.form-actions-group {
  display: flex;
  gap: 6px;
  flex: 0 0 auto;
}

/* 折叠状态：隐藏筛选项 */
.search-form:not(.expanded) .filter-item {
  display: none;
}

/* ===== PC端样式 (≥769px) ===== */
@media (min-width: 769px) {
  .search-form {
    align-items: center;
    flex-wrap: nowrap; /* PC端不换行 */
  }

  /* 展开时显示所有筛选项 */
  .search-form.expanded .filter-item {
    display: block;
    flex: 1 1 auto; /* 自适应宽度 */
    min-width: 120px;
  }

  /* PC端显示按钮文字 */
  .advanced-toggle-btn .btn-text {
    display: inline;
  }

  /* 所有控件高度统一为32px */
  .search-form .el-input,
  .search-form .el-select,
  .search-form .el-date-picker,
  .search-form .el-button {
    height: 32px;
  }

  .advanced-toggle-btn {
    height: 32px;
  }

  /* 所有表单控件宽度100%填充父容器 */
  .search-form .form-group > *,
  .search-form .filter-item > * {
    width: 100% !important;
  }

  .search-form .el-select,
  .search-form .el-input,
  .search-form .el-date-picker {
    width: 100% !important;
  }

  .search-form .el-select .el-input__wrapper,
  .search-form .el-input .el-input__wrapper,
  .search-form .el-date-picker .el-input__wrapper {
    width: 100% !important;
  }
}

/* ===== 移动端样式 (≤768px) ===== */
@media (max-width: 768px) {
  .search-section {
    padding: 12px;
    margin: 0 0 12px 0;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .search-form {
    gap: 8px;
  }

  /* 搜索框全宽，排在第一位 */
  .search-form .form-group-search {
    flex: 1 1 100%;
    order: 1;
  }

  /* 按钮组排在第二位 */
  .form-actions-group {
    order: 2;
  }

  /* 筛选按钮排在第三位 */
  .advanced-toggle-btn {
    order: 3;
  }

  /* 展开时筛选项每行2个 */
  .search-form.expanded .filter-item {
    display: block;
    flex: 1 1 calc(50% - 4px);
    min-width: calc(50% - 4px);
  }
}
```

### 样式变量表

| 样式属性 | PC端 | 移动端 | 说明 |
|---------|------|--------|------|
| padding | 12px 16px | 12px | 内边距 |
| border-radius | 12px | 0 | 圆角 |
| border | 1px solid | 左右边框无 | 边框 |
| 组件高度 | 32px | 32px | 统一高度 |
| 筛选项宽度 | 自适应 | 50% - 4px | 宽度计算 |
| 间距 gap | 8px | 8px | 元素间距 |

## 📱 响应式设计规范

### 断点定义

```css
/* 移动端 */
@media (max-width: 768px) { }

/* PC端 */
@media (min-width: 769px) { }
```

### 移动端布局

```
┌────────────────────────────┐
│ 搜索区域 (无边框圆角)       │
├────────────────────────────┤
│ [🔍 搜索关键词] - 全宽      │
│ [搜索] [重置] [筛选]        │
│                            │
│ ▼ 展开后显示：              │
│ [供应商] [店铺]             │
│ [品牌]   [型号]             │
│ [颜色]   [内存]             │
│ ...每行2个                  │
└────────────────────────────┘
```

### PC端布局

```
┌─────────────────────────────────────────────────────────────────┐
│ 搜索区域 (有圆角和边框)                                           │
├─────────────────────────────────────────────────────────────────┤
│ [🔍 搜索...] [筛选▼] [搜索] [重置] [供应商] [店铺] [品牌] ...   │
│                                                                 │
│ ▼ 展开后显示（横向排列，自适应宽度）：                              │
│ 更多筛选项在一行显示，自动调整宽度                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 实施步骤

### 步骤1: 准备工作

1. **确认页面是否有搜索功能**
2. **检查现有筛选字段**
3. **确定数据加载方法名**

### 步骤2: 更新模板

```vue
<!-- 1. 替换现有的搜索区域结构 -->
<div class="search-section" @click="toggleSearch">
  <div class="search-form" :class="{ 'expanded': shouldExpandSearch }" @click.stop>
    <!-- 2. 添加搜索输入框 -->
    <div class="form-group form-group-search">
      <el-input v-model="filters.search" placeholder="🔍 搜索关键词" clearable />
    </div>

    <!-- 3. 添加切换按钮 -->
    <button class="advanced-toggle-btn" @click.stop="toggleSearch()">
      <i class="fas" :class="shouldExpandSearch ? 'fa-chevron-up' : 'fa-sliders-h'"></i>
      <span class="btn-text">{{ shouldExpandSearch ? '收起' : '筛选' }}</span>
    </button>

    <!-- 4. 添加操作按钮 -->
    <div class="form-actions-group">
      <el-button type="primary" size="small" @click="loadData">
        <i class="fas fa-search"></i> 搜索
      </el-button>
      <el-button type="default" size="small" @click="resetFilters">
        <i class="fas fa-redo"></i> 重置
      </el-button>
    </div>

    <!-- 5. 转换现有筛选项，添加 data-field 属性 -->
    <div class="form-group filter-item" data-field="字段名">
      <el-select ...>...</el-select>
    </div>
  </div>
</div>
```

### 步骤3: 更新 Script

```javascript
// 添加状态管理
const searchExpanded = ref(false)
const shouldExpandSearch = computed(() => searchExpanded.value)
const toggleSearch = () => {
  searchExpanded.value = !searchExpanded.value
}

// 确保有 resetFilters 方法
const resetFilters = () => {
  // 重置所有筛选条件
  filters.search = ''
  // ...
  loadData()
}
```

### 步骤4: 更新样式

```css
/* 删除旧的搜索区域样式 */
/* 添加新的统一样式（参考本文档"CSS 样式规范"章节） */
```

### 步骤5: 测试验证

- [ ] PC端默认折叠状态正常
- [ ] PC端点击"筛选"展开正常
- [ ] PC端展开后筛选项横向排列
- [ ] 移动端默认折叠状态正常
- [ ] 移动端点击"筛选"展开正常
- [ ] 移动端展开后筛选项每行2个
- [ ] 搜索功能正常工作
- [ ] 重置功能正常工作
- [ ] 所有筛选项正常工作

## ✅ 已完成页面列表

以下页面已完成统一搜索区域规范的更新：

| 序号 | 页面名称 | 文件路径 | 状态 |
|-----|---------|---------|------|
| 1 | 销售管理 | `views/sales/SalesView.vue` | ✅ |
| 2 | 库存管理 | `views/inventory/InventoryView.vue` | ✅ |
| 3 | 综合查询 | `views/query/QueryView.vue` | ✅ |
| 4 | 工资管理 | `views/salary/SalaryView.vue` | ✅ |
| 5 | 考勤管理 | `views/attendance/AttendanceView.vue` | ✅ |
| 6 | 供应商付款 | `views/payments/SupplierPhonePaymentsView.vue` | ✅ |
| 7 | 权限管理 | `views/permissions/PermissionsView.vue` | ✅ |
| 8 | 菜单管理 | `views/menu/MenuManagementView.vue` | ✅ |
| 9 | 员工管理 | `views/employees/EmployeesView.vue` | ✅ |
| 10 | 供应商管理 | `views/suppliers/SuppliersView.vue` | ✅ |
| 11 | 品牌管理 | `views/brands/BrandsView.vue` | ✅ |
| 12 | 店铺管理 | `views/stores/StoresView.vue` | ✅ |
| 13 | 型号管理 | `views/models/ModelsView.vue` | ✅ |
| 14 | 内存管理 | `views/memories/MemoriesView.vue` | ✅ |
| 15 | 颜色管理 | `views/colors/ColorsView.vue` | ✅ |
| 16 | 补贴管理 | `views/subsidy/SubsidyView.vue` | ✅ |
| 17 | 租赁管理 | `views/rentals/RentalsView.vue` | ✅ |
| 18 | 客户管理 | `views/customers/CustomersView.vue` | ✅ |

## 🎯 设计原则

### 1. 一致性原则

所有页面的搜索区域必须使用：
- 相同的类名
- 相同的布局结构
- 相同的交互方式
- 相同的视觉样式

### 2. 渐进增强原则

- **移动优先**: 先确保移动端体验
- **PC增强**: 在PC端提供更丰富的展示
- **降级处理**: 在不支持某些特性时优雅降级

### 3. 可访问性原则

- 使用语义化 HTML
- 提供清晰的视觉反馈
- 支持键盘操作（Enter 搜索）
- 使用图标辅助文字说明

### 4. 性能原则

- 使用 `v-show` 而非 `v-if`（频繁切换）
- 防抖输入（`@input` 使用 debounce）
- 按需加载筛选数据

## 📚 相关文档

- [组件开发规范](./component-standards.md)
- [权限系统指南](../permissions/permission-system-guide.md)
- [移动端开发标准](../guides/mobile-development-standards.md)
- [TypeScript 规范](../guides/typescript-standards.md)

## 🔄 版本历史

| 版本 | 日期 | 变更内容 |
|-----|------|---------|
| v2.0 | 2026-01-23 | 完全重写，统一所有页面的搜索区域规范 |
| v1.0 | 2026-01-17 | 初始版本，仅针对综合查询页面 |

---

**维护团队**: TF2025 前端开发团队
**最后更新**: 2026-01-23

---

## 附录：快速参考

### data-field 属性命名规范

| 字段类型 | data-field 值示例 | 说明 |
|---------|-------------------|------|
| 供应商 | `supplier` | 供应商选择 |
| 店铺 | `store` | 店铺选择 |
| 品牌 | `brand` | 品牌选择 |
| 型号 | `model` | 型号选择 |
| 颜色 | `color` | 颜色选择 |
| 内存 | `memory` | 内存选择 |
| 状态 | `status` | 状态筛选 |
| 成色 | `condition` | 成色筛选 |
| 销售员 | `operator` | 操作员筛选 |
| 开始日期 | `start_date` | 开始日期 |
| 结束日期 | `end_date` | 结束日期 |

### 常用方法命名

```javascript
// 数据加载方法
loadData()           // 加载数据
loadInventory()      // 加载库存数据
loadSales()          // 加载销售数据
loadQueryData()      // 加载查询数据

// 重置方法
resetFilters()       // 重置筛选条件
handleReset()        // 处理重置操作

// 防抖方法
debounceLoad()       // 防抖加载
debounceLoadData()   // 防抖加载数据

// 切换方法
toggleSearch()       // 切换搜索区域
```
