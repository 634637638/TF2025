# TF2025 前端开发规范文档

## 📚 文档概述

本文档集合为 TF2025 项目提供完整的前端开发规范和最佳实践指南。所有开发人员在参与项目前应仔细阅读并严格遵守这些规范。

## 🎯 规范目标

- **统一性**：确保所有功能页面采用统一的开发模式
- **可维护性**：提高代码质量，降低维护成本
- **可扩展性**：便于新功能的快速开发和集成
- **团队协作**：减少沟通成本，提升开发效率

## 📖 文档目录

### 1. [API 调用规范](./api-standards.md)
- 统一 API 接口调用方式
- 请求/响应格式规范
- 错误处理标准
- 接口文档规范

### 2. [通知系统规范](./notification-standards.md) ✅
- 统一通知服务使用
- 通知类型和应用场景
- 全局通知方法
- 通知最佳实践

### 3. [错误处理规范](./error-handling-standards.md)
- 统一错误处理机制
- 错误边界实现
- 错误日志规范
- 用户友好提示

### 4. [TypeScript 规范](./typescript-standards.md)
- 类型定义规范
- 接口设计原则
- 类型声明最佳实践
- 项目级类型组织

### 5. [分页组件规范](./pagination-standards.md)
- 统一分页组件使用
- 分页参数规范
- 数据加载优化
- 性能最佳实践

### 6. [页面结构规范](./page-structure-standards.md)
- 页面组织模式
- 组件结构标准
- 路由设计原则
- 页面生命周期管理

### 7. [样式定义规范](./style-standards.md)
- SCSS 使用规范
- CSS 命名约定
- 响应式设计原则
- 主题系统使用

### 8. [CRUD 逻辑规范](./crud-standards.md)
- 增删改查标准模式
- 表单处理规范
- 数据验证流程
- 批量操作标准

### 9. [权限系统指南](./permission-system-guide.md) ✅
- 统一权限命名规范（模块:操作格式）
- 权限控制实现（v-permission指令、useUnifiedPermissions）
- 权限最佳实践和代码示例
- 权限数据流和测试指南

### 9.1 [字段权限指南](./field-permission-guide.md)
- 字段级权限控制（v-field-permission指令）
- 字段权限定义和配置
- 动态字段权限实现
- 字段权限最佳实践

### 10. [组件开发规范](./component-standards.md)
- 组件设计原则
- Props/Emits 规范
- 组件通信方式
- 可复用组件库

## 🔧 开发环境配置

### 必要工具
```bash
# Node.js 版本
node -v  # >= 18.0.0

# 包管理器
npm -v   # >= 8.0.0

# 开发服务器
npm run dev
```

### VS Code 插件推荐
- Vue Language Features (Volar)
- TypeScript Importer
- ESLint
- Prettier
- Vue VSCode Snippets

## 📋 代码审查清单

在提交代码前，请确保：

- [ ] 所有 API 调用使用 `unifiedApi`
- [ ] 通知使用统一的通知服务
- [ ] 错误处理符合规范
- [ ] TypeScript 类型定义完整
- [ ] 组件结构清晰规范
- [ ] 样式使用 SCSS 和 BEM 命名
- [ ] 分页使用统一组件
- [ ] 权限控制正确实现（使用useUnifiedPermissions）
- [ ] 权限命名规范统一（模块:操作格式）
- [ ] 无权限时显示友好提示
- [ ] 无硬编码配置
- [ ] 移除调试 console.log

## 🚀 快速开始

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd TF2025/frontend
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **访问应用**
   ```
   http://localhost:5176
   ```

## 📞 联系方式

如有规范相关问题，请联系：
- 技术负责人：[姓名]
- 邮箱：[email]
- 文档更新：[日期]

---

**注意**：本文档会随着项目发展持续更新，请定期查看最新版本。