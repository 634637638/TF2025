# 日志系统规范文档

> **文档版本**: v1.1.0
>
> **最后更新**: 2026-04-11
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
| 统一入口 | `frontend/src/utils/logger.ts` | 环境控制、组件日志、错误上报 | ✅ 是 |
| 错误系统 | `error-logger.ts` | 错误收集、统计分析、上报服务 | 按需使用 |

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
└── error-logger.ts  # 错误上报系统（按需使用）
```

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

| 环境 | 日志级别 | 控制台输出 | 上报服务器 |
|------|---------|-----------|-----------|
| `development` | debug | ✅ 输出 | ❌ 禁用 |
| `production` | none | ❌ 禁用 | ✅ 启用 |

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
- [CLAUDE.md](../../CLAUDE.md) - 开发规范

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
