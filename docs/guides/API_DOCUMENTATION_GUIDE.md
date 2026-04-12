# TF2025 API 文档使用指南

> **API 文档地址**: `http://localhost:3000/api-docs` (开发环境)
> **生产环境**: `https://your-domain/api-docs`

---

## 📚 什么是 Swagger/OpenAPI？

**Swagger/OpenAPI** 是一套自动生成 API 文档的规范和工具。它可以：
- 自动从代码注释生成在线 API 文档
- 提供可交互的 API 测试界面
- 标准化 API 接口定义

---

## 🚀 快速开始

### 1. 访问 API 文档

启动后端服务后，在浏览器中访问：

```
http://localhost:3000/api-docs
```

### 2. 认证配置

大部分 API 需要认证，按以下步骤配置：

1. 点击文档页面右上角的 **"Authorize"** 按钮
2. 在弹出框中输入 JWT Token（格式：`Bearer your_token_here`）
3. 点击 **"Authorize"** 确认
4. 关闭弹出框

**获取 Token 的方式：**
```bash
# 使用登录接口获取
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sadmin","password":"123456"}'
```

### 3. 测试 API

1. 找到要测试的 API 接口
2. 点击接口展开详情
3. 点击 **"Try it out"** 按钮
4. 填写请求参数
5. 点击 **"Execute"** 执行请求
6. 在下方查看响应结果

---

## 📝 添加 API 文档注释

### 基础模板

```javascript
/**
 * @swagger
 * /api/资源路径:
 *   post:
 *     summary: 接口简要描述
 *     description: 接口详细说明
 *     tags: [标签名]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field1:
 *                 type: string
 *                 description: 字段说明
 *     responses:
 *       200:
 *         description: 成功响应
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/resource', async (req, res) => {
  // 路由处理逻辑
});
```

### GET 请求示例

```javascript
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: 获取用户列表
 *     description: 分页获取用户列表，支持搜索和筛选
 *     tags: [用户管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: 按角色筛选
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['0', '1']
 *         description: 按状态筛选：0-禁用，1-启用
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get('/', async (req, res) => {
  // ...
});
```

### POST 请求示例

```javascript
/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: 创建新用户
 *     description: 创建一个新用户，需要管理员权限
 *     tags: [用户管理]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - name
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 description: 用户名
 *                 example: "john_doe"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 100
 *                 description: 密码
 *                 example: "securePassword123"
 *               name:
 *                 type: string
 *                 description: 真实姓名
 *                 example: "张三"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 邮箱地址
 *                 example: "john@example.com"
 *               phone:
 *                 type: string
 *                 description: 手机号码
 *                 example: "13800138000"
 *               roleId:
 *                 type: integer
 *                 description: 角色ID
 *                 example: 2
 *     responses:
 *       200:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "用户创建成功"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', async (req, res) => {
  // ...
});
```

### PUT/PATCH 请求示例

```javascript
/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: 更新用户信息
 *     description: 完整更新指定用户的信息
 *     tags: [用户管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id', async (req, res) => {
  // ...
});
```

### DELETE 请求示例

```javascript
/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: 删除用户
 *     description: 删除指定用户（软删除）
 *     tags: [用户管理]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 用户ID
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 用户不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', async (req, res) => {
  // ...
});
```

---

## 🏷️ 可用的 Schema 引用

在 `swagger.js` 中已定义的可复用 Schema：

| Schema 名称 | 说明 |
|------------|------|
| `ApiResponse` | 通用响应格式 |
| `PaginatedResponse` | 分页响应格式 |
| `ErrorResponse` | 错误响应格式 |
| `User` | 用户实体 |
| `Customer` | 客户实体 |
| `Phone` | 手机库存实体 |

使用方式：
```yaml
$ref: '#/components/schemas/User'
```

---

## 📋 可用的 Parameter 引用

| Parameter 名称 | 说明 |
|----------------|------|
| `PageParam` | 分页参数 |
| `LimitParam` | 每页数量参数 |
| `SearchParam` | 搜索关键词参数 |

使用方式：
```yaml
- $ref: '#/components/parameters/PageParam'
```

---

## 🎯 API 文档注释规范

### 必填字段

每个 API 文档注释必须包含：

1. **`summary`**: 接口简要描述（一行）
2. **`description`**: 详细说明（多行支持 Markdown）
3. **`tags`**: 分组标签
4. **`responses`**: 响应定义（至少 200 和错误响应）

### 推荐字段

1. **`security`**: 认证要求（如需登录）
2. **`requestBody`**: 请求体定义（POST/PUT）
3. **`parameters`**: 请求参数定义（GET/DELETE）

### 描述写法

```javascript
/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: 获取用户列表
 *     description: |
 *       分页获取用户列表
 *
 *       **功能说明：**
 *       - 支持按角色筛选
 *       - 支持按状态筛选
 *       - 支持关键词搜索
 *
 *       **权限要求：**
 *       - 需要 `users_usersview:view` 权限
 *
 *       **注意事项：**
 *       - 返回数据按创建时间倒序排列
 *     tags: [用户管理]
 */
```

---

## 🔧 修改 Swagger 配置

### 添加新的 Schema

编辑 `backend/src/config/swagger.js`：

```javascript
schemas: {
  // 添加新实体
  Product: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      price: { type: 'number' }
    }
  }
}
```

### 添加新的 Tag

```javascript
tags: [
  {
    name: '新模块',
    description: '新模块的描述'
  }
]
```

---

## 📦 导出 API 文档

### 导出 JSON

```bash
curl http://localhost:3000/api-docs.json > api-docs.json
```

### 使用 Swagger UI

Swagger UI 已集成在项目中，直接访问 `/api-docs` 即可。

---

## 🐛 常见问题

### 1. 文档不显示

**原因**：注释格式不正确

**解决**：
- 确保使用 `/** @swagger */` 格式
- 注释必须在路由定义之前
- 检查 YAML 缩进是否正确

### 2. Schema 引用失败

**原因**：Schema 未定义或引用路径错误

**解决**：
- 检查 `swagger.js` 中是否已定义该 Schema
- 确认引用路径格式为 `#/components/schemas/SchemaName`

### 3. 参数无法展开

**原因**：Parameters 定义位置错误

**解决**：
- GET 请求参数应在 `parameters` 中定义
- POST/PUT 请求体应在 `requestBody` 中定义

---

## 📚 参考资源

- [OpenAPI 3.0 规范](https://swagger.io/specification/)
- [Swagger 注释文档](https://github.com/SwaggerAPITools/swagger-ui/blob/master/docs/usage/swagger2-annotation-mapping.md)
- [项目 API 标准](./api-standards.md)

---

**最后更新**: 2026-01-23
**维护者**: TF2025 开发团队
