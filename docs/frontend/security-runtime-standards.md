# 安全与运行时审计规范

## 开发环境模块加载

Vite 通过 `optimizeDeps.include` 在启动时预构建 Element Plus 的 `element-plus/es` 和 `element-plus/es/components/**/style/css`，覆盖自动导入插件生成的组件样式路径，减少懒加载页面首次进入时的依赖重新优化。测试或临时组件服务器必须使用独立 `cacheDir`，不得覆盖正在运行的开发服务器缓存。

出现 `Failed to fetch dynamically imported module` 时，应检查失败模块及其依赖请求。`504 Outdated Optimize Dep` 表示开发预构建依赖版本失效，不能直接判断为业务 API 故障或组件语法错误；修复缓存冲突或依赖预构建配置后重新加载页面。不要通过删除业务缓存、忽略错误或无限自动刷新掩盖问题。

## 本地 HTTPS 开发

普通开发默认 HTTP。需要真机摄像头等 HTTPS 能力时，先在前端目录执行 `npm run cert:local -- <本机局域网IP>` 生成本地证书，再从仓库根目录执行：

```bash
npm --prefix frontend run dev:https
```

唯一入口为 `frontend/scripts/start-dev-https.sh`，按脚本位置定位前端目录，校验证书文件后设置 `TF_USE_HTTPS=true` 并调用 `npm run dev`，继续执行现有启动前规范门禁。缺少证书必须失败，不能显示 HTTPS 成功提示后回退 HTTP；访问地址以 Vite 实际输出为准，不硬编码手机 IP。证书与私钥位于忽略提交的 `frontend/ssl/`，本地 CA 需要在测试设备上信任，不上传生产服务器。

`npm --prefix frontend run check:dev-https` 验证缺证书拒绝启动、目录定位、HTTPS 开关、参数和退出码传递，已接入 `check:standards`；该测试使用临时替身，不启动真实服务或替代真机 TLS 验收。

## 生产构建与产物

唯一标准生产入口为 `frontend/package.json` 的 `build` 脚本，从仓库根目录执行 `npm --prefix frontend run build`：先由 `prebuild` 执行完整规范门禁，再执行 Vite 生产构建和 `check:bundle-size`。输出目录由 `frontend/vite.config.ts` 的 `build.outDir` 统一指定为 `frontend/dist/`；每次构建清理该目录旧产物并生成本次静态文件。

登录首屏不加载业务专用的表格拖动和 TAB 滚动工具；两者复用 `main.ts` 的业务路由初始化入口动态加载，并由原公共工具保证全局只初始化一次。构建仍使用现有体积基线，不通过提高限额或关闭检查规避超限。

按用户要求，标准打包只更新 `frontend/dist/`，不自动生成 `dist.zip`、TAR 或其他部署归档，也不增加自动压缩钩子或第二个构建脚本。用户自行压缩、上传该目录内容。Vite 的代码压缩和静态资源 `.gz` 预压缩继续沿用现有配置，它们属于站点资源优化；根目录 `本地备份/` 的项目源码压缩备份按独立特例保留，见[备份管理](../backend/backup-management.md#git-管理页项目压缩包)。

## 审计要求

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

禁止为了通过检查而扩大白名单。新增公开路由、`v-html` 来源或永久定时器时，必须先完成代码审查并说明无法使用更安全模式的原因。

公开路由必须按具体方法和路径登记，并说明数据最小化与访问边界。导航公开接口只返回导航展示所需字段；客服设置不提供独立二维码读取接口。包含后台采购、门店、库存或员工数据的选项接口不得登记为公开路由；需要公开展示的数据必须建立独立的最小字段公共接口。
