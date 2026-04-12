# 配件图片上传功能修复指南

## 问题描述

配件管理页面中的图片上传功能报错：
```
UploadAjaxError: {"success":false,"message":"接口不存在","path":"/api/accessories/upload","method":"POST"}
```

## 根本原因

前端 Nginx 配置缺少 `/api` 路径的反向代理配置，导致前端的 API 请求无法正确路由到后端服务器。

**问题分析：**
- 前端部署在 `v6.cn9527.cn:33336`
- 后端运行在 `127.0.0.1:30001`
- 前端使用相对路径 `/api` 调用后端接口
- 前端 Nginx 只配置了静态文件服务，没有配置 API 代理

## 解决方案

### 1. 前端修改

已更新 `AccessoryStockInModal.vue` 组件，修复了上传 URL 和 Authorization header 的获取逻辑：

```typescript
// 图片上传配置
const uploadUrl = computed(() => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  if (apiBaseUrl.startsWith('http')) {
    return `${apiBaseUrl}/accessories/upload`
  }
  return `${apiBaseUrl}/accessories/upload`
})

const uploadHeaders = computed(() => {
  const token = authStore.token || localStorage.getItem('tf2025_token') ||
                (JSON.parse(localStorage.getItem('tf2025_auth') || '{}')?.token)
  return {
    Authorization: token ? `Bearer ${token}` : ''
  }
})
```

### 2. Nginx 配置更新

已更新 `nginx-frontend.conf`，添加以下配置：

```nginx
# API 反向代理到后端服务器
location /api/ {
    proxy_pass http://127.0.0.1:30001/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;

    # 超时设置（文件上传需要更长时间）
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;

    # 支持文件上传
    client_max_body_size 10M;
}

# 上传文件访问（代理到后端静态文件服务）
location /uploads/ {
    proxy_pass http://127.0.0.1:30001/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # 缓存设置
    expires 30d;
    add_header Cache-Control "public, immutable";
    add_header X-Content-Type-Options "nosniff" always;
}
```

## 部署步骤

### 1. 部署前端代码

```bash
# 在前端目录
cd /Users/imac/Desktop/webtset/TF2025/frontend
npm run build
```

### 2. 更新服务器上的前端文件

```bash
# 上传构建后的文件到服务器
scp -r dist/* user@v6.cn9527.cn:/www/wwwroot/v6.cn9527.cn/
```

### 3. 上传并执行 Nginx 更新脚本

```bash
# 上传更新脚本
scp update-nginx.sh nginx-frontend.conf user@v6.cn9527.cn:/home/user/

# SSH 登录到服务器
ssh user@v6.cn9527.cn

# 执行更新脚本
cd /home/user
sudo ./update-nginx.sh
```

### 4. 验证修复

1. 访问配件管理页面
2. 点击"配件入库"按钮
3. 点击上传图片区域
4. 选择一张图片上传
5. 应该能成功上传并显示图片

## 验证命令

### 检查 Nginx 配置

```bash
# 检查配置语法
sudo nginx -t

# 查看 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 错误日志
sudo tail -f /www/wwwlogs/v6.cn9527.cn.error.log
```

### 测试 API 连接

```bash
# 测试上传接口（需要有效的 token）
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.jpg" \
  https://v6.cn9527.cn:33336/api/accessories/upload
```

## 注意事项

1. **端口确认**: 确保后端服务运行在 `30001` 端口（根据 `.env.production` 配置）
2. **文件权限**: 确保 `/www/wwwroot/v6.cn9527.cn/backend/uploads/accessories` 目录存在且有写权限
3. **CORS 配置**: 确保后端 CORS 允许前端域名
4. **Token 有效性**: 确保用户登录状态正常，token 未过期

## 相关文件

- `frontend/src/components/AccessoryStockInModal.vue` - 上传组件
- `nginx-frontend.conf` - 前端 Nginx 配置
- `backend/src/routes/accessories.js` - 后端上传接口
- `update-nginx.sh` - Nginx 更新脚本
