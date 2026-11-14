# 生产故障邮件告警

本文说明 T5 邮件告警的触发规则、生产配置、人工验收和回退方式。日志分级以[日志系统规范](../guides/LOG_SYSTEM_STANDARDS.md)为准，当前进度统一登记[任务台账 T5](../development/TECHNICAL_DEBT_PROGRESS.md)。代码已提供，默认关闭；本地模拟通过不代表生产已启用或邮件已送达。

## 公共入口与触发规则

`backend/src/services/error-alert.service.js` 统一筛选、聚合和排队，`backend/src/utils/error-alert-mailer.js` 使用独立 SMTP 发送纯文本邮件，不携带站内 JWT、CSRF 或请求头。邮件仅含固定事件说明、接口末级模板、状态码、窗口内观察次数、北京时间及最多三个 request ID；不包含原始错误文案、堆栈、请求体、用户资料或认证凭据。路由注册身份仅散列参与 HTTP 分组，不读取或发送实际 URL；未匹配路由使用 `/unmatched`。

| 来源 | 触发条件 |
| --- | --- |
| 后端严重事件 | 启动数据库不可用、服务启动失败、未捕获异常、未处理 Promise 拒绝；由 `app.js` 固定事件入口提交，立即排队，仍受冷却和全局限频约束 |
| HTTP 5xx | `requestContext` 后挂载的响应观测中间件在 `finish` 后统计，包含控制器自行返回的 500；按方法、路由注册身份摘要、末级模板及状态码分组 |
| 浏览器技术故障 | 已认证的生产报告成功落库后，JavaScript/Vue/异步/网络 high 或 critical 候选按服务端实际接收事件聚合；客户端 critical 不能触发立即邮件 |
| 普通输入、业务、权限和 HTTP 4xx | 仅页面提示及必要本地/服务端日志，不发送告警邮件 |

高频组从首次事件起使用固定五分钟窗口，默认至少十次且首末事件相隔至少三十秒，在后续事件满足条件时排队；短时间爆发后停止不会仅因计时到期发送。同组发送成功或三次重试耗尽后冷却五分钟。全局任意五分钟最多五次发送尝试，包含失败与重试；超额任务延后，每次失败间隔三十秒，最多尝试三次。SMTP 每次总超时五秒并中止连接，失败只记固定诊断，不改变原业务响应或递归告警。

前端同一错误再次发生会在下一批更新累计次数；请求发送期间新增错误不会被旧响应误标为已上报。服务端按用户、会话与错误 ID 去重，只有累计次数递增才增加一个观察事件，不把浏览器累计 count 当作窗口频次；API 转报由后端 HTTP 观测负责，避免重复计数。环境标识来自客户端，不能证明报告真实性，故客户端候选只能走聚合且受全局限频限制。

## 生产配置

仅 `NODE_ENV=production`、`ERROR_ALERT_ENABLED=true` 且下列配置合法时启用。配置无效会禁用告警并写固定字段说明，业务继续运行。开发/测试环境即使开启开关也不会发送。

在后端服务器本机 `.env.production` 逐项添加，参考不含真实值的 `backend/.env.example`。禁止从本地整份覆盖生产配置，不要向聊天、日志或前端提供授权码。

| 变量 | 要求 |
| --- | --- |
| `ERROR_ALERT_ENABLED` | 默认 `false`，准备好生产配置后改为 `true` |
| `ERROR_ALERT_SMTP_HOST` | 邮箱服务商提供的 SMTP 主机名，不带协议或路径 |
| `ERROR_ALERT_SMTP_PORT` | `465`（默认，直接 TLS）或 `587`（强制 STARTTLS），校验证书且至少 TLS 1.2 |
| `ERROR_ALERT_SMTP_USER` | SMTP 登录账号，必填 |
| `ERROR_ALERT_SMTP_PASSWORD` | SMTP 专用授权码或服务商规定的认证密码，仅保留在服务器本机 |
| `ERROR_ALERT_FROM` | 一个发件邮箱地址，须符合服务商发信权限 |
| `ERROR_ALERT_TO` | 一至五个收件邮箱地址，以英文逗号分隔，不带显示名 |
| `ERROR_ALERT_THRESHOLD` | 默认 `10`，允许 `2` 至 `1000` 的整数，仅调整高频阈值 |

本轮引入 `nodemailer@10.5.0`，要求 Node.js 20 或更高版本。发布流程和单实例约束见[部署索引](../deployment/INDEX.md)，密钥保管见[环境配置与密钥管理](../security/ENVIRONMENT_SECRETS.md)。

## 用户手动发布与验收

前后端由用户自行上传，不自动部署。后端完整同步 `src/`、`scripts/check-error-alerts.js`、`package.json`、`package-lock.json` 及已有运行资源，保留生产本机环境文件、上传目录和日志。在服务器后端目录安装锁定依赖：

```bash
npm ci --omit=dev
npm run check:runtime-assets
npm run check:error-alerts -- --production
```

最后一条复用生产环境加载与校验，不启动应用、不连接数据库或 SMTP，也不发信。输出仅环境/开关状态、收件人数、阈值和 sent 标记，不输出收件地址或 SMTP 凭据；生产完整配置缺失、告警配置无效会失败。`enabled=false` 表示尚未启用，不算告警验收通过。

配置准备完成后，通过宝塔 PM2 的 `backend/start-production.js` 入口重启单实例。确认业务及 `/live`、`/health` 正常。用户准备好真实收件验收后，才在后端目录手动执行：

```bash
npm run check:error-alerts -- --production --send-test
```

该命令真实发出一封固定验收邮件，不触发业务错误、不写数据库。CLI 发送仅用于人工验收，不经过运行时聚合/冷却；不要循环执行。`sent=true` 仅表示所有收件地址已被 SMTP 接受，仍须收件人检查收件箱及垃圾箱并确认收到。无需制造生产故障测试；聚合、重试与权限过滤由下方模拟回归覆盖。

正式验收后，把部署日期、启用结果、实际收件结果登记 T5，再关闭任务。当前尚未执行生产配置、自检或真实发送，不得把本地通过视作生产闭环。

## 运行边界与回退

队列为单进程内存状态，最多五百个聚合组、两千个前端去重项、五十个待发任务；容量满会放弃新候选，重启清空计数及队列。扩容前须先完成 T9 共享状态改造，否则各实例可能重复发送并各自限频。

通知采用尽力发送：SMTP 部分拒收或超时后重试可能导致部分收件人重复收到，不能保证恰好一次。服务启动失败后立即退出、未捕获异常后快速退出、整机断电或网络故障时，邮件可能来不及发送；配置加载前的失败也无法经过本服务。T7 的独立外部健康监控仍必需，不能用本邮件服务替代整站离线监控。

回退时设置 `ERROR_ALERT_ENABLED=false` 并通过原入口重启后端即可；不涉及数据库迁移，不关闭页面提示或既有错误日志。需要回退代码时，按同一版本同步源码及依赖锁文件。

## 本地验证入口

模拟测试使用可控时钟、假 SMTP 和本地 loopback HTTP，不连接云端数据库、不发真实邮件：

```bash
RUN_DB_TESTS=false node --test backend/test/error-alerts.check.js backend/test/error-alert-mailer.check.js backend/test/error-alert-integration.check.js backend/test/frontend-error-reporting-contract.check.js backend/test/frontend-error-log-route.check.js backend/test/logging-security.check.js
npm --prefix frontend run test:unit -- tests/error-reporting-environment.spec.ts tests/error-reporting.spec.ts tests/error-boundary.spec.ts tests/api-loading.spec.ts tests/api-response.spec.ts tests/inventory-shop-cache.spec.ts
```

后端正式测试也已纳入 `npm --prefix backend test`。生产 SMTP 联通、真实投递、PM2 环境和浏览器实际故障恢复需要分别验收。
