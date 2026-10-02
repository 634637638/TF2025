# 跨域部署配置指南

## 📋 概述

本指南说明前后端分离部署方式。优先由前端 Nginx 代理 `/api/` 到后端 API 入口，这样浏览器访问同源地址，不需要 CORS。

## 🔧 后端 CORS 配置

### 后端实现与默认值

后端 CORS 中间件位于 `backend/src/middleware/cors.js`，允许来源默认值由 `backend/src/config/constants.js` 提供。

### 默认开发来源

```javascript
const allowedOrigins = [
  'http://localhost:5173',  // Vite开发服务器
  'http://localhost:5176',  // Vite开发服务器（备用）
  'http://localhost:3000',  // 备用前端端口
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:3000'
]
```

生产环境应只配置可信的准确来源。后端读取 `ALLOWED_ORIGINS`（兼容旧变量 `CORS_ORIGIN`）；直连跨域时必须显式配置准确的 scheme、host 和 port。未提供环境变量时默认只允许源码列出的本地开发来源。开发环境 CORS 中间件较宽松，不应把开发行为当作生产策略。

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
        proxy_pass http://v4.cn9527.cn:3000/api/;
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

如确需浏览器直接访问独立 API 域名（不使用 Nginx 代理），配置：

```bash
# 生产环境配置
VITE_NODE_ENV=production
# 仅直接跨域访问时才设置后端完整地址；应由后端 ALLOWED_ORIGINS 严格白名单保护
VITE_API_BASE_URL=https://api.example.com/api
VITE_API_TIMEOUT=15000
```

**注意**：这种情况下，后端必须在 `ALLOWED_ORIGINS` 配置前端完整 origin；不得使用 `*`，也不得在代理层反射请求的 `Origin`。

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
│ v4.cn9527.cn:3000 │
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
2. **入口集中**：可在 HTTPS 前端入口统一配置 TLS、请求限制和安全响应头
3. **部署灵活**：API 可使用 `/api` 相对路径，是否启用缓存或负载均衡需单独配置

反向代理只改变浏览器访问路径，不会自动关闭或隐藏可从公网直连的后端地址。若需限制后端网络暴露，必须另外配置防火墙、访问控制或私有网络；当前家庭后端 DDNS/P2P 链路按服务器实际可达性核验。

## 配置清单

部署前检查：

- [ ] 直连跨域时，后端允许列表包含准确的前端 origin；同源代理时确认后端自定义 Origin 校验与代理链路匹配
- [ ] 前端 API 基础 URL 配置正确
- [ ] 前端使用 `withCredentials: true`
- [ ] 只有浏览器直接跨域请求时，才要求验证 CORS 响应头；同源代理不依赖 `Access-Control-Allow-Origin`
- [ ] 数据库连接配置正确
- [ ] 防火墙规则正确配置
