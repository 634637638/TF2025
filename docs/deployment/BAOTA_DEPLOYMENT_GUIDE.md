# 宝塔面板部署指南 - 前后端分离跨服务器部署

## 架构说明
- **前端服务器**: 10.2.3.24 (宝塔面板)
- **后端服务器**: v4.cn9527.cn:30000 (Node.js API)
- **问题**: 前端和后端部署在不同的服务器上，需要配置跨域和反向代理

---

## 步骤一：更新前端 Nginx 配置

在宝塔面板中：

1. 找到网站 `10.2.3.24`
2. 点击「设置」→「配置文件」
3. 替换为以下配置（或手动修改关键部分）

### 关键修改点：

```nginx
# API 代理到后端服务器（关键配置）
location /api/ {
    # 修改这里：指向您的后端服务器
    proxy_pass http://v4.cn9527.cn:30000/api/;

    # HTTP 版本
    proxy_http_version 1.1;

    # 请求头设置
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # CORS 头部
    add_header Access-Control-Allow-Origin "$http_origin" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
    add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,X-CSRF-Token,X-Device-Info,X-Required-Permission" always;
    add_header Access-Control-Allow-Credentials "true" always;

    # 处理 OPTIONS 预检请求
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin "$http_origin" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,X-CSRF-Token,X-Device-Info,X-Required-Permission" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Content-Length 0;
        add_header Content-Type 'text/plain; charset=utf-8';
        return 204;
    }

    # 超时设置
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;

    # 支持文件上传
    client_max_body_size 10M;
}
```

4. 保存配置
5. 重载 Nginx：在宝塔面板「软件商店」→「Nginx」→「重载配置」

---

## 步骤二：更新后端 CORS 配置

在后端服务器 `v4.cn9527.cn` 上：

1. 找到后端项目的 `.env.production` 文件
2. 修改 `ALLOWED_ORIGINS` 配置：

```bash
# CORS配置 - 允许前端服务器访问（跨服务器部署）
ALLOWED_ORIGINS=http://10.2.3.24,http://182.140.180.74:50124,http://v6.cn9527.cn:33336,https://v6.cn9527.cn:33336,http://localhost:5176,http://localhost:3000,http://127.0.0.1:5176
```

3. 重启后端服务：

```bash
# 使用 PM2 重启
pm2 restart TF2025-backend

# 或使用您项目的重启命令
npm run restart:production
```

---

## 步骤三：验证配置

### 1. 检查前端 Nginx 代理

在前端服务器上执行：

```bash
# 测试 API 代理是否正常
curl -I http://10.2.3.24/api/health

# 应该返回 200 状态码，并包含后端服务器的响应
```

### 2. 检查后端 CORS 配置

```bash
# 测试 CORS 预检请求
curl -X OPTIONS http://v4.cn9527.cn:30000/api/auth/login \
  -H "Origin: http://10.2.3.24" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v

# 应该返回包含 Access-Control-Allow-Origin 的响应头
```

### 3. 浏览器测试

1. 打开浏览器开发者工具（F12）
2. 访问 `http://10.2.3.24`
3. 尝试登录
4. 在「Network」标签中检查 `/api/auth/login` 请求

**成功的标志：**
- 请求 URL 为：`http://10.2.3.24/api/auth/login`（相对路径）
- 状态码为：`200 OK`（不是 502）
- 响应头包含：`Access-Control-Allow-Origin`

---

## 常见问题排查

### 问题 1：仍然返回 502 错误

**原因**：Nginx 无法连接到后端服务器

**解决方案**：
1. 检查后端服务器是否正常运行：`curl http://v4.cn9527.cn:30000/health`
2. 检查防火墙是否放行 30000 端口
3. 检查 Nginx 错误日志：`tail -f /www/wwwlogs/10.2.3.24.error.log`

### 问题 2：CORS 错误

**原因**：后端未允许前端域名

**解决方案**：
1. 确认后端 `.env.production` 中的 `ALLOWED_ORIGINS` 包含前端地址
2. 重启后端服务
3. 检查后端日志中的 CORS 警告信息

### 问题 3：请求 URL 仍然是 50124 端口

**原因**：前端代码中可能有硬编码的 API URL

**解决方案**：
1. 确认前端构建时使用的是 `.env.production` 配置
2. 检查是否有其他文件直接使用了 `http://182.140.180.74:50124`
3. 重新构建前端：`npm run build`

---

## 安全建议

1. **使用 HTTPS**：在生产环境中，建议为前后端都配置 SSL 证书
2. **限制访问来源**：在 `ALLOWED_ORIGINS` 中只添加实际需要的前端域名
3. **配置防火墙**：限制后端 API 只允许特定 IP 访问
4. **启用认证**：确保所有 API 端点都需要身份验证

---

## 完整配置文件

完整的前端 Nginx 配置已保存在：`/Users/imac/Desktop/webtset/TF2025/nginx-baota-frontend.conf`

您可以直接复制到宝塔面板的配置文件中。
