# 部署文档索引

本文档区分仓库配置模板与服务器实际部署状态。服务器实际 Nginx、TLS 终止位置和 PM2 进程需在服务器核验；本地文件本身不能证明线上配置已生效。

环境文件采用唯一约定：本地开发只使用 `backend/.env`，云端生产只使用服务器本机的 `backend/.env.production`。部署时仅逐项同步新增变量，不得把本地 `.env` 整份上传覆盖云端文件。生产统一通过 `backend/start-production.js` 启动；该入口在加载业务模块前固定设置 `NODE_ENV=production`、`ENV_FILE=.env.production` 和端口 `3000`，避免宝塔或其他 PM2 管理器遗漏环境变量。线上是否正确加载以应用日志和 `/health` 为准，不能只依据 PM2 的 `node env` 元数据显示。

## 当前拓扑约定

- 浏览器通过外部前端服务器提供的 HTTPS 页面访问本站。
- 前端 Nginx 将 `/api/` 和 `/uploads/` 代理到后端 Node 服务的 `3000` 端口。
- 后端可达地址按实际网络拓扑和服务器私有运维配置选择；真实 DDNS、P2P 和内网地址不写入仓库文档。前后端同机时可使用 `127.0.0.1:3000`。
- 后端 Node 服务使用 `3000`。仓库中的 `backend/deploy/nginx.conf` 是可选入口，不属于当前主链路。
- TLS 可在外部前端 Nginx 或其前置 HTTPS 入口终止。CSP/HSTS 是否生效，以浏览器实际收到的 HTTPS 响应头为准；HTTP 后端链路不代表后端自身启用了 HTTPS。

## 操作入口

- [全云端部署参考](CLOUD_DEPLOYMENT_GUIDE.md) - 后端迁至云服务器时的替代方案，不是当前家庭后端拓扑的直接操作手册。
- [宝塔前端部署说明](BAOTA_DEPLOYMENT_GUIDE.md) - 宝塔 Nginx 站点的代理配置。
- [跨域与反向代理说明](cross-domain-deployment.md) - 直连跨域和同源代理的区别；当前优先采用同源代理。
- [上传文件存储与迁移规范](../backend/upload-storage-standard.md) - 上传目录、数据库 URL 与文件同步发布要求。
- [环境配置与密钥管理](../security/ENVIRONMENT_SECRETS.md) - `.env*` 文件不得进入 Git 或前端构建产物。
- [本地 HTTPS 开发](../frontend/security-runtime-standards.md#本地-https-开发) - 前端证书生成、唯一启动入口及检查；与生产 Nginx TLS 配置分开维护。

全新后端服务器的文件目录、`npm ci`、运行目录权限、宝塔 PM2 参数和验收命令统一维护在[全云端部署参考的后端部署章节](CLOUD_DEPLOYMENT_GUIDE.md#后端部署)，不另建重复教程。

旧的单次故障记录、过期 IP/端口示例及依赖不存在脚本的排错文档已移除；环境变量配置方式见[云端部署指南](CLOUD_DEPLOYMENT_GUIDE.md)，新增部署步骤前应先验证配置或命令确实存在。

## 部署前检查

```bash
# 后端目录：确认运行时文件及本地生产环境文件已就绪
npm run check:runtime-assets

# 前端目录：构建会先运行强制规范和安全审计
npm run build

# 前端服务器：验证 Nginx 配置后再重载
sudo nginx -t && sudo systemctl reload nginx

# 后端服务器：从本机确认 Node 健康检查
curl http://127.0.0.1:3000/live
curl http://127.0.0.1:3000/health
```

运行时资源检查包含 `backend/src/config/module-permission-capabilities.json` 和 `backend/src/config/reminder-policy.json`。生产发布完整同步 `backend/src/config/`，提醒服务不依赖后端目录之外的根目录 `config/`；详细文件清单见上方部署指南。

销售出库依赖 `invoice_sequences`；生产环境不会在请求中自动建表。该表可通过 `npm run migrate:invoice-sequences` 预览并用 `npm run migrate:invoice-sequences -- --apply` 独立补齐，不依赖统一迁移台账。发布包含其他数据库结构变更时，先备份数据库和上传目录，再在后端目录使用服务器本机 `.env.production` 运行 `npm run migrate:schema` 预览；确认目标库后才运行 `npm run migrate:schema -- --apply`。CSRF token 表使用独立的 `npm run migrate:csrf-tokens` 预览和 `npm run migrate:csrf-tokens -- --apply` 迁移。`/live` 只用于进程存活检查，`/health` 用于数据库就绪和发布验证，生产监控必须主动请求 `/health`。

生产密钥不得写入部署文档、命令历史、前端 `.env.production` 或发布包。后端 `.env.production` 留在后端服务器本机；命令行 PM2 使用 `backend/ecosystem.production.config.js`，宝塔 PM2 项目的启动文件使用 `backend/start-production.js`。两者最终进入同一个生产启动入口。
