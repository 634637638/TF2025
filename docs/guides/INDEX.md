# 开发指南索引

本目录包含 TF2025 项目的开发规范和最佳实践指南。

## 核心规范

### API 开发
- [API 标准](api-standards.md) - RESTful API 设计与实现规范
- [API 缓存指南](API_CACHE_GUIDE.md) - ⭐ **NEW** 页面级 API 缓存使用规范

### 组件开发
- [组件标准](component-standards.md) - Vue 组件开发规范
- [组件决策指南](component-decision-guide.md) - 组件选型建议

### 前端开发
- [TypeScript 标准](typescript-standards.md) - TypeScript 使用规范
- [错误处理标准](error-handling-standards.md) - 统一错误处理机制
- [移动端开发标准](mobile-development-standards.md) - 移动端适配开发
- [移动端适配指南](mobile-adaptation-guide.md) - 响应式布局适配
- [移动端响应式指南](MOBILE_RESPONSIVE_GUIDE.md) - 移动端完整指南

## 代码规范

### 命名规范
```javascript
// 组件：PascalCase
SalesOrderList.vue

// 文件：kebab-case
use-user-management.ts

// 变量/函数：camelCase
const salesOrderData = ref([])

// 常量：SCREAMING_SNAKE_CASE
const API_BASE_URL = '/api/v1'
```

### 代码审查
- [代码审查标准](CODE_REVIEW_STANDARDS.md) - ⭐ **NEW** AI 代码审查完整提示词规范

### 目录结构
```
src/
├── api/           # API 接口
├── components/    # 公共组件
├── views/         # 页面视图
├── stores/        # Pinia 状态
├── router/        # 路由配置
├── utils/         # 工具函数
└── types/         # 类型定义
```

## 相关文档

- [组件文档](../components/)
- [权限系统](../permissions/)
- [业务文档](../business/)
