# 环境配置与密钥管理

## 后端环境文件

后端环境文件可能包含数据库地址、用户名和密码、JWT 密钥、会话密钥及第三方服务凭据，均属于敏感信息。全局固定约定如下：

- 本地开发环境只使用 `backend/.env`。
- 云端生产环境只使用云端服务器本机的 `backend/.env.production`，并由 PM2 设置 `ENV_FILE=.env.production`。
- 测试环境使用忽略提交的专用文件（如 `backend/.env.test`），必须通过测试入口显式指定；不能回退读取开发或生产文件。

本地 `.env` 与云端 `.env.production` 的数据库地址、密钥和运行模式可以不同，禁止把任一真实文件整份复制覆盖另一环境。需要同步新增变量时，只按 `backend/.env.example` 和本文件的变量清单逐项补充，并在目标环境生成独立密钥。这些文件只保存在对应运行环境的服务器或开发机上，不得提交到 Git、上传到前端静态目录、粘贴到工单或聊天记录，也不要在日志和终端记录中打印完整内容。仓库只保留 `backend/.env.example` 作为不含真实凭据的变量名模板。

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

之后只在服务器本机编辑 `.env.production` 并填入实际值。PM2 配置通过 `ENV_FILE=.env.production` 加载该文件；云端不得改用 `backend/.env`，也不要把真实配置复制进仓库中的 PM2 文件。

## 前端环境文件

`frontend/.env.production` 用于构建前端。`VITE_` 前缀变量会被编译进浏览器可下载的静态资源，因此只能放公开配置，例如 API 地址、页面标题或公开地图 Key；不能放数据库密码、JWT 密钥、私有令牌或其他后端凭据。商城配置页也支持维护 `tencent_map_key`，它同样是浏览器公开 Key；必须在腾讯地图控制台配置域名白名单，不能填写服务端私钥。

微信支付 API v3 Key、商户私钥和支付宝应用私钥属于后端秘密。生产环境需在后端 `.env.production` 设置独立的 `CONFIG_ENCRYPTION_KEY`；运行时不再回退到 `JWT_SECRET`。轮换时把旧值暂存到 `CONFIG_ENCRYPTION_PREVIOUS_KEY`，应用会用 current 写入、用 current 和 previous 读取，再通过 `npm --prefix backend run migrate:config-encryption-key` 预览并追加 `-- --apply` 重加密存量支付秘密。脚本保留一步回滚备份并使用条件更新防止覆盖并发修改。详细边界见[商城地图与支付服务配置](../backend/shop-provider-config-standard.md)。

## 密钥用途隔离与平滑轮换

后端密钥按用途隔离，不能把一个密钥复制给多个 current 变量：

环境变量不支持安全的实时热更新。签名密钥通过 current/previous 实现“业务不中断的平滑轮换”，修改目标环境文件后仍需重启后端进程才能生效；前端不需要重新构建或重启。数据库加密密钥还必须先完成密文迁移，不能把“支持轮换”理解为可直接覆盖。

| 用途 | 当前密钥 | 上一密钥 | 最短兼容窗口 |
| --- | --- | --- | --- |
| 登录访问令牌 | `JWT_SECRET` | `JWT_PREVIOUS_SECRET` | 当前最长访问令牌有效期（30 天） |
| 刷新令牌 | `JWT_REFRESH_SECRET` | `JWT_REFRESH_PREVIOUS_SECRET` | 刷新令牌有效期（默认 30 天） |
| 私有文件签名 | `FILE_ACCESS_SIGNING_KEY` | `FILE_ACCESS_PREVIOUS_SIGNING_KEY` | 10 分钟 |
| 订单访问凭证 | `ORDER_ACCESS_SIGNING_KEY` | `ORDER_ACCESS_PREVIOUS_SIGNING_KEY` | 24 小时 |
| 库存查询凭证 | `INVENTORY_QUERY_SIGNING_KEY` | `INVENTORY_QUERY_PREVIOUS_SIGNING_KEY` | 10 分钟 |
| 支付配置密文 | `CONFIG_ENCRYPTION_KEY` | `CONFIG_ENCRYPTION_PREVIOUS_KEY` | 完成存量重加密和回滚观察期 |
| 价格同步密文 | `PRICE_SYNC_ENCRYPTION_KEY` | 仅轮换脚本临时变量 | 完成数据库重加密和验证 |

首次从旧版单一 JWT 密钥升级时，在服务器对应环境文件执行：

```bash
npm --prefix backend run setup:security-keys -- --env-file=.env.production
npm --prefix backend run setup:security-keys -- --env-file=.env.production --apply
chmod 600 backend/.env.production
```

脚本只补齐缺失变量，不覆盖已有值，也不输出密钥内容。首次生成的各类 previous 会保存升级前的 `JWT_SECRET`，因此旧刷新令牌、旧文件链接、旧订单凭证及旧支付密文在兼容窗口内仍可验证。部署并重启后，先预览再迁移支付密文：

```bash
npm --prefix backend run migrate:config-encryption-key -- --env-file=.env.production
npm --prefix backend run migrate:config-encryption-key -- --env-file=.env.production --apply
```

确认读写正常并超过回滚观察期后才能清空 `CONFIG_ENCRYPTION_PREVIOUS_KEY`。本地开发使用 `backend/.env` 时可以省略 `--env-file`；云端生产必须使用 `--env-file=.env.production` 或进程级 `ENV_FILE=.env.production`，不能省略后依赖默认开发文件。

后续轮换无数据库状态的签名密钥时，使用：

```bash
npm --prefix backend run rotate:signing-key -- --scope=jwt-access
npm --prefix backend run rotate:signing-key -- --scope=jwt-access --apply
```

可用 scope 为 `jwt-access`、`jwt-refresh`、`file-access`、`order-access` 和 `inventory-query`。脚本把 current 移入 previous 并生成新 current；重启后端即可，不需要重启或重新构建前端。达到表中兼容窗口后再清空 previous 并重启。支付配置和价格同步属于数据库加密密钥，禁止用该脚本或直接覆盖环境变量，必须先完成对应数据库迁移。

`SESSION_SECRET` 当前只保留为未来服务端会话配置，项目没有启用 `express-session`，修改它不会使现有 JWT 失效。若以后启用服务端 Session，必须另行定义会话失效和双密钥轮换策略，不能假定与当前行为相同。

价格同步站点的登录密码使用独立的 `PRICE_SYNC_ENCRYPTION_KEY` 加密。该变量至少 32 个字符，生产环境缺失或长度不足时应用拒绝启动；推荐使用以下命令生成并只写入服务器的 `.env.production`：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

新密文采用 AES-256-GCM 和 `enc:v2:` 版本前缀。密钥必须稳定备份，不能直接轮换；需要轮换时先提供逐条解密、重加密和回读验证迁移。旧 CBC 密文迁移使用 `npm --prefix backend run migrate:price-sync-encryption` 预览，再临时通过进程环境提供旧口令和盐并追加 `-- --apply`；旧口令和盐不得写入脚本、文档或仓库。迁移脚本会把旧密文使用新密钥再次包裹后保存到迁移备份表，未发生后续密码修改时可使用 `-- --rollback` 恢复。

如果 `PRICE_SYNC_ENCRYPTION_KEY` 被粘贴到聊天、工单、日志或其他非密钥管理渠道，应立即视为泄露，不能只删除消息后继续使用。仓库提供 `npm --prefix backend run rotate:price-sync-encryption-key`：默认只读预览，临时设置 `PRICE_SYNC_NEXT_ENCRYPTION_KEY` 并追加 `-- --apply` 后，脚本会重加密业务密文、重包裹历史迁移备份并保留轮换回滚记录。新密钥不得作为命令字面量写入 Shell 历史；轮换成功后应立即更新所有运行环境并重启。紧急回滚需要当前新密钥和临时注入的 `PRICE_SYNC_PREVIOUS_ENCRYPTION_KEY`，数据库恢复后还必须把应用环境切回上一密钥。

## 发现密钥误提交时

停止继续传播相关提交，立即轮换所有可能暴露的凭据，并检查 CI 日志、部署包和 Git 历史的访问范围。不要只删除当前文件或追加 `.gitignore` 后就认为密钥已安全。
