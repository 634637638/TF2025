# 天翼云盘登录方案总结

## 已实现功能

### 1. Cookie 一键获取工具 ✅

**访问地址**: `http://localhost:5176/get-ctyun-cookie.html`（开发环境）

**三种获取方式**:

#### 方式一：书签工具（最简单）
1. 打开工具页面
2. 将"🔖 获取天翼云 Cookie"链接拖到浏览器书签栏
3. 在天翼云盘登录后，点击书签
4. 自动提取并显示 Cookie，一键复制

#### 方式二：控制台代码
1. 在天翼云盘页面按 F12
2. 切换到 Console 标签
3. 复制工具页面提供的代码并运行
4. 自动复制到剪贴板

#### 方式三：手动复制
1. F12 → Application → Cookies → cloud.189.cn
2. 手动复制关键 Cookie

### 2. 账号密码登录 ✅

**实现细节**:
- 使用现代 portal/open.e.189.cn 登录链路
- RSA 加密密码（{NRP} 前缀）
- 严格 session 验证
- 结构化错误返回

**限制**:
- 天翼云会触发验证码/风控
- 不适合自动化场景
- 建议作为备用方案

### 3. 验证码交互界面 🚧

**前端已实现**:
- 验证码显示区域
- 验证码输入框
- 刷新验证码功能
- 提交验证码功能

**后端待实现**:
- 获取验证码图片 URL
- 提交验证码登录
- 刷新验证码

## 推荐使用方案

### 方案 A：Cookie 方式（推荐）⭐

**优点**:
- 稳定可靠，不触发风控
- 一次获取，长期有效（7-30天）
- 操作简单，有工具辅助

**步骤**:
1. 访问 Cookie 获取工具页面
2. 使用书签或控制台代码获取 Cookie
3. 粘贴到系统配置
4. 保存并连接

**适用场景**:
- 自动备份
- 长期使用
- 稳定性要求高

### 方案 B：账号密码 + Cookie 组合

**配置**:
- 同时配置账号密码和 Cookie
- 系统优先使用 Cookie
- Cookie 失效时尝试账号密码
- 遇到验证码时提示重新获取 Cookie

**适用场景**:
- 需要自动恢复登录
- Cookie 可能过期的场景

### 方案 C：验证码交互（开发中）

**说明**:
- 前端界面已完成
- 后端接口待实现
- 需要处理验证码刷新、提交等逻辑

**复杂度**:
- 需要维护登录会话状态
- 需要处理验证码过期
- 用户体验相对复杂

## 文件清单

### 前端
- `frontend/src/views/backup/components/CloudBackupTab.vue` - 云备份配置界面
- `frontend/public/get-ctyun-cookie.html` - Cookie 获取工具页面

### 后端
- `backend/src/services/ctyun.service.js` - 天翼云服务核心逻辑
- `backend/src/services/cloud-backup.service.js` - 云备份服务
- `backend/src/routes/cloud-backup.routes.js` - 云备份路由
- `backend/config/ctyun-config.json` - 天翼云配置文件
- `backend/CTYUN_COOKIE_GUIDE.md` - Cookie 获取指南

## 下一步建议

### 优先级 1：完善 Cookie 工具
- ✅ 书签工具
- ✅ 控制台代码
- ✅ 工具页面
- ⬜ 添加使用说明视频/动图

### 优先级 2：验证码交互（可选）
- ✅ 前端 UI
- ⬜ 后端获取验证码接口
- ⬜ 后端提交验证码接口
- ⬜ 验证码刷新逻辑

### 优先级 3：用户体验优化
- ⬜ Cookie 有效期提醒
- ⬜ 自动检测 Cookie 失效
- ⬜ 登录状态实时显示
- ⬜ 备份成功率统计

## 技术要点

### Cookie 格式
```
COOKIE_LOGIN_USER=xxx; SESSION_KEY=xxx; UID=xxx
```

### 关键 Cookie 字段
- `COOKIE_LOGIN_USER` - 用户登录标识
- `SESSION_KEY` - 会话密钥
- `UID` - 用户 ID
- `FAMILY_SESSION_KEY` - 家庭云会话（可选）

### 登录优先级
1. 检查已保存的 Cookie
2. 使用 Cookie 验证 session
3. Cookie 无效时尝试账号密码登录
4. 遇到验证码返回错误提示

### 错误码
- `CTYUN_COOKIE_VALID` - Cookie 有效
- `CTYUN_COOKIE_INVALID` - Cookie 无效
- `CTYUN_RISK_CONTROL` - 触发风控
- `CTYUN_CAPTCHA_REQUIRED` - 需要验证码
- `CTYUN_ACCOUNT_PASSWORD_ERROR` - 账号密码错误

## 常见问题

### Q: Cookie 多久过期？
A: 通常 7-30 天，取决于天翼云的策略。系统会在 Cookie 失效时提示重新获取。

### Q: 为什么账号密码登录失败？
A: 天翼云检测到非浏览器环境会触发验证码。建议使用 Cookie 方式。

### Q: Cookie 安全吗？
A: Cookie 存储在本地服务器，仅用于天翼云盘连接。请勿分享给他人。

### Q: 可以同时配置多个账号吗？
A: 当前版本仅支持单账号。如需多账号，需要修改配置文件结构。

## 更新日志

### 2026-04-06
- ✅ 实现账号密码登录（portal/open.e.189.cn 链路）
- ✅ 实现 RSA 密码加密
- ✅ 实现严格 session 验证
- ✅ 实现结构化错误返回
- ✅ 创建 Cookie 获取工具页面
- ✅ 添加验证码交互前端界面
- ✅ 优化前端错误提示
- ✅ 添加 Cookie 配置支持
