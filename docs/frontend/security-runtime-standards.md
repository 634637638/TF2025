# 安全与运行时审计规范

## 开发环境模块加载

Vite 通过 `optimizeDeps.include` 在启动时预构建 Element Plus 的 `element-plus/es` 和 `element-plus/es/components/**/style/css`，覆盖自动导入插件生成的组件样式路径，减少懒加载页面首次进入时的依赖重新优化。测试或临时组件服务器必须使用独立 `cacheDir`，不得覆盖正在运行的开发服务器缓存。

出现 `Failed to fetch dynamically imported module` 时，应检查失败模块及其依赖请求。`504 Outdated Optimize Dep` 表示开发预构建依赖版本失效，不能直接判断为业务 API 故障或组件语法错误；修复缓存冲突或依赖预构建配置后重新加载页面。不要通过删除业务缓存、忽略错误或无限自动刷新掩盖问题。

## 日常启动与审计时机

根目录 `npm run dev`、`npm start`、`npm run frontend`，以及前端目录 `npm run dev`、`npm start` 和 HTTPS 开发入口直接启动服务，不自动运行全量审计或业务测试。一次性修复、地区资源准备和数据库迁移也不能挂到这些入口自动重跑；真实数据库写入仍须获得本次明确授权。

已修复问题的正式回归测试和审计保留，通过根目录 `npm run check:standards` 手动执行。日常 `build` 和 `build:debug` 只执行 Vite 构建及产物体积门禁，避免重复运行全量规范和单元测试。发布使用 `build:release`，先执行 `check:release` 再构建，失败不得发布。`check:coverage` 的隔离 npm 生命周期回归验证这些边界；后端必要的环境、运行时资源和单实例安全检查继续执行。

## 本地 HTTPS 开发

普通开发默认 HTTP。需要真机摄像头等 HTTPS 能力时，先在前端目录执行 `npm run cert:local -- <本机局域网IP>` 生成本地证书，再从仓库根目录执行：

```bash
npm --prefix frontend run dev:https
```

唯一入口为 `frontend/scripts/start-dev-https.sh`，按脚本位置定位前端目录，校验证书文件后设置 `TF_USE_HTTPS=true` 并调用日常 `npm run dev` 入口，不自动执行全量审计。缺少证书必须失败，不能显示 HTTPS 成功提示后回退 HTTP；访问地址以 Vite 实际输出为准，不硬编码手机 IP。证书与私钥位于忽略提交的 `frontend/ssl/`，本地 CA 需要在测试设备上信任，不上传生产服务器。

`npm --prefix frontend run check:dev-https` 验证缺证书拒绝启动、目录定位、HTTPS 开关、参数和退出码传递，已接入 `check:standards`；该测试使用临时替身，不启动真实服务或替代真机 TLS 验收。

## 生产构建与产物

日常生产构建入口为 `frontend/package.json` 的 `build` 脚本，从仓库根目录执行 `npm --prefix frontend run build`，执行 Vite 生产构建和 `check:bundle-size`。发布构建使用 `npm --prefix frontend run build:release`，先执行 `check:release`，再复用同一个 `build` 入口，避免审计和构建重复执行。输出目录由 `frontend/vite.config.ts` 的 `build.outDir` 统一指定为 `frontend/dist/`；每次构建清理该目录旧产物并生成本次静态文件。

登录首屏不加载业务专用的表格拖动和 TAB 滚动工具；两者复用 `main.ts` 的业务路由初始化入口动态加载，并由原公共工具保证全局只初始化一次。构建仍使用现有体积基线，不通过提高限额或关闭检查规避超限。

后台布局和表格样式 `admin-layout.css` 随后台布局及两个公开报价路由加载。入口共享同一份样式，Vite 在路由组件渲染前加载相应的 CSS。

按用户要求，标准打包只更新 `frontend/dist/`，不自动生成 `dist.zip`、TAR 或其他部署归档，也不增加自动压缩钩子或第二个构建脚本。用户自行压缩、上传该目录内容。Vite 的代码压缩和静态资源 `.gz` 预压缩继续沿用现有配置，它们属于站点资源优化；根目录 `本地备份/` 的项目源码压缩备份按独立特例保留，见[备份管理](../backend/backup-management.md#git-管理页项目压缩包)。

## 审计要求

错误上报遵循[日志系统规范](../guides/LOG_SYSTEM_STANDARDS.md#42-前端日志行为)：非生产构建只保留本地诊断，生产通过唯一 `globalErrorLogger` 和 `unifiedApi` 上报符合条件的技术故障；普通业务、输入和权限提示不外发。T5 已提供默认关闭的[生产故障邮件告警](../backend/error-alerting.md)，待用户手动部署、配置及实际收件验收；不得将站内上报成功或 SMTP 接受视为负责人已收到通知。

后端不得使用 `eval`、`new Function`、硬编码密钥，SQL 和文件路径不得直接插入请求字段。没有认证中间件的完整路由文件必须登记在 `backend/scripts/config/backend-security-audit.json`，公开白名单只允许真实公开且经过数据最小化审查的接口。

前端使用 `v-html` 时，表达式必须来自登记并经过审查的净化函数。组件和组合式函数创建的周期定时器必须在生命周期结束时清理；确实与应用同生命周期的单例定时器需要登记在 `frontend/scripts/runtime-pattern-audit.json`。

强制检查：

```bash
cd frontend
npm run check:backend-security
npm run check:runtime-patterns
npm run type-check
```

依赖漏洞检查需要访问 npm 公告服务，因此不阻断离线开发和普通本地构建。发布前必须执行：

```bash
cd frontend
npm run check:release
```

仓库依赖 CI 入口为 `.github/workflows/dependency-audit.yml`：每个 PR、每周一北京时间 10:00 和手动触发时，分别审计根目录、前端和后端的完整锁文件（含开发依赖），high/critical 或公告服务错误使对应任务失败，三端互不提前中断。CI 不安装依赖、不执行仓库脚本、不读取部署环境文件；Actions 固定提交且只有代码只读权限，审计 JSON 保留 7 天。该工作流不上传或部署前后端，也不替代发布前的 `check:release`。

工作流进入 GitHub 后，仓库管理员需将三个 `Dependency audit (root/frontend/backend)` 状态分别设为目标分支必需检查，或用等价 ruleset 阻止失败时合并；仅有工作流文件不能证明合并已被阻断。首次远程执行和保护规则验证的进度统一登记[技术债务台账 T8](../development/TECHNICAL_DEBT_PROGRESS.md)，不能以本地 YAML 检查冒充 CI 验收。依赖豁免必须记录包、CVE、到期日及替代控制，不关闭检查、不用 `npm audit fix --force` 绕过问题。

禁止为了通过检查而扩大白名单。新增公开路由、`v-html` 来源或永久定时器时，必须先完成代码审查并说明无法使用更安全模式的原因。

公开路由必须按具体方法和路径登记，并说明数据最小化与访问边界。导航公开接口只返回导航展示所需字段；客服设置不提供独立二维码读取接口。包含后台采购、门店、库存或员工数据的选项接口不得登记为公开路由；需要公开展示的数据必须建立独立的最小字段公共接口。

## 退出会话

`stores/auth.ts` 的主动退出复用 `unifiedApi.post('/auth/logout')`，不能只清前端存储。统一 API 等待已发出的令牌刷新完成再发送注销，避免刷新响应重新设置 HttpOnly Cookie；注销期间禁止新刷新。后端注销沿用访问/刷新令牌撤销和同路径 Cookie 清理；前端最后清理本地身份，并使旧身份查询、登录、刷新响应失效。网络或服务器故障时提示注销未确认，不能把本地清除当作服务器撤销成功。隔离回归为 `auth-permission-state.spec.ts`、`api-loading.spec.ts` 和后端 `auth-session-controller.check.js`；真实浏览器 Cookie 及多窗口行为需单独验收。
