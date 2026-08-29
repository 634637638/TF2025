# 部署文档索引

本目录包含 TF2025 项目的部署相关文档。

> 注意：权限能力清单已包含在 `backend/src/config/module-permission-capabilities.json`。
> 部署时上传完整 `backend/`，不再需要额外上传项目根目录 `config`。

## 文档列表

- [云端部署指南](CLOUD_DEPLOYMENT_GUIDE.md) - 完整的云端服务器部署教程

## 快速开始

### 最简部署流程

```bash
# 1. 安装依赖
sudo apt update
sudo apt install -y nodejs npm mysql-server nginx git

# 2. 克隆项目
cd /var/www
git clone <your-repo> tf2025
cd tf2025
npm run install:all

# 3. 配置数据库
mysql -u root -p
# 创建数据库和用户（详见部署指南）

# 4. 配置环境
cd backend
cp .env.example .env.production
nano .env.production  # 编辑配置

# 5. 检查后端运行时资源并启动
npm install -g pm2
cd backend
npm run check:runtime-assets
cd ..
pm2 start backend/server.js --name tf2025-backend

# 6. 构建前端
cd ../frontend
npm run build
sudo cp -r dist/* /www/wwwroot/your-domain/

# 7. 配置 Nginx
sudo cp *.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/tf2025-* /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 部署架构

```
用户 → Nginx → 前端 (Vue 3 静态文件)
            ↓
         后端 (Node.js API)
            ↓
         数据库 (MySQL)
```

## 服务器要求

| 资源 | 最低配置 | 推荐配置 |
|-----|---------|---------|
| CPU | 2 核 | 4 核+ |
| 内存 | 2GB | 4GB+ |
| 存储 | 20GB SSD | 50GB+ SSD |
| 系统 | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

## 相关文档

- [开发指南](../guides/)
- [数据库同步](../sync/)
- [API 标准](../guides/api-standards.md)
