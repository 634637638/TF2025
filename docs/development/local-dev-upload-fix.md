# 本地开发环境 - 配件图片上传修复指南

## 快速修复步骤

### 1. 启动后端服务

```bash
# 在项目根目录
cd /Users/imac/Desktop/webtset/TF2025/backend

# 确保依赖已安装
npm install

# 使用开发环境变量启动
export $(cat .env | xargs)
npm start
# 或使用 pm2
pm2 start ecosystem.config.js --env development
```

### 2. 启动前端服务

```bash
# 在前端目录
cd /Users/imac/Desktop/webtset/TF2025/frontend

# 启动开发服务器（已配置代理）
npm run dev
# 前端会运行在 http://localhost:5176
# Vite 配置了代理，会将 /api 请求转发到 http://localhost:3000
```

### 3. 测试上传功能

1. 访问 `http://localhost:5176`
2. 登录系统（使用测试账号）
3. 进入"配件管理"页面
4. 点击"配件入库"按钮
5. 点击图片上传区域，选择图片
6. 应该能成功上传

## 验证后端接口

```bash
# 测试接口是否可达
curl -X GET http://localhost:3000/api/accessories

# 测试上传接口（需要有效的 token）
TOKEN="你的token"
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/image.jpg" \
  http://localhost:3000/api/accessories/upload
```

## 检查上传目录

```bash
# 确保上传目录存在
ls -la /Users/imac/Desktop/webtset/TF2025/backend/uploads/accessories

# 如果不存在，创建它
mkdir -p /Users/imac/Desktop/webtset/TF2025/backend/uploads/accessories
```

## 故障排查

### 问题 1: 接口返回 404

**原因**: 后端服务未启动或路由未注册

**解决**:
```bash
# 检查后端服务是否运行
pm2 status
# 或
lsof -i :3000

# 查看后端日志
pm2 logs tf2025
```

### 问题 2: CORS 错误

**原因**: 前端和后端端口不同，开发环境可能有 CORS 问题

**解决**: Vite 开发服务器已配置代理，应该不会有此问题。如果仍有问题，检查 `vite.config.ts` 中的 proxy 配置。

### 问题 3: 上传目录权限错误

**原因**: uploads 目录没有写权限

**解决**:
```bash
chmod 755 /Users/imac/Desktop/webtset/TF2025/backend/uploads/accessories
```

### 问题 4: Token 无效

**原因**: 用户未登录或 token 过期

**解决**:
1. 重新登录系统
2. 打开浏览器开发者工具 → Application → Local Storage
3. 检查 `tf2025_auth` 或 `tf2025_token` 是否存在

## 相关配置文件

- `frontend/vite.config.ts` - 前端代理配置
- `backend/src/routes/accessories.js` - 上传接口
- `backend/src/middleware/unified-auth.js` - 认证中间件
- `frontend/src/components/AccessoryStockInModal.vue` - 上传组件

## 修复后的变更

### 前端变更

`AccessoryStockInModal.vue`:
- 修复了 `uploadUrl` 计算属性，确保正确拼接 API URL
- 修复了 `uploadHeaders` 计算属性，从多个来源获取 token

### Nginx 配置变更

`nginx-frontend.conf`:
- 添加了 `/api/` 路径的反向代理到后端 `30001` 端口
- 添加了 `/uploads/` 路径的静态文件代理
- 增加了文件上传的大小限制（10M）和超时时间（120s）
