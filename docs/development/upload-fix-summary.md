# 配件图片上传功能修复 - 完整摘要

## 问题描述

配件管理页面中图片上传后无法显示，控制台报错：
```
[ErrorBoundary] HIGH: Resource loading failed: http://localhost:5176/uploads/accessories/accessory-xxx.png
```

同时上传接口也报错：
```
UploadAjaxError: {"success":false,"message":"接口不存在","path":"/api/accessories/upload","method":"POST"}
```

## 根本原因分析

### 问题 1: 生产环境 - Nginx 缺少 API 代理配置
前端 Nginx 配置 (`nginx-frontend.conf`) 只配置了静态文件服务，缺少 `/api` 和 `/uploads` 路径的反向代理。

### 问题 2: 开发环境 - Vite 缺少 uploads 代理配置
Vite 开发服务器的 proxy 配置只包含 `/api` 路径，缺少 `/uploads` 路径的代理。

### 问题 3: 前端组件 - Token 获取逻辑不完整
`AccessoryStockInModal.vue` 组件的 `uploadHeaders` 只从 `authStore.token` 获取 token，没有考虑其他存储位置。

## 已修复的文件

### 1. 前端组件修复

**文件**: `frontend/src/components/AccessoryStockInModal.vue`

**修复内容**:
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

### 2. 开发环境修复

**文件**: `frontend/vite.config.ts`

**修复内容**:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path
  },
  '/uploads': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path
  }
}
```

### 3. 生产环境修复

**文件**: `nginx-frontend.conf`

**修复内容**:
```nginx
# API 反向代理到后端服务器
location /api/ {
    proxy_pass http://127.0.0.1:30001/api/;
    # ... 其他配置
    client_max_body_size 10M;
}

# 上传文件访问
location /uploads/ {
    proxy_pass http://127.0.0.1:30001/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

## 部署步骤

### 开发环境

1. **重启前端开发服务器**:
   ```bash
   cd /Users/imac/Desktop/webtset/TF2025/frontend
   # 按 Ctrl+C 停止当前服务器
   npm run dev
   ```

2. **确保后端服务运行**:
   ```bash
   cd /Users/imac/Desktop/webtset/TF2025/backend
   npm start
   ```

3. **测试上传功能**:
   - 访问 `http://localhost:5176`
   - 登录后进入配件管理
   - 点击"配件入库"并上传图片

### 生产环境

1. **构建前端**:
   ```bash
   cd /Users/imac/Desktop/webtset/TF2025/frontend
   npm run build
   ```

2. **上传文件到服务器**:
   ```bash
   # 上传构建后的前端文件
   scp -r dist/* user@v6.cn9527.cn:/www/wwwroot/v6.cn9527.cn/

   # 上传 Nginx 配置和部署脚本
   scp nginx-frontend.conf deploy-accessories-upload-fix.sh user@v6.cn9527.cn:/home/user/
   ```

3. **在服务器上执行部署**:
   ```bash
   ssh user@v6.cn9527.cn
   cd /home/user
   sudo ./deploy-accessories-upload-fix.sh
   ```

## 验证步骤

### 1. 检查上传接口

```bash
# 登录获取 token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sadmin","password":"123456"}' | \
  jq -r '.data.token')

# 测试上传
curl -X POST http://localhost:3000/api/accessories/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-image.png"
```

### 2. 检查图片访问

```bash
# 上传成功后，响应会包含图片 URL
# 访问该 URL 验证图片可访问
curl -I http://localhost:3000/uploads/accessories/accessory-xxx.png
```

### 3. 检查上传目录

```bash
# 本地开发环境
ls -la /Users/imac/Desktop/webtset/TF2025/backend/uploads/accessories

# 生产环境
ls -la /www/wwwroot/v6.cn9527.cn/backend/uploads/accessories
```

## 故障排查

### 问题: 上传接口返回 404

**检查**:
- 后端服务是否运行: `pm2 status` 或 `lsof -i :3000`
- 路由是否注册: 检查 `backend/src/routes/index.js` 中是否有 `router.use('/accessories', accessoriesRoutes)`

### 问题: 图片上传成功但无法显示

**检查**:
- 开发环境: 确认 `vite.config.ts` 中有 `/uploads` 代理配置
- 生产环境: 确认 `nginx-frontend.conf` 中有 `/uploads/` 反向代理配置
- 静态文件服务: 确认后端 `app.js` 中有 `app.use('/uploads', express.static(...))` 配置

### 问题: Token 相关错误

**检查**:
- 用户是否已登录
- LocalStorage 中是否有 `tf2025_auth` 或 `tf2025_token`
- Token 是否过期（默认 7 天有效）

## 相关文档

- [生产环境部署指南](./deployment/fix-accessories-upload.md)
- [本地开发环境指南](./development/local-dev-upload-fix.md)
- [Nginx 配置说明](../../nginx-frontend.conf)

## 测试账号

- 管理员: `sadmin` / `123456`
- 销售员: `3333` / `636363`
