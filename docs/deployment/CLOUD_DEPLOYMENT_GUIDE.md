# TF2025 云端部署指南

本文档详细说明如何将 TF2025 项目部署到云端服务器。

## 目录

- [架构概述](#架构概述)
- [服务器要求](#服务器要求)
- [部署前准备](#部署前准备)
- [后端部署](#后端部署)
- [前端部署](#前端部署)
- [Nginx 配置](#nginx-配置)
- [域名配置](#域名配置)
- [SSL 证书配置](#ssl-证书配置)
- [进程管理](#进程管理)
- [监控与日志](#监控与日志)
- [常见问题](#常见问题)

---

## 架构概述

```
┌─────────────────────────────────────────────────────────┐
│                        用户浏览器                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Nginx 反向代理                          │
│  前端: v6.cn9527.cn:33336                                 │
│  API:  api.cn9527.cn:3001                                │
└────────┬──────────────────────────────┬─────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐          ┌──────────────────┐
│   Vue 3 前端      │          │  Node.js 后端     │
│   静态文件        │          │  Express API      │
│   端口: 33336     │          │  端口: 3001       │
└──────────────────┘          └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │  云端 MySQL 数据库 │
                              │  端口: 3306       │
                              └──────────────────┘
```

---

## 服务器要求

### 推荐配置

| 资源 | 最低配置 | 推荐配置 |
|-----|---------|---------|
| CPU | 2 核 | 4 核+ |
| 内存 | 2GB | 4GB+ |
| 存储 | 20GB SSD | 50GB+ SSD |
| 系统 | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| Node.js | 16.x | 18.x+ |
| MySQL | 5.7 | 8.0+ |

### 需要安装的软件

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 MySQL 8.0
sudo apt install -y mysql-server

# 安装 Nginx
sudo apt install -y nginx

# 安装 PM2 (进程管理)
sudo npm install -g pm2

# 安装 Git
sudo apt install -y git
```

---

## 部署前准备

### 1. 克隆项目

```bash
# 克隆代码到服务器
cd /var/www
sudo git clone <你的仓库地址> tf2025
cd tf2025

# 安装依赖
npm run install:all
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cd backend
cp .env.example .env.production

# 编辑生产环境配置
nano .env.production
```

**生产环境配置示例：**

```bash
# 数据库配置（云端数据库）
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=tf2025_user
DB_PASSWORD=your_strong_password_here
DB_NAME=tf2025_prod
DB_CONNECTION_LIMIT=20

# JWT 配置（使用强密钥）
JWT_SECRET=your_very_secure_jwt_secret_key_at_least_32_characters_long_change_me
JWT_EXPIRES_IN=24h

# 服务器配置
PORT=3001
NODE_ENV=production

# 日志配置
LOG_LEVEL=warn

# API 配置（生产环境适当收紧）
API_RATE_LIMIT=60
API_RATE_WINDOW_MS=900000

# 安全配置
BCRYPT_ROUNDS=12
SESSION_SECRET=your_session_secret_key_change_me_to_something_secure

# 缓存配置
CACHE_TTL=3600
CACHE_MAX_KEYS=5000
```

### 3. 创建数据库

```bash
# 登录 MySQL
sudo mysql -u root -p

# 执行以下 SQL 命令
CREATE DATABASE tf2025_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tf2025_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';
GRANT ALL PRIVILEGES ON tf2025_prod.* TO 'tf2025_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 导入数据库结构（如果有备份文件）
mysql -u tf2025_user -p tf2025_prod < database_backup.sql
```

---

## 后端部署

### 1. 构建后端

```bash
cd /var/www/tf2025/backend

# 使用生产环境配置启动
NODE_ENV=production node server.js
```

### 2. 使用 PM2 管理进程

```bash
# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'tf2025-backend',
    script: './server.js',
    cwd: '/var/www/tf2025/backend',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/tf2025/backend-error.log',
    out_file: '/var/log/tf2025/backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M'
  }]
}
EOF

# 创建日志目录
sudo mkdir -p /var/log/tf2025
sudo chown $USER:$USER /var/log/tf2025

# 启动应用
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 按照输出的提示执行命令
```

### 3. 验证后端运行

```bash
# 查看 PM2 状态
pm2 status

# 查看日志
pm2 logs tf2025-backend

# 测试 API
curl http://localhost:3001/api/health
```

---

## 前端部署

### 1. 构建前端

```bash
cd /var/www/tf2025/frontend

# 创建生产环境配置
cat > .env.production << 'EOF'
VITE_API_BASE_URL=https://api.cn9527.cn
VITE_APP_TITLE=TF2025 销售管理系统
VITE_APP_ENV=production
EOF

# 安装依赖
npm install

# 构建生产版本
npm run build
```

### 2. 部署静态文件

```bash
# 创建网站目录
sudo mkdir -p /www/wwwroot/v6.cn9527.cn

# 复制构建文件
sudo cp -r dist/* /www/wwwroot/v6.cn9527.cn/

# 设置权限
sudo chown -R www-data:www-data /www/wwwroot/v6.cn9527.cn
sudo chmod -R 755 /www/wwwroot/v6.cn9527.cn
```

---

## Nginx 配置

### 1. 后端 Nginx 配置

```bash
# 复制后端配置
sudo cp /var/www/tf2025/nginx-backend.conf /etc/nginx/sites-available/tf2025-backend

# 创建软链接启用站点
sudo ln -s /etc/nginx/sites-available/tf2025-backend /etc/nginx/sites-enabled/

# 添加限流配置到 nginx.conf
sudo nano /etc/nginx/nginx.conf
# 在 http 块中添加：
# limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 2. 前端 Nginx 配置

```bash
# 复制前端配置
sudo cp /var/www/tf2025/nginx-frontend.conf /etc/nginx/sites-available/tf2025-frontend

# 创建软链接
sudo ln -s /etc/nginx/sites-available/tf2025-frontend /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 3. 完整的 Nginx 配置示例

**后端配置文件** (`/etc/nginx/sites-available/tf2025-backend`):

```nginx
# TF2025 后端 Nginx 配置
upstream tf2025_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.cn9527.cn;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.cn9527.cn;

    # SSL 证书配置（下面会说明）
    ssl_certificate /etc/ssl/certs/api.cn9527.cn.crt;
    ssl_certificate_key /etc/ssl/private/api.cn9527.cn.key;

    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 反向代理
    location / {
        proxy_pass http://tf2025_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 文件上传
    location /api/upload {
        client_max_body_size 10M;
        proxy_pass http://tf2025_backend;
    }

    # 日志
    access_log /var/log/nginx/tf2025-backend-access.log;
    error_log /var/log/nginx/tf2025-backend-error.log;
}
```

**前端配置文件** (`/etc/nginx/sites-available/tf2025-frontend`):

```nginx
# TF2025 前端 Nginx 配置
server {
    listen 80;
    listen [::]:80;
    server_name v6.cn9527.cn;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name v6.cn9527.cn;

    # SSL 证书配置
    ssl_certificate /etc/ssl/certs/v6.cn9527.cn.crt;
    ssl_certificate_key /etc/ssl/private/v6.cn9527.cn.key;

    # 网站根目录
    root /www/wwwroot/v6.cn9527.cn;
    index index.html;

    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # HTML 不缓存
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # 日志
    access_log /var/log/nginx/tf2025-frontend-access.log;
    error_log /var/log/nginx/tf2025-frontend-error.log;
}
```

---

## 域名配置

### DNS 解析设置

在你的域名服务商（如阿里云、腾讯云）添加以下解析记录：

| 主机记录 | 记录类型 | 记录值 | TTL |
|---------|---------|--------|-----|
| api | A | 你的服务器公网 IP | 600 |
| v6 | A | 你的服务器公网 IP | 600 |
| @ | A | 你的服务器公网 IP | 600 |

### 防火墙配置

```bash
# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 允许 SSH（确保已启用）
sudo ufw allow 22/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

---

## SSL 证书配置

### 使用 Let's Encrypt 免费证书

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 自动配置证书（会自动修改 Nginx 配置）
sudo certbot --nginx -d api.cn9527.cn -d v6.cn9527.cn

# 按照提示输入邮箱并同意服务条款

# 测试自动续期
sudo certbot renew --dry-run

# Certbot 会自动添加 cron 任务进行续期
```

### 手动配置证书（如果有自己的证书）

```bash
# 创建证书目录
sudo mkdir -p /etc/ssl/certs /etc/ssl/private

# 复制证书文件
sudo cp your-certificate.crt /etc/ssl/certs/api.cn9527.cn.crt
sudo cp your-private-key.key /etc/ssl/private/api.cn9527.cn.key

# 设置权限
sudo chmod 644 /etc/ssl/certs/api.cn9527.cn.crt
sudo chmod 600 /etc/ssl/private/api.cn9527.cn.key
```

---

## 进程管理

### PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs tf2025-backend

# 重启应用
pm2 restart tf2025-backend

# 停止应用
pm2 stop tf2025-backend

# 删除应用
pm2 delete tf2025-backend

# 监控
pm2 monit

# 查看详细信息
pm2 show tf2025-backend
```

### 开机自启动

```bash
# 保存当前 PM2 配置
pm2 save

# 生成启动脚本
pm2 startup

# 按照输出的提示执行命令（类似下面）
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your-user --hp /home/your-user
```

---

## 监控与日志

### 日志管理

```bash
# 查看应用日志
pm2 logs tf2025-backend --lines 100

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/tf2025-backend-error.log
sudo tail -f /var/log/nginx/tf2025-frontend-access.log

# 日志轮转配置
sudo nano /etc/logrotate.d/tf2025
```

**logrotate 配置示例：**

```
/var/log/tf2025/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 性能监控

```bash
# 安装监控工具
npm install -g pm2-logrotate
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 更新部署

### 更新代码流程

```bash
# 1. 拉取最新代码
cd /var/www/tf2025
git pull origin main

# 2. 更新后端
cd backend
npm install
pm2 restart tf2025-backend

# 3. 更新前端
cd ../frontend
npm install
npm run build
sudo cp -r dist/* /www/wwwroot/v6.cn9527.cn/

# 4. 重载 Nginx（如果配置有变更）
sudo nginx -t && sudo systemctl reload nginx
```

### 数据库迁移

```bash
# 备份当前数据库
mysqldump -u tf2025_user -p tf2025_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# 执行迁移脚本
mysql -u tf2025_user -p tf2025_prod < migration_script.sql
```

---

## 常见问题

### 1. 端口被占用

```bash
# 查看端口占用
sudo netstat -tlnp | grep :3001

# 杀死占用进程
sudo kill -9 <PID>
```

### 2. 权限问题

```bash
# 修改文件所有者
sudo chown -R $USER:$USER /var/www/tf2025

# 修改文件夹权限
sudo chmod -R 755 /var/www/tf2025
```

### 3. Nginx 502 错误

检查后端服务是否运行：
```bash
pm2 status
curl http://localhost:3001/api/health
```

### 4. 前端白屏

检查 Nginx 配置和构建文件：
```bash
sudo nginx -t
ls -la /www/wwwroot/v6.cn9527.cn/
```

### 5. 数据库连接失败

检查数据库配置和权限：
```bash
# 测试连接
mysql -u tf2025_user -p -h 127.0.0.1 tf2025_prod

# 检查 MySQL 服务
sudo systemctl status mysql
```

---

## 安全建议

1. **定期更新系统**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **配置防火墙**
   ```bash
   sudo ufw enable
   ```

3. **使用强密码**
   - 数据库密码至少 16 位
   - JWT Secret 至少 32 位

4. **定期备份数据**
   ```bash
   # 备份数据库
   mysqldump -u tf2025_user -p tf2025_prod > backup.sql
   ```

5. **监控日志**
   ```bash
   # 定期查看异常日志
   sudo tail -f /var/log/nginx/tf2025-backend-error.log
   ```

---

## 相关文档

- [开发指南](../guides/)
- [数据库同步指南](../sync/DATABASE_SYNC_GUIDE.md)
- [API 标准](../guides/api-standards.md)
