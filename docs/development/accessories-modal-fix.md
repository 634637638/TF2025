# 配件入库/编辑模态框修复总结

## 修复的问题

### 1. 图片上传后无法预览
**原因**: Vite 开发服务器缺少 `/uploads` 路径的代理配置
**修复**: 在 `vite.config.ts` 中添加了 `/uploads` 路径代理

### 2. 编辑配件时报错 Network Error
**原因**: 编辑模式下提交的数据包含了不应该发送的字段（如 `total_quantity`, `store_id`, `distribution` 等）
**修复**: 在 `handleSubmit` 函数中，编辑模式只发送配件基础信息字段

### 3. 图片 URL 处理不完善
**原因**: 图片 URL 是相对路径，没有统一处理
**修复**: 添加了 `displayImageUrl` 计算属性和 `handleImageError` 错误处理函数

## 已修改的文件

### 1. `frontend/vite.config.ts`
添加 `/uploads` 路径代理配置：
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path
  },
  '/uploads': {  // 新增
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path
  }
}
```

### 2. `frontend/src/components/AccessoryStockInModal.vue`

#### 添加 `displayImageUrl` 计算属性：
```typescript
const displayImageUrl = computed(() => {
  if (!formData.value.image_url) return ''
  if (formData.value.image_url.startsWith('http')) {
    return formData.value.image_url
  }
  return formData.value.image_url
})
```

#### 添加 `handleImageError` 错误处理：
```typescript
const handleImageError = (event) => {
  console.warn('图片加载失败:', formData.value.image_url)
  event.target.style.display = 'none'
}
```

#### 修复 `handleSubmit` 函数（编辑模式）：
```typescript
if (isEditMode.value) {
  // 编辑模式：只更新配件基础信息
  const updateData = {
    name: formData.value.name,
    barcode: formData.value.barcode || null,
    category: formData.value.category || null,
    brand_id: formData.value.brand_id || null,
    model_id: formData.value.model_id || null,
    color_id: formData.value.color_id || null,
    supplier_id: formData.value.supplier_id || null,
    purchase_price: formData.value.purchase_price || 0,
    selling_price: formData.value.selling_price || 0,
    unit: formData.value.unit || '个',
    specifications: formData.value.specifications || null,
    status: formData.value.status !== undefined ? formData.value.status : 1,
    min_stock: formData.value.min_stock || 5,
    image_url: formData.value.image_url || null,
    remarks: formData.value.remarks || null
  }
  await api.put(`/accessories/${formData.value.id}`, updateData)
  ElMessage.success('更新成功！')
}
```

#### 更新模板中的图片绑定：
```vue
<img :src="displayImageUrl" alt="配件图片" @error="handleImageError" />
```

## 功能验证

### 入库模式测试
1. 点击"配件入库"按钮
2. 扫描或输入条形码（可选）
3. 上传配件图片
4. 填写配件信息（名称、分类、供应商、进价、售价等）
5. 设置入库数量和门店分配
6. 点击"确认入库"
7. **验证点**:
   - 图片上传成功后立即显示预览
   - 入库成功后列表中显示新配件
   - 配件卡片中显示上传的图片

### 编辑模式测试
1. 点击配件卡片的"编辑"按钮
2. **验证点**:
   - 模态框标题显示"编辑配件"
   - 已有图片显示预览
   - 所有字段填充正确
   - 可以修改图片和配件信息
3. 修改配件信息或更换图片
4. 点击"保存修改"
5. **验证点**:
   - 更新成功，无网络错误
   - 列表中配件信息已更新
   - 新图片正确显示

## 图片处理流程

### 上传流程
1. 用户选择图片文件
2. 前端验证：必须是图片类型，大小 < 2MB
3. 发送 POST 请求到 `/api/accessories/upload`
4. 后端保存文件到 `backend/uploads/accessories/` 目录
5. 后端返回文件 URL：`/uploads/accessories/accessory-xxx.png`
6. 前端更新 `formData.image_url`
7. 前端通过 `displayImageUrl` 计算属性显示图片

### 访问流程（开发环境）
1. 前端请求：`http://localhost:5176/uploads/accessories/xxx.png`
2. Vite 代理转发到：`http://localhost:3000/uploads/accessories/xxx.png`
3. 后端 Express 静态文件服务返回文件

### 访问流程（生产环境）
1. 前端请求：`https://v6.cn9527.cn:33336/uploads/accessories/xxx.png`
2. Nginx 代理转发到：`http://127.0.0.1:30001/uploads/accessories/xxx.png`
3. 后端 Express 静态文件服务返回文件

## 常见问题排查

### 图片上传成功但无法显示
1. 检查浏览器控制台是否有图片加载错误
2. 检查 `/uploads` 代理配置是否正确
3. 检查后端静态文件服务是否正常

### 编辑时出现 Network Error
1. 检查后端服务是否运行
2. 检查 `/api` 代理配置是否正确
3. 检查配件 ID 是否正确

### 图片 URL 显示正确但图片破裂
1. 检查文件是否存在于后端 `uploads/accessories` 目录
2. 检查文件权限是否正确
3. 尝试直接访问图片 URL 验证

## 需要重启的服务

修改后需要重启以下服务：

### 开发环境
```bash
# 重启前端（使 vite.config.ts 生效）
cd frontend
# Ctrl+C 停止当前服务
npm run dev

# 后端一般不需要重启
```

### 生产环境
```bash
# 重新构建前端
cd frontend
npm run build

# 上传到服务器
scp -r dist/* user@server:/www/wwwroot/v6.cn9527.cn/

# 更新 Nginx 配置
sudo ./deploy-accessories-upload-fix.sh

# 重启后端（如果需要）
pm2 restart tf2025-backend
```
