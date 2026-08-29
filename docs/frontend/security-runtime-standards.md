# 安全与运行时审计规范

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

当前公开路由文件白名单只登记 `price-list-public.js`。包含后台采购、门店、库存或员工数据的选项接口不得登记为公开路由；需要公开展示的数据必须建立独立的最小字段公共接口。
