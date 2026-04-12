# TF2025 文档规范指南

> **最后更新**：2025-12-20
> **版本**：v1.0.0
> **维护者**：TF2025 开发团队

## 概述

本文档定义了 TF2025 项目的文档编写规范，确保所有文档的格式、风格和内容保持一致。

## 文档结构

### 目录结构

```
docs/
├── README.md                 # 项目主文档
├── INDEX.md                  # 文档索引
├── TEMPLATE.md              # 文档模板
├── DOCUMENTATION_STANDARDS.md # 文档规范（本文档）
├── mobile-adaptation-guide.md # 移动端适配指南
├── modal-guide.md           # 模态框使用指南
├── style-standards.md       # 样式规范
└── api/                     # API 文档目录
    └── README.md
```

### 文档命名规范

1. **使用英文命名**，采用 kebab-case 格式
2. **名称要清晰表达文档内容**
3. ** README.md** 作为目录或项目的入口文档

示例：
- ✅ `mobile-adaptation-guide.md`
- ✅ `modal-guide.md`
- ❌ `移动端适配.md`
- ❌ `Mobile Guide.md`

## 文档格式规范

### 1. 头部信息

每个文档必须包含标准头部信息：

```markdown
# 文档标题

> **文档说明**：简要描述本文档的用途和目标读者
>
> **最后更新**：2025-MM-DD
> **版本**：vX.X.X
> **维护者**：TF2025 开发团队
```

### 2. 目录结构

长文档（超过500字）必须包含目录：

```markdown
## 目录

- [概述](#概述)
- [主要内容](#主要内容)
- [使用指南](#使用指南)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)
- [更新日志](#更新日志)
```

### 3. 标题规范

- 使用 ATX 风格（# ## ###）
- 一级标题：文档标题（仅一个）
- 二级标题：主要章节
- 三级标题：子章节
- 避免超过四级标题

### 4. 内容规范

#### 文字规范
- 使用中文书写，技术术语保留英文原名
- 段落之间空一行
- 列表项之间换行

#### 代码块规范
```typescript
// TypeScript/JavaScript 示例
const example: string = 'value'
```

```vue
<!-- Vue 组件示例 -->
<template>
  <div>内容</div>
</template>
```

```scss
// SCSS 示例
.class-name {
  property: value;
}
```

#### 链接规范
- 内部链接使用相对路径
- 外部链接必须包含 https://
- 为链接添加有意义的文字描述

```markdown
✅ [移动端适配指南](./mobile-adaptation-guide.md)
✅ [Element Plus 官方文档](https://element-plus.org/)

❌ 点击这里
❅ [docs](../docs)
```

#### 图片规范
- 图片存放在 `docs/assets/` 目录
- 使用相对路径引用
- 添加 alt 属性

```markdown
![架构图](./assets/architecture-diagram.png)
```

## 特殊标记规范

### 状态标记

```markdown
✅ 已完成
🚧 进行中
📋 计划中
❌ 已废弃
⚠️ 注意事项
💡 提示信息
🔧 配置项
🎯 目标
📈 性能优化
🔒 安全相关
```

### 重要性标记

```markdown
- **必须**：强制要求
- **应该**：推荐做法
- **可以**：可选方案
- **不建议**：避免的做法
```

## 更新日志规范

每个文档必须维护更新日志：

```markdown
## 更新日志

### 2025-12-20 - v1.0.0
- ✨ 新功能：新增移动端适配指南
- 🔧 改进：优化响应式断点定义
- 🐛 修复：修正文档中的错误链接
- 📚 文档：完善API文档结构

### 2025-12-15 - v0.9.0
- 初始版本
```

### 版本号规范

- **主版本号**：不兼容的API修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

## 代码示例规范

### 1. 注释规范

```typescript
// 单行注释：解释代码目的
const apiKey = 'your-api-key' // 行末注释：解释变量

/**
 * 多行注释：
 * 描述函数功能、参数和返回值
 * @param param1 参数说明
 * @returns 返回值说明
 */
function exampleFunction(param1: string): boolean {
  return true
}
```

### 2. 组件示例

```vue
<template>
  <!-- 模板注释 -->
  <div class="component-name">
    {{ message }}
  </div>
</template>

<script setup lang="ts">
// 导入
import { ref } from 'vue'

// 定义
const message = ref('Hello World')
</script>

<style lang="scss" scoped>
// 样式注释
.component-name {
  color: var(--el-color-primary);
}
</style>
```

### 3. API 示例

```typescript
// 请求示例
const response = await unifiedApi.get('/api/v1/users', {
  params: { page: 1, limit: 10 }
})

// 响应示例
interface ApiResponse {
  success: boolean
  data: User[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}
```

## 文档审查清单

发布文档前请检查：

- [ ] 头部信息完整
- [ ] 目录结构清晰
- [ ] 链接全部有效
- [ ] 代码示例可运行
- [ ] 版本号更新
- [ ] 更新日志填写
- [ ] 拼写和语法正确
- [ ] 格式符合规范

## 文档维护

### 定期审查

- **每月**：检查文档是否需要更新
- **版本发布前**：更新相关文档
- **功能变更后**：及时更新文档

### 贡献指南

1. 创建新文档前先查阅本规范
2. 使用提供的模板创建文档
3. 提交前进行自我审查
4. PR 中包含文档变更说明

## 参考资料

- [Markdown 语法指南](https://www.markdownguide.org/)
- [Vue.js 风格指南](https://v2.vuejs.org/v2/style-guide/)
- [TypeScript 文档规范](https://typescript-eslint.io/rules/)

---

**注意**：所有文档都应遵循本规范，确保项目的文档质量和一致性。