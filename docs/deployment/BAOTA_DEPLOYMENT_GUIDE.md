# 宝塔前端站点部署说明

本文用于在宝塔管理的外部前端服务器上部署静态前端，并由 Nginx 将 API 和上传文件请求代理到家庭后端。它不代表服务器当前配置已生效；请以宝塔中实际加载的站点配置为准。

## 请求链路

```text
浏览器 --HTTPS--> 外部前端站点/Nginx --HTTP:3000--> 家庭后端 Node
```

后端 upstream 按外部前端服务器的网络可达性选择：

```nginx
# DDNS 可达
proxy_pass http://v4.cn9527.cn:3000/api/;

# 或者前端服务器可访问家庭 P2P 网络
# proxy_pass http://10.2.3.10:3000/api/;

# 如果前后端在同一服务器
# proxy_pass http://127.0.0.1:3000/api/;
```

Node 服务监听 `3000`。不要把 Nginx 可选的 `3001` 入口当作后端端口，也不要使用旧部署记录中的地址或端口。

## 配置步骤

1. 在宝塔面板打开前端网站配置，确认静态站点目录指向本次构建的 `frontend/dist` 内容。
2. 在站点配置的 `server` 块中合并仓库的 `nginx-frontend.conf`，不要直接覆盖宝塔生成的 TLS、证书和站点基础配置。
3. 确认 `/api/` 与 `/uploads/` 的 upstream 是从前端服务器实际可达的后端地址，且端口为 `3000`。
4. 确认 `/` 保留 Vue Router history fallback：`try_files $uri $uri/ /index.html;`。
5. 从 HTTPS 前端站点响应中检查 CSP 与 HSTS；如果 TLS 在宝塔之外终止，必须确认前置 HTTPS 入口没有移除这些响应头。HSTS 仅对 HTTPS 响应生效。
6. 检查并重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 后端来源配置

同源代理可以避免浏览器跨域，但后端仍可能依据 `Origin` 做来源校验。若启用了 `ALLOWED_ORIGINS`，只配置正式前端的准确 HTTPS origin，不要配置通配符或在 Nginx 反射任意请求的 `Origin`。

改动后端环境配置时，只在后端服务器本机修改 `backend/.env.production`，再按部署文档中的 PM2 配置重启。环境文件不得上传到前端站点或提交 Git。

## 验证

在前端服务器验证其到后端的网络连通性：

```bash
curl http://v4.cn9527.cn:3000/health
```

浏览器登录后，在开发者工具 Network 中确认 API 请求使用前端 HTTPS 域名下的 `/api/...`，而非浏览器直连家庭 HTTP 地址。再分别检查一个 `/uploads/...` 文件和一个 Vue history 路由。

遇到 `502` 时检查 Nginx error log 与前端服务器到所选后端地址 `:3000` 的连通性；遇到 `404` 时确认后端路由、`proxy_pass` 路径和前端发布内容。线上配置是否正确，最终以 HTTPS 页面实际响应与浏览器请求为准。
