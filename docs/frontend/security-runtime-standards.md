# 安全与运行时审计规范

## 开发环境模块加载

Vite 通过 `optimizeDeps.include` 在启动时预构建 Element Plus 的 `element-plus/es` 和 `element-plus/es/components/**/style/css`，覆盖自动导入插件生成的组件样式路径，减少懒加载页面首次进入时的依赖重新优化。测试或临时组件服务器必须使用独立 `cacheDir`，不得覆盖正在运行的开发服务器缓存。

出现 `Failed to fetch dynamically imported module` 时，应检查失败模块及其依赖请求。`504 Outdated Optimize Dep` 表示开发预构建依赖版本失效，不能直接判断为业务 API 故障或组件语法错误；修复缓存冲突或依赖预构建配置后重新加载页面。不要通过删除业务缓存、忽略错误或无限自动刷新掩盖问题。

## 审计要求

后端不得使用 `eval`、`new Function`、硬编码密钥，SQL 和文件路径不得直接插入请求字段。没有认证中间件的完整路由文件必须登记在 `config/backend-security-audit.json`，公开白名单只允许真实公开且经过数据最小化审查的接口。

前端使用 `v-html` 时，表达式必须来自登记并经过审查的净化函数。组件和组合式函数创建的周期定时器必须在生命周期结束时清理；确实与应用同生命周期的单例定时器需要登记在 `config/runtime-pattern-audit.json`。

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
