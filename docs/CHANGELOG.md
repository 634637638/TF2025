# TF2025 项目更新日志

> **文档说明**：记录 TF2025 项目的所有版本更新内容
>
> **最后更新**：2026-04-11
> **版本**：v1.0.1
> **维护者**：TF2025 开发团队

## [2026-04-11] - 后端日志与审查项持续收口

### 🔧 改进优化
- 🛠️ **后端日志统一**：继续将后端核心中间件、权限路由、分析路由、库存与手机路由中的 `console.*` 迁移到统一日志工具 `backend/src/utils/log.js`
- 🛠️ **认证链路收口**：同步清理 `unified-auth.js`、`jwt-blacklist.js`、登录限制与上传安全等公共层直写日志
- 🛠️ **高噪音模块治理**：收口 `price-list.service.js`、`permission-management.js`、`http-login.service.js`、`shop.js`、`data-import.service.js` 等高频调试输出
- 🛠️ **服务与路由层继续收口**：补充统一 `data-check.service.js`、`backup.service.js`、`permission.service.js`、`menu.service.js`、`database-sync.service.js`、`captcha-recognizer.js`，以及 `system.js`、`data-import.js`、`employees.js`、`preorders.js`、`accessories.js` 等路由文件日志出口
- 🛠️ **日志余量继续压降**：后端 `backend/src/{middleware,utils,services,routes}` 范围内 `console.*` 统计已清理至 `0`，统一收口到 `backend/src/utils/log.js`
- 🛠️ **权限命名 canonical 化**：后端路由层 `requirePermission` / `requireAnyPermission` 已统一改为短权限名，`backend/src/routes` 中长模块权限名 grep 已清零
- 🛠️ **权限映射补齐**：`unified-auth.js` 增补 `salary-records`、`home-sections`、`return-goods`、`suppliers`、`accessories` 等 canonical 权限映射，`moduleKeyNormalizer.js` 同步补齐短 module key 归一化
- 🛠️ **工资模板权限收口**：`salary-templates.js` 与 `unified-auth.js` 已补齐 `salary-templates:*` canonical 权限
- 🛠️ **前端权限统一入口**：`permissionMapper.ts`、`auth.ts`、`routePermissions.ts`、`dynamicRouter.js` 已统一支持旧权限自动归一化和短权限优先
- 🛠️ **前端页面权限文本收口**：视图层 `permission-code`、`v-permission`、`v-permission-not`、权限提示文案已批量改为 canonical 短权限
- 🛠️ **页面权限边界修正**：`usePagePermissions` 已补充 `module-management -> permissions:admin` 特例，保持模块管理页管理员边界不变

### 🐛 问题修复
- 🐛 **审查报告同步**：确认 `db-status`、`sample-data`、`security.js` 等部分“未修复”项已在代码中完成，不再属于当前真实未修状态
- 🐛 **后端调试日志过多**：本轮继续压降后端 `console.*` 残留，减少认证、权限、商城、导入导出相关模块的调试噪音

### 📚 文档更新
- 📖 **更新文档**：
  - `docs/CHANGELOG.md` - 记录本轮日志统一与审查项收口进展

## [2026-04-10] - 安全认证策略优化

### 🔧 改进优化
- 🛡️ **认证安全策略**：认证数据改为仅存储在 sessionStorage
  - 关闭浏览器后自动清除登录状态，需重新登录
  - 更适合公网环境，提高安全性
  - 修改文件：`storage.ts`、`auth-session.ts`、`auth.ts`

### 🐛 问题修复
- 🐛 **后端失联误报**：修复 `/health` 接口返回格式与前端期望不一致的问题

### 📚 文档更新
- 📖 **更新文档**：
  - `docs/CHANGELOG.md` - 记录本次修复

## [2026-03-19] - 权限系统文档同步

### 🔧 改进优化
- 🛠️ **权限架构**：统一确认当前权限系统采用数据库驱动 RBAC 模型
- 🛠️ **权限模型**：明确菜单显示、页面权限、动作权限三层分离
- 🛠️ **模块扫描**：明确扫描模块仅注册 `modules`，不自动发放权限
- 🛠️ **用户权限汇总**：明确用户最终权限由后端根据角色并集统一生成

### 📚 文档更新
- 📖 **更新文档**：
  - `docs/permissions/permission-system-guide.md` - 补充核心表结构、权限汇总流程、前后端接入规范
  - `docs/permissions/INDEX.md` - 更新权限命名规范和索引说明
  - `docs/00-INDEX.md` - 更新权限系统总索引入口说明
  - 清理旧 `module:action`、角色名硬编码、旧管理员特权示例，统一收敛为当前 RBAC 模型

## [2025-12-20] - v1.2.0

### 🎉 新增功能
- ✨ **响应式系统**：完善移动端适配，支持 375px-767px 统一断点
- ✨ **MobileDialog 组件**：新增响应式模态框组件，支持移动端自动全屏
- ✨ **MobileTable 组件**：新增响应式表格组件，移动端自动切换为卡片布局
- ✨ **MobileForm 组件**：新增响应式表单组件，优化移动端交互体验
- ✨ **文档系统**：建立统一的文档规范和模板

### 🔧 改进优化
- 🛠️ **断点统一**：修正所有 768px 断点为 767px，确保移动端适配一致性
- 🛠️ **样式规范**：整合样式文档，统一 BEM 命名规范
- 🛠️ **组件使用**：制定弹窗组件使用规范，推荐使用 MobileDialog
- 🛠️ **响应式布局**：优化 ResponsiveLayout 组件，增强安全区域适配

### 🐛 问题修复
- 🐛 **移动端适配**：修复多处硬编码断点导致的响应式问题
- 🐛 **文档同步**：修复文档与代码不一致的问题
- 🐛 **样式冲突**：解决移动端样式覆盖问题

### 📚 文档更新
- 📖 **新增文档**：
  - `mobile-adaptation-guide.md` - 移动端适配指南
  - `modal-guide.md` - 模态框使用指南
  - `DOCUMENTATION_STANDARDS.md` - 文档规范指南
  - `INDEX.md` - 文档中心索引
- 📖 **更新文档**：
  - `style-standards.md` - 样式定义规范
  - `api-standards.md` - API 调用规范

## [2025-12-15] - v1.1.0

### 🎉 新增功能
- ✨ **权限系统**：完整的 RBAC 权限管理系统
- ✨ **统一 API**：unifiedApi 服务封装所有 HTTP 请求
- ✨ **错误边界**：全局错误处理和边界组件
- ✨ **全局加载**：统一的加载状态管理
- ✨ **消息通知**：响应式的消息提醒系统

### 🔧 改进优化
- 🛠️ **TypeScript**：增强类型定义和类型检查
- 🛠️ **性能优化**：虚拟滚动、懒加载等性能优化
- 🛠️ **用户体验**：添加触摸优化、安全区域适配

## [2025-12-10] - v1.0.0

### 🎉 初始版本
- ✨ **基础架构**：Vue 3 + TypeScript + Element Plus
- ✨ **核心模块**：销售、库存、客户、采购等业务模块
- ✨ **响应式设计**：基础的响应式布局系统
- ✨ **主题系统**：支持深色模式切换

---

## 版本号说明

- **主版本号 (X.0.0)**：不兼容的 API 修改
- **次版本号 (0.Y.0)**：向下兼容的功能性新增
- **修订号 (0.0.Z)**：向下兼容的问题修正

## 发布周期

- **主版本**：根据重大功能更新发布
- **次版本**：每月发布一次（如有新功能）
- **修订版**：根据问题修复需要随时发布

## 如何查看历史版本

- GitHub 仓库的 [Releases](https://github.com/your-org/TF2025/releases) 页面
- Git 标签：`git tag -l`
- 变更记录：`git log --oneline --decorate --graph`

---

**注意**：本更新日志遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范。
