# 天翼云盘 Cookie 获取指南

## 问题说明

账号密码登录可能因为天翼云的风控机制而失败（即使账号密码正确）。这种情况下，可以使用浏览器 Cookie 作为替代方案。

## 获取 Cookie 步骤

### 1. 在浏览器中登录天翼云盘

1. 打开浏览器（推荐 Chrome 或 Edge）
2. 访问：https://cloud.189.cn
3. 使用账号密码正常登录
4. 确保登录成功，能看到云盘主页

### 2. 打开开发者工具

- Windows/Linux: 按 `F12` 或 `Ctrl + Shift + I`
- Mac: 按 `Cmd + Option + I`

### 3. 获取 Cookie

#### 方法一：从 Application 面板获取（推荐）

1. 点击开发者工具顶部的 `Application` 标签
2. 左侧展开 `Cookies` → `https://cloud.189.cn`
3. 找到以下关键 Cookie（复制 Value 列的值）：
   - `COOKIE_LOGIN_USER`
   - `SESSION_KEY`
   - `UID`
   - `FAMILY_SESSION_KEY`（如果有）

4. 按以下格式组合（用分号和空格分隔）：
   ```
   COOKIE_LOGIN_USER=xxx; SESSION_KEY=xxx; UID=xxx
   ```

#### 方法二：从 Network 面板获取

1. 点击开发者工具顶部的 `Network` 标签
2. 刷新页面（F5）
3. 找到任意一个请求到 `cloud.189.cn` 的请求
4. 点击该请求，查看右侧 `Headers` 标签
5. 找到 `Request Headers` 部分的 `Cookie` 字段
6. 复制完整的 Cookie 值

### 4. 配置到系统

#### 方法一：通过前端界面配置

1. 打开云端备份页面
2. 在"天翼云盘配置"卡片中
3. 点击"使用 Cookie 登录"（如果有此选项）
4. 粘贴复制的 Cookie

#### 方法二：直接修改配置文件

编辑 `backend/config/ctyun-config.json`：

```json
{
  "account": "13207903333",
  "password": "qq636363",
  "uploadPath": "/TF2025备份",
  "cookies": "COOKIE_LOGIN_USER=xxx; SESSION_KEY=xxx; UID=xxx",
  "lastLogin": null
}
```

### 5. 测试连接

1. 保存配置后
2. 点击"保存并连接"按钮
3. 系统会优先使用 Cookie 进行验证

## Cookie 有效期

- 天翼云盘的 Cookie 通常有效期为 7-30 天
- 如果 Cookie 过期，需要重新获取
- 建议定期更新 Cookie 或使用自动备份功能

## 安全提示

- Cookie 包含登录凭证，请妥善保管
- 不要将 Cookie 分享给他人
- 配置文件应设置适当的文件权限（仅当前用户可读）

## 故障排查

### Cookie 无效

- 确认 Cookie 是从登录后的页面获取的
- 确认 Cookie 格式正确（键值对用分号分隔）
- 尝试重新登录浏览器并获取新的 Cookie

### 仍然无法连接

- 检查网络连接
- 确认天翼云盘服务正常
- 查看后端日志获取详细错误信息
