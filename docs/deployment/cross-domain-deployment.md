# 跨域部署配置指南

## 📋 概述

本指南说明如何在前端和后端部署在不同服务器时配置跨域访问。

## 🔧 后端 CORS 配置

### 当前配置

后端已经配置了完整的 CORS 支持，位于 `backend/src/middleware/cors.js`。

### 默认允许的域名

```javascript
const allowedOrigins = [
  'http://localhost:5173',  // Vite开发服务器
  'http://localhost:5176',  // Vite开发服务器（备用）
  'http://localhost:3000',  // 备用前端端口
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:3000',
  '*'  // 生产环境允许所有来源
]
```

### CORS 配置选项

| 选项 | 值 | 说明 |
|------|-----|------|
| `methods` | GET, POST, PUT, DELETE, OPTIONS | 允许的 HTTP 方法 |
| `allowedHeaders` | Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control | 允许的请求头 |
| `exposedHeaders` | X-Total-Count, X-Page-Count, X-Login-Attempts-Remaining | 暴露给客户端的响应头 |
| `credentials` | true | 允许发送凭据（cookies, authorization headers） |
| `maxAge` | 86400 | 预检请求缓存时间（24小时） |

## 🌐 生产环境部署

### 方案一：使用环境变量配置允许的域名

在后端服务器的 `.env` 文件中添加：

```bash
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://www.your-frontend-domain.com
```

### 方案二：修改代码配置

编辑 `backend/src/middleware/cors.js`：

```javascript
const allowedOrigins = [
  'https://v6.cn9527.cn',      // 你的前端域名
  'https://www.your-domain.com',
  // 不使用 '*'，更安全
]
```

### 方案三：使用 Nginx 反向代理（推荐）

在生产环境中，推荐使用 Nginx 反向代理而不是直接跨域访问。

#### 前端 Nginx 配置示例

```nginx
server {
    listen 80;
    server_name v6.cn9527.cn;
    root /www/wwwroot/v6.cn9527.cn/dist;

    # 前端静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端（避免跨域）
    location /api/ {
        proxy_pass http://v4.cn9527.cn:30000/api/;
        proxy_http_version 1.1;

        # 请求头设置
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # CORS 头部（如果后端也需要配置）
        add_header Access-Control-Allow-Origin "$http_origin" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        add_header Access-Control-Allow-Credentials "true" always;

        # 处理 OPTIONS 预检请求
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "$http_origin" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
            add_header Access-Control-Allow-Credentials "true" always;
            add_header Content-Length 0;
            add_header Content-Type 'text/plain; charset=utf-8';
            return 204;
        }

        # 支持文件上传
        client_max_body_size 10M;
    }
}
```

## 📱 前端配置

### API 基础 URL 配置

前端的 API 配置位于 `frontend/.env.production`：

```bash
# 生产环境配置
VITE_NODE_ENV=production
# 使用相对路径，通过 Nginx 反向代理到后端
VITE_API_BASE_URL=/api
VITE_API_TIMEOUT=15000
```

### 直接跨域访问配置（不推荐）

如果前端需要直接访问后端 API（不使用 Nginx 代理），配置：

```bash
# 生产环境配置
VITE_NODE_ENV=production
# 后端服务器的完整地址
VITE_API_BASE_URL=https://v4.cn9527.cn:30000/api
VITE_API_TIMEOUT=15000
```

**注意**：这种情况下，后端必须配置正确的 CORS 允许域名。

## 🔍 调试 CORS 问题

### 1. 检查后端 CORS 日志

后端会记录所有 CORS 请求：

```bash
pm2 logs tf2025-backend | grep CORS
```

### 2. 浏览器控制台检查

打开浏览器开发者工具（F12）：

1. **Network 标签**：查看 API 请求的响应头
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`

2. **Console 标签**：查看 CORS 错误信息

### 3. 使用 curl 测试

```bash
# 测试 OPTIONS 预检请求
curl -X OPTIONS https://your-backend.com/api/auth/login \
  -H "Origin: https://your-frontend.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v

# 测试实际请求
curl https://your-backend.com/api/auth/login \
  -H "Origin: https://your-frontend.com" \
  -H "Content-Type: application/json" \
  -v
```

## ⚠️ 常见问题

### 1. CORS 错误：No 'Access-Control-Allow-Origin' header

**原因**：后端没有正确配置 CORS，或者请求的域名不在允许列表中。

**解决方案**：
- 检查后端 CORS 配置
- 添加前端域名到允许列表
- 检查是否使用了 HTTPS/HTTP 混合

### 2. CORS 错误：Credentials mode is 'include'

**原因**：当使用 `credentials: true` 时，不能使用 `Access-Control-Allow-Origin: *`

**解决方案**：
- 后端 `origin` 配置必须是具体的域名，不能使用 `*`
- 前端 API 请求需要配置 `withCredentials: true`

### 3. OPTIONS 预检请求失败

**原因**：OPTIONS 请求没有返回正确的响应头

**解决方案**：
- 确保后端正确处理 OPTIONS 请求
- 检查服务器防火墙是否阻止 OPTIONS 请求

## 🚀 推荐部署架构

```
┌─────────────────┐
│   用户浏览器    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   前端服务器     │
│  (Nginx + Vue)  │
│   v6.cn9527.cn  │
└────────┬────────┘
         │
         │ API 请求（/api/*）
         ▼
┌─────────────────┐
│   后端服务器     │
│  (Node.js API)  │
│ v4.cn9527.cn:30000│
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   数据库服务器   │
│  (MySQL)        │
│ v4.cn9527.cn     │
└─────────────────┘
```

这种架构的优势：
1. **无跨域问题**：前端通过 Nginx 代理访问后端，同源策略
2. **安全性更好**：后端不直接暴露给公网
3. **性能更好**：可以利用 Nginx 缓存和负载均衡

## 📝 配置清单

部署前检查：

- [ ] 后端 CORS 配置正确
- [ ] 前端 API 基础 URL 配置正确
- [ ] 前端使用 `withCredentials: true`
- [ ] 后端返回正确的 CORS 响应头
- [ ] 数据库连接配置正确
- [ ] 防火墙规则正确配置
