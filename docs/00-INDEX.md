# TF2025 项目文档总索引

> 本文档是 TF2025 项目的文档总入口，包含所有技术文档、业务文档的导航链接。

## 📚 快速导航

| 分类 | 描述 | 链接 |
|-----|------|-----|
| 📖 [开发指南](guides/) | 技术规范、开发标准 | [查看 →](guides/) |
| 💼 [业务文档](business/) | 业务逻辑说明 | [查看 →](business/) |
| 🔐 [权限系统](permissions/) | 权限管理文档 | [查看 →](permissions/) |
| 🔄 [数据同步](sync/) | 同步与导入功能 | [查看 →](sync/) |
| 💳 [支付管理](payments/) | 支付与打款 | [查看 →](payments/) |
| 🎨 [组件开发](components/) | UI 组件规范 | [查看 →](components/) |
| 🗄️ [数据库文档](database/) | 数据库与模块映射 | [查看 →](database/) |
| 🚀 [部署文档](deployment/) | 云端部署指南 | [查看 →](deployment/) |
| 📦 [归档文档](archive/) | 已废弃文档 | [查看 →](archive/) |

---

## 📖 开发指南

开发规范与最佳实践，所有开发人员必读。

### 核心规范
- [API 标准](guides/api-standards.md) - RESTful API 设计规范
- [API 缓存指南](guides/API_CACHE_GUIDE.md) - ⭐ **NEW** 页面级 API 缓存使用规范
- [代码审查标准](guides/CODE_REVIEW_STANDARDS.md) - ⭐ **NEW** AI 代码审查完整提示词规范
- [日志系统规范](guides/LOG_SYSTEM_STANDARDS.md) - ⭐ **NEW** 统一日志入口，后端 `backend/src/utils/log.js` / 前端 `frontend/src/utils/logger.ts`
- [前端类型统一进展](development/FRONTEND_TYPE_UNIFICATION_PROGRESS.md) - ⭐ **NEW** 公共类型、表格组件、业务页面去 `any` 收口记录
- [组件标准](guides/component-standards.md) - Vue 组件开发规范
- [TypeScript 标准](guides/typescript-standards.md) - TS 使用规范
- [错误处理标准](guides/error-handling-standards.md) - 统一错误处理
- [组件决策指南](guides/component-decision-guide.md) - 组件选型建议

### ⭐ 类型定义规范
- 所有类型定义集中在 `src/types/` 目录
- 按业务模块分类：`employee.ts`、`order.ts`、`repair.ts`、`system.ts`、`h5.ts` 等
- 统一从 `@/types` 导入，禁止在页面组件中分散定义类型

### 移动端开发
- [移动端开发标准](guides/mobile-development-standards.md) - 移动端适配开发
- [移动端适配指南](guides/mobile-adaptation-guide.md) - 响应式布局
- [移动端响应式指南](guides/MOBILE_RESPONSIVE_GUIDE.md) - 完整移动端指南

---

## 💼 业务文档

各业务模块的功能说明和规则文档。

### [考勤管理 (leave/)](business/leave/)
- [考勤计算规则](business/leave/LEAVE_CALCULATION_RULES.md)
- [考勤日期拆分指南](business/leave/LEAVE_DATE_SPLIT_GUIDE.md)
- [工资模板考勤天数](business/leave/LEAVE_DAYS_FROM_SALARY_TEMPLATE.md)
- [待计算考勤处理](business/leave/LEAVE_PENDING_CALCULATION.md)

### [销售管理 (sales/)](business/sales/)
销售业务相关文档（待补充）

### [库存管理 (inventory/)](business/inventory/)
库存业务相关文档（待补充）

---

## 🔐 权限系统

RBAC 权限管理系统的完整文档。

### 核心文档
- [权限系统完整指南](permissions/permission-system-guide.md) - 数据库驱动 RBAC、权限汇总与接入规范
- [页面扫描与模块注册规范](permissions/page-module-scan-guide.md) - 新增页面、`page/` 目录与模块扫描规则
- [字段权限完整指南](permissions/field-permissions-complete-guide.md) - 字粒度权限

### 其他
- [权限缓存刷新](permissions/permission-cache-refresh.md)
- [权限拒绝组件](permissions/permission-denied-component.md)

**当前权限体系要点：**
- 角色、模块、动作、菜单显示、页面权限均以数据库为准
- 用户登录后由后端汇总最终权限
- 前端只负责消费权限结果并渲染菜单、页面、按钮、字段

---

## 🔄 数据同步

数据库同步、数据导入相关文档。

### 快速开始
- [快速开始同步](sync/QUICK_START_SYNC.md)
- [智能同步快速指南](sync/SMART_SYNC_QUICK_GUIDE.md)

### 同步功能
- [自动同步指南](sync/AUTO_SYNC_GUIDE.md)
- [数据库同步指南](sync/DATABASE_SYNC_GUIDE.md)
- [远程数据库同步](sync/REMOTE_DATABASE_SYNC_GUIDE.md)
- [智能用户匹配指南](sync/SMART_USER_MATCHING_GUIDE.md)
- [智能同步功能完成](sync/SMART_SYNC_FEATURE_COMPLETE.md)

### 导入功能
- [智能导入功能说明](数据优化/智能导入功能说明.md) - 🌟 新增智能导入策略
- [智能匹配逻辑说明](数据优化/智能匹配逻辑说明.md) - 先匹配后创建的智能逻辑
- [导入历史记录](sync/IMPORT_HISTORY_GUIDE.md)
- [导入策略报告](sync/IMPORT_STRATEGIES_REPORT.md)

---

## 💳 支付管理

供应商打款、支付相关文档。

- [供应商打款指南](payments/SUPPLIER_PAYMENT_GUIDE.md)
- [供应商打款菜单设置](payments/SUPPLIER_PAYMENT_MENU_SETUP.md)

---

## 🎨 组件开发

UI 组件开发指南和样式规范。

### 搜索/筛选组件
- [统一搜索区域设计规范](components/UNIFIED_SEARCH_AREA_STANDARD.md) - 所有页面的搜索区域统一标准 ⭐ **NEW**
- [综合查询检索标准](components/query-search-standard.md) - 旧版检索标准（已过时）

### 通用组件
- [模态框指南](components/modal-guide.md)
- [样式标准](components/style-standards.md)
- [样式使用指南](components/styleusage-guide.md)

---

## 🗄️ 数据库文档

云端数据库管理与模块映射。

### 快速开始
- [数据库模块映射表](database/DATABASE_MODULE_MAPPING.md) - **完整模块与数据表对应关系** ⭐ **NEW**
- [客户表结构文档](database/customers-table-schema.md) - 客户表详细结构说明

---

## 🚀 部署文档

服务器部署、运维相关文档。

### [云端部署](deployment/)
- [云端部署指南](deployment/CLOUD_DEPLOYMENT_GUIDE.md) - 完整的云端部署教程
- [后端性能优化](deployment/PERFORMANCE_OPTIMIZATION.md) - 数据库和API优化指南

**部署架构：**
```
用户 → Nginx → 前端 (Vue 3)
              ↓
           后端 (Node.js)
              ↓
           数据库 (MySQL)
```

---

## ⚡ 性能优化

前端和后端性能优化指南。

### [前端性能优化](frontend/PERFORMANCE_OPTIMIZATION.md)
- Vite 构建优化
- 路由懒加载
- Element Plus 按需引入
- 图片和资源优化
- 代码分割策略

### [后端性能优化](deployment/PERFORMANCE_OPTIMIZATION.md)
- 数据库索引优化
- 连接池配置
- 查询优化
- 缓存策略
- API 响应优化

---

## 📦 归档文档

已废弃或过期的文档，仅供参考。

- [设备识别计划](archive/DEVICE_IDENTIFICATION_PLAN.md)

---

## 🛠️ 项目文档结构

```
docs/
├── 00-INDEX.md                    # 本文件 - 文档总索引
├── CLAUDE.md                      # Claude AI 开发指南
├── CHANGELOG.md                   # 项目变更记录
├── guides/                        # 开发指南
│   ├── INDEX.md
│   ├── api-standards.md
│   ├── component-standards.md
│   └── ...
├── business/                      # 业务文档
│   ├── INDEX.md
│   ├── leave/
│   ├── sales/
│   └── inventory/
├── sync/                          # 数据同步
│   ├── INDEX.md
│   └── ...
├── permissions/                   # 权限系统
│   ├── INDEX.md
│   └── ...
├── payments/                      # 支付管理
│   ├── INDEX.md
│   └── ...
├── components/                    # 组件开发
│   ├── INDEX.md
│   └── ...
├── database/                      # 数据库文档
│   ├── INDEX.md
│   └── DATABASE_MODULE_MAPPING.md
├── deployment/                    # 部署文档
│   ├── INDEX.md
│   └── CLOUD_DEPLOYMENT_GUIDE.md
└── archive/                       # 归档文档
    └── INDEX.md
```

---

## 📝 文档存放规范

### 统一存放位置
**所有项目文档必须存放在 `docs/` 目录下，禁止在项目根目录或其他位置创建文档。**

### 按模块命名规则
新增文档时，根据所属模块存放到对应文件夹：

| 模块 | 文档目录 | 示例 |
|---|---|---|
| 综合查询 | `docs/query/` | 查询功能相关文档 |
| 销售管理 | `docs/business/sales/` | 销售相关文档 |
| 库存管理 | `docs/business/inventory/` | 库存相关文档 |
| 考勤管理 | `docs/business/leave/` | 考勤相关文档 |
| 国补管理 | `docs/subsidy/` | 国补相关文档 |
| 工资管理 | `docs/salary/` | 工资相关文档 |
| H5商城 | `docs/frontend/` | H5商城相关文档 |
| 前端组件 | `docs/components/` | 组件开发文档 |
| 后端服务 | `docs/backend/` | 后端技术文档 |
| 数据同步 | `docs/sync/` | 同步相关文档 |
| 支付管理 | `docs/payments/` | 支付相关文档 |
| 权限系统 | `docs/permissions/` | 权限相关文档 |

### 文件命名规范
- **业务文档**：大写下划线（如 `LEAVE_CALCULATION_RULES.md`）
- **技术文档**：小写连字符（如 `api-standards.md`）
- **索引文件**：统一使用 `INDEX.md`

### 操作流程
1. 创建文档 → 放入对应模块目录
2. 更新模块目录的 `INDEX.md`
3. 更新本文档 `00-INDEX.md`

### 根目录保留文件
```
docs/
├── 00-INDEX.md              # 文档总索引 ⭐
├── CHANGELOG.md             # 项目变更记录
├── CLAUDE.md                # Claude AI 开发指南
└── TEMPLATE.md              # 文档模板
```

---

## 🔗 相关链接

- [前端文档索引](frontend/INDEX.md)
- [后端文档索引](backend/INDEX.md)
- [README.md](../README.md)

---

**最后更新**: 2026-04-11
