# Git 变更分批提交方案

## 日期
2026-04-16

## 当前状态

- 当前工作区共有约 `101` 条未提交状态
- 其中：
  - `80` 个修改
  - `13` 个删除
  - `8` 个新增

当前状态更像“重构后的工作树尚未收口”，不是单纯代码丢失。

---

## 建议提交顺序

### 批次 1：安全修复

优先提交，避免继续在脏工作区叠加风险修复。

涉及文件：

- `backend/.env.example`
- `backend/src/middleware/jwt-blacklist.js`
- `backend/src/repositories/base.repository.js`
- `backend/src/routes/auth.js`
- `backend/src/utils/security-enhanced.js`
- `frontend/.env.production`
- `frontend/src/views/H5-admin/page/config.vue`
- `frontend/src/views/H5-mobile/page/MobileHome.vue`
- `frontend/src/vite-env.d.ts`
- `frontend/src/utils/tencent-map.ts`

建议命令：

```bash
git add \
  backend/.env.example \
  backend/src/middleware/jwt-blacklist.js \
  backend/src/repositories/base.repository.js \
  backend/src/routes/auth.js \
  backend/src/utils/security-enhanced.js \
  frontend/.env.production \
  frontend/src/views/H5-admin/page/config.vue \
  frontend/src/views/H5-mobile/page/MobileHome.vue \
  frontend/src/vite-env.d.ts \
  frontend/src/utils/tencent-map.ts

git commit -m "fix: harden auth sql and tencent map config"
```

### 批次 2：前端 TS 迁移与工具替换

这批是结构性替换，和安全修复分开更清晰。

涉及文件：

- `frontend/package.json`
- `frontend/src/api/attendance.ts`
- `frontend/src/api/menu.js`
- `frontend/src/api/menu.ts`
- `frontend/src/utils/dynamicRouter.js`
- `frontend/src/utils/dynamicRouter.ts`

说明：

- `frontend/package.json` 已移除失效的 `audit:pagination` 脚本引用
- `menu.js -> menu.ts`
- `dynamicRouter.js -> dynamicRouter.ts`

建议命令：

```bash
git add \
  frontend/package.json \
  frontend/src/api/attendance.ts \
  frontend/src/api/menu.js \
  frontend/src/api/menu.ts \
  frontend/src/utils/dynamicRouter.js \
  frontend/src/utils/dynamicRouter.ts

git commit -m "refactor: migrate menu and dynamic router to typescript"
```

### 批次 3：前端移动端与组件重构

这批体量最大，建议单独提交。

涉及范围：

- `frontend/src/components/**`
- `frontend/src/composables/**`
- `frontend/src/router/guards.ts`
- `frontend/src/stores/auth.ts`
- `frontend/src/styles/**`
- `frontend/src/views/**`

重点说明：

- `useDeviceDetection.ts`
- `useMobile.ts`
- `useResponsive.ts`

这些删除已由 `frontend/src/composables/mobile.ts` 聚合替代，不属于裸删。

### 批次 4：后端权限/认证/业务重构

涉及范围：

- `backend/package*.json`
- `backend/src/app.js`
- `backend/src/config/index.js`
- `backend/src/controllers/**`
- `backend/src/middleware/unified-auth.js`
- `backend/src/repositories/customer.repository.js`
- `backend/src/repositories/sales-order.repository.js`
- `backend/src/repositories/user.repository.js`
- `backend/src/routes/**`
- `backend/src/services/**`

说明：

- `backend/src/config/swagger.js` 的删除与 `backend/package.json`、`backend/src/app.js` 中 Swagger 接入的移除是成套变化
- 这更像“明确下线 Swagger”，不是单文件误删

### 批次 5：文档与审查记录

涉及文件：

- `docs/00-INDEX.md`
- `docs/development/FRONTEND_CODE_AUDIT_VERIFIED_2026-04-15.md`

建议命令：

```bash
git add docs/00-INDEX.md docs/development/FRONTEND_CODE_AUDIT_VERIFIED_2026-04-15.md
git commit -m "docs: add verified frontend audit notes"
```

---

## 需要人工确认的删除项

以下 3 项建议你在正式提交前再确认一次业务意图：

### 1. `auto-backup-cleanup.sh`

判断：

- 当前未发现代码引用
- 删除不会影响项目运行
- 但会失去一键备份清理工具

建议：

- 如果你仍需要本地运维辅助脚本，恢复保留
- 如果团队已经不再用它，可以正常提交删除

### 2. `backend/src/config/swagger.js`

判断：

- 与 `backend/src/app.js` 的 Swagger 挂载逻辑删除一致
- 与 `backend/package.json` 的 Swagger 依赖删除一致

建议：

- 如果你决定继续停用 Swagger，直接提交删除
- 如果后续还要保留在线 API 文档，应恢复整套功能，而不是只恢复单文件

### 3. `docs/guides/API_DOCUMENTATION_GUIDE.md`

判断：

- 属于 Swagger 使用说明文档
- 既然 Swagger 已成套下线，这份文档删除是合理的

建议：

- 如果 Swagger 确认停用，则一起删除
- 如果 Swagger 要恢复，这份文档也应一起恢复

---

## 不建议现在做的事

- 不建议把全部变更一次性提交为一个大提交
- 不建议现在回滚整个工作区
- 不建议在未快照前继续叠加新需求开发

---

## 建议操作

### 最稳妥流程

```bash
git checkout -b chore/wip-snapshot-2026-04-16
git add -A
git commit -m "chore: wip snapshot before cleanup"
```

然后再按上面的批次从这个快照分支里整理正式提交。

### 如果你不想先做总快照

至少先提交“安全修复”这一批，再继续整理剩余重构。
