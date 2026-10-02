# 环境配置与密钥管理

## 后端环境文件

后端环境文件可能包含数据库地址、用户名和密码、JWT 密钥、会话密钥及第三方服务凭据，均属于敏感信息：

- 本地运行配置：`backend/.env`
- 生产运行配置：`backend/.env.production`
- 其他后端环境配置：`backend/.env.*`

这些文件只保存在对应运行环境的服务器或开发机上，不得提交到 Git、上传到前端静态目录、粘贴到工单或聊天记录，也不要在日志和终端记录中打印完整内容。仓库只保留 `backend/.env.example` 作为不含真实凭据的变量名模板。

`.gitignore` 只能阻止尚未跟踪的文件被意外添加，不能让已经提交过的密钥从 Git 历史中消失。提交前可检查：

```bash
git check-ignore -v backend/.env backend/.env.production
git ls-files --error-unmatch backend/.env
```

第一条应显示忽略规则；第二条对未跟踪的私密文件应返回“未跟踪”错误。若真实凭据曾经提交或泄露，应立即在对应服务轮换凭据；仅添加忽略规则并不足以撤销泄露。

在服务器上创建生产配置并限制读取权限，例如：

```bash
cd /www/wwwroot/api2025.com/backend
cp .env.example .env.production
chmod 600 .env.production
```

之后在服务器本机编辑 `.env.production` 并填入实际值。PM2 配置通过 `ENV_FILE=.env.production` 加载该文件；不要把真实配置复制进仓库中的 PM2 文件。

## 前端环境文件

`frontend/.env.production` 用于构建前端。`VITE_` 前缀变量会被编译进浏览器可下载的静态资源，因此只能放公开配置，例如 API 地址、页面标题或公开地图 Key；不能放数据库密码、JWT 密钥、私有令牌或其他后端凭据。

## 发现密钥误提交时

停止继续传播相关提交，立即轮换所有可能暴露的凭据，并检查 CI 日志、部署包和 Git 历史的访问范围。不要只删除当前文件或追加 `.gitignore` 后就认为密钥已安全。
