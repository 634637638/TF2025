# 环境变量错误快速修复

## 错误信息
```
Error: 缺少必需的环境变量: DB_PASSWORD
at /www/wwwroot/api2025.com/backend/src/config/index.js:10:13
```

## 一键修复（复制粘贴执行）

```bash
cd /www/wwwroot/api2025.com/backend && \
pm2 stop tf2025-api 2>/dev/null || true && \
pm2 delete tf2025-api 2>/dev/null || true && \
NODE_ENV=production \
DB_HOST=v4.cn9527.cn \
DB_PORT=3306 \
DB_NAME=TF2025 \
DB_USER=TF2025 \
DB_PASSWORD=TF2025 \
JWT_SECRET=TF2025_JWT_SECRET_KEY_32_CHARS_LONG_FOR_SECURITY \
PORT=30000 \
pm2 start server.js --name tf2025-api && \
pm2 save && \
echo "✅ 服务已重启" && \
pm2 status
```

## 检查结果

```bash
# 查看日志
pm2 logs tf2025-api

# 查看状态
pm2 status
```

## 如果问题仍然存在

```bash
# 检查 .env.production 文件
cat /www/wwwroot/api2025.com/backend/.env.production

# 诊断问题
cd /www/wwwroot/api2025.com
bash fix-cloud-env.sh
```

## 常见原因

1. **PM2 没有正确加载 .env 文件** - PM2 不会自动加载 .env 文件，需要明确指定
2. **NODE_ENV 环境变量未设置** - 导致 dotenv 加载了错误的配置文件
3. **.env.production 文件权限问题** - 确保 PM2 进程可以读取该文件

## 永久解决方案

使用 ecosystem 配置文件并明确指定所有环境变量：

```bash
cd /www/wwwroot/api2025.com/backend
pm2 start ecosystem.production.js --env production
pm2 save
```
