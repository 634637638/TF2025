# TF2025 前端文档索引

## 📚 前端开发文档导航

本文档提供TF2025前端项目的所有文档快速导航。

---

## 🎯 快速导航

### 🔥 必读文档 (优先级: ⭐⭐⭐⭐⭐)
- **[开发规范总览](./README.md)** - 所有规范的入口
- **[权限系统指南](./permission-system-guide.md)** ✅ - 权限控制核心指南
- **[CRUD逻辑规范](./crud-standards.md)** ✅ - 增删改查标准实现

### 🛠️ 核心开发规范 (优先级: ⭐⭐⭐⭐)
- **[API调用规范](./api-standards.md)** - 统一API接口调用
- **[错误处理规范](./error-handling-standards.md)** - 错误处理标准
- **[TypeScript规范](./typescript-standards.md)** - 类型定义和使用

### 🎨 UI/UX规范 (优先级: ⭐⭐⭐)
- **[页面结构规范](./page-structure-standards.md)** - 页面组织模式
- **[样式定义规范](./style-standards.md)** - SCSS和CSS规范
- **[分页组件规范](./pagination-standards.md)** - 分页实现标准
- **[组件开发规范](./component-standards.md)** ✅ - Vue组件开发标准

### 🔧 专项功能指南 (优先级: ⭐⭐)
- **[对话框/编辑框规范](./dialog-standards.md)** ✅ - 统一的弹窗和编辑框标准
- **[搜索组件规范](./search-standards.md)** ✅ - 统一的搜索组件标准
- **[移动端开发规范](./mobile-development-standards.md)** ✅ - 移动端适配开发标准
- **[移动端组件示例](./mobile-component-examples.md)** ✅ - 移动端页面模板示例
- **[通知系统规范](./notification-standards.md)** ✅ - 通知服务使用
- **[字段权限指南](./field-permission-guide.md)** - 字段级权限控制

---

## 🚀 开发流程建议

### 新功能开发
1. **功能设计阶段**
   - 阅读 [页面结构规范](./page-structure-standards.md)
   - 参考 [权限系统指南](./permission-system-guide.md) 设计权限

2. **开发实现阶段**
   - 遵循 [CRUD逻辑规范](./crud-standards.md)
   - 使用 [API调用规范](./api-standards.md)
   - 实现 [错误处理规范](./error-handling-standards.md)

3. **UI实现阶段**
   - 遵循 [样式定义规范](./style-standards.md)
   - 使用 [分页组件规范](./pagination-standards.md)
   - 添加权限控制（参考权限系统指南）

### Bug修复
1. 错误定位 → [错误处理规范](./error-handling-standards.md)
2. 权限问题 → [权限系统指南](./permission-system-guide.md)
3. API问题 → [API调用规范](./api-standards.md)

---

## 📋 代码审查清单

开发完成后，请根据以下清单进行自检：

### ✅ 基础要求
- [ ] 遵循 [TypeScript规范](./typescript-standards.md)
- [ ] 使用统一 [API调用规范](./api-standards.md)
- [ ] 实现 [错误处理规范](./error-handling-standards.md)

### ✅ 功能要求
- [ ] 遵循 [CRUD逻辑规范](./crud-standards.md)
- [ ] 实现 [权限系统指南](./permission-system-guide.md) 要求
- [ ] 使用 [通知系统规范](./notification-standards.md)

### ✅ UI要求
- [ ] 遵循 [页面结构规范](./page-structure-standards.md)
- [ ] 使用 [样式定义规范](./style-standards.md)
- [ ] 列表页面使用 [分页组件规范](./pagination-standards.md)
- [ ] 遵循 [组件开发规范](./component-standards.md)
- [ ] 使用 [对话框/编辑框规范](./dialog-standards.md) 实现弹窗
- [ ] 使用 [搜索组件规范](./search-standards.md) 实现搜索功能
- [ ] 移动端页面遵循 [移动端开发规范](./mobile-development-standards.md)

---

## 🆘 常见问题

### Q: 如何实现权限控制？
A: 参考 [权限系统指南](./permission-system-guide.md)，使用 `useUnifiedPermissions` composable

### Q: 如何调用API接口？
A: 参考 [API调用规范](./api-standards.md)，使用统一API服务

### Q: 如何处理错误？
A: 参考 [错误处理规范](./error-handling-standards.md)，使用统一错误处理机制

### Q: 如何实现CRUD功能？
A: 参考 [CRUD逻辑规范](./crud-standards.md)，遵循标准模式

### Q: 如何使用通知功能？
A: 参考 [通知系统规范](./notification-standards.md)，使用统一通知服务

### Q: 如何开发Vue组件？
A: 参考 [组件开发规范](./component-standards.md)，遵循组件开发标准

### Q: 如何适配移动端？
A: 参考 [移动端开发规范](./mobile-development-standards.md)，使用 ResponsiveLayout 组件

### Q: 有移动端页面模板吗？
A: 参考 [移动端组件示例](./mobile-component-examples.md)，查看完整的页面模板

### Q: 如何实现编辑框和弹窗？
A: 参考 [对话框/编辑框规范](./dialog-standards.md)，使用统一的弹窗组件

### Q: 如何实现搜索功能？
A: 参考 [搜索组件规范](./search-standards.md)，使用 GlobalSearch 组件

---

## 📞 技术支持

- **前端团队**：查看团队内部联系方式
- **文档问题**：在项目Issues中提交
- **功能问题**：联系相关功能负责人

---

**最后更新**：2025-12-16
**维护团队**：TF2025前端开发团队