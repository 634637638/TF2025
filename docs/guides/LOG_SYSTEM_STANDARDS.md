# 日志系统规范文档

> **文档版本**: v1.1.0
>
> **最后核实日期**: 2026-11-13
>
> **维护者**: TF2025 开发团队

---

## 一、日志系统架构

### 1.1 分层结构

```
┌─────────────────────────────────────────────────────────────────┐
│                        业务层 (Service/Controller)              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  使用 log.ts / logger.ts 记录日志                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      统一日志入口层                               │
│  ┌───────────────────┐          ┌───────────────────┐          │
│  │ backend/src/utils/│          │  frontend/src/utils/│         │
│  │     log.js        │          │     logger.ts       │         │
│  │                   │          │                    │          │
│  │  - info()         │          │  - info()          │          │
│  │  - error()        │          │  - error()         │          │
│  │  - warn()         │          │  - warn()          │          │
│  │  - debug()        │          │  - debug()         │          │
│  │  - success()      │          │  - createLogger()  │          │
│  │  - fail()         │          │                    │          │
│  │  - start()        │          │                    │          │
│  │  - done()         │          │                    │          │
│  │  - db()           │          │                    │          │
│  │  - api()          │          │                    │          │
│  └───────────────────┘          └───────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      底层日志引擎层                               │
│  ┌───────────────────┐          ┌───────────────────┐          │
│  │ backend/src/utils/│          │ frontend/src/utils/│         │
│  │    logger.js      │          │   error-logger.ts  │         │
│  │  - Winston 配置    │          │                   │          │
│  │  - 文件写入        │          │  - 错误收集       │          │
│  │  - 日期分割        │          │  - 上报服务       │          │
│  │  - 级别过滤       │          │  - 统计分析       │          │
│  └───────────────────┘          └───────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 职责说明

| 层级 | 文件 | 职责 | 业务层是否直接使用 |
|------|------|------|-------------------|
| 底层引擎 | `backend/src/utils/logger.js` | Winston 配置、文件写入、分级控制 | ❌ 否 |
| 统一入口 | `backend/src/utils/log.js` | 便捷 API、格式化输出、语义化方法 | ✅ 是 |
| 统一入口 | `frontend/src/utils/logger.ts` | 环境控制、组件诊断日志，不发起网络上报 | ✅ 是 |
| 错误系统 | `error-logger.ts` | 全局错误收集、去重、统计和服务端上报 | 基础设施使用 |

---

## 二、后端日志规范 (Node.js)

### 2.1 文件位置

```
backend/src/utils/
├── logger.js   # ❌ 底层引擎，业务层不可直接使用
└── log.js      # ✅ 统一入口，业务层使用此文件
```

### 2.2 使用方式

```javascript
// ✅ 正确：使用 log.js 作为统一入口
const log = require('../utils/log');

// ❌ 错误：直接使用 logger.js
const logger = require('../utils/logger');
```

### 2.3 API 方法

#### 基础方法

| 方法 | 级别 | 说明 | 示例 |
|------|------|------|------|
| `log.info()` | info | 一般信息日志 | `log.info('用户登录成功', { userId })` |
| `log.error()` | error | 错误日志 | `log.error('数据库连接失败', error)` |
| `log.warn()` | warn | 警告日志 | `log.warn('配置缺失，使用默认值')` |
| `log.debug()` | debug | 调试日志（仅开发环境） | `log.debug('请求参数', params)` |

#### 语义化方法

| 方法 | 级别 | 说明 | 示例 |
|------|------|------|------|
| `log.success()` | info | 成功操作（带图标） | `log.success('订单创建成功')` |
| `log.fail()` | error | 失败操作（带图标） | `log.fail('订单创建失败')` |
| `log.start()` | info | 开始操作（带图标） | `log.start('数据同步开始')` |
| `log.done()` | info | 完成操作（带图标） | `log.done('数据同步完成')` |
| `log.db()` | debug | 数据库操作（带标签） | `log.db('查询用户表')` |
| `log.api()` | http | API 请求（带标签） | `log.api('调用价格接口')` |

### 2.4 使用示例

```javascript
const log = require('../utils/log');

class UserService {
  async login(username, password) {
    log.start('用户登录');  // 🚀 用户登录

    try {
      const user = await this.verifyUser(username, password);
      if (!user) {
        log.fail('用户认证失败');  // ❌ 用户认证失败
        return null;
      }

      log.success('用户登录成功', { userId: user.id });  // ✅ 用户登录成功
      return user;
    } catch (error) {
      log.error('登录异常', error);  // 错误日志
      throw error;
    }
  }

  async queryUsers(filters) {
    log.db('查询用户列表');  // [DB] 查询用户列表
    log.debug('查询条件', filters);

    const users = await this.userRepository.findAll(filters);
    log.info('查询完成', { count: users.length });

    return users;
  }
}
```

---

## 三、前端日志规范 (Vue3)

### 3.1 文件位置

```
frontend/src/utils/
├── logger.ts        # ✅ 统一入口，业务层使用此文件
└── error-logger.ts  # ✅ 唯一服务端错误上报系统
```

职责边界：

- `logger.ts` 只负责按环境输出诊断日志，不得维护上报地址、`fetch` 或私有 Axios 请求。
- `error-logger.ts` 是唯一服务端错误上报实现，通过 `unifiedApi` 调用 `/api/logs/errors`；立即上报与定时批量上报复用 `errors` 数组报文及失败处理，包含每条日志的 `count`。两者关闭全局 Loading、用户错误提示及重复错误上报（`reportError: false`），不失效业务缓存。上报失败只记录诊断警告，原日志保留等待后续上报；必须收到 `success: true` 且累计次数未在发送期间变化才标为已接收。同类错误再次发生进入下一批，服务端按递增次数去重，不把累计 count 直接当窗口内频次。
- 全局未捕获错误由 `ErrorBoundaryPlugin` 的 `onError` 转交 `globalErrorLogger`；API 错误由 `unified-api.ts` 转交。
- Error Boundary 只捕获、记录及转交错误，不保留独立网络上报、上报定时器或可重新开启的配置；由 `onError` 接入唯一 `globalErrorLogger`。退休的上报配置、未使用的配置修改方法不能恢复为第二套发送链路。
- `logger.error()` 不等同于服务端上报。业务代码通常只记录诊断信息；确需纳入监控的错误必须通过已有错误边界或统一请求层进入，不得另建上报器。
- 禁止页面、组件、store、service 自行请求 `/api/logs/errors`，避免同一错误重复上报。

### 3.2 使用方式

```typescript
// ✅ 正确：使用 logger.ts 作为统一入口
import { logger } from '@/utils/logger';

// ✅ 正确：创建组件专属日志
import { logger } from '@/utils/logger';
const componentLog = logger.createComponentLogger('UserLogin');

// ❌ 错误：使用 console.log
console.log('debug info');
```

### 3.3 API 方法

| 方法 | 说明 | 示例 |
|------|------|------|
| `logger.info()` | 一般信息 | `logger.info('加载完成')` |
| `logger.warn()` | 警告信息 | `logger.warn('配置缺失')` |
| `logger.error()` | 错误信息 | `logger.error('请求失败', error)` |
| `logger.debug()` | 调试信息（仅开发环境） | `logger.debug('数据', data)` |

### 3.4 组件日志器

```typescript
import { logger } from '@/utils/logger';

// 为组件创建专属日志器
const userLog = logger.createComponentLogger('UserProfile');

userLog.info('组件挂载');      // [ComponentName] 组件挂载
userLog.debug('数据加载中');    // [ComponentName] 数据加载中
userLog.error('加载失败', err); // [ComponentName] 加载失败
```

### 3.5 使用示例

```typescript
import { logger } from '@/utils/logger';

export default defineComponent({
  name: 'SalesOrderList',

  setup() {
    const loading = ref(false);

    const fetchOrders = async () => {
      logger.info('开始加载订单列表');

      try {
        loading.value = true;
        const data = await api.getOrders();

        logger.info('订单列表加载成功', { count: data.length });
        return data;
      } catch (error) {
        logger.error('订单列表加载失败', error);
        throw error;
      } finally {
        loading.value = false;
      }
    };

    return { fetchOrders };
  }
});
```

---

## 四、环境行为

### 4.1 后端日志行为

| 环境 | 日志级别 | 控制台输出 | 文件写入 |
|------|---------|-----------|---------|
| `development` | debug | ✅ 彩色输出 | ✅ 按日期分割 |
| `production` | info | ❌ 禁用 | ✅ 按日期分割 |

### 4.2 前端日志行为

| 环境 | 普通诊断日志 | 本地错误收集 | 上报服务器 |
|------|---------|-----------|-----------|
| 开发 / 测试等非生产构建 | 开发环境通过公共 `logger` 输出 | 保留当前页面会话记录 | 禁用，手动刷新上报、页面隐藏、退出和 critical 均不能开启发送 |
| 生产构建（`import.meta.env.PROD`） | 普通 `logger` 控制台输出关闭 | 保留当前页面会话记录 | 启用符合条件的技术故障上报，可显式关闭 |

环境以构建标识为准，不根据域名、端口或 API 指向判断。开发页面即使连接云端 API，也不能通过本上报器发送错误日志。非生产环境不能通过构造参数 `enabled: true` 绕过限制；本地记录不是服务端持久化，也不保证刷新页面后保留。

生产默认上报 `high` / `critical` 的 JavaScript、Vue、异步和网络技术故障；`critical` 可立即上报，其他候选每 30 秒批量发送。单次网络中断、超时或 HTTP 5xx 标为 `high`，不因一次请求失败自动认定为最高严重故障。取消请求不进入错误日志。

错误边界与统一请求层遵守同一分级原则：权限拒绝、登录过期不因错误文案直接升级为 `critical`；单次网络异常为 `high`。页面所需代码分块加载失败仍可判为严重故障，由统一上报器按环境及类型筛选。

### 错误上报接口的独立限流

`POST /api/logs/errors` 在 `unifiedAuth` 之后使用 `frontendErrorLogRateLimit`，每个认证用户ID与IP组合5分钟最多60次；IPv6地址由公共 `ipKeyGenerator` 按网段聚合。第61次返回 `429 / FRONTEND_ERROR_LOG_RATE_LIMIT_EXCEEDED` 及标准 `RateLimit-*`、`Retry-After` 头，限流后不进入日志持久化。未经认证的请求先返回401，不占用已登录用户额度；客户端请求体不能指定计数身份。全局限流仍保留，不能为测试专用额度而移除。

正式回归 `backend/test/frontend-error-rate-limit.check.js` 用真实Express路由、控制器与生产限流器发起本机HTTP请求，只替换认证结果和持久化。6项测试覆盖60/61边界、用户/IP隔离、未认证顺序、窗口恢复、IPv6同网段及并发，不连接数据库。该证据不替代真实JWT/CSRF、反向代理和生产部署验证；单实例内存限流的扩容边界沿用T9。

```bash
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/frontend-error-rate-limit.check.js
```

### 4.3 页面提示、日志与主动告警

- 必填遗漏、格式不合法、支付渠道无效、库存不足、权限不足等，沿用公共通知或表单校验提示当前操作人员。错误上报关闭不能关闭正常页面提示，也不能改变原请求的成功/失败结果。
- `permission` / `validation` / `business` 记录不外发；API 的 HTTP 4xx 记录也不外发，即使误标为高等级仍会过滤。后端必要的安全审计和业务日志独立保留。
- 技术故障与普通提示并存时，报文只包含通过筛选的错误，不附带全量错误统计中的普通提示摘要。开发控制台输出错误文案，不直接展开完整错误条目或响应上下文。
- 技术故障上报只表示送入站内错误日志接口，不等同于给负责人发送消息。上报失败不弹业务提醒、不递归上报，原日志保留以便后续重试。
- 用户已选择邮件作为主动告警渠道。生产后端通过唯一 `ErrorAlertService` 处理固定严重事件及高频聚合，默认关闭；开发/测试即使配置开关也不发送。高频默认在首事件起固定 5 分钟窗口至少 10 次且持续 30 秒；同组成功或重试耗尽后冷却 5 分钟，全局任意 5 分钟最多 5 次发送尝试（含重试）。
- 浏览器 `critical` 只作为聚合候选，不能立即发信；服务端按实际收到且 count 递增的报告计事件，过滤普通业务/权限/输入/4xx 及 API 重复转报。邮件只发送最小固定摘要和请求编号，SMTP 失败不影响业务。
- SMTP 配置、自检、有限重试、单实例内存队列边界及用户手动生产验收统一见[生产故障邮件告警](../backend/error-alerting.md)。T5 本地实现不能证明已部署或实际收件，进度只登记在[任务台账 T5](../development/TECHNICAL_DEBT_PROGRESS.md)；进程快速退出或整站离线仍需 T7 外部健康监控。

环境隔离、输入/权限拒绝过滤及统一上报行为回归：

```bash
npm --prefix frontend run test:unit -- tests/error-reporting-environment.spec.ts tests/error-reporting.spec.ts tests/error-boundary.spec.ts
```

---

## 五、日志文件管理

### 5.1 后端日志文件

```
backend/logs/
├── error-2026-04-11.log      # 错误日志（保留30天）
├── combined-2026-04-11.log   # 组合日志（保留14天）
├── api-2026-04-11.log       # API 日志（保留7天）
├── exceptions.log            # 未捕获异常
└── rejections.log           # Promise 拒绝
```

### 5.2 日志文件说明

| 文件 | 内容 | 保留时间 | 触发条件 |
|------|------|---------|---------|
| `error-*.log` | error 级别日志 | 30天 | level === 'error' |
| `combined-*.log` | 所有级别日志 | 14天 | 所有日志 |
| `api-*.log` | HTTP 请求日志 | 7天 | level === 'http' |
| `exceptions.log` | 未捕获异常 | 永久 | uncaughtException |
| `rejections.log` | 未处理 Promise | 永久 | unhandledRejection |

---

## 六、禁止事项

### 6.1 禁止使用

```javascript
// ❌ 禁止：直接使用原生 console
console.log('message');
console.info('message');
console.debug('message');

// ❌ 禁止：直接使用底层引擎
const logger = require('../utils/logger');

// ❌ 禁止：生产环境调试输出
if (process.env.NODE_ENV === 'production') {
  console.log('debug');  // 即使包裹也不允许
}
```

### 6.2 允许使用

```javascript
// ✅ 允许：错误日志（真实错误必须记录）
log.error('数据库连接失败', error);

// ✅ 允许：重要业务状态
log.info('用户登录成功', { userId: 123 });
log.success('订单创建成功');

// ✅ 允许：开发环境调试
if (process.env.NODE_ENV !== 'production') {
  log.debug('调试信息', data);
}
```

---

## 七、迁移指南

### 7.0 当前项目状态

- 后端 `backend/src/middleware`、`backend/src/utils`、`backend/src/services`、`backend/src/routes` 范围内，`console.*` 已完成清理。
- 当前统计结果为 `0`，后端核心目录已全部统一到 `backend/src/utils/log.js`。
- 后端业务代码统一使用 `backend/src/utils/log.js`。
- 前端业务代码统一使用 `frontend/src/utils/logger.ts`。

业务页面、组件、路由和服务不得直接调用 `console.*`，包括 `console.error`。底层日志适配器为实现输出可以调用原生 console，CLI/审计脚本可以输出检查结果；这些例外不得扩展为业务层捷径。清理临时调试输出不等于删除必要业务日志或统一入口中的有效 `debug` 记录。

### 7.1 从 console.log 迁移

```javascript
// ❌ 旧代码
console.log('用户登录成功');
console.log('错误:', error);
console.log('调试数据:', data);

// ✅ 新代码
log.info('用户登录成功');
log.error('操作失败', error);
log.debug('调试数据', data);
```

### 7.2 从 logger.js 迁移

```javascript
// ❌ 旧代码（直接使用底层引擎）
const logger = require('../utils/logger');
logger.info('message');
logger.error('message', error);

// ✅ 新代码（使用统一入口）
const log = require('../utils/log');
log.info('message');
log.error('message', error);
```

---

## 八、相关文档

- [代码审查标准](../guides/CODE_REVIEW_STANDARDS.md) - 日志检查项
- [Winston 官方文档](https://github.com/winstonjs/winston)
- [项目开发指引](../CLAUDE.md) - 开发规范

---

## 更新日志

### 2026-04-11 - v1.1.0

- 同步项目当前日志分层现状
- 修正统一入口与底层引擎的实际文件路径
- 记录后端核心目录 `console.*` 已完成清理，统计归零

### 2026-04-11 - v1.0.0

- 初始版本：明确日志分层架构
- 定义后端统一入口为 `log.js`
- 定义前端统一入口为 `logger.ts`
- 说明 `logger.js` 为底层引擎，不可直接使用
