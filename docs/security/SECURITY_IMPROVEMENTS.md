# TF2025 项目安全性优化总结

## 概述

本文档总结了 TF2025 项目的安全性优化措施和实施结果。

---

## 1. SQL 注入防护 ✅

### 问题分析
- **ORDER BY 子句拼接**：多个 repository 文件中存在直接拼接用户输入的排序参数
- **LIMIT/OFFSET 拼接**：分页参数未经验证直接拼接到 SQL 语句
- **动态表名拼接**：部分查询存在表名直接拼接风险

### 解决方案
创建了 `backend/src/utils/security-enhanced.js` 工具库，提供：

1. **ORDER BY 白名单验证**
   - 为每个表定义允许的排序字段
   - `sanitizeOrderBy(orderBy, tableName)` 函数自动验证和清理排序参数

2. **LIMIT/OFFSET 验证**
   - `sanitizeLimitOffset(value, max)` 函数确保数值在安全范围内
   - 默认最大值 10000 可配置

3. **表名和字段名验证**
   - `isValidTableName(tableName, allowedTables)` 防止表名注入
   - `isValidFieldName(fieldName)` 防止字段名注入

### 修改文件
- [base.repository.js](../backend/src/repositories/base.repository.js)
  - `findAll()` 方法
  - `findBy()` 方法
  - `paginate()` 方法

### 使用示例
```javascript
const { sanitizeOrderBy, sanitizeLimitOffset } = require('../utils/security-enhanced');

// 在查询中使用
const safeOrderBy = sanitizeOrderBy(orderBy, 'brands');
const safeLimit = sanitizeLimitOffset(limit, 1000);

sql += ` ORDER BY ${safeOrderBy} LIMIT ${safeLimit}`;
```

---

## 2. XSS 防护 ✅

### 问题分析
- 前端缺少 DOMPurify 或类似过滤库
- 没有用户输入转义处理机制
- 后端缺少输入清洗

### 解决方案

#### 后端防护
在 `backend/src/utils/security-enhanced.js` 中提供：

1. **HTML 实体编码**
   - `escapeHtml(str)` - 转义 HTML 特殊字符

2. **输入清理**
   - `sanitizeInput(input)` - 移除恶意内容（script 标签、事件处理器等）
   - `sanitizeObject(obj)` - 递归清理对象中的所有字符串
   - `sanitizeQuery(query)` - 清理查询参数

#### 前端防护
创建了 `frontend/src/utils/security.ts` 工具库：

1. **DOMPurify 集成**
   - `sanitizeHtml(html, config)` - 清理 HTML 内容
   - `sanitizeText(text)` - 提取纯文本内容

2. **Vue 自定义指令**
   - `v-sanitize` - 自动清理 v-html 绑定的内容
   - `v-escape-html` - 转义 HTML 特殊字符

3. **CSP 违规监控**
   - `initCSPReporting()` - 监控内容安全策略违规

### 使用示例
```vue
<template>
  <!-- 使用 v-sanitize 指令 -->
  <div v-sanitize="userInput"></div>

  <!-- 或手动清理 -->
  <div v-html="sanitizeHtml(userInput)"></div>
</template>

<script setup>
import { sanitizeHtml } from '@/utils/security'
</script>
```

---

## 3. 文件上传安全 ✅

### 问题分析
- 文件类型验证不够严格（只检查扩展名和 MIME 类型）
- 没有文件内容验证（Magic Numbers）
- 文件名可能包含危险字符

### 解决方案
创建了 `backend/src/middleware/upload-security.js` 中间件：

1. **多层验证**
   - 扩展名白名单验证
   - MIME 类型白名单验证
   - 文件大小限制（5MB）
   - **Magic Number 验证**（文件内容真实性检查）

2. **安全存储**
   - 按日期组织目录结构
   - 使用加密安全的随机文件名
   - 自动创建目录（mode 0o755）

3. **安全中间件**
   - `uploadSingle(fieldName)` - 单文件上传
   - `uploadMultiple(fieldName, maxCount)` - 多文件上传
   - `uploadFields(fields)` - 多字段文件上传
   - 验证失败自动删除已上传文件

### Magic Numbers 验证
```javascript
const FILE_MAGIC_NUMBERS = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46]
};
```

### 使用示例
```javascript
const { uploadSingle } = require('../middleware/upload-security');

// 在路由中使用
router.post('/upload', uploadSingle('file'), (req, res) => {
  // 文件已验证并安全存储
  const fileInfo = req.uploadedFiles[0];
  res.json({ success: true, file: fileInfo });
});
```

---

## 4. JWT 安全机制 ✅

### 问题分析
- JWT 密钥硬编码在代码中
- 黑名单主要存储在内存中，服务器重启后失效
- 没有实现刷新令牌轮换

### 解决方案

#### 1. 密钥安全
更新了环境变量配置：
- 在 `.env.production` 中使用强随机密钥
- 提供生成密钥的命令：`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

#### 2. 数据库持久化黑名单
增强了 `backend/src/middleware/jwt-blacklist.js`：

- 新增 `PERSIST_BLACKLIST` 配置选项
- 实现内存 + 数据库双层缓存
- 定期清理过期令牌

#### 3. Token 安全增强
- 为每个 Token 生成唯一的 JTI（JWT ID）
- 使用加密安全的随机数生成器
- 异步的黑名单检查

### 配置示例
```bash
# .env.production
JWT_SECRET=your_secure_64_char_hex_key_here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
JWT_BLACKLIST_PERSIST=true
```

---

## 5. CSRF 防护 ✅

### 问题分析
- 现有 CSRF 实现只基于 session
- 没有数据库持久化
- 缺少速率限制

### 解决方案
增强了 `backend/src/routes/csrf.js`：

1. **数据库持久化**
   - Token 存储在 `csrf_tokens` 表中
   - 内存 + 数据库双层缓存

2. **安全增强**
   - 使用加密安全的随机 Token 生成
   - 每个 Token 有唯一 ID 和过期时间
   - 限制每个用户最多持有 10 个 Token

3. **中间件选项**
   - `validateCSRFToken` - 强制验证（用于写操作）
   - `optionalCSRFValidation` - 可选验证（提供 Token 时验证）

### 配置选项
```javascript
const CSRF_CONFIG = {
  TOKEN_LENGTH: 32,           // Token 长度（字节）
  TOKEN_EXPIRY: 3600,         // Token 过期时间（秒）
  MAX_TOKENS_PER_USER: 10,    // 每用户最大 Token 数
  ENABLE_PERSISTENCE: true,   // 启用数据库持久化
  ENABLE_RATE_LIMIT: true     // 启用速率限制
};
```

---

## 6. 其他安全增强

### 输入验证工具
提供了完整的输入验证函数：
- `isValidEmail(email)` - 邮箱验证
- `isValidPhone(phone)` - 电话号码验证（中国大陆）
- `isValidIdCard(idCard)` - 身份证号验证（带校验码）
- `isValidAmount(amount)` - 金额验证

### 密码安全
- `validatePassword(password)` - 密码强度评估
- `generateSecurePassword(length)` - 生成安全随机密码
- 最小长度要求：8 位
- 推荐长度：12+ 位

### 路径安全
- `isSafePath(path)` - 防止路径遍历攻击
- `normalizePath(path)` - 规范化路径

---

## 安全检查清单

### 后端
- [x] SQL 注入防护（参数化查询 + 白名单验证）
- [x] XSS 防护（输入清理 + 输出转义）
- [x] 文件上传安全（类型 + 大小 + 内容验证）
- [x] JWT 安全（环境变量密钥 + 数据库黑名单）
- [x] CSRF 防护（Token 验证 + 数据库持久化）
- [x] 输入验证（邮箱、电话、身份证等）
- [x] 密码安全（强度验证 + bcrypt 哈希）
- [x] 安全头部（Helmet 中间件）
- [x] 速率限制（登录、API 调用）

### 前端
- [x] DOMPurify 集成（HTML 内容清理）
- [x] 自定义安全指令（v-sanitize, v-escape-html）
- [x] CSP 违规监控
- [x] 输入验证（邮箱、电话、身份证等）
- [x] Token 安全存储
- [x] XSS 防护（默认转义，谨慎使用 v-html）

---

## 部署建议

### 生产环境配置
1. **生成强随机密钥**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **更新环境变量**
   ```bash
   # .env.production
   JWT_SECRET=<生成的64字符密钥>
   JWT_BLACKLIST_PERSIST=true
   ```

3. **安装前端依赖**
   ```bash
   cd frontend
   npm install dompurify
   ```

4. **创建数据库表**
   ```sql
   CREATE TABLE jwt_blacklist (
     id INT AUTO_INCREMENT PRIMARY KEY,
     jti VARCHAR(64) NOT NULL UNIQUE,
     user_id INT NOT NULL,
     token_type ENUM('access', 'refresh') NOT NULL,
     reason VARCHAR(50),
     created_at DATETIME NOT NULL,
     expires_at DATETIME NOT NULL,
     INDEX idx_user (user_id),
     INDEX idx_expires (expires_at)
   );

   CREATE TABLE csrf_tokens (
     id INT AUTO_INCREMENT PRIMARY KEY,
     token_id VARCHAR(64) NOT NULL UNIQUE,
     user_id INT NOT NULL,
     token VARCHAR(128) NOT NULL,
     created_at DATETIME NOT NULL,
     expires_at DATETIME NOT NULL,
     INDEX idx_user (user_id),
     INDEX idx_expires (expires_at)
   );
   ```

---

## 文件清单

### 新增文件
- `backend/src/utils/security-enhanced.js` - 后端安全工具库
- `backend/src/middleware/upload-security.js` - 文件上传安全中间件
- `frontend/src/utils/security.ts` - 前端安全工具库

### 修改文件
- `backend/src/repositories/base.repository.js` - SQL 安全增强
- `backend/src/middleware/jwt-blacklist.js` - JWT 安全增强
- `backend/src/routes/csrf.js` - CSRF 防护增强
- `backend/.env.production` - 环境变量配置
- `backend/.env.example` - 环境变量示例
- `frontend/package.json` - 添加 dompurify 依赖
- `frontend/src/main.ts` - 注册安全指令

---

## 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
