# TF2025 云服务器部署指南

## 快速修复（项目本来正常的情况）

如果项目本来运行正常，突然出现环境变量错误，请按以下步骤操作：

### 立即修复命令

```bash
# 方式1: 使用重启脚本（推荐）
cd /www/wwwroot/api2025.com
chmod +x restart-production.sh
./restart-production.sh

# 方式2: 手动重启
cd /www/wwwroot/api2025.com/backend

# 停止现有服务
pm2 stop tf2025-api
pm2 delete tf2025-api

# 重新启动（明确指定环境变量）
NODE_ENV=production \
DB_HOST=v4.cn9527.cn \
DB_PORT=3306 \
DB_NAME=TF2025 \
DB_USER=TF2025 \
DB_PASSWORD=TF2025 \
JWT_SECRET=TF2025_JWT_SECRET_KEY_32_CHARS_LONG_FOR_SECURITY \
PORT=30000 \
pm2 start server.js --name tf2025-api

# 保存配置
pm2 save
```

### 验证修复

```bash
# 检查服务状态
pm2 status

# 查看启动日志
pm2 logs tf2025-api --lines 50

# 测试 API
curl http://localhost:30000/api/health
```

## 问题说明

如果在云端启动时出现以下错误：
```
Error: 缺少必需的环境变量: DB_PASSWORD
at /www/wwwroot/api2025.com/backend/src/config/index.js:10:13
```

这表示服务器启动时没有正确加载环境变量。

## 解决方案

### 方案一：使用 PM2 启动（推荐）

1. **上传文件到服务器**
   ```bash
   # 确保以下文件已上传到服务器
   /www/wwwroot/api2025.com/backend/.env.production
   /www/wwwroot/api2025.com/backend/ecosystem.production.js
   ```

2. **检查 .env.production 文件**
   ```bash
   cat /www/wwwroot/api2025.com/backend/.env.production
   ```
   确保包含以下必需配置：
   ```env
   DB_HOST=v4.cn9527.cn
   DB_PORT=3306
   DB_NAME=TF2025
   DB_USER=TF2025
   DB_PASSWORD=TF2025
   JWT_SECRET=TF2025_JWT_SECRET_KEY_32_CHARS_LONG_FOR_SECURITY
   PORT=30000
   NODE_ENV=production
   ```

3. **使用 ecosystem 配置启动**
   ```bash
   cd /www/wwwroot/api2025.com/backend

   # 停止现有服务
   pm2 stop tf2025-api 2>/dev/null || true
   pm2 delete tf2025-api 2>/dev/null || true

   # 使用生产配置启动
   pm2 start ecosystem.production.js --env production

   # 保存配置
   pm2 save

   # 设置开机自启
   pm2 startup
   ```

4. **查看服务状态**
   ```bash
   pm2 status
   pm2 logs tf2025-api
   ```

### 方案二：直接使用环境变量启动

1. **使用 cloud-start.sh 脚本**
   ```bash
   cd /www/wwwroot/api2025.com
   chmod +x cloud-start.sh
   ./cloud-start.sh
   ```

### 方案三：手动设置环境变量

如果上述方案都不可用，可以手动设置环境变量：

```bash
#!/bin/bash
export NODE_ENV=production
export PORT=30000
export DB_HOST=v4.cn9527.cn
export DB_PORT=3306
export DB_NAME=TF2025
export DB_USER=TF2025
export DB_PASSWORD=TF2025
export JWT_SECRET=TF2025_JWT_SECRET_KEY_32_CHARS_LONG_FOR_SECURITY

cd /www/wwwroot/api2025.com/backend
node server.js
```

## 常见问题

### 1. 端口被占用
```bash
# 查找占用端口的进程
lsof -i :30000

# 杀死进程
kill -9 <PID>
```

### 2. PM2 命令不存在
```bash
# 全局安装 PM2
npm install -g pm2
```

### 3. 权限问题
```bash
# 给脚本添加执行权限
chmod +x /www/wwwroot/api2025.com/cloud-start.sh
chmod +x /www/wwwroot/api2025.com/backend/server.js
```

### 4. 数据库连接失败
- 检查数据库服务器是否可访问
- 确认防火墙规则允许连接
- 验证数据库用户名和密码

## 服务管理命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs tf2025-api

# 实时查看日志
pm2 logs tf2025-api --lines 100

# 重启服务
pm2 restart tf2025-api

# 停止服务
pm2 stop tf2025-api

# 删除服务
pm2 delete tf2025-api

# 监控服务
pm2 monit
```

## 验证部署

启动成功后，应该看到以下输出：
```
🚀 服务器启动成功
📍 端口: 30000
🌍 环境: production
⏰ 启动时间: 2026-01-19 20:00:00
```

可以通过以下命令验证 API 是否正常工作：
```bash
curl http://localhost:30000/api/health
```

## 更新代码后重新部署

```bash
cd /www/wwwroot/api2025.com

# 拉取最新代码
git pull

# 安装依赖（如有变化）
cd backend && npm install --production

# 重启服务
pm2 restart tf2025-api
```

## 生产环境检查清单

- [ ] .env.production 文件已配置并上传
- [ ] ecosystem.production.js 已配置
- [ ] PM2 已安装并配置为开机自启
- [ ] 数据库连接正常
- [ ] 防火墙规则已配置
- [ ] 日志目录有写入权限
- [ ] 上传目录有写入权限
- [ ] CORS 配置正确（ALLOWED_ORIGINS）
