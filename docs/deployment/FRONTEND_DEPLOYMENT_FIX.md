# 前端部署完整指南 - 解决 502 错误

## 问题诊断

您看到的是：
```
Request URL: http://182.140.180.74:50124/api/auth/login
Status Code: 502 Bad Gateway
```

**根本原因**：浏览器正在加载旧的、包含硬编码 URL 的前端文件。

---

## 解决步骤

### 步骤 1：清理并重新构建前端

在本地执行：

```bash
# 1. 进入前端目录
cd /Users/imac/Desktop/webtset/TF2025/frontend

# 2. 清理旧的构建文件
rm -rf dist/

# 3. 重新构建
npm run build

# 4. 验证构建结果（应该不包含 182.140.180.74）
grep -r "182.140.180.74" dist/
# 如果没有输出，说明构建正确
```

### 步骤 2：部署到服务器

**选项 A：使用宝塔面板**
1. 压缩 dist 目录为 `dist.zip`
2. 在宝塔面板中上传到网站根目录
3. 解压并覆盖现有文件

**选项 B：使用 SCP 命令**
```bash
scp -r dist/* root@10.2.3.24:/www/wwwroot/10.2.3.24/
```

### 步骤 3：清除浏览器缓存

**重要**：必须强制刷新浏览器缓存

1. **Chrome/Edge**：
   - 按 `Ctrl + Shift + R` (Windows) 或 `Cmd + Shift + R` (Mac)
   - 或者按 `F12` 打开开发者工具，右键点击刷新按钮，选择「清空缓存并硬性重新加载」

2. **或者在隐私/无痕模式下测试**

### 步骤 4：验证部署

1. 打开浏览器开发者工具（F12）
2. 访问 `http://10.2.3.24`
3. 在「Network」标签中查看请求

**正确的请求应该是：**
```
Request URL: http://10.2.3.24/api/auth/login
```

**而不是：**
```
Request URL: http://182.140.180.74:50124/api/auth/login
```

---

## 宝塔面板 Nginx 配置

在宝塔面板中配置网站 `10.2.3.24`：

1. 点击「设置」→「配置文件」
2. 找到 `location /api/` 部分，修改为：

```nginx
# API 代理到后端（使用 IP 地址）
location /api/ {
    proxy_pass http://182.106.85.74:30000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;
    client_max_body_size 10M;
}
```

3. 保存配置
4. 重载 Nginx（在软件商店 → Nginx → 重载配置）

---

## 后端 CORS 配置

在后端服务器 `v4.cn9527.cn` 上：

1. 编辑 `.env.production`：
```bash
ALLOWED_ORIGINS=http://10.2.3.24,*
```

2. 重启后端服务：
```bash
pm2 restart TF2025-backend
```

---

## 快速诊断清单

- [ ] 已重新构建前端（`npm run build`）
- [ ] 构建文件中不包含硬编码 IP（`grep -r "182.140.180.74" dist/` 无结果）
- [ ] 已将新的 dist 文件部署到服务器
- [ ] 已在宝塔面板中更新 Nginx 配置
- [ ] 已重载 Nginx 配置
- [ ] 已清除浏览器缓存（强制刷新）
- [ ] 请求 URL 变为 `http://10.2.3.24/api/...`（而不是 `50124` 端口）

---

## 如果问题仍然存在

1. **检查 Nginx 错误日志**：
   ```bash
   tail -f /www/wwwlogs/10.2.3.24.error.log
   ```

2. **测试 API 代理**：
   ```bash
   curl -I http://10.2.3.24/api/health
   ```

3. **检查 dist/index.html**：
   - 确认其中的 JS/CSS 引用路径正确
   - 确认文件是最新构建的（查看修改时间）

4. **完全清除浏览器数据**：
   - 清除所有缓存、Cookie、网站数据
   - 或者使用其他浏览器/隐私模式测试
