# 全局时间工具与日期格式规范

## 适用范围

本规范适用于前端所有页面、组件、组合式函数、状态仓库、导出和接口参数。时间处理必须区分：

- **业务日期**：订单日期、考勤日期、退库时间、日期范围、报表月份等会影响业务含义的值。
- **机器时间**：接口时间戳、缓存过期时间、性能耗时、请求去重、动画和手势计时。

## 唯一公共入口

业务时间处理统一使用：

- `frontend/src/utils/time.ts`
- `TimeUtil`
- `TIME_FORMATS`
- `useTime()`
- `frontend/src/utils/format.ts` 中的 `formatDateTime`、`formatDate`、`formatTime` 和 `formatRelativeTime`

上述 `formatDate`、`formatDateTime`、`formatTime` 是页面显示日期时间的首选入口：入参接受 `string | Date | number | null | undefined`，内部已完成北京时间解析、非法值兜底，并支持 `fallback`（空值/非法兜底文本，默认 `'-'`）与 `format`（`formatDateTime` 的展示精度，默认 `TIME_FORMATS.DATETIME`）参数。

`TimePlugin` 已在 `frontend/src/main.ts` 全局注册，模板可以使用全局时间能力；新增代码优先直接导入 `TimeUtil` 和 `TIME_FORMATS`，不要在页面内重新创建 dayjs 配置或时区配置。

业务组件里的局部格式化函数只允许作为展示适配层，并必须委托给上述公共工具。公共 `format.ts` 已内置空值与非法值兜底，**不得再为“处理 null/空串”包一层纯透传包装**（如 `const formatDate = (d) => d ? formatGlobalDate(d) : '-'`）——直接调用公共函数即可。仅以下情形允许保留局部适配：需要非默认兜底文案（如 `''`、“未知”）、需要指定 `TIME_FORMATS` 精度（如 `DATETIME_MINUTE`）、或业务专有语义（时区修正如 `formatWholesaleDate`、时长/相对时间换算）；这些适配仍必须委托公共工具，不得自行初始化 Day.js、构造时区格式器或复制日期运算。Element Plus 日期控件需要原生 `Date` 时，使用 `TimeUtil.toDatePickerValue()` 适配日历字段，业务值仍保持 `TIME_FORMATS` 定义的字符串。

所有 Vue 页面和组件中的日期控件 `format`、`value-format` 属性必须绑定公共格式，例如 `:format="TIME_FORMATS.DATE"` 和 `:value-format="TIME_FORMATS.DATE"`。禁止在模板属性或绑定表达式中重复写日期格式字面量；新增格式先扩展 `TIME_FORMATS`，再由所有页面引用。日期控件作为共享组件时也遵循同一要求，不以“只是显示格式”为由豁免。

存储服务、错误边界和日志发送等基础设施同样必须使用 `TimeUtil.toISOString()`；机器时间属于公共时间规范范围，不因为“不显示在页面”而绕过统一入口。

当前业务时区固定为 `Asia/Shanghai`（北京时间）。前端显示、日期范围计算和日期-only 表单值都必须按该时区解释。

## 格式来源

常用格式只能从 `TIME_FORMATS` 读取：

| 用途 | 格式 |
| --- | --- |
| 日期字段和日期范围参数 | `TIME_FORMATS.DATE` |
| 需要保持旧界面非补零显示时 | `TIME_FORMATS.DATE_UNPADDED` |
| 紧凑文件名日期 | `TIME_FORMATS.DATE_COMPACT` |
| 时间显示 | `TIME_FORMATS.TIME` |
| 紧凑文件名时间 | `TIME_FORMATS.TIME_COMPACT` |
| 页面日期时间 | `TIME_FORMATS.DATETIME`、`TIME_FORMATS.DATETIME_SHORT` |
| `datetime-local` 输入值 | `TIME_FORMATS.DATETIME_LOCAL` |
| 接口、日志、导出机器值 | `TimeUtil.toISOString()` |
| 中文显示 | `TIME_FORMATS.DISPLAY`、`TIME_FORMATS.DISPLAY_DATE` |

新增业务格式先补充到 `TIME_FORMATS`，调用方再引用其值，不能直接传自定义格式字面量。公共适配层确需接收动态格式时，应核对调用来源并经过专项审查，不在页面绕过格式审计。

## 日期输入和接口值

- 日期-only 字符串（例如 `2026-09-30`）是日历日期，不是 UTC 时间戳；使用 `TimeUtil.toDateInputValue()` 或 `TimeUtil.format()`，不得直接经过 `toISOString()`。
- `el-date-picker`、`el-date-range-picker` 和 `datetime-local` 的提交值必须使用统一格式，日期范围的开始和结束由 `TimeUtil.startOf()`、`TimeUtil.endOf()` 或 `TimeUtil.add()` 计算。
- ISO 8601 只用于机器数据传输、日志和导出。使用 `TimeUtil.toISOString()`，不要把带 `Z` 的字符串当作北京时间显示值。
- 页面显示使用 `formatDateTime()`、`formatDate()`、`formatTime()` 或 `TimeUtil.getFriendlyTime()`，不要直接调用浏览器本地化日期 API。

## 允许的技术计时

`Date.now()` 可以用于缓存 TTL、请求去重、性能统计、动画/手势时长、限流窗口、随机 ID 和文件名唯一性。这些场景不属于业务日期显示，不需要强行转换为 `TimeUtil`。

如果 `Date.now()` 的值会进入订单、考勤、库存、付款、提醒或报表等业务字段，应改用 `TimeUtil.now()`、`TimeUtil.toISOString()` 或明确的 `TIME_FORMATS` 格式。

## 禁止事项

- 禁止业务代码直接使用 `new Date()` 进行日期展示、日期范围计算或业务字段赋值。
- 禁止使用 `toLocaleDateString()`、`toLocaleString()` 作为业务日期显示。
- 禁止使用 `.toISOString()` 生成日期-only 表单值或页面显示值。
- 禁止在业务页面直接复制 `YYYY-MM-DD`、`YYYYMMDD`、`HH:mm:ss` 等公共格式；统一登记到 `TIME_FORMATS`。向 `formatDateTime()`、`formatDate()`、`formatTime()` 等格式化调用的格式参数位传入硬编码格式串同样禁止，必须传 `TIME_FORMATS` 常量。
- 禁止把公共 `format.ts` 已覆盖的空值/非法兜底再包成一层纯透传本地函数；需要不同兜底或精度时按“展示适配层”规则委托，不复制兜底判断。
- 禁止在业务模块重新设置 dayjs 时区、locale 或插件。

`Date.now()`、`new Date()` 和原生 `Date` 比较仅可用于技术计时；涉及业务日期字段、日期范围和日期-only 值时必须使用 `TimeUtil`。日期控件所需的原生 `Date` 只能经 `TimeUtil.toDatePickerValue()` 转换。审计会检查日期格式字面量、`TimeUtil.format()` 的自定义格式、向任何名称含 `format` 的格式化调用传入的硬编码日期格式参数、日期-only 字段传入原生 `Date`、浏览器本地化日期 API 和直接 `.toISOString()`。

## 示例

```ts check
import { TIME_FORMATS, TimeUtil } from '@/utils/time'

export const today = TimeUtil.nowFormatted(TIME_FORMATS.DATE)
export const localInput = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME_LOCAL)
export const exportTime = TimeUtil.toISOString()
export function displayTime(createdAt: string): string {
  return TimeUtil.format(createdAt, TIME_FORMATS.DATETIME)
}
export const monthStart = TimeUtil.format(TimeUtil.startOf(TimeUtil.now(), 'month'), TIME_FORMATS.DATE)
```

## 验证

```bash
cd frontend
npm run check:time
npm run check:standards
```

`check:time` 会递归检查 Vue、TS、TSX、JS 和 JSX 源码，包含 Vue 模板中的日期控件格式属性；同时检查直接日期格式化、名称含 `format` 的格式化调用参数位硬编码格式串、本地化日期 API、日期-only 字段传入原生 `Date` 和直接 `.toISOString()`。`ref('YYYY-MM-DD')` 等配置初始值不属于格式化调用，不会被误报。技术计时类 `Date.now()` 不会被误报。新增业务日期处理后必须先通过该检查，再运行类型检查和构建。
