# 组件开发文档索引

本目录包含 TF2025 项目组件开发相关的指南和规范。

## UI 组件

### 模态框（Modal）
- [模态框指南](modal-guide.md) - 模态框组件使用规范
- [样式标准](style-standards.md) - 统一样式开发标准
- [样式使用指南](style-usage-guide.md) - 样式最佳实践

## 组件开发规范

### 组件结构
```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup lang="ts">
// 1. 导入依赖
// 2. Props 定义
// 3. Emits 定义
// 4. 响应式数据
// 5. 计算属性
// 6. 方法定义
// 7. 生命周期
</script>

<style lang="scss" scoped>
// 组件样式
</style>
```

### 组件命名
- **文件名**：kebab-case（如：`sales-order-list.vue`）
- **组件名**：PascalCase（如：`SalesOrderList`）
- **CSS 类**：BEM 命名（如：`.sales-order__item`）

## 常用组件示例

### 表单组件
```vue
<el-form ref="formRef" :model="formData" :rules="formRules">
  <el-form-item label="客户" prop="customer_id">
    <el-select v-model="formData.customer_id" />
  </el-form-item>
</el-form>
```

### 表格组件
```vue
<el-table :data="tableData" v-loading="loading">
  <el-table-column prop="name" label="名称" />
  <el-table-column label="操作">
    <template #default="{ row }">
      <el-button @click="handleEdit(row)">编辑</el-button>
    </template>
  </el-table-column>
</el-table>
```

## 相关文档

- [开发指南](../guides/)
- [权限系统](../permissions/)
