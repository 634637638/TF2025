# 部署文档索引

本文档区分仓库配置模板与服务器实际部署状态。服务器实际 Nginx、TLS 终止位置和 PM2 进程需在服务器核验；本地文件本身不能证明线上配置已生效。

## 当前拓扑约定

- 浏览器通过外部前端服务器提供的 HTTPS 页面访问本站。
- 前端 Nginx 将 `/api/` 和 `/uploads/` 代理到后端 Node 服务的 `3000` 端口。
- 后端可达地址按网络位置选择：DDNS `v4.cn9527.cn:3000`、P2P `10.2.3.10:3000`；前后端同机时使用 `127.0.0.1:3000`。
- 后端 Node 服务使用 `3000`。仓库中的 `nginx-backend.conf` 是可选入口，不属于当前主链路。
- TLS 可在外部前端 Nginx 或其前置 HTTPS 入口终止。CSP/HSTS 是否生效，以浏览器实际收到的 HTTPS 响应头为准；HTTP 后端链路不代表后端自身启用了 HTTPS。

## 操作入口

- [全云端部署参考](CLOUD_DEPLOYMENT_GUIDE.md) - 后端迁至云服务器时的替代方案，不是当前家庭后端拓扑的直接操作手册。
- [宝塔前端部署说明](BAOTA_DEPLOYMENT_GUIDE.md) - 宝塔 Nginx 站点的代理配置。
- [跨域与反向代理说明](cross-domain-deployment.md) - 直连跨域和同源代理的区别；当前优先采用同源代理。
- [上传文件存储与迁移规范](../backend/upload-storage-standard.md) - 上传目录、数据库 URL 与文件同步发布要求。
- [环境配置与密钥管理](../security/ENVIRONMENT_SECRETS.md) - `.env*` 文件不得进入 Git 或前端构建产物。

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
curl http://127.0.0.1:3000/health
```

生产密钥不得写入部署文档、命令历史、前端 `.env.production` 或发布包。后端 `.env.production` 留在后端服务器本机，并由 `backend/ecosystem.production.config.js` 加载。
