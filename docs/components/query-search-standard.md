# 综合查询检索组件标准文档

## 📝 概述

本文档定义了 TF2025 项目中综合查询页面的检索功能标准，包括UI布局、响应式设计、权限控制等规范，供其他页面参考和复用。

## 🎯 核心特性

### 1. **响应式布局**
- **PC端（>480px）**：所有筛选项和按钮在一行显示，左对齐
- **手机端（≤480px）**：默认折叠，只显示搜索关键词和按钮，点击标题展开

### 2. **统一的样式规范**
- 按钮与输入框高度一致（`padding: 10px 16px`，`font-size: 14px`）
- 按钮固定宽度（`width: 110px`）确保大小一致
- 紫色渐变背景（`linear-gradient(135deg, #667eea, #764ba2)`）

### 3. **权限控制**
- 使用 `v-permission` 指令控制按钮显示
- 使用 `v-if` 双重保护，彻底隐藏无权限按钮

## 📐 布局结构

### PC端布局
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 综合查询                                                       │
├─────────────────────────────────────────────────────────────────┤
│ [搜索关键词] [供应商] [店铺] [品牌] [型号] ... [高级搜索] [重置]   │
└─────────────────────────────────────────────────────────────────┘
```

### 移动端布局
```
┌────────────────────────────────┐
│ 🔍 综合查询                  ▼  │
├────────────────────────────────┤
│ [搜索关键词输入框 - 全宽]      │
│ [高级搜索] [重置]               │
│ ▼ (点击展开以下)                  │
│ [供应商] [店铺]                 │
│ [品牌]   [型号]                 │
│ [颜色]   [内存]                 │
│ ...                              │
└────────────────────────────────┘
```

## 🎨 样式规范

### 按钮样式
```css
/* 统一按钮样式 */
.btn {
  padding: 10px 16px;          /* 与输入框高度一致 */
  font-size: 14px;            /* 与输入框字体一致 */
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 主按钮 - 紫色渐变 */
.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

/* 次要按钮 - 同样紫色渐变 */
.btn-secondary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

/* 按钮组内的按钮 */
.search-form .form-actions-group .btn {
  width: 110px;              /* 固定宽度，确保一致 */
  flex: 0 0 auto;
  border: none !important;     /* 移除边框差异 */
  box-shadow: none !important;  /* 移除阴影差异 */
}
```

### 输入框样式
```css
.form-control {
  padding: 10px 12px;
  border: 2px solid #e8ecef;
  border-radius: 8px;
  font-size: 14px;
  background: #f8f9fa;
}

.form-control:focus {
  border-color: #667eea;
  background: white;
}
```

### 布局容器
```css
/* 搜索表单 - PC端水平排列 */
.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-start;
  align-items: flex-end;  /* 底部对齐 */
}

/* 表单组 - 固定宽度 */
.search-form .form-group {
  flex: 0 0 auto;
  min-width: 120px;
  max-width: 160px;
}
```

## 📱 响应式断点

### PC端（>480px）
```css
.search-form {
  align-items: flex-end;  /* 底部对齐 */
}

.search-form .form-actions-group {
  margin-top: 0;         /* 无上边距，与其他字段对齐 */
}
```

### 手机端（≤480px）
```css
/* 筛选项默认隐藏 */
.search-form .form-group:not(.form-group-search):not(.form-actions-group) {
  display: none;
}

/* 展开时显示，一行2个 */
.search-form.expanded .form-group:not(.form-group-search):not(.form-actions-group) {
  display: flex !important;
  flex: 0 0 calc(50% - 5px) !important;
  max-width: calc(50% - 5px) !important;
}

/* 搜索框始终显示，排在最前 */
.form-group-search {
  order: -2;
  display: flex !important;
  flex: 1 1 100% !important;
}

/* 按钮始终显示，排在搜索框后 */
.form-actions-group {
  order: -1;
  display: flex !important;
}
```

## 🔧 权限控制示例

```vue
<!-- 编辑按钮 -->
<el-button
  v-if="authStore.hasPermission('salary_salaryview:edit')"
  v-permission="'salary_salaryview:edit'"
  @click="handleEdit"
>
  <i class="fas fa-edit"></i>
  编辑
</el-button>

<!-- 删除按钮 -->
<el-button
  v-if="authStore.hasPermission('salary_salaryview:delete')"
  v-permission="'salary_salaryview:delete'"
  @click="handleDelete"
>
  <i class="fas fa-trash"></i>
  删除
</el-button>
```

## 📋 实现步骤

### 1. 复制样式
将综合查询页面的以下样式复制到全局样式文件：
- `.search-form` - 搜索表单布局
- `.form-group` - 表单组样式
- `.form-actions-group` - 按钮组样式
- `.btn` - 按钮基础样式
- `.btn-primary` / `.btn-secondary` - 按钮变体
- 响应式媒体查询

### 2. 使用权限指令
确保在 `main.ts` 中注册了 `v-permission` 指令：
```typescript
import { installDirectives } from '@/directives'
installDirectives(app)
```

### 3. 应用到其他页面
在其他页面中应用相同的布局和样式：
```vue
<template>
  <div class="search-section">
    <div class="search-form">
      <!-- 搜索框 -->
      <div class="form-group form-group-search">
        <label class="form-label">搜索关键词</label>
        <input v-model="searchQuery" type="text" class="form-control" />
      </div>

      <!-- 其他筛选项... -->

      <!-- 按钮 -->
      <div class="form-actions-group">
        <button class="btn btn-primary" @click="handleSearch">
          <i class="fas fa-search"></i>
          搜索
        </button>
        <button class="btn btn-secondary" @click="handleReset">
          <i class="fas fa-redo"></i>
          重置
        </button>
      </div>
    </div>
  </div>
</template>
```

### 4. 添加权限控制
```vue
<script setup>
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// 检查权限
const canCreate = computed(() => authStore.hasPermission('module:create'))
const canEdit = computed(() => authStore.hasPermission('module:edit'))
const canDelete = computed(() => authStore.hasPermission('module:delete'))
</script>
```

## 🎯 最佳实践

1. **统一按钮大小**：使用固定宽度而非内容自适应
2. **底部对齐**：使用 `align-items: flex-end` 确保按钮与输入框底部对齐
3. **移除额外样式**：在按钮组中使用 `!important` 覆盖边框和阴影差异
4. **响应式优先**：先设计移动端，再适配PC端
5. **权限双重保护**：`v-if` + `v-permission` 双重检查

## 📚 相关文档

- [搜索组件规范](./search-standards.md)
- [权限系统文档](./permissions/permission-system-guide.md)
- [组件开发规范](./component-standards.md)
- [TypeScript规范](./typescript-standards.md)

---

**最后更新**：2026-01-17
**维护团队**：TF2025前端开发团队
